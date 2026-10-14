// Denegación administrativa por defecto, incluso si un handler nuevo olvida su middleware de rol.
module.exports = (req, res, next) => {
    if (req.security?.admin) return next();
    const route = req.method + ' ' + req.path;
    if (/^\/api\/v4(?:\/|$)/.test(req.path))
        return res.status(403).json({ error: 'Se requiere administrador.' });
    const own = [
        /^GET \/api\/v3\/(profile|categories)$/,
        /^PUT \/api\/v3\/profile$/,
        /^POST \/api\/v3\/(password|heartbeat)$/,
        /^GET \/api\/v3\/(travel|survey|attachments)\/[^/]+$/,
        /^POST \/api\/v3\/survey\/[^/]+$/
    ];
    if (own.some((pattern) => pattern.test(route))) return next();
    if (
        req.security?.soporte &&
        (/^GET \/api\/v3\/archives(?:\/[^/]+)?$/.test(route) ||
            /^POST \/api\/v3\/travel\/[^/]+\/[^/]+$/.test(route))
    )
        return next();
    return res.status(403).json({ error: 'Se requiere administrador.' });
};
