// Ejecuta las suites de forma secuencial porque comparten el puerto 3200.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const output = path.resolve('artifacts/verificacion-final-20261014');
fs.mkdirSync(output, { recursive: true });
const suites = [
    ['sintaxis', 'scripts/comprobar-sintaxis.cjs'],
    ['instalacion', 'scripts/test-installation.cjs'],
    ['seguridad', 'scripts/test-production-security.cjs'],
    ['regresion', 'scripts/test-production-regression.cjs'],
    ['incremento-IV', 'scripts/test-increment4.cjs'],
    ['interfaz', 'scripts/production-test-ui.cjs'],
    ['adversarial', 'scripts/test-adversarial.cjs']
];
(async () => {
    const results = [];
    for (const [name, filename] of suites) {
        console.log('INICIANDO:', name);
        const began = Date.now();
        const code = await new Promise((resolve, reject) => {
            const log = fs.createWriteStream(path.join(output, name + '.txt'));
            const child = spawn(process.execPath, [filename], {
                env: process.env,
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true
            });
            for (const stream of [child.stdout, child.stderr])
                stream.on('data', (chunk) => {
                    log.write(chunk);
                    process.stdout.write(chunk);
                });
            child.on('error', reject);
            child.on('close', (code) => log.end(() => resolve(code)));
        });
        results.push({
            name,
            exit_code: code,
            seconds: Math.round((Date.now() - began) / 1000)
        });
        fs.writeFileSync(
            path.join(output, 'RESULTADOS.json'),
            JSON.stringify(
                { date: '2026-10-14', isolated: true, results },
                null,
                2
            )
        );
        if (code !== 0)
            throw Error(
                'Falló ' + name + '. Revisa el registro antes de entregar.'
            );
    }
    console.log('Todas las suites terminaron correctamente.');
})().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
