const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
function limits(mb) {
    return {
        fileSize: mb * 1024 * 1024,
        files: 1,
        fields: 20,
        parts: 22,
        fieldSize: 16384,
        fieldNameSize: 100,
        headerPairs: 100
    };
}
function remove(file) {
    if (file) {
        try {
            fs.unlinkSync(file.path);
        } catch (error) {
            if (error.code !== 'ENOENT')
                console.error('No se pudo retirar una carga rechazada.', error);
        }
    }
}
function validate(file, pdfOnly = false) {
    if (!file) return;
    let fd;
    const header = Buffer.alloc(16);
    try {
        fd = fs.openSync(file.path, 'r');
        fs.readSync(fd, header, 0, header.length, 0);
    } catch {
        throw Error(
            'No se pudo leer la carga. Reintenta con un archivo válido.'
        );
    } finally {
        if (fd !== undefined) fs.closeSync(fd);
    }
    const signature = header.toString('ascii');
    const actual = signature.startsWith('%PDF-')
        ? 'application/pdf'
        : header
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? 'image/png'
          : header[0] === 255 && header[1] === 216 && header[2] === 255
            ? 'image/jpeg'
            : /^GIF8[79]a/.test(signature)
              ? 'image/gif'
              : signature.startsWith('RIFF') &&
                  signature.slice(8, 12) === 'WEBP'
                ? 'image/webp'
                : null;
    const ext = path.extname(file.originalname).toLowerCase();
    const expected = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    }[ext];
    if (
        (pdfOnly && (ext !== '.pdf' || actual !== 'application/pdf')) ||
        (expected && expected !== actual)
    )
        throw Error(
            pdfOnly
                ? 'El archivo no contiene un PDF válido.'
                : 'El contenido del archivo no corresponde a su formato.'
        );
    file.mimetype = actual || 'application/octet-stream';
}
// Tamaños declarados antes de que SheetJS descomprima el libro completo.
function validateWorkbook(buffer) {
    let end = -1;
    for (
        let i = buffer.length - 22;
        i >= Math.max(0, buffer.length - 65557);
        i--
    )
        if (buffer.readUInt32LE(i) === 0x06054b50) {
            end = i;
            break;
        }
    if (end < 0) throw Error('Excel inválido.');
    const count = buffer.readUInt16LE(end + 10),
        start = buffer.readUInt32LE(end + 16);
    if (
        !count ||
        count > 2000 ||
        start >= end ||
        buffer.readUInt16LE(end + 4) ||
        buffer.readUInt16LE(end + 6)
    )
        throw Error('Excel inválido o demasiado complejo.');
    let offset = start,
        size = 0;
    for (let i = 0; i < count; i++) {
        if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50)
            throw Error('Excel inválido.');
        const uncompressed = buffer.readUInt32LE(offset + 24);
        if (
            uncompressed === 0xffffffff ||
            buffer.readUInt32LE(offset + 20) === 0xffffffff
        )
            throw Error('Excel demasiado grande.');
        size += uncompressed;
        if (size > 32 * 1024 * 1024)
            throw Error(
                'El Excel supera el contenido descomprimido permitido.'
            );
        const compressed = buffer.readUInt32LE(offset + 20),
            local = buffer.readUInt32LE(offset + 42),
            method = buffer.readUInt16LE(offset + 10);
        if (
            local + 30 > start ||
            buffer.readUInt32LE(local) !== 0x04034b50 ||
            buffer.readUInt16LE(offset + 8) & 1
        )
            throw Error('Excel inválido o cifrado.');
        const data =
            local +
            30 +
            buffer.readUInt16LE(local + 26) +
            buffer.readUInt16LE(local + 28);
        if (data + compressed > start || ![0, 8].includes(method))
            throw Error('Excel inválido.');
        const content =
            method === 8
                ? zlib.inflateRawSync(
                      buffer.subarray(data, data + compressed),
                      { maxOutputLength: Math.max(1, uncompressed) }
                  )
                : buffer.subarray(data, data + compressed);
        if (content.length !== uncompressed)
            throw Error(
                'El contenido del Excel no coincide con su estructura.'
            );
        offset +=
            46 +
            buffer.readUInt16LE(offset + 28) +
            buffer.readUInt16LE(offset + 30) +
            buffer.readUInt16LE(offset + 32);
        if (offset > end) throw Error('Excel inválido.');
    }
}
module.exports = { limits, remove, validate, validateWorkbook };
