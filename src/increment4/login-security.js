const crypto = require('node:crypto');
const passwords = require('../passwords');

const MAX_FAILURES = 5;
const BLOCK_MINUTES = 30;
const INVALID_MESSAGE = 'Contraseña incorrecta o usuario no encontrado.';
const BLOCK_MESSAGE =
    'Acceso bloqueado por seguridad. Espera 30 minutos o contacta al administrador para revisar tu acceso.';
const keyFor = (scope, value) =>
    crypto
        .createHash('sha256')
        .update(scope + ':' + value)
        .digest('hex');
const normalizeRut = (value) =>
    typeof value === 'string'
        ? value.replaceAll('.', '').trim().toUpperCase()
        : '';

module.exports = function createLoginSecurity({ pool, transporter, log }) {
    // Comparar también cuentas inexistentes evita una respuesta inmediata que revele su existencia.
    const dummyHash = passwords.hash(crypto.randomBytes(24).toString('hex'));
    const event = (db, type, userId, ip, detail, actorId = null) =>
        db.query(
            'INSERT INTO inc4_security_event(event_type,user_id,actor_id,source_ip,detail) VALUES(?,?,?,?,?)',
            [type, userId, actorId, ip, detail]
        );

    async function notifyLocked(user, ip) {
        if (
            !user ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.institutional_email)
        )
            return;
        try {
            await transporter.sendMail({
                from: process.env.MAIL_FROM || process.env.MAIL_USER,
                to: user.institutional_email,
                subject: 'Alerta de seguridad de acceso — Clínica Aconcagua',
                text:
                    `Se bloquearon los accesos después de cinco intentos fallidos consecutivos. IP de origen: ${ip}. ` +
                    (user.admin
                        ? 'La cuenta requiere un desbloqueo manual por un administrador autorizado o TI.'
                        : 'El bloqueo dura 30 minutos. Si no reconoces estos intentos, contacta a soporte.'),
                clinicTemplateApplied: true
            });
            await event(
                pool,
                'ALERT_SENT',
                user.user_id,
                ip,
                'Alerta entregada al servicio de correo.'
            );
        } catch (error) {
            await event(
                pool,
                'ALERT_FAILED',
                user.user_id,
                ip,
                'No se pudo enviar la alerta. El bloqueo permanece activo.'
            );
            await log(error, 'error', {
                operation: 'security-alert',
                user_id: user.user_id
            });
        }
    }

    async function authenticateOnce(req, res) {
        const rut = normalizeRut(req.body.rut);
        const password = req.body.password;
        if (
            !rut ||
            rut.length > 16 ||
            typeof password !== 'string' ||
            password.length > 256
        ) {
            return res.status(401).json({ error: INVALID_MESSAGE });
        }
        const ip = String(req.ip || req.socket.remoteAddress || '')
            .replace(/^::ffff:/, '')
            .slice(0, 45);
        const keys = [
            keyFor('account', rut),
            keyFor('account_ip', rut + '|' + ip)
        ].sort();
        const accountKey = keyFor('account', rut);
        const ipKey = keyFor('account_ip', rut + '|' + ip);
        const db = await pool.getConnection();
        let response,
            status = 200,
            lockedUser = null;
        try {
            await db.beginTransaction();
            // Orden estable + locks en MySQL: los intentos concurrentes y reinicios no evaden el contador.
            for (const key of keys) {
                await db.query(
                    'INSERT INTO inc4_access_guard(guard_key,scope,source_ip) VALUES(?,?,?) ON DUPLICATE KEY UPDATE guard_key=inc4_access_guard.guard_key',
                    [
                        key,
                        key === accountKey ? 'account' : 'account_ip',
                        key === ipKey ? ip : null
                    ]
                );
            }
            const [guards] = await db.query(
                'SELECT *,NOW() db_now FROM inc4_access_guard WHERE guard_key IN (?,?) ORDER BY guard_key FOR UPDATE',
                keys
            );
            const now = new Date(guards[0].db_now).getTime();
            for (const guard of [...guards].sort(
                (a, b) =>
                    Number(b.scope === 'account_ip') -
                    Number(a.scope === 'account_ip')
            )) {
                if (
                    (guard.scope === 'account_ip' && guard.manual_unlock) ||
                    (guard.blocked_until &&
                        new Date(guard.blocked_until).getTime() > now)
                ) {
                    await event(
                        db,
                        'BLOCKED_ATTEMPT',
                        guard.user_id,
                        ip,
                        'Intento rechazado durante un bloqueo activo.'
                    );
                    await db.commit();
                    const retry =
                        guard.scope === 'account'
                            ? Math.max(
                                  1,
                                  Math.ceil(
                                      (new Date(guard.blocked_until).getTime() -
                                          now) /
                                          1000
                                  )
                              )
                            : BLOCK_MINUTES * 60;
                    res.setHeader('Retry-After', retry);
                    return res
                        .status(guard.scope === 'account' ? 429 : 423)
                        .json({
                            error:
                                guard.scope === 'account'
                                    ? 'Espera unos segundos antes de intentar nuevamente.'
                                    : BLOCK_MESSAGE
                        });
                }
                if (
                    (guard.scope === 'account_ip' && guard.blocked_until) ||
                    (guard.last_failure &&
                        now - new Date(guard.last_failure).getTime() >
                            BLOCK_MINUTES * 60000)
                ) {
                    guard.failures = 0;
                    await db.query(
                        'UPDATE inc4_access_guard SET failures=0,blocked_until=NULL WHERE guard_key=?',
                        [guard.guard_key]
                    );
                }
            }
            const [[user]] = await db.query(
                `SELECT u.*,EXISTS(SELECT 1 FROM user_role r WHERE r.user_id=u.user_id AND r.role_id=1 AND r.active=1) admin
                 FROM user u WHERE rut=? AND user_status=1 FOR UPDATE`,
                [rut]
            );
            const valid = await passwords.verify(
                password,
                user?.password_hash || (await dummyHash)
            );
            if (!user || !valid) {
                let reachedLimit = false;
                for (const guard of guards) {
                    const failures = Number(guard.failures) + 1;
                    const manual =
                        guard.scope === 'account_ip' &&
                        !!user?.admin &&
                        failures >= MAX_FAILURES;
                    const blocked =
                        guard.scope === 'account_ip' &&
                        failures >= MAX_FAILURES;
                    await db.query(
                        `UPDATE inc4_access_guard SET failures=?,last_failure=NOW(),user_id=?,
                         blocked_until=IF(?,DATE_ADD(NOW(),INTERVAL 30 MINUTE),NULL),manual_unlock=? WHERE guard_key=?`,
                        [
                            failures,
                            user?.user_id || null,
                            blocked && !manual,
                            manual,
                            guard.guard_key
                        ]
                    );
                    if (guard.scope === 'account' && failures >= MAX_FAILURES)
                        await db.query(
                            'UPDATE inc4_access_guard SET blocked_until=DATE_ADD(NOW(),INTERVAL ? SECOND) WHERE guard_key=?',
                            [
                                Math.min(
                                    15,
                                    2 ** Math.min(4, failures - MAX_FAILURES)
                                ),
                                guard.guard_key
                            ]
                        );
                    if (blocked) reachedLimit = true;
                }
                await event(
                    db,
                    reachedLimit ? 'ACCESS_BLOCKED' : 'LOGIN_FAILED',
                    user?.user_id || null,
                    ip,
                    reachedLimit
                        ? user?.admin
                            ? 'Cinco intentos fallidos. Cuenta administrativa: desbloqueo manual.'
                            : 'Cinco intentos fallidos. Bloqueo de la combinación cuenta e IP durante 30 minutos.'
                        : 'Credenciales inválidas.'
                );
                status = reachedLimit ? 423 : 401;
                response = {
                    error: reachedLimit ? BLOCK_MESSAGE : INVALID_MESSAGE
                };
                if (reachedLimit) lockedUser = user;
            } else {
                const token = crypto.randomBytes(32).toString('hex');
                await db.query(
                    'UPDATE user SET session_token_hash=?,last_seen=NOW(),last_login=NOW(),password_hash=? WHERE user_id=?',
                    [
                        require('../session').digest(token),
                        user.password_hash,
                        user.user_id
                    ]
                );
                await db.query(
                    'UPDATE inc4_access_guard SET failures=0,last_failure=NULL,blocked_until=NULL,manual_unlock=0 WHERE guard_key IN (?,?)',
                    keys
                );
                response = {
                    success: true,
                    user_id: user.user_id,
                    nombre: user.first_name,
                    rut: user.rut,
                    correo: user.institutional_email.includes('@temp.com')
                        ? ''
                        : user.institutional_email,
                    permisos: user.admin ? 'si' : 'no',
                    esCritico: !!user.is_critical_tech,
                    esTecnico: user.tipo_usuario === 'TECNICO',
                    token,
                    mustReset: !!user.must_reset_password
                };
            }
            await db.commit();
        } catch (error) {
            await db.rollback();
            throw error;
        } finally {
            db.release();
        }
        if (lockedUser) await notifyLocked(lockedUser, ip);
        if (status === 423) res.setHeader('Retry-After', BLOCK_MINUTES * 60);
        return res.status(status).json(response);
    }

    async function authenticate(req, res) {
        for (let attempt = 0; attempt < 4; attempt++) {
            try {
                return await authenticateOnce(req, res);
            } catch (error) {
                if (
                    !['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(
                        error.code
                    )
                )
                    throw error;
                if (attempt === 3)
                    throw Object.assign(
                        new Error(
                            'El acceso está ocupado. Espera un momento y vuelve a intentar.'
                        ),
                        { status: 503 }
                    );
                await new Promise((resolve) =>
                    setTimeout(resolve, 30 * (attempt + 1))
                );
            }
        }
    }

    async function unlockAccount(db, userId, actorId, reason) {
        const [[user]] = await db.query(
            'SELECT user_id FROM user WHERE user_id=?',
            [userId]
        );
        if (!user)
            throw Object.assign(new Error('Usuario no encontrado.'), {
                status: 404
            });
        const [guards] = await db.query(
            'SELECT * FROM inc4_access_guard WHERE user_id=?',
            [userId]
        );
        // Al desbloquear una cuenta se revisan explícitamente sus IPs asociadas al último bloqueo.
        const [events] = await db.query(
            "SELECT DISTINCT source_ip FROM inc4_security_event WHERE user_id=? AND event_type='ACCESS_BLOCKED' AND created_at>DATE_SUB(NOW(),INTERVAL 30 MINUTE)",
            [userId]
        );
        const keys = [
            ...new Set([
                ...guards.map((g) => g.guard_key),
                ...events.map((e) => keyFor('ip', e.source_ip))
            ])
        ].sort();
        for (const key of keys)
            await db.query(
                'SELECT guard_key FROM inc4_access_guard WHERE guard_key=? FOR UPDATE',
                [key]
            );
        if (keys.length)
            await db.query(
                'UPDATE inc4_access_guard SET failures=0,last_failure=NULL,blocked_until=NULL,manual_unlock=0 WHERE guard_key IN (?)',
                [keys]
            );
        await event(db, 'MANUAL_UNLOCK', userId, null, reason, actorId);
    }

    return { authenticate, unlockAccount, keyFor };
};
