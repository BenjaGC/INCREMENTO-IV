// Solo para el ejecutor de pruebas: lee la cookie HttpOnly mediante Playwright, no JavaScript de la página.
module.exports = async (page) => {
    const cookies = await page.context().cookies('http://127.0.0.1:3200');
    const token = cookies.find((c) => c.name === 'clinica_session')?.value;
    if (!/^[a-f0-9]{64}$/.test(token || ''))
        throw Error('La prueba requiere una sesión autenticada.');
    return token;
};
