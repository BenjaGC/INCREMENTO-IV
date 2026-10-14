const { WebSocketServer, WebSocket } = require('ws');
const sessions = require('./session');

module.exports = function attachAvailability(
    server,
    { pool, snapshot, log, clientIp }
) {
    const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
    const peers = new Map();
    let pending = 0;
    server.on('upgrade', (req, socket, head) => {
        if (req.url !== '/api/v3/availability/live') return socket.destroy();
        let validOrigin = true;
        try {
            validOrigin =
                !req.headers.origin ||
                (process.env.NODE_ENV === 'production'
                    ? req.headers.origin ===
                      new URL(process.env.PUBLIC_ORIGIN).origin
                    : new URL(req.headers.origin).host === req.headers.host);
        } catch {
            validOrigin = false;
        }
        if (!validOrigin) {
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            return socket.destroy();
        }
        const ip = clientIp ? clientIp(req) : req.socket.remoteAddress;
        const peer = peers.get(ip) || { clients: 0, pending: 0 };
        if (
            wss.clients.size >= 64 ||
            pending >= 32 ||
            peer.clients >= 24 ||
            peer.pending >= 8
        ) {
            socket.write(
                'HTTP/1.1 429 Too Many Requests\r\nRetry-After: 5\r\n\r\n'
            );
            return socket.destroy();
        }
        wss.handleUpgrade(req, socket, head, (ws) =>
            wss.emit('connection', ws, ip, req)
        );
    });
    wss.on('connection', (ws, ip, req) => {
        const peer = peers.get(ip) || { clients: 0, pending: 0 };
        peers.set(ip, peer);
        peer.clients++;
        peer.pending++;
        pending++;
        let token,
            busy = false,
            authenticated = false;
        const timeout = setTimeout(
            () => ws.close(4401, 'Autenticación requerida'),
            5000
        );
        const send = async () => {
            if (!token || busy || ws.readyState !== WebSocket.OPEN) return;
            busy = true;
            try {
                const [[u]] = await pool.query(
                    `SELECT u.user_id FROM user u WHERE u.session_token_hash=? AND u.user_status=1 AND u.must_reset_password=0 AND u.last_login>DATE_SUB(NOW(),INTERVAL 8 HOUR) AND EXISTS(SELECT 1 FROM user_role r WHERE r.user_id=u.user_id AND r.role_id=1 AND r.active=1)`,
                    [sessions.digest(token)]
                );
                if (ws.readyState !== WebSocket.OPEN) return;
                if (!u) {
                    ws.close(4403, 'Acceso denegado');
                    return;
                }
                if (!authenticated) {
                    authenticated = true;
                    pending--;
                    peer.pending--;
                    clearTimeout(timeout);
                }
                ws.send(
                    JSON.stringify({
                        type: 'availability',
                        data: await snapshot()
                    })
                );
            } catch (error) {
                if (!authenticated)
                    ws.close(1013, 'Servicio temporalmente no disponible');
                if (ws.readyState === WebSocket.OPEN)
                    ws.send(
                        JSON.stringify({
                            type: 'sync-error',
                            message:
                                'Sin sincronización. Se conserva la última actualización válida.'
                        })
                    );
                await log(error, 'error', {
                    operation: 'availability-stream'
                }).catch(() => {});
            } finally {
                busy = false;
            }
        };
        ws.on('message', (raw) => {
            if (token) return;
            try {
                const msg = JSON.parse(raw);
                if (
                    msg.type !== 'auth' ||
                    (!sessions.valid(msg.token) &&
                        (!req.headers.origin ||
                            !sessions.valid(sessions.read(req).token)))
                )
                    throw Error();
                token = msg.token || sessions.read(req).token;
                send();
            } catch {
                ws.close(4401, 'Autenticación inválida');
            }
        });
        const timer = setInterval(send, 15000);
        ws.on('error', () => {});
        ws.on('close', () => {
            peer.clients--;
            if (!authenticated) {
                pending--;
                peer.pending--;
            }
            if (!peer.clients) peers.delete(ip);
            clearTimeout(timeout);
            clearInterval(timer);
        });
    });
    server.on('close', () => {
        for (const ws of wss.clients) ws.terminate();
        wss.close();
    });
    return wss;
};
