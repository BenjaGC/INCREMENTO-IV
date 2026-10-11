const path = require('node:path');
const fs = require('node:fs');

module.exports = function registerIncrement4(
    app,
    { pool, transporter, log, wrap }
) {
    const security = require('./login-security')({ pool, transporter, log });
    const traces = require('./trace-retention')({ pool, transporter, log });
    const router = require('express').Router();
    app.use('/api/v4', router);
    const admin = (req, res, next) =>
        req.security?.admin
            ? next()
            : res
                  .status(403)
                  .json({ error: 'Se requiere una sesión de administrador.' });

    router.get(
        '/security',
        admin,
        wrap(async (req, res) => {
            const [blocked] =
                await pool.query(`SELECT g.user_id,u.first_name,g.source_ip,g.scope,g.failures,g.blocked_until,g.manual_unlock,g.updated_at
            FROM inc4_access_guard g LEFT JOIN user u ON u.user_id=g.user_id
            WHERE g.manual_unlock=1 OR g.blocked_until>NOW() ORDER BY g.updated_at DESC LIMIT 100`);
            const [events] =
                await pool.query(`SELECT e.id,e.created_at,e.event_type,e.source_ip,e.detail,u.first_name
            FROM inc4_security_event e LEFT JOIN user u ON u.user_id=e.user_id ORDER BY e.id DESC LIMIT 100`);
            res.json({ blocked, events, threshold: 5, block_minutes: 30 });
        })
    );
    router.post(
        '/security/unlock',
        admin,
        wrap(async (req, res) => {
            const { user_id, reason } = req.body;
            if (
                !Number.isInteger(user_id) ||
                typeof reason !== 'string' ||
                reason.trim().length < 10 ||
                reason.length > 500
            ) {
                return res.status(400).json({
                    error: 'Selecciona una cuenta e indica un motivo de 10 a 500 caracteres.'
                });
            }
            const db = await pool.getConnection();
            try {
                await db.beginTransaction();
                await security.unlockAccount(
                    db,
                    user_id,
                    req.security.user.user_id,
                    reason.trim()
                );
                await db.commit();
                res.json({
                    success: true,
                    message:
                        'Cuenta desbloqueada. La revisión quedó registrada.'
                });
            } catch (error) {
                await db.rollback();
                throw error;
            } finally {
                db.release();
            }
        })
    );
    router.get(
        '/traces',
        admin,
        wrap(async (req, res) => res.json(await traces.snapshot()))
    );
    router.put(
        '/traces/policy',
        admin,
        wrap(async (req, res) => {
            if (typeof req.body.enabled !== 'boolean')
                return res.status(400).json({
                    error: 'Indica si la política de retención está habilitada.'
                });
            await pool.query(
                'UPDATE inc4_retention_policy SET enabled=?,retention_years=2,updated_by=?,updated_at=NOW() WHERE id=1',
                [req.body.enabled, req.security.user.user_id]
            );
            await pool.query(
                "INSERT INTO inc4_security_event(event_type,user_id,actor_id,source_ip,detail) VALUES('RETENTION_POLICY',?,?,?,?)",
                [
                    req.security.user.user_id,
                    req.security.user.user_id,
                    req.ip,
                    req.body.enabled
                        ? 'Retención de dos años habilitada.'
                        : 'Retención deshabilitada.'
                ]
            );
            res.json({ success: true });
        })
    );
    router.post(
        '/traces/run',
        admin,
        wrap(async (req, res) => {
            if (req.body.confirm !== true)
                return res.status(400).json({
                    error: 'Confirma el mantenimiento antes de ejecutarlo.'
                });
            res.json(await traces.execute());
        })
    );
    router.get(
        '/traces/:id/backup',
        admin,
        wrap(async (req, res) => {
            const [[run]] = await pool.query(
                "SELECT backup_name FROM inc4_retention_run WHERE id=? AND outcome='completed'",
                [req.params.id]
            );
            if (
                !run?.backup_name ||
                path.basename(run.backup_name) !== run.backup_name
            )
                return res.sendStatus(404);
            const filename = path.join(
                traces.backupDirectory(),
                run.backup_name
            );
            if (!fs.existsSync(filename))
                return res.status(404).json({
                    error: 'El respaldo ya no está disponible en el servidor.'
                });
            res.download(filename);
        })
    );
    return { security, traces };
};
