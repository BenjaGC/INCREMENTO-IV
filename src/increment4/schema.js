// Migración aditiva: no recrea tablas existentes ni altera los tickets.
module.exports = async function migrateIncrement4(db) {
    const statements = [
        `CREATE TABLE IF NOT EXISTS inc4_access_guard (
            guard_key CHAR(64) PRIMARY KEY,
            scope ENUM('account','ip','account_ip') NOT NULL,
            user_id INT NULL,
            source_ip VARCHAR(45) NULL,
            failures INT NOT NULL DEFAULT 0,
            last_failure DATETIME NULL,
            blocked_until DATETIME NULL,
            manual_unlock TINYINT NOT NULL DEFAULT 0,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY inc4_guard_user(user_id), KEY inc4_guard_updated(updated_at)
        )`,
        `CREATE TABLE IF NOT EXISTS inc4_security_event (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            event_type VARCHAR(40) NOT NULL,
            user_id INT NULL,
            actor_id INT NULL,
            source_ip VARCHAR(45) NULL,
            detail VARCHAR(500) NOT NULL,
            KEY inc4_security_date(created_at,id)
        )`,
        `CREATE TABLE IF NOT EXISTS inc4_retention_policy (
            id INT PRIMARY KEY, enabled TINYINT NOT NULL DEFAULT 0,
            retention_years INT NOT NULL DEFAULT 2,
            updated_by INT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS inc4_retention_run (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            finished_at DATETIME NULL,
            outcome VARCHAR(30) NOT NULL DEFAULT 'running',
            cutoff DATETIME NULL, removed_rows BIGINT NOT NULL DEFAULT 0,
            backup_name VARCHAR(180) NULL, backup_sha256 CHAR(64) NULL,
            summary VARCHAR(500) NULL,
            KEY inc4_retention_date(started_at)
        )`
    ];
    for (const sql of statements) await db.query(sql);
    const [[scope]] = await db.query(
        "SELECT column_type FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inc4_access_guard' AND column_name='scope'"
    );
    if (!String(scope.column_type || scope.COLUMN_TYPE).includes('account_ip'))
        await db.query(
            "ALTER TABLE inc4_access_guard MODIFY scope ENUM('account','ip','account_ip') NOT NULL"
        );
    await db.query('INSERT IGNORE INTO inc4_retention_policy(id) VALUES(1)');
    for (const [table, name, columns] of [
        ['audit_log', 'inc4_audit_date', 'action_date,log_id'],
        ['inc3_log', 'inc4_technical_date', 'created_at,id']
    ]) {
        const [existing] = await db.query(
            'SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=?',
            [table, name]
        );
        if (!existing.length)
            await db.query(`CREATE INDEX ${name} ON ${table}(${columns})`);
    }
};
