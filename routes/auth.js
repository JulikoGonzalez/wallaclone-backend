const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const verificarPulseraVIP = require('../middlewares/auth');
const transporter = require('../utils/email');

// POST /registro
router.post('/registro', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }
        const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!emailValido) {
            return res.status(400).json({ error: 'El email no tiene un formato válido' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }

        const usernameTomado = await Usuario.findOne({ username });
        if (usernameTomado) {
            return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso' });
        }

        const emailTomado = await Usuario.findOne({ email });
        if (emailTomado) {
            return res.status(400).json({ error: 'Ese email ya está registrado' });
        }

        const passwordEncriptada = await bcrypt.hash(password, 10);
        await Usuario.create({ username, email, password: passwordEncriptada });

        res.status(201).json({ mensaje: '¡Usuario registrado con éxito!' });
    } catch (error) {
        console.log('🔴 Error en el registro:', error);
        res.status(500).json({ error: 'Error al registrar el usuario' });
    }
});

// POST /login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'El nombre de usuario y la contraseña son obligatorios' });
        }

        const usuario = await Usuario.findOne({ username });
        if (!usuario) {
            return res.status(401).json({ error: 'Nombre de usuario o contraseña incorrectos' });
        }

        const contraseñaCorrecta = await bcrypt.compare(password, usuario.password);
        if (!contraseñaCorrecta) {
            return res.status(401).json({ error: 'Nombre de usuario o contraseña incorrectos' });
        }

        const token = jwt.sign(
            { id: usuario._id, username: usuario.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ mensaje: '¡Login correcto!', token });
    } catch (error) {
        console.log('🔴 Error en el login:', error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

// POST /logout
// JWT es stateless — la invalidación real ocurre en el cliente borrando el token.
// Esta ruta garantiza que solo usuarios autenticados pueden invocar el logout.
router.post('/logout', verificarPulseraVIP, (req, res) => {
    res.json({ mensaje: 'Sesión cerrada correctamente' });
});

// POST /recuperar-password
router.post('/recuperar-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'El email es obligatorio' });

        const usuario = await Usuario.findOne({ email });

        if (usuario) {
            const token = crypto.randomBytes(32).toString('hex');
            usuario.resetToken = token;
            usuario.resetTokenExpiry = Date.now() + 3600000; // caduca en 1 hora
            await usuario.save();

            const enlace = `${process.env.BASE_URL}/resetear-password.html?token=${token}`;

            await transporter.sendMail({
                from: `"Wallaclone" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: 'Recuperación de contraseña - Wallaclone',
                html: `
                    <h2>Recuperación de contraseña</h2>
                    <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
                    <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
                    <p><a href="${enlace}">${enlace}</a></p>
                    <p>Este enlace caduca en <strong>1 hora</strong>.</p>
                    <p>Si no solicitaste este cambio, puedes ignorar este email.</p>
                `
            });
        }

        // Respuesta genérica para no revelar si el email existe en el sistema
        res.json({ mensaje: 'Si ese email está registrado, recibirás un correo con instrucciones.' });
    } catch (error) {
        console.log('🔴 Error al recuperar contraseña:', error);
        res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
});

// POST /resetear-password/:token
router.post('/resetear-password/:token', async (req, res) => {
    try {
        const { password } = req.body;

        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }

        const usuario = await Usuario.findOne({
            resetToken: req.params.token,
            resetTokenExpiry: { $gt: Date.now() }
        });

        if (!usuario) {
            return res.status(400).json({ error: 'El enlace no es válido o ha caducado' });
        }

        usuario.password = await bcrypt.hash(password, 10);
        usuario.resetToken = undefined;
        usuario.resetTokenExpiry = undefined;
        await usuario.save();

        res.json({ mensaje: '¡Contraseña actualizada con éxito! Ya puedes iniciar sesión.' });
    } catch (error) {
        console.log('🔴 Error al resetear contraseña:', error);
        res.status(500).json({ error: 'Error al actualizar la contraseña' });
    }
});

module.exports = router;
