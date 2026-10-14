// Migración aditiva. No acepta contraseñas heredadas en el autenticador ni conserva tokens en claro.
module.exports = async function migrateSecurity(db) {
    const [[column]] = await db.query(
        "SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='user' AND column_name='session_token_hash'"
    );
    if (!column)
        await db.query(
            'ALTER TABLE user ADD session_token_hash CHAR(64) NULL, ADD UNIQUE KEY security_session_hash(session_token_hash)'
        );
    await db.query(
        'UPDATE user SET session_token=NULL WHERE session_token IS NOT NULL'
    );
    const passwords = require('./passwords');
    const [legacy] = await db.query(
        "SELECT user_id,password_hash FROM user WHERE password_hash NOT REGEXP '^[$]2[aby][$]' ORDER BY user_id"
    );
    for (const row of legacy) {
        const usable =
            typeof row.password_hash === 'string' &&
            row.password_hash.length >= 8 &&
            Buffer.byteLength(row.password_hash) <= 72;
        await db.query(
            'UPDATE user SET password_hash=?,session_token_hash=NULL,must_reset_password=IF(?,must_reset_password,1) WHERE user_id=? AND password_hash=?',
            [
                await passwords.hash(
                    usable
                        ? row.password_hash
                        : require('node:crypto').randomBytes(32).toString('hex')
                ),
                usable,
                row.user_id,
                row.password_hash
            ]
        );
    }
    await db.query(
        'CREATE TABLE IF NOT EXISTS security_migration(name VARCHAR(80) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)'
    );
    const [[applied]] = await db.query(
        "SELECT name FROM security_migration WHERE name='account-ip-guards'"
    );
    if (!applied) {
        const [old] = await db.query(
            "SELECT g.*,u.rut,e.source_ip event_ip FROM inc4_access_guard g JOIN user u ON u.user_id=g.user_id JOIN inc4_security_event e ON e.user_id=u.user_id AND e.event_type='ACCESS_BLOCKED' WHERE g.scope='account' AND (g.manual_unlock=1 OR g.blocked_until>NOW()) AND e.source_ip IS NOT NULL AND e.created_at>=g.last_failure"
        );
        for (const row of old) {
            const ip = row.event_ip.replace(/^::ffff:/, '');
            const guard = require('node:crypto')
                .createHash('sha256')
                .update(
                    'account_ip:' +
                        row.rut.replaceAll('.', '').trim().toUpperCase() +
                        '|' +
                        ip
                )
                .digest('hex');
            await db.query(
                "INSERT IGNORE INTO inc4_access_guard(guard_key,scope,user_id,source_ip,failures,last_failure,blocked_until,manual_unlock) VALUES(?,'account_ip',?,?,?,?,?,?)",
                [
                    guard,
                    row.user_id,
                    ip,
                    row.failures,
                    row.last_failure,
                    row.blocked_until,
                    row.manual_unlock
                ]
            );
        }
        await db.query(
            "UPDATE inc4_access_guard SET failures=0,last_failure=NULL,blocked_until=NULL,manual_unlock=0 WHERE scope IN ('account','ip')"
        );
        await db.query(
            "INSERT INTO security_migration(name) VALUES('account-ip-guards')"
        );
    }
    await db.query(`CREATE TABLE IF NOT EXISTS security_recovery (
      guard_key CHAR(64) PRIMARY KEY, user_id INT NULL, code_hash CHAR(64) NULL,
      expires_at DATETIME NULL, attempts INT NOT NULL DEFAULT 0,
      window_started DATETIME NULL, sends INT NOT NULL DEFAULT 0, last_sent DATETIME NULL,
      verified TINYINT NOT NULL DEFAULT 0, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
};
