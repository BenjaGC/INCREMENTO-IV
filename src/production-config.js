module.exports = function () {
    const mode = process.env.NODE_ENV || 'production';
    process.env.NODE_ENV = mode;
    if (!['development', 'test', 'production'].includes(mode))
        throw Error('NODE_ENV debe ser production, development o test.');
    const bind = process.env.CLINICA_BIND_ADDRESS || '127.0.0.1';
    if (!['127.0.0.1', '::1', 'localhost'].includes(bind))
        throw Error(
            'El backend debe escuchar en loopback detrás del proxy autorizado.'
        );
    if (process.env.TRUST_PROXY_HOPS)
        throw Error(
            'TRUST_PROXY_HOPS no se admite. Configura CLINICA_TRUSTED_PROXIES con las direcciones del proxy autorizado.'
        );
    if (mode !== 'production') return;
    const required = [
        'DB_HOST',
        'DB_USER',
        'DB_PASSWORD',
        'DB_NAME',
        'PUBLIC_ORIGIN',
        'MAIL_USER',
        'MAIL_PASSWORD',
        'CLINICA_BACKUP_DIR',
        'CLINICA_DATA_DIR',
        'CLINICA_TRUSTED_PROXIES',
        'CLINICA_RECOVERY_SECRET'
    ];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length)
        throw Error('Falta configuración de producción: ' + missing.join(', '));
    if (process.env.DB_USER === 'root')
        throw Error('Producción requiere una cuenta MySQL dedicada, no root.');
    const origin = new URL(process.env.PUBLIC_ORIGIN);
    if (origin.protocol !== 'https:')
        throw Error('PUBLIC_ORIGIN debe usar HTTPS.');
    const path = require('node:path');
    const pub = path.resolve(__dirname, '../public');
    for (const key of [
        'CLINICA_DATA_DIR',
        'CLINICA_BACKUP_DIR',
        ...(process.env.CLINICA_TRACE_BACKUP_DIR
            ? ['CLINICA_TRACE_BACKUP_DIR']
            : [])
    ]) {
        const value = process.env[key];
        const relative = path.relative(pub, path.resolve(value));
        if (
            !path.isAbsolute(value) ||
            relative === '' ||
            (!relative.startsWith('..') && !path.isAbsolute(relative))
        )
            throw Error(key + ' debe ser una ruta absoluta fuera de public.');
    }
    const proxies = process.env.CLINICA_TRUSTED_PROXIES.split(',').map((s) =>
        s.trim()
    );
    for (const proxy of proxies) {
        const [ip, bits] = proxy.split('/');
        const version = require('node:net').isIP(ip);
        if (
            !version ||
            (bits !== undefined &&
                (!/^\d+$/.test(bits) ||
                    Number(bits) < (version === 4 ? 24 : 64) ||
                    Number(bits) > (version === 4 ? 32 : 128)))
        )
            throw Error(
                'Configura direcciones o redes específicas de proxies confiables; no una confianza global.'
            );
    }
    require('proxy-addr').compile(proxies);
    if (process.env.CLINICA_RECOVERY_SECRET.length < 32)
        throw Error(
            'CLINICA_RECOVERY_SECRET requiere al menos 32 caracteres aleatorios privados.'
        );
    if (
        /^clinica_ui_test_/.test(process.env.DB_NAME) ||
        process.env.CLINIC_TEST_PUBLIC ||
        process.env.CLINIC_INTEGRATION_TEST
    )
        throw Error(
            'No se permite usar el entorno de demostración como producción.'
        );
};
