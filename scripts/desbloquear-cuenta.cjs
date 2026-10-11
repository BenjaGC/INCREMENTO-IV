// Recuperación operativa desde una terminal del servidor autorizada por TI.
// No crea administradores ni cambia contraseñas o permisos.
require('dotenv').config({ quiet: true });
const pool = require('../src/config/database');
const createSecurity = require('../src/increment4/login-security');
(async () => {
    const [rut, reason] = process.argv.slice(2);
    if (!rut || !reason || reason.trim().length < 10 || reason.length > 450) {
        throw Error(
            'Uso: npm run account:unlock -- RUT "Motivo de al menos 10 caracteres". Ejecutar solo por TI autorizado.'
        );
    }
    const db = await pool.getConnection();
    try {
        await db.beginTransaction();
        const [[user]] = await db.query(
            'SELECT user_id FROM user WHERE rut=?',
            [rut.replaceAll('.', '').trim().toUpperCase()]
        );
        if (!user) throw Error('No se encontró la cuenta.');
        const security = createSecurity({
            pool,
            transporter: null,
            log: async () => {}
        });
        await security.unlockAccount(
            db,
            user.user_id,
            null,
            'Recuperación por TI desde terminal: ' + reason.trim()
        );
        await db.commit();
        console.log(
            'Cuenta desbloqueada. El evento de recuperación quedó registrado.'
        );
    } catch (error) {
        await db.rollback();
        throw error;
    } finally {
        db.release();
    }
})()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
