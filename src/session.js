const crypto = require('node:crypto');
const COOKIE = 'clinica_session';
const valid = (token) =>
    typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
const digest = (token) =>
    crypto.createHash('sha256').update(token).digest('hex');
function read(req) {
    const authorization = req.headers.authorization || '';
    const bearer = authorization.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    const cookie = (req.headers.cookie || '')
        .split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith(COOKIE + '='))
        ?.slice(COOKIE.length + 1);
    return { token: bearer || cookie, bearer: Boolean(bearer) };
}
function originAllowed(req) {
    if (['cross-site', 'same-site'].includes(req.headers['sec-fetch-site']))
        return false;
    if (!req.headers.origin) return true; // APIs con bearer pueden no enviar Origin.
    const expected =
        process.env.NODE_ENV === 'production'
            ? new URL(process.env.PUBLIC_ORIGIN).origin
            : req.protocol + '://' + req.headers.host;
    return req.headers.origin === expected;
}
async function find(pool, token) {
    if (!valid(token)) return null;
    const [[user]] = await pool.query(
        'SELECT u.*,EXISTS(SELECT 1 FROM user_role r WHERE r.user_id=u.user_id AND r.role_id=1 AND r.active=1) admin FROM user u WHERE session_token_hash=? AND user_status=1 AND last_login>DATE_SUB(NOW(),INTERVAL 8 HOUR)',
        [digest(token)]
    );
    return user || null;
}
module.exports = { COOKIE, valid, digest, read, originAllowed, find };
