const crypto = require('node:crypto');
const passwords = require('./passwords');
module.exports = function (app, { pool, transporter }) {
    const secret =
        process.env.CLINICA_RECOVERY_SECRET ||
        crypto
            .createHash('sha256')
            .update((process.env.DB_PASSWORD || '') + ':local-recovery')
            .digest('hex');
    const key = (rut) =>
        crypto
            .createHash('sha256')
            .update('recovery:' + rut)
            .digest('hex');
    const digest = (rut, code) =>
        crypto
            .createHmac('sha256', secret)
            .update(rut + ':' + code)
            .digest('hex');
    const rutOf = (value) =>
        typeof value === 'string' ? value.trim().toUpperCase() : '';
    const message =
        'Si la cuenta tiene un correo habilitado, recibirás un código que vence en 10 minutos.';
    const invalid = (res) =>
        res.status(400).json({ error: 'Código incorrecto o expirado.' });
    async function transaction(action) {
        const db = await pool.getConnection();
        try {
            await db.beginTransaction();
            const result = await action(db);
            await db.commit();
            return result;
        } catch (e) {
            await db.rollback();
            throw e;
        } finally {
            db.release();
        }
    }
    async function check(db, rut, code) {
        const [[row]] = await db.query(
            'SELECT *,NOW() db_now FROM security_recovery WHERE guard_key=? FOR UPDATE',
            [key(rut)]
        );
        if (
            !row ||
            !row.code_hash ||
            row.attempts >= 5 ||
            new Date(row.expires_at) <= new Date(row.db_now)
        )
            return null;
        const match =
            typeof code === 'string' &&
            /^\d{6}$/.test(code) &&
            crypto.timingSafeEqual(
                Buffer.from(row.code_hash, 'hex'),
                Buffer.from(digest(rut, code), 'hex')
            );
        if (!match) {
            await db.query(
                'UPDATE security_recovery SET attempts=attempts+1,verified=0 WHERE guard_key=?',
                [row.guard_key]
            );
            return null;
        }
        return row;
    }
    app.post('/recuperar-solicitar', async (req, res) => {
        const rut = rutOf(req.body.rut);
        if (!/^\d{7,8}-[\dK]$/.test(rut))
            return res.status(400).json({ error: 'Indica un RUT válido.' });
        let mail;
        try {
            await transaction(async (db) => {
                await db.query(
                    'INSERT IGNORE INTO security_recovery(guard_key) VALUES(?)',
                    [key(rut)]
                );
                const [[row]] = await db.query(
                    'SELECT *,NOW() db_now FROM security_recovery WHERE guard_key=? FOR UPDATE',
                    [key(rut)]
                );
                const now = new Date(row.db_now).getTime();
                const renewed =
                    !row.window_started ||
                    now - new Date(row.window_started).getTime() >= 15 * 60000;
                if (renewed) {
                    row.attempts = 0;
                    row.sends = 0;
                    await db.query(
                        'UPDATE security_recovery SET attempts=0,sends=0,window_started=NOW(),code_hash=NULL,verified=0 WHERE guard_key=?',
                        [row.guard_key]
                    );
                }
                if (
                    row.attempts >= 5 ||
                    row.sends >= 3 ||
                    (row.last_sent &&
                        now - new Date(row.last_sent).getTime() < 60000)
                )
                    return;
                const [[user]] = await db.query(
                    'SELECT user_id,institutional_email FROM user WHERE rut=? AND user_status=1',
                    [rut]
                );
                const code = String(crypto.randomInt(100000, 1000000));
                const hash = digest(rut, code);
                await db.query(
                    'UPDATE security_recovery SET user_id=?,code_hash=?,expires_at=DATE_ADD(NOW(),INTERVAL 10 MINUTE),sends=sends+1,last_sent=NOW(),verified=0 WHERE guard_key=?',
                    [
                        user?.user_id || null,
                        user?.institutional_email ? hash : null,
                        row.guard_key
                    ]
                );
                if (
                    user?.institutional_email &&
                    !user.institutional_email.endsWith('@temp.com')
                )
                    mail = {
                        to: user.institutional_email,
                        code,
                        hash,
                        guard: row.guard_key
                    };
            });
            if (mail) {
                try {
                    await transporter.sendMail({
                        from: process.env.MAIL_FROM || process.env.MAIL_USER,
                        to: mail.to,
                        subject: 'Recuperación de acceso',
                        text: `Tu código de recuperación es ${mail.code}. Vence en 10 minutos. Si no lo solicitaste, ignora este mensaje.`
                    });
                } catch {
                    await pool.query(
                        'UPDATE security_recovery SET code_hash=NULL WHERE guard_key=? AND code_hash=?',
                        [mail.guard, mail.hash]
                    );
                }
            }
            res.json({
                success: true,
                message,
                correoHint: 'el correo registrado'
            });
        } catch {
            res.status(503).json({
                error: 'Servicio temporalmente no disponible.'
            });
        }
    });
    app.post('/recuperar-verificar', async (req, res) => {
        try {
            const match = await transaction(async (db) => {
                const row = await check(
                    db,
                    rutOf(req.body.rut),
                    req.body.codigo
                );
                if (row)
                    await db.query(
                        'UPDATE security_recovery SET verified=1 WHERE guard_key=?',
                        [row.guard_key]
                    );
                return Boolean(row);
            });
            return match
                ? res.json({
                      success: true,
                      message: 'Código verificado correctamente.'
                  })
                : invalid(res);
        } catch {
            res.status(503).json({
                error: 'Servicio temporalmente no disponible.'
            });
        }
    });
    app.post('/recuperar-cambiar', async (req, res) => {
        const { nuevaPassword, codigo } = req.body;
        if (
            typeof nuevaPassword !== 'string' ||
            nuevaPassword.length < 8 ||
            Buffer.byteLength(nuevaPassword) > 72
        )
            return res
                .status(400)
                .json({
                    error: 'La contraseña debe tener al menos 8 caracteres y hasta 72 bytes.'
                });
        try {
            const match = await transaction(async (db) => {
                const row = await check(db, rutOf(req.body.rut), codigo);
                if (!row) return false;
                await db.query(
                    'UPDATE security_recovery SET code_hash=NULL,expires_at=NULL,verified=0 WHERE guard_key=?',
                    [row.guard_key]
                );
                const [changed] = await db.query(
                    'UPDATE user SET password_hash=?,must_reset_password=0,session_token_hash=NULL WHERE user_id=? AND user_status=1',
                    [await passwords.hash(nuevaPassword), row.user_id]
                );
                return changed.affectedRows === 1;
            });
            return match
                ? res.json({
                      success: true,
                      message: 'Contraseña actualizada.'
                  })
                : invalid(res);
        } catch {
            res.status(503).json({
                error: 'No se pudo cambiar la contraseña. Solicita otro código.'
            });
        }
    });
};
