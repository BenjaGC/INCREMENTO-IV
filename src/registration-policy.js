module.exports = {
    enabled: () =>
        process.env.NODE_ENV !== 'production' ||
        process.env.CLINICA_PUBLIC_REGISTRATION === 'true'
};
