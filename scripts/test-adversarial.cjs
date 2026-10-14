// Pruebas autorizadas y acotadas: solo loopback, base temporal y transporte de correo de prueba.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');
const { WebSocket } = require('ws');
const { chromium, expect } = require('@playwright/test');
const probe = process.argv.includes('--probe');
const output = path.resolve('artifacts/seguridad-20261014');
fs.mkdirSync(output, { recursive: true });
const results = [];
const base = 'http://127.0.0.1:3200';
const options = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
};
const name = 'clinica_ui_test_' + Date.now();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'clinica-security-'));
let db, child, browser, originalHash;
const password = crypto.randomBytes(18).toString('hex');
async function originalDigest() {
    const h = crypto.createHash('sha256');
    for (const table of ['user', 'user_role', 'ticket', 'attachment']) {
        const [rows] = await db.query('SELECT * FROM ??.?? ORDER BY 1', [
            process.env.DB_NAME,
            table
        ]);
        h.update(JSON.stringify(rows));
    }
    return h.digest('hex');
}
async function request(
    url,
    token,
    body,
    method = body === undefined ? 'GET' : 'POST',
    extra = {}
) {
    return fetch(base + url, {
        method,
        headers: {
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
            ...(body === undefined || body instanceof FormData
                ? {}
                : { 'Content-Type': 'application/json' }),
            ...extra
        },
        body:
            body === undefined
                ? undefined
                : body instanceof FormData
                  ? body
                  : JSON.stringify(body),
        signal: AbortSignal.timeout(10000)
    });
}
async function test(label, action) {
    const began = Date.now();
    try {
        await action();
        results.push({
            name: label,
            result: 'correcto',
            ms: Date.now() - began
        });
        console.log('OK:', label);
    } catch (error) {
        const page = browser?.contexts()[0]?.pages()[0];
        if (page) {
            await page
                .screenshot({ path: path.join(output, 'diagnostico-ui.png') })
                .catch(() => {});
            console.log(
                'Diagnóstico UI:',
                await page
                    .evaluate(() => {
                        const s = Alpine.$data(document.documentElement);
                        return {
                            modo: s.modo,
                            soporte: s.esSoporte,
                            usuario: s.usuario?.nombre,
                            permisos: s.usuario?.permisos,
                            critico: s.usuario?.esCritico,
                            lista: s.listaTickets?.length,
                            activos: s.incidentesActivos?.length,
                            filtrados: s.ticketsFiltrados?.length,
                            error: s.ticketsError
                        };
                    })
                    .catch(() => ({}))
            );
        }
        results.push({
            name: label,
            result: 'fallo',
            detail: error.message,
            ms: Date.now() - began
        });
        throw error;
    }
}
async function alive() {
    const r = await request('/health/ready');
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { status: 'ready' });
}
function upload(filename, text, type = 'text/plain', code = 'INC0000001') {
    const body = new FormData();
    body.append('id_ticket', code);
    body.append('texto', 'Evidencia de prueba autorizada');
    body.append('archivo', new Blob([text], { type }), filename);
    return body;
}
async function wsResult(token, origin, payload) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(
            'ws://127.0.0.1:3200/api/v3/availability/live',
            { origin }
        );
        const timer = setTimeout(() => {
            ws.terminate();
            reject(Error('WebSocket no rechazó o respondió a tiempo.'));
        }, 6500);
        const done = (value) => {
            clearTimeout(timer);
            ws.terminate();
            resolve(value);
        };
        ws.on('open', () => {
            if (payload) ws.send(payload);
            else if (token) ws.send(JSON.stringify({ type: 'auth', token }));
        });
        ws.on('message', (raw) => done({ data: JSON.parse(raw.toString()) }));
        ws.on('close', (code) => done({ close: code }));
        ws.on('unexpected-response', (_req, res) => {
            res.resume();
            done({ status: res.statusCode });
        });
        ws.on('error', () => {});
    });
}
(async () => {
    db = await mysql.createConnection(options);
    originalHash = await originalDigest();
    try {
        await db.query('CREATE DATABASE ??', [name]);
        await db.changeUser({ database: name });
        await db.query(fs.readFileSync('database/clinica.sql', 'utf8'));
        await db.query(fs.readFileSync('database/datos-iniciales.sql', 'utf8'));
        const hash = await require('../src/passwords').hash(password);
        for (const [id, title, rut, role, critical] of [
            [1, 'Administración QA', '11111111-1', 1, 0],
            [2, 'Persona con nombre compartido', '22222222-2', 2, 0],
            [3, 'Persona con nombre compartido', '33333333-3', 2, 0],
            [4, 'Técnico QA', '44444444-4', 2, 1]
        ]) {
            await db.query(
                "INSERT INTO user(user_id,first_name,first_last_name,second_last_name,institutional_email,rut,username,password_hash,is_critical_tech) VALUES (?,?,'','',?,?,?,?,?)",
                [
                    id,
                    title,
                    'qa' + id + '@example.test',
                    rut,
                    rut,
                    hash,
                    critical
                ]
            );
            await db.query(
                'INSERT INTO user_role(assignment_date,active,role_id,user_id) VALUES(NOW(),1,?,?)',
                [role, id]
            );
        }
        const [equipment] = await db.query(
            "INSERT INTO equipment(equipment_name,equipment_type) VALUES('Activo privado de prueba','Otro')"
        );
        await db.query(
            "INSERT INTO ticket(ticket_code,title,description,requester_user_id,category_id,status_id,priority_id,equipment_id,assigned_user_id) VALUES('INC0000001','Incidente privado','Contenido privado de prueba',3,1,5,1,?,1)",
            [equipment.insertId]
        );
        for (const file of ['index.html', 'css', 'js', 'vendor'])
            fs.cpSync(path.join('public', file), path.join(temp, file), {
                recursive: true
            });
        fs.mkdirSync(path.join(temp, 'uploads'));
        fs.mkdirSync(path.join(temp, 'manuales'));
        child = spawn(process.execPath, ['scripts/test-server.cjs'], {
            env: {
                ...process.env,
                NODE_ENV: 'test',
                DB_NAME: name,
                CLINICA_DATA_DIR: '',
                CLINIC_TEST_PUBLIC: temp,
                CLINIC_TEST_PORT: '3200',
                CLINIC_CAPTURE_MAIL: path.join(temp, 'mail.jsonl'),
                CLINICA_LOG_FALLBACK: path.join(temp, 'fallback.log'),
                CLINICA_TRACE_BACKUP_DIR: path.join(temp, 'traces')
            },
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        });
        let logs = '';
        child.stdout.on('data', (c) => (logs += c));
        child.stderr.on('data', (c) => (logs += c));
        for (let i = 0; i < 120; i++) {
            if (child.exitCode !== null)
                throw Error('Servidor de prueba detenido.');
            try {
                await alive();
                break;
            } catch {}
            await new Promise((r) => setTimeout(r, 500));
        }
        await alive();
        const login = async (rut) => {
            const r = await request('/login', null, { rut, password });
            assert.equal(r.status, 200);
            return (await r.json()).token;
        };
        const admin = await login('11111111-1'),
            user = await login('22222222-2'),
            owner = await login('33333333-3'),
            tech = await login('44444444-4');
        await test('La base solo conserva el hash de sesión y ese hash no permite autenticarse', async () => {
            const [[row]] = await db.query(
                'SELECT session_token,session_token_hash,password_hash FROM user WHERE user_id=1'
            );
            assert.equal(row.session_token, null);
            assert.equal(
                row.session_token_hash,
                require('../src/session').digest(admin)
            );
            assert.notEqual(row.session_token_hash, admin);
            assert.equal(
                (await request('/incidentes', row.session_token_hash)).status,
                401
            );
            assert.match(row.password_hash, /^\$2[aby]\$/);
            assert.equal(
                await require('../src/passwords').verify('legacy', 'legacy'),
                false
            );
        });
        await test('Cookie HttpOnly permite escrituras propias con control CSRF, nunca desde otro origen', async () => {
            assert.equal(
                (
                    await request(
                        '/api/v3/profile',
                        null,
                        { area: 'Prueba propia', piso: 'Piso 1' },
                        'PUT',
                        {
                            Cookie: 'clinica_session=' + owner,
                            'X-Clinica-Request': '1',
                            Origin: base
                        }
                    )
                ).status,
                200
            );
            assert.equal(
                (
                    await request(
                        '/api/v3/profile',
                        null,
                        { area: 'No autorizado', piso: 'Piso 1' },
                        'PUT',
                        {
                            Cookie: 'clinica_session=' + owner,
                            'X-Clinica-Request': '1',
                            Origin: 'https://externo.example'
                        }
                    )
                ).status,
                403
            );
        });
        await test('Los GET del ticket no aceptan un body para sustituir el código de la URL', async () => {
            for (const suffix of [
                'materiales',
                'etiqueta-pdf',
                'qr',
                'adjuntos-zip'
            ])
                assert.equal(
                    (await request('/incidente/INC0000001/' + suffix, user))
                        .status,
                    403
                );
            const [ownTicket] = await db.query(
                "INSERT INTO ticket(ticket_code,title,description,requester_user_id,category_id,status_id,priority_id,equipment_id,assigned_user_id) VALUES('INC0000088','Propio','Ticket propio para comprobar alcance',2,1,5,1,?,1)",
                [equipment.insertId]
            );
            const http = require('node:http');
            const status = await new Promise((resolve, reject) => {
                const data = JSON.stringify({ id_ticket: 'INC0000088' });
                const req = http.request(
                    base + '/incidente/INC0000001/qr',
                    {
                        method: 'GET',
                        headers: {
                            Authorization: 'Bearer ' + user,
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(data)
                        }
                    },
                    (res) => {
                        res.resume();
                        resolve(res.statusCode);
                    }
                );
                req.on('error', reject);
                req.end(data);
            });
            assert.equal(status, 403);
            assert.equal(
                (await request('/incidente/qr?id_ticket=INC0000088', user))
                    .status,
                400
            );
            await db.query('DELETE FROM ticket WHERE ticket_id=?', [
                ownTicket.insertId
            ]);
        });
        await test('Las rutas versionadas deniegan por defecto cualquier función no autorizada', async () => {
            for (const url of [
                '/api/v3/availability',
                '/api/v3/competencies',
                '/api/v3/surveys',
                '/api/v3/survey-results',
                '/api/v3/trash',
                '/api/v3/jobs',
                '/api/v3/integration-activity',
                '/api/v3/no-registrada',
                '/api/v4/no-registrada'
            ])
                for (const token of [user, tech])
                    assert.equal((await request(url, token)).status, 403);
        });
        await test('Rutas y archivos sensibles requieren autenticación', async () => {
            for (const url of [
                '/.env',
                '/server.js',
                '/database/clinica.sql',
                '/api/v3/logs',
                '/api/v4/security',
                '/api/v4/traces',
                '/uploads/private.txt'
            ]) {
                const r = await request(url);
                assert.ok([401, 403, 404].includes(r.status));
                assert.ok(!(await r.text()).includes('DB_PASSWORD'));
            }
        });
        await test('Producción exige datos privados, secreto y proxies explícitos; desarrollo no se expone a la red', async () => {
            const { spawnSync } = require('node:child_process');
            const config = {
                ...process.env,
                NODE_ENV: 'production',
                DB_NAME: 'config_validada',
                DB_USER: 'clinica_app',
                DB_PASSWORD: 'CredencialPrivadaDePrueba',
                PUBLIC_ORIGIN: 'https://clinica.example',
                MAIL_USER: 'qa@example.test',
                MAIL_PASSWORD: 'CorreoPrivadoDePrueba',
                CLINICA_BACKUP_DIR: path.join(temp, 'backup'),
                CLINICA_DATA_DIR: path.join(temp, 'data'),
                CLINICA_TRUSTED_PROXIES: '127.0.0.1',
                CLINICA_RECOVERY_SECRET: crypto.randomBytes(32).toString('hex'),
                CLINIC_TEST_PUBLIC: '',
                CLINIC_INTEGRATION_TEST: '',
                TRUST_PROXY_HOPS: ''
            };
            const validate = (changes) =>
                spawnSync(
                    process.execPath,
                    [
                        '-e',
                        'require(process.argv[1])()',
                        path.resolve('src/production-config.js')
                    ],
                    {
                        env: { ...config, ...changes },
                        encoding: 'utf8',
                        windowsHide: true
                    }
                ).status;
            assert.equal(validate({}), 0);
            for (const change of [
                { CLINICA_DATA_DIR: '' },
                { CLINICA_DATA_DIR: path.resolve('public/uploads') },
                { CLINICA_TRUSTED_PROXIES: '0.0.0.0/0' },
                { TRUST_PROXY_HOPS: '2' },
                { NODE_ENV: 'development', CLINICA_BIND_ADDRESS: '0.0.0.0' },
                { CLINICA_RECOVERY_SECRET: 'corta' }
            ])
                assert.notEqual(validate(change), 0);
            assert.ok(
                fs
                    .readFileSync('.env.example', 'utf8')
                    .includes('NODE_ENV=production')
            );
        });
        await test('Recuperación persiste entre instancias y reemitir no reinicia intentos ni inunda de correos', async () => {
            await db.query(
                "UPDATE user SET institutional_email='recuperacion@example.test' WHERE user_id=3"
            );
            const mails = () =>
                fs
                    .readFileSync(path.join(temp, 'mail.jsonl'), 'utf8')
                    .trim()
                    .split('\n')
                    .map(JSON.parse)
                    .filter((m) => m.subject === 'Recuperación de acceso');
            assert.equal(
                (
                    await request('/recuperar-solicitar', null, {
                        rut: '33333333-3'
                    })
                ).status,
                200
            );
            assert.equal(mails().length, 1);
            for (let n = 0; n < 4; n++)
                assert.equal(
                    (
                        await request('/recuperar-verificar', null, {
                            rut: '33333333-3',
                            codigo: '000000'
                        })
                    ).status,
                    400
                );
            await db.query(
                'UPDATE security_recovery SET last_sent=DATE_SUB(NOW(),INTERVAL 2 MINUTE)'
            );
            assert.equal(
                (
                    await request('/recuperar-solicitar', null, {
                        rut: '33333333-3'
                    })
                ).status,
                200
            );
            const code = mails()
                .at(-1)
                .text.match(/\b\d{6}\b/)[0];
            const [[row]] = await db.query('SELECT * FROM security_recovery');
            assert.equal(row.attempts, 4);
            assert.equal(row.sends, 2);
            assert.notEqual(row.code_hash, code);
            const isolatedPool = mysql.createPool({
                ...options,
                database: name
            });
            try {
                const handlers = new Map();
                require('../src/password-recovery')(
                    { post: (route, fn) => handlers.set(route, fn) },
                    {
                        pool: isolatedPool,
                        transporter: { sendMail: async () => {} }
                    }
                );
                const reply = {
                    statusCode: 200,
                    status(n) {
                        this.statusCode = n;
                        return this;
                    },
                    json(value) {
                        this.value = value;
                        return this;
                    }
                };
                await handlers.get('/recuperar-verificar')(
                    { body: { rut: '33333333-3', codigo: code } },
                    reply
                );
                assert.equal(reply.statusCode, 200);
                assert.equal(reply.value.success, true);
            } finally {
                await isolatedPool.end();
            }
            assert.equal(
                (
                    await request('/recuperar-verificar', null, {
                        rut: '33333333-3',
                        codigo: '000000'
                    })
                ).status,
                400
            );
            for (let n = 0; n < 4; n++)
                assert.equal(
                    (
                        await request('/recuperar-solicitar', null, {
                            rut: '33333333-3'
                        })
                    ).status,
                    200
                );
            assert.equal(mails().length, 2);
            assert.equal(
                (
                    await request('/recuperar-verificar', null, {
                        rut: '33333333-3',
                        codigo: code
                    })
                ).status,
                400
            );
        });
        await test('Los enlaces de comentarios incorporan protección de apertura externa', async () => {
            await db.query(
                'INSERT INTO comment(content,user_id,ticket_id) SELECT \'<a href="https://example.test" target="_blank">Documento</a>\',3,ticket_id FROM ticket WHERE ticket_code=\'INC0000001\''
            );
            const response = await request('/incidentes', owner);
            const tickets = await response.json();
            const comments = JSON.parse(
                tickets.find((t) => t.id_ticket === 'INC0000001').comentarios
            );
            assert.ok(
                comments.some((c) =>
                    c.texto.includes('rel="noopener noreferrer"')
                )
            );
        });
        await test('Nombres iguales y parámetros falsificados no conceden tickets ajenos', async () => {
            for (const url of [
                '/incidentes?esAdmin=si&usuario=Administración',
                '/incidentes/buscar?q=privado&esAdmin=si'
            ]) {
                const r = await request(url, user);
                assert.equal(r.status, 200);
                assert.deepEqual(await r.json(), []);
            }
            assert.equal(
                (
                    await request('/incidente/ver', user, {
                        id_ticket: 'INC0000001'
                    })
                ).status,
                403
            );
        });
        await test('Una consulta malformada se rechaza sin detener el servidor', async () => {
            const r = await request('/incidentes/buscar?q[valor]=prueba', user);
            assert.equal(r.status, 400);
            await alive();
        });
        if (probe) return;
        await test('JSON con tipos incorrectos recibe 400 y mantiene el servicio', async () => {
            for (const body of [
                { descripcion: {}, category_id: 1 },
                { descripcion: ['no'], category_id: 1 },
                []
            ])
                assert.equal(
                    (await request('/incidente', user, body)).status,
                    400
                );
            await alive();
        });
        await test('Inyección SQL no extrae ni modifica datos', async () => {
            for (const q of [
                "' OR 1=1 --",
                "' UNION SELECT password_hash FROM user --",
                "'; DROP TABLE ticket; --"
            ]) {
                const r = await request(
                    '/incidentes/buscar?q=' + encodeURIComponent(q),
                    user
                );
                assert.equal(r.status, 200);
                assert.deepEqual(await r.json(), []);
            }
            assert.equal(
                (await db.query('SELECT COUNT(*) n FROM ticket'))[0][0].n,
                1
            );
        });
        await test('Registro no acepta privilegios enviados por el cliente y se cierra por defecto en producción', async () => {
            const r = await request('/registro', null, {
                nombre: 'Cuenta de prueba sin privilegios',
                rut: '12345678-5',
                correo: 'nueva@example.test',
                password,
                role_id: 1,
                permisos: 'si',
                tipo_usuario: 'ADMINISTRADOR'
            });
            assert.equal(r.status, 200);
            const [[u]] = await db.query(
                "SELECT u.tipo_usuario,EXISTS(SELECT 1 FROM user_role r WHERE r.user_id=u.user_id AND r.role_id=1 AND r.active=1) admin FROM user u WHERE rut='12345678-5'"
            );
            assert.equal(u.admin, 0);
            assert.equal(u.tipo_usuario, 'SOLICITANTE');
            const previous = process.env.NODE_ENV,
                flag = process.env.CLINICA_PUBLIC_REGISTRATION;
            try {
                process.env.NODE_ENV = 'production';
                delete process.env.CLINICA_PUBLIC_REGISTRATION;
                assert.equal(
                    require('../src/registration-policy').enabled(),
                    false
                );
                process.env.CLINICA_PUBLIC_REGISTRATION = 'true';
                assert.equal(
                    require('../src/registration-policy').enabled(),
                    true
                );
            } finally {
                if (previous === undefined) delete process.env.NODE_ENV;
                else process.env.NODE_ENV = previous;
                if (flag === undefined)
                    delete process.env.CLINICA_PUBLIC_REGISTRATION;
                else process.env.CLINICA_PUBLIC_REGISTRATION = flag;
            }
        });
        await test('Las cabeceras restringen scripts externos, enmarcado y detección de MIME', async () => {
            const r = await request('/');
            assert.equal(r.headers.get('x-powered-by'), null);
            assert.equal(r.headers.get('x-frame-options'), 'DENY');
            assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
            assert.match(
                r.headers.get('content-security-policy'),
                /script-src 'self'/
            );
            assert.match(
                r.headers.get('content-security-policy'),
                /frame-ancestors 'none'/
            );
        });
        await test('Excel que declara expansión excesiva se rechaza antes de procesarlo', async () => {
            const XLSX = require('xlsx'),
                wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(
                wb,
                XLSX.utils.aoa_to_sheet([
                    ['nombre', 'rut', 'correo', 'password'],
                    ['Prueba', '55555555-5', 'ejemplo@example.test', password]
                ]),
                'Usuarios'
            );
            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            const central = buffer.indexOf(Buffer.from([80, 75, 1, 2]));
            assert.ok(central > 0);
            buffer.writeUInt32LE(64 * 1024 * 1024, central + 24);
            const body = new FormData();
            body.append('archivo', new Blob([buffer]), 'archivo-excesivo.xlsx');
            assert.equal(
                (await request('/api/v3/users/import', admin, body)).status,
                400
            );
            await alive();
        });
        await test('JSON con claves de prototipo no modifica objetos compartidos', async () => {
            const r = await request(
                '/api/v3/config',
                admin,
                JSON.parse('{"__proto__":{"polluted":"si"}}'),
                'PUT'
            );
            assert.equal(r.status, 400);
            assert.equal({}.polluted, undefined);
        });
        await test('Solicitante y técnico no pueden administrar seguridad, importación ni parámetros', async () => {
            for (const token of [user, tech])
                for (const url of [
                    '/api/v4/security',
                    '/api/v4/traces',
                    '/api/v3/config',
                    '/api/v3/logs',
                    '/api/v3/users/template'
                ])
                    assert.equal((await request(url, token)).status, 403);
            assert.equal(
                (
                    await request('/api/v4/security/unlock', user, {
                        user_id: 1,
                        reason: 'Intento sin permisos'
                    })
                ).status,
                403
            );
        });
        await test('Cookie sin bearer y origen extraño no autorizan mutaciones', async () => {
            assert.equal(
                (
                    await request(
                        '/api/v3/password',
                        null,
                        { password: 'ContraseñaAlternativa2026!' },
                        'POST',
                        {
                            Cookie: 'clinica_session=' + owner,
                            Origin: 'https://sitio-no-autorizado.example'
                        }
                    )
                ).status,
                403
            );
        });
        await test('Recorrido de carpetas no expone archivos ni configuración', async () => {
            for (const url of [
                '/manuales/..%2f..%2f.env',
                '/js/%2e%2e/%2e%2e/.env',
                '/uploads/%2e%2e%2f.env'
            ]) {
                const r = await request(url, admin);
                assert.ok([400, 401, 403, 404].includes(r.status));
                assert.ok(!(await r.text()).includes('DB_PASSWORD'));
            }
        });
        await test('Subir a un ticket inexistente o ajeno no deja archivos huérfanos', async () => {
            const before = fs.readdirSync(path.join(temp, 'uploads')).length;
            assert.equal(
                (
                    await request(
                        '/incidente/comentar',
                        user,
                        upload('evidencia.txt', 'Prueba sin permiso')
                    )
                ).status,
                403
            );
            assert.equal(
                (
                    await request(
                        '/incidente/comentar',
                        owner,
                        upload(
                            'evidencia.txt',
                            'Prueba sin ticket',
                            'text/plain',
                            'INC9999999'
                        )
                    )
                ).status,
                404
            );
            assert.equal(
                fs.readdirSync(path.join(temp, 'uploads')).length,
                before
            );
        });
        await test('Evidencia HTML se descarga sin ejecutar scripts en el origen', async () => {
            const r = await request(
                '/incidente/comentar',
                owner,
                upload(
                    'evidencia.html',
                    '<script>window.ejecucionNoAutorizada=true</script>',
                    'text/html'
                )
            );
            assert.equal(r.status, 200);
            const [[a]] = await db.query(
                'SELECT file_path FROM attachment ORDER BY attachment_id DESC LIMIT 1'
            );
            const download = await request(a.file_path, owner);
            assert.equal(download.status, 200);
            assert.match(
                download.headers.get('content-disposition'),
                /attachment/
            );
            assert.match(
                download.headers.get('content-security-policy'),
                /sandbox/
            );
            assert.equal((await request(a.file_path, user)).status, 404);
        });
        await test('Evidencia JavaScript se entrega como descarga binaria', async () => {
            const r = await request(
                '/incidente/comentar',
                owner,
                upload(
                    'evidencia.js',
                    'window.ejecucionNoAutorizada=true',
                    'application/javascript'
                )
            );
            assert.equal(r.status, 200);
            const [[a]] = await db.query(
                'SELECT file_path FROM attachment ORDER BY attachment_id DESC LIMIT 1'
            );
            const download = await request(a.file_path, owner);
            assert.equal(download.status, 200);
            assert.match(
                download.headers.get('content-disposition'),
                /attachment/
            );
            assert.equal(
                download.headers.get('content-type'),
                'application/octet-stream'
            );
        });
        await test('Fórmulas de texto se neutralizan en la exportación CSV', async () => {
            await db.query(
                "UPDATE priority SET priority_name='=1+1' WHERE priority_id=1"
            );
            await db.query(
                "INSERT INTO ticket(ticket_code,title,description,requester_user_id,category_id,status_id,priority_id,equipment_id,assigned_user_id,resolution_date) VALUES('INC0000099','Prueba CSV','Exportación autorizada',3,1,4,1,?,1,NOW())",
                [equipment.insertId]
            );
            const r = await request('/reportes/exportar', admin, {
                formato: 'csv'
            });
            assert.equal(r.status, 200);
            const csv = await r.text();
            assert.ok(csv.includes('"\'=1+1"'));
            assert.ok(!csv.includes(';"=1+1";'));
            await db.query(
                "UPDATE priority SET priority_name='Prueba local' WHERE priority_id=1"
            );
        });
        await test('Manual con extensión y MIME PDF falsificados se rechaza', async () => {
            const body = new FormData();
            body.append(
                'manual',
                new Blob(['<script>notAPdf()</script>'], {
                    type: 'application/pdf'
                }),
                'manual-falso.pdf'
            );
            const before = fs.readdirSync(path.join(temp, 'manuales')).length;
            assert.equal(
                (await request('/manuales/subir', admin, body)).status,
                400
            );
            assert.equal(
                fs.readdirSync(path.join(temp, 'manuales')).length,
                before
            );
        });
        await test('Los campos multipart están acotados', async () => {
            const body = new FormData();
            body.append('id_ticket', 'INC0000001');
            for (let i = 0; i < 30; i++)
                body.append('extra' + i, 'campo de prueba');
            assert.equal(
                (await request('/incidente/comentar', owner, body)).status,
                400
            );
            await alive();
        });
        await test('No hay inyección de HTML en las notificaciones de correo', async () => {
            const r = await request('/incidente', user, {
                piso: 'Piso 1',
                habitacion: 'Área QA',
                aparato: 'Impresora',
                category_id: 2,
                priority_id: 1,
                descripcion:
                    '<img src="https://example.test/track" onerror="alert(1)"> Prueba autorizada de escape'
            });
            assert.equal(r.status, 200);
            const messages = fs
                .readFileSync(path.join(temp, 'mail.jsonl'), 'utf8')
                .trim()
                .split('\n')
                .map(JSON.parse);
            const email = messages.find(
                (m) => m.html && m.html.includes('Prueba autorizada de escape')
            );
            assert.ok(email);
            assert.ok(
                !email.html.includes('<img src="https://example.test/track"')
            );
            assert.ok(email.html.includes('&lt;img'));
        });
        await test('Una URL externa no autorizada no puede alcanzar servicios internos', async () => {
            const r = await request(
                '/configuracion-externa',
                admin,
                { external_endpoint_url: 'http://127.0.0.1:3306/' },
                'PUT'
            );
            assert.equal(r.status, 400);
        });
        await test('WebSocket exige sesión administrativa y rechaza otros orígenes', async () => {
            assert.equal(
                (await wsResult(admin, 'https://sitio-no-autorizado.example'))
                    .status,
                403
            );
            assert.equal((await wsResult(user, base)).close, 4403);
            assert.equal(
                (await wsResult(null, base, '{malformado')).close,
                4401
            );
            assert.equal(
                (await wsResult(admin, base)).data.type,
                'availability'
            );
        });
        await test('Conexiones WebSocket sin autenticar no ocupan indefinidamente el servicio', async () => {
            const connections = Promise.all(
                Array.from({ length: 12 }, () => wsResult(null, base))
            );
            await new Promise((resolve) => setTimeout(resolve, 100));
            await alive();
            const responses = await connections;
            assert.ok(responses.some((r) => r.status === 429));
            assert.ok(
                responses.every((r) => r.status === 429 || r.close === 4401)
            );
            await alive();
        });
        await test('Una ráfaga acotada de 80 consultas con 8 clientes conserva la disponibilidad', async () => {
            const latencies = [];
            let index = 0;
            await Promise.all(
                Array.from({ length: 8 }, async () => {
                    while (index < 80) {
                        index++;
                        const at = Date.now();
                        const r = await request('/api/v3/profile', owner);
                        assert.ok([200, 429, 503].includes(r.status));
                        await r.arrayBuffer();
                        latencies.push(Date.now() - at);
                        if (Date.now() - at > 5000)
                            throw Error('Latencia excesiva: prueba detenida.');
                    }
                })
            );
            await alive();
            latencies.sort((a, b) => a - b);
            results.push({
                name: 'Medición de ráfaga local',
                result: 'correcto',
                requests: latencies.length,
                concurrency: 8,
                p95ms: latencies[Math.floor(latencies.length * 0.95)],
                maxms: Math.max(...latencies)
            });
        });
        await test('XSS almacenado no se ejecuta al abrir el ticket', async () => {
            const [[fixture]] = await db.query(
                'SELECT ticket_id,ticket_code FROM ticket WHERE assigned_user_id=4 ORDER BY ticket_id DESC LIMIT 1'
            );
            await db.query(
                "INSERT INTO comment(content,user_id,ticket_id) VALUES('<img src=x onerror=window.ejecucionNoAutorizada=true><script>window.ejecucionNoAutorizada=true</script>',3,?)",
                [fixture.ticket_id]
            );
            browser = await chromium.launch();
            const ctx = await browser.newContext();
            const page = await ctx.newPage();
            await page.goto(base);
            await page
                .locator('.welcome-panel')
                .getByRole('button', { name: 'Iniciar sesión' })
                .click();
            await page.locator('[x-model="login.rut"]').fill('44444444-4');
            await page.locator('[x-model="login.pass"]').fill(password);
            await page
                .locator('[x-show="authTab===\'login\'"]')
                .getByRole('button', { name: /Ingresar/ })
                .click();
            await page
                .getByRole('button', {
                    name: 'Bandeja de soporte',
                    exact: true
                })
                .click();
            await page
                .getByRole('button', { name: fixture.ticket_code, exact: true })
                .click();
            await expect(page.locator('.detail-window')).toBeVisible();
            const r = await request('/incidentes', owner);
            const tickets = await r.text();
            assert.ok(!tickets.includes('onerror'));
            assert.ok(!tickets.includes('<script>'));
            assert.equal(
                await page.evaluate(() => window.ejecucionNoAutorizada),
                undefined
            );
            const profile = await page.evaluate(() =>
                JSON.parse(localStorage.getItem('usuario_actual'))
            );
            assert.ok(!Object.hasOwn(profile, 'token'));
            assert.equal(
                await page.evaluate(
                    () => Alpine.$data(document.documentElement).usuario.token
                ),
                undefined
            );
            const cookies = await ctx.cookies(base);
            assert.ok(
                cookies.find((c) => c.name === 'clinica_session').httpOnly
            );
            assert.ok(
                !(await page.request.get(base))
                    .headers()
                    ['content-security-policy'].includes('unsafe-eval')
            );
            await ctx.close();
        });
        await test('La sesión se revoca al cerrar y no admite reutilización', async () => {
            assert.equal(
                (await request('/sesion/cerrar', owner, {})).status,
                200
            );
            assert.equal((await request('/incidentes', owner)).status, 401);
        });
    } finally {
        if (browser) await browser.close();
        if (child && child.exitCode === null) {
            child.kill();
            await new Promise((r) => child.once('exit', r));
        }
        const unchanged = originalHash === (await originalDigest());
        results.push({
            name: 'Conservación de datos originales',
            result: unchanged ? 'correcto' : 'fallo'
        });
        if (/^clinica_ui_test_\d+$/.test(name)) {
            await db.changeUser({ database: 'mysql' });
            await db.query('DROP DATABASE IF EXISTS ??', [name]);
        }
        await db.end();
        if (
            path.dirname(temp) === os.tmpdir() &&
            path.basename(temp).startsWith('clinica-security-')
        )
            fs.rmSync(temp, { recursive: true, force: true });
        fs.writeFileSync(
            path.join(output, probe ? 'SONDEO.json' : 'RESULTADOS.json'),
            JSON.stringify(
                {
                    date: '2026-10-14',
                    target: 'loopback y base aislada',
                    boundedLoad: { requests: 80, concurrency: 8 },
                    results
                },
                null,
                2
            )
        );
        assert.ok(unchanged, 'Los datos originales cambiaron.');
    }
})().catch((error) => {
    console.error('Revisión interrumpida:', error.message);
    process.exitCode = 1;
});
