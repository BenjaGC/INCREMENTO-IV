const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const readline = require('node:readline');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const TRACE_TABLES = [
    { name: 'audit_log', id: 'log_id', date: 'action_date' },
    { name: 'inc3_log', id: 'id', date: 'created_at' },
    { name: 'inc4_security_event', id: 'id', date: 'created_at' }
];
const PAGE_SIZE = 500;

function backupDirectory() {
    const directory = path.resolve(
        process.env.CLINICA_TRACE_BACKUP_DIR ||
            path.join(
                process.env.CLINICA_BACKUP_DIR ||
                    path.join(__dirname, '../../.local-backup'),
                'trazas'
            )
    );
    const publicDirectory = path.resolve(__dirname, '../../public');
    const relative = path.relative(publicDirectory, directory);
    if (
        !relative ||
        (!relative.startsWith('..') && !path.isAbsolute(relative))
    ) {
        throw Error('Los respaldos de trazas deben quedar fuera de public.');
    }
    return directory;
}

// Lee el archivo comprimido completo y compara las huellas de los registros antes de borrar.
async function verifyBackup(filename, expectedCount, expectedDigest) {
    const reader = readline.createInterface({
        input: fs.createReadStream(filename).pipe(zlib.createGunzip()),
        crlfDelay: Infinity
    });
    const digest = crypto.createHash('sha256');
    let count = 0,
        header = false;
    for await (const line of reader) {
        const entry = JSON.parse(line);
        if (entry.format === 'clinica-traces-v1') {
            header = true;
            continue;
        }
        if (
            !TRACE_TABLES.some((table) => table.name === entry.table) ||
            !entry.row
        )
            throw Error('Respaldo de trazas inválido.');
        digest.update(line + '\n');
        count++;
    }
    if (
        !header ||
        count !== expectedCount ||
        digest.digest('hex') !== expectedDigest
    ) {
        throw Error(
            'No se pudo verificar la integridad del respaldo de trazas.'
        );
    }
}

