const http = require('node:http');
const https = require('node:https');
// TI autoriza los destinos de red en el servidor.
function validate(value) {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw Error('Indica una URL HTTP o HTTPS válida.');
    }
    if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.hash ||
        String(value).length > 2048
    )
        throw Error('La URL no debe contener credenciales ni fragmentos.');
    if (
        [...url.searchParams.keys()].some((key) =>
            /token|password|secret|credential|signature|api.?key|auth/i.test(
                key
            )
        )
    )
        throw Error(
            'Las credenciales deben configurarse en el servidor, no en la URL.'
        );
    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    if (
        [22, 25, 53, 110, 143, 3306, 5432, 6379, 27017].includes(port) ||
        /^(169\.254\.|0\.0\.0\.0$|\[::\]$)/.test(url.hostname)
    )
        throw Error('Destino de red no autorizado.');
    const authorized = (process.env.CLINICA_EXTERNAL_ALLOWED_HOSTS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .some((item) => {
            try {
                const candidate = new URL('http://' + item);
                return (
                    candidate.hostname === url.hostname &&
                    (candidate.port
                        ? Number(candidate.port) === port
                        : port === (url.protocol === 'https:' ? 443 : 80))
                );
            } catch {
                return false;
            }
        });
    if (!authorized)
        throw Error(
            'Servidor externo no autorizado. Solicita a TI habilitar este destino.'
        );
    return url;
}
async function probe(value) {
    const url = validate(value);
    return new Promise((resolve) => {
        const began = Date.now();
        let settled = false;
        const done = (result) => {
            if (!settled) {
                settled = true;
                resolve({ ...result, tiempoMs: Date.now() - began });
            }
        };
        const connection = (url.protocol === 'https:' ? https : http).get(
            url,
            { timeout: 5000 },
            (response) => {
                response.resume();
                const exito =
                    response.statusCode >= 200 && response.statusCode < 300;
                done({
                    exito,
                    statusCode: response.statusCode,
                    ...(exito
                        ? {}
                        : {
                              error:
                                  'El servicio devolvió HTTP ' +
                                  response.statusCode +
                                  '.'
                          })
                });
            }
        ); // No sigue redirecciones.
        connection.on('timeout', () => {
            connection.destroy();
            done({ exito: false, error: 'Tiempo de conexión agotado.' });
        });
        connection.on('error', () =>
            done({
                exito: false,
                error: 'No se pudo conectar al servicio autorizado.'
            })
        );
    });
}
module.exports = { validate, probe };
