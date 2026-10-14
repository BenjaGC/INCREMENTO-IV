const { Usuario } = require('./domain');
const sessions = require('./session');
const PUBLIC_POST = new Set([
    '/login',
    '/registro',
    '/validar-rut',
    '/recuperar-solicitar',
    '/recuperar-verificar',
    '/recuperar-cambiar'
]);
const READ_USER = new Set([
    '/incidentes',
    '/incidentes/cerrados',
    '/incidentes/buscar',
    '/categorias',
    '/prioridades',
    '/manuales',
    '/config-public',
    '/equipos/sugerencias',
    '/equipos/sugerencias-completas'
]);
module.exports = function (app, pool) {
    app.disable('x-powered-by');
    const attempts = new Map();
    const timer = setInterval(() => {
        const now = Date.now();
        for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
    }, 60000);
    timer.unref();
    app.use(async (req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'same-origin');
        const url = req.path;
        if (
            ['GET', 'HEAD'].includes(req.method) &&
            (url === '/' ||
                url === '/index.html' ||
                /^\/(css|js|vendor)\//.test(url) ||
                url === '/favicon.ico')
        )
            return next();
        res.setHeader('Cache-Control', 'no-store');
        // Login response supplies a same-site cookie for protected images/download links.
        const json = res.json.bind(res);
        res.json = (data) => {
            if (url === '/login' && data?.token)
                res.cookie('clinica_session', data.token, {
                    httpOnly: true,
                    sameSite: 'strict',
                    secure: process.env.NODE_ENV === 'production',
                    maxAge: 8 * 3600000,
                    path: '/'
                });
            if (url === '/sesion/cerrar')
                res.clearCookie('clinica_session', { path: '/' });
            if (
                url === '/login' &&
                req.headers['x-clinica-session'] === 'cookie' &&
                data?.token
            ) {
                const { token, ...publicUser } = data;
                return json(publicUser);
            }
            return json(data);
        };
        if (PUBLIC_POST.has(url) && req.method === 'POST') {
            const key = req.ip + ':' + url,
                now = Date.now();
            let bucket = attempts.get(key);
            if (!bucket || bucket.until < now) {
                bucket = { n: 0, until: now + 15 * 60000 };
                attempts.set(key, bucket);
            }
            if (++bucket.n > (url === '/validar-rut' ? 150 : 30)) {
                res.setHeader(
                    'Retry-After',
                    Math.ceil((bucket.until - now) / 1000)
                );
                return res.status(429).json({
                    error: 'Demasiados intentos. Espera unos minutos.'
                });
            }
            return next();
        }
        if (url === '/integraciones/imer/webhook') return next(); // Dedicated token validation in acceptance.js.
        if (
            url === '/__integration/run' &&
            process.env.CLINIC_INTEGRATION_TEST === '1'
        )
            return next();
        try {
            const { token, bearer } = sessions.read(req);
            if (!token || !/^[a-f0-9]{64}$/.test(token))
                return res
                    .status(401)
                    .json({ error: 'Inicia sesión para continuar.' });
            // Cookie HttpOnly + cabecera propia + origen: un formulario externo no autoriza escrituras.
            if (
                !sessions.originAllowed(req) ||
                (!['GET', 'HEAD'].includes(req.method) &&
                    !bearer &&
                    req.headers['x-clinica-request'] !== '1')
            )
                return res
                    .status(403)
                    .json({ error: 'Se requiere autorización de la sesión.' });
            const u = await sessions.find(pool, token);
            if (!u)
                return res.status(401).json({
                    error: 'La sesión expiró o fue cerrada. Vuelve a ingresar.'
                });
            req.security = { user: u, ...Usuario.desde(u).obtenerPermisos() };
            if (
                u.must_reset_password &&
                !['/api/v3/password', '/sesion/cerrar'].includes(url)
            )
                return res
                    .status(428)
                    .json({ error: 'Debes cambiar tu contraseña temporal.' });
            if (url.startsWith('/api/v3/') || url.startsWith('/api/v4/'))
                return require('./versioned-policy')(req, res, next);
            if (req.body && typeof req.body === 'object') {
                req.body.usuario = u.first_name;
                req.body.creador = u.first_name;
            }
            req.query.usuario = u.first_name;
            req.query.esAdmin = req.security.soporte ? 'si' : 'no';
            if (url.startsWith('/uploads/')) {
                const [[file]] = await pool.query(
                    'SELECT a.is_deleted,a.mime_type,t.requester_user_id,t.assigned_user_id FROM attachment a JOIN ticket t ON t.ticket_id=a.ticket_id WHERE a.file_path=?',
                    [url]
                );
                if (
                    !file ||
                    (!req.security.soporte &&
                        file.requester_user_id !== u.user_id &&
                        file.assigned_user_id !== u.user_id)
                )
                    return res.sendStatus(404);
                if (file.is_deleted) return res.sendStatus(410);
                // Prevent uploaded HTML/SVG or other active documents from executing in our origin.
                res.setHeader(
                    'Content-Security-Policy',
                    "sandbox; default-src 'none'; style-src 'unsafe-inline'"
                );
                const inline = {
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp',
                    '.pdf': 'application/pdf'
                }[require('path').extname(url).toLowerCase()];
                if (!inline || inline !== file.mime_type) {
                    res.type('application/octet-stream');
                    res.attachment(require('path').basename(url));
                    res.type('application/octet-stream');
                } else res.type(inline);
                return next();
            }
            if (
                (req.method === 'GET' || req.method === 'HEAD') &&
                (READ_USER.has(url) || url.startsWith('/manuales/'))
            ) {
                if (url.startsWith('/manuales/') && url !== '/manuales/') {
                    if (!/\.pdf$/i.test(url)) return res.sendStatus(404);
                    res.setHeader(
                        'Content-Security-Policy',
                        "sandbox; default-src 'none'"
                    );
                    res.type('application/pdf');
                }
                return next();
            }
            if (url === '/sesion/verificar' || url === '/sesion/cerrar')
                return next();
            if (url === '/incidente' || url.startsWith('/incidente/')) {
                // Los GET usan exclusivamente el código de la ruta; un body o query no puede sustituirlo.
                const routeCode = url.match(
                    /^\/incidente\/([^/]+)\/(materiales|etiqueta-pdf|qr|adjuntos-zip)$/
                )?.[1];
                const code = ['GET', 'HEAD'].includes(req.method)
                    ? routeCode
                    : req.body?.id_ticket;
                const multipartComment =
                    req.method === 'POST' &&
                    url === '/incidente/comentar' &&
                    /^multipart\/form-data(?:;|$)/i.test(
                        req.headers['content-type'] || ''
                    );
                if (url !== '/incidente' && !code && !multipartComment)
                    return res
                        .status(400)
                        .json({ error: 'Indica el ticket de la operación.' });
                if (code) {
                    const [[t]] = await pool.query(
                        'SELECT requester_user_id,assigned_user_id,is_archived FROM ticket WHERE ticket_code=?',
                        [code]
                    );
                    if (!t) return res.sendStatus(404);
                    if (
                        !req.security.soporte &&
                        t.requester_user_id !== u.user_id &&
                        t.assigned_user_id !== u.user_id
                    )
                        return res.status(403).json({
                            error: 'No tienes permiso para esta operación.'
                        });
                    if (t.is_archived && !['GET', 'HEAD'].includes(req.method))
                        return res
                            .status(409)
                            .json({ error: 'Ticket archivado: solo lectura.' });
                    if (
                        req.method === 'POST' &&
                        url === '/incidente/reasignar' &&
                        !req.security.admin
                    )
                        return res.status(403).json({
                            error: 'Solo el administrador puede reasignar tickets.'
                        });
                    if (
                        req.method === 'POST' &&
                        [
                            '/incidente/nota-privada',
                            '/incidente/ajustar-prioridad',
                            '/incidente/materiales',
                            '/incidente/espera',
                            '/incidente/continuar',
                            '/incidente/cancelar',
                            '/incidente/resolver'
                        ].includes(url) &&
                        !req.security.admin &&
                        (!req.security.soporte ||
                            t.assigned_user_id !== u.user_id)
                    )
                        return res.status(403).json({
                            error: 'Solo el técnico asignado o administrador puede realizar esta acción.'
                        });
                }
                if (
                    !req.security.soporte &&
                    req.method !== 'GET' &&
                    ![
                        '/incidente',
                        '/incidente/ver',
                        '/incidente/comentar',
                        '/incidente/reabrir',
                        '/incidente/cerrar'
                    ].includes(url)
                )
                    return res.status(403).json({
                        error: 'No tienes permiso para esta operación.'
                    });
                return next();
            }
            if (
                req.method === 'GET' &&
                [
                    '/materiales',
                    '/insumos/stock',
                    '/tecnicos',
                    '/reportes/mapa-calor'
                ].includes(url) &&
                req.security.soporte
            )
                return next();
            // Unknown legacy operations default to administrator, not anonymous access.
            if (!req.security.admin)
                return res.status(403).json({
                    error: 'Se requiere una sesión de administrador.'
                });
            return next();
        } catch (e) {
            return res.status(503).json({
                error: 'No se pudo verificar la sesión. Intenta nuevamente.'
            });
        }
    });
};