module.exports = function createTraceRetention({ pool, log, transporter }) {
    async function snapshot() {
        const [[policy]] = await pool.query(
            'SELECT * FROM inc4_retention_policy WHERE id=1'
        );
        const [[date]] = await pool.query(
            'SELECT DATE_SUB(NOW(),INTERVAL 2 YEAR) cutoff'
        );
        const counts = [];
        for (const table of TRACE_TABLES) {
            const [[count]] = await pool.query(
                `SELECT COUNT(*) total FROM ${table.name} WHERE ${table.date}<?`,
                [date.cutoff]
            );
            counts.push({ table: table.name, total: Number(count.total) });
        }
        const [runs] = await pool.query(
            'SELECT * FROM inc4_retention_run ORDER BY id DESC LIMIT 30'
        );
        return {
            policy,
            cutoff: date.cutoff,
            eligible: counts.reduce((total, row) => total + row.total, 0),
            counts,
            runs
        };
    }

    async function execute() {
        const db = await pool.getConnection();
        let runId,
            backup,
            acquired = false,
            committed = false;
        try {
            const [[lock]] = await db.query(
                "SELECT GET_LOCK(CONCAT(DATABASE(),':trace-retention'),0) acquired"
            );
            if (!lock.acquired)
                throw Object.assign(
                    new Error(
                        'El mantenimiento de trazas ya está en ejecución.'
                    ),
                    { status: 409 }
                );
            acquired = true;
            const [[policy]] = await db.query(
                'SELECT * FROM inc4_retention_policy WHERE id=1'
            );
            const [[date]] = await db.query(
                'SELECT DATE_SUB(NOW(),INTERVAL 2 YEAR) cutoff'
            );
            const [run] = await db.query(
                'INSERT INTO inc4_retention_run(cutoff) VALUES(?)',
                [date.cutoff]
            );
            runId = run.insertId;
            if (!policy?.enabled || policy.retention_years !== 2) {
                await db.query(
                    "UPDATE inc4_retention_run SET outcome='not_configured',finished_at=NOW(),summary=? WHERE id=?",
                    [
                        'No existe una política de retención habilitada. Se conservaron todos los registros.',
                        runId
                    ]
                );
                return { outcome: 'not_configured', removed: 0 };
            }
            await db.beginTransaction();
            const selected = {};
            const digest = crypto.createHash('sha256');
            let count = 0;
            const directory = backupDirectory();
            fs.mkdirSync(directory, { recursive: true });
            const filename = `trazas-${runId}-${crypto.randomBytes(8).toString('hex')}.jsonl.gz`;
            backup = path.join(directory, filename);
            const temporary = backup + '.partial';
            async function* records() {
                yield JSON.stringify({
                    format: 'clinica-traces-v1',
                    cutoff: date.cutoff,
                    created_at: new Date().toISOString()
                }) + '\n';
                for (const table of TRACE_TABLES) {
                    let after = 0;
                    selected[table.name] = [];
                    for (;;) {
                        const [rows] = await db.query(
                            `SELECT * FROM ${table.name} WHERE ${table.date}<? AND ${table.id}>? ORDER BY ${table.id} LIMIT ${PAGE_SIZE} FOR UPDATE`,
                            [date.cutoff, after]
                        );
                        if (!rows.length) break;
                        for (const row of rows) {
                            const line =
                                JSON.stringify({ table: table.name, row }) +
                                '\n';
                            digest.update(line);
                            selected[table.name].push(row[table.id]);
                            after = row[table.id];
                            count++;
                            yield line;
                        }
                    }
                }
            }
            try {
                await pipeline(
                    Readable.from(records()),
                    zlib.createGzip(),
                    fs.createWriteStream(temporary, {
                        flags: 'wx',
                        mode: 0o600
                    })
                );
                const file = await fs.promises.open(temporary, 'r+');
                try {
                    await file.sync();
                } finally {
                    await file.close();
                }
                await verifyBackup(temporary, count, digest.digest('hex'));
                if (!count) {
                    await db.rollback();
                    await fs.promises.unlink(temporary);
                    await db.query(
                        "UPDATE inc4_retention_run SET outcome='no_records',finished_at=NOW(),summary=? WHERE id=?",
                        [
                            'No hay trazas con más de dos años de antigüedad.',
                            runId
                        ]
                    );
                    return { outcome: 'no_records', removed: 0 };
                }
                await fs.promises.rename(temporary, backup);
                const fileDigest = crypto.createHash('sha256');
                for await (const chunk of fs.createReadStream(backup))
                    fileDigest.update(chunk);
                const sha256 = fileDigest.digest('hex');
                let removed = 0;
                for (const table of TRACE_TABLES) {
                    const ids = selected[table.name];
                    for (
                        let offset = 0;
                        offset < ids.length;
                        offset += PAGE_SIZE
                    ) {
                        const [deleted] = await db.query(
                            `DELETE FROM ${table.name} WHERE ${table.id} IN (?) AND ${table.date}<?`,
                            [ids.slice(offset, offset + PAGE_SIZE), date.cutoff]
                        );
                        removed += deleted.affectedRows;
                    }
                }
                if (removed !== count)
                    throw Error(
                        'La cantidad eliminada no coincide con el respaldo verificado.'
                    );
                await db.query(
                    "UPDATE inc4_retention_run SET outcome='completed',finished_at=NOW(),removed_rows=?,backup_name=?,backup_sha256=?,summary=? WHERE id=?",
                    [
                        removed,
                        filename,
                        sha256,
                        'Respaldo comprimido verificado. Se retiraron únicamente las trazas anteriores al límite de dos años.',
                        runId
                    ]
                );
                await db.commit();
                committed = true;
                return { outcome: 'completed', removed, run_id: runId };
            } catch (error) {
                await fs.promises.unlink(temporary).catch(() => {});
                throw error;
            }
        } catch (error) {
            if (!committed) await db.rollback().catch(() => {});
            if (runId)
                await db
                    .query(
                        "UPDATE inc4_retention_run SET outcome='failed',finished_at=NOW(),summary=? WHERE id=?",
                        [
                            'El mantenimiento falló. Se conservaron las trazas originales; revisa el registro técnico.',
                            runId
                        ]
                    )
                    .catch(() => {});
            await log(error, 'critical', { operation: 'trace-retention' });
            const [admins] =
                await pool.query(`SELECT DISTINCT u.institutional_email FROM user u JOIN user_role r ON r.user_id=u.user_id
                WHERE u.user_status=1 AND r.active=1 AND r.role_id=1`);
            for (const admin of admins) {
                try {
                    await transporter.sendMail({
                        from: process.env.MAIL_FROM || process.env.MAIL_USER,
                        to: admin.institutional_email,
                        subject: 'Mantenimiento de trazas interrumpido',
                        text: 'No se completó el respaldo de trazas. Los registros originales se conservaron. Revisa Mantenimiento de trazas y el registro técnico.'
                    });
                } catch (mailError) {
                    await log(mailError, 'error', {
                        operation: 'trace-retention-alert'
                    });
                }
            }
            throw error;
        } finally {
            if (acquired)
                await db
                    .query(
                        "SELECT RELEASE_LOCK(CONCAT(DATABASE(),':trace-retention'))"
                    )
                    .catch(() => {});
            db.release();
        }
    }

    function startScheduler() {
        const tick = async () => {
            try {
                const [[due]] = await pool.query(`SELECT p.enabled AND
                    NOT EXISTS(SELECT 1 FROM inc4_retention_run WHERE started_at>DATE_SUB(NOW(),INTERVAL 1 HOUR)) AND
                    NOT EXISTS(SELECT 1 FROM inc4_retention_run WHERE outcome IN ('completed','no_records') AND finished_at>DATE_SUB(NOW(),INTERVAL 6 MONTH)) due
                    FROM inc4_retention_policy p WHERE p.id=1`);
                if (due?.due) await execute();
            } catch (error) {
                await log(error, 'error', {
                    operation: 'trace-retention-scheduler'
                });
            }
        };
        const timer = setInterval(tick, 60000);
        timer.unref();
    }
    return { snapshot, execute, startScheduler, backupDirectory };
};
