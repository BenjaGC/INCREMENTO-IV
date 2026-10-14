// Límites de proceso y validación de entrada. El proxy institucional completa la protección de red.
const TEXT_FIELDS = new Set([
    'descripcion',
    'piso',
    'habitacion',
    'aparato',
    'nombreActivo',
    'id_ticket',
    'texto',
    'nombre',
    'correo',
    'password',
    'rut',
    'usuario',
    'creador',
    'info_resolucion',
    'info_espera',
    'info_cancelar',
    'justificacion',
    'external_endpoint_url'
]);
function limit(name, fallback, max) {
    const value = Number(process.env[name]);
    return Number.isInteger(value) && value > 0 && value <= max
        ? value
        : fallback;
}
function install(app) {
    // Express 4 no reenvía automáticamente los rechazos de handlers async.
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'all']) {
        const register = app[method];
        app[method] = function (route, ...handlers) {
            const guard = (handler) =>
                Array.isArray(handler)
                    ? handler.map(guard)
                    : typeof handler === 'function' &&
                        handler.constructor.name === 'AsyncFunction'
                      ? function (req, res, next) {
                            Promise.resolve(handler(req, res, next)).catch(
                                next
                            );
                        }
                      : handler;
            return register.call(this, route, ...handlers.map(guard));
        };
    }
    app.disable('x-powered-by');
    const buckets = new Map();
    const concurrent = limit('CLINICA_MAX_ACTIVE_REQUESTS', 64, 512);
    const perMinute = limit('CLINICA_REQUESTS_PER_MINUTE', 1200, 100000);
    let active = 0;
    setInterval(() => {
        for (const [ip, bucket] of buckets)
            if (bucket.until < Date.now()) buckets.delete(ip);
    }, 60000).unref();
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        res.setHeader(
            'Permissions-Policy',
            'camera=(), microphone=(), geolocation=()'
        );
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
        );
        if (!require('./session').originAllowed(req)) return res.status(403).json({error:'Origen de la solicitud no autorizado.'});
        if (process.env.NODE_ENV === 'production') {
            if (req.secure)
                res.setHeader('Strict-Transport-Security', 'max-age=15552000');
            if (
                !req.secure &&
                !['/health/live', '/health/ready'].includes(req.path)
            )
                return res
                    .status(426)
                    .json({
                        error: 'Utiliza la dirección HTTPS autorizada de la clínica.'
                    });
            if (
                req.headers.origin &&
                req.headers.origin !== new URL(process.env.PUBLIC_ORIGIN).origin
            )
                return res
                    .status(403)
                    .json({ error: 'Origen de la solicitud no autorizado.' });
        }
        if (
            /^\/(css|js|vendor)\//.test(req.path) ||
            req.path === '/favicon.ico'
        )
            return next();
        const now = Date.now(),
            ip = req.ip;
        let bucket = buckets.get(ip);
        if (!bucket || bucket.until < now) {
            if (!bucket && buckets.size >= 5000)
                return res
                    .status(429)
                    .set('Retry-After', '60')
                    .json({
                        error: 'Demasiadas solicitudes. Reintenta en un minuto.'
                    });
            bucket = { n: 0, until: now + 60000 };
            buckets.set(ip, bucket);
        }
        if (++bucket.n > perMinute)
            return res
                .status(429)
                .set(
                    'Retry-After',
                    String(Math.max(1, Math.ceil((bucket.until - now) / 1000)))
                )
                .json({
                    error: 'Demasiadas solicitudes. Reintenta en un minuto.'
                });
        if (active >= concurrent)
            return res
                .status(503)
                .set('Retry-After', '1')
                .json({
                    error: 'El servicio está ocupado. Reintenta en unos segundos.'
                });
        active++;
        let finished = false;
        const done = () => {
            if (!finished) {
                finished = true;
                active--;
            }
        };
        res.once('finish', done);
        res.once('close', done);
        next();
    });
}
function validate(req, res, next) {
    const invalid = () =>
        res
            .status(400)
            .json({
                error: 'Formato de solicitud inválido. Revisa los datos.'
            });
    if (Object.values(req.query).some((value) => typeof value !== 'string'))
        return invalid();
    if (req.body === undefined) return next();
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
        return invalid();
    let nodes = 0;
    function safe(value, depth) {
        if (++nodes > 5000 || depth > 12) return false;
        if (!value || typeof value !== 'object') return true;
        if (Array.isArray(value) && value.length > 1000) return false;
        return Object.entries(value).every(
            ([key, item]) =>
                !['__proto__', 'constructor', 'prototype'].includes(key) &&
                safe(item, depth + 1)
        );
    }
    if (!safe(req.body, 0)) return invalid();
    for (const key of TEXT_FIELDS)
        if (
            req.body[key] != null &&
            (typeof req.body[key] !== 'string' ||
                Buffer.byteLength(req.body[key]) > 16000)
        )
            return invalid();
    next();
}
function configureServer(server) {
    server.headersTimeout = 15000;
    server.requestTimeout = 120000;
    server.keepAliveTimeout = 5000;
    server.maxHeadersCount = 100;
    server.maxConnections = 512;
}
module.exports = { install, validate, configureServer };
