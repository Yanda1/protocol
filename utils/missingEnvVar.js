function missingEnvVar(var_name) {
    if(!process.env[var_name]) {
        console.log(`${var_name} env var is required...`);
        return true;
    }
    return false;
};

module.exports = { missingEnvVar };
