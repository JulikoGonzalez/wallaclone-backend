const jwt = require('jsonwebtoken');

// Este es nuestro "portero de discoteca"
function verificarPulseraVIP(req, res, next) {
    // 1. Buscamos la pulsera en las cabeceras del mensaje
    const token = req.header('Authorization');

    // 2. Si no hay pulsera, le denegamos la entrada
    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Necesitas iniciar sesión.' });
    }

    try {
        // 3. Si hay pulsera, comprobamos que no sea falsa y que la firma sea la nuestra
        // (El token suele venir con la palabra "Bearer " delante, se la quitamos)
        const tokenLimpio = token.startsWith('Bearer ') ? token.slice(7) : token;
        const usuarioVerificado = jwt.verify(tokenLimpio, process.env.JWT_SECRET);

        // 4. Si la pulsera es buena, apuntamos quién es el usuario y le dejamos pasar a la fiesta
        req.usuario = usuarioVerificado;
        next(); // next() significa "pasa pa'dentro"
    } catch (error) {
        // 5. Si la pulsera ha caducado o es falsa, lo echamos
        res.status(401).json({ error: 'Tu sesión ha caducado o el token no es válido.' });
    }
}

module.exports = verificarPulseraVIP;