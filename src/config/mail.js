const nodemailer = require('nodemailer');

const transport = nodemailer.createTransport({
    ...(process.env.SMTP_HOST
        ? {
              host: process.env.SMTP_HOST,
              port: Number(process.env.SMTP_PORT || 587),
              secure: process.env.SMTP_SECURE === 'true',
              requireTLS: process.env.SMTP_SECURE !== 'true'
          }
        : { service: 'gmail' }),
    connectionTimeout: 15000,
    socketTimeout: 30000,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD
    }
});
transport.configured = Boolean(
    process.env.MAIL_USER && process.env.MAIL_PASSWORD
);
const send = transport.sendMail.bind(transport);
transport.sendMail = (message, callback) => {
    if (transport.configured) return send(message, callback);
    const error = new Error('Correo no configurado en el servidor.');
    if (callback) {
        queueMicrotask(() => callback(error));
        return;
    }
    return Promise.reject(error);
};
module.exports = transport;
