const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Anuncio  = require('../models/Anuncio');
const Usuario  = require('../models/Usuario');
const Oferta   = require('../models/Oferta');
const verificarPulseraVIP = require('../middlewares/auth');

// PUT /usuarios/mi-cuenta — actualizar datos del usuario autenticado
router.put('/usuarios/mi-cuenta', verificarPulseraVIP, async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const usuarioId = req.usuario.id;
        const cambios   = {};

        if (username) {
            const existente = await Usuario.findOne({ username, _id: { $ne: usuarioId } });
            if (existente) return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso' });
            cambios.username = username;
        }

        if (email) {
            const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            if (!emailValido) return res.status(400).json({ error: 'El email no tiene un formato válido' });
            const existente = await Usuario.findOne({ email, _id: { $ne: usuarioId } });
            if (existente) return res.status(400).json({ error: 'Ese email ya está siendo utilizado' });
            cambios.email = email;
        }

        if (password) {
            if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
            cambios.password = await bcrypt.hash(password, 10);
        }

        if (Object.keys(cambios).length === 0) {
            return res.status(400).json({ error: 'No se han enviado datos para actualizar' });
        }

        await Usuario.findByIdAndUpdate(usuarioId, cambios);
        res.json({ mensaje: 'Datos actualizados con éxito. Vuelve a iniciar sesión para aplicar los cambios.' });
    } catch (error) {
        console.log('🔴 Error al actualizar usuario:', error);
        res.status(500).json({ error: 'Error al actualizar los datos' });
    }
});

// DELETE /usuarios/mi-cuenta — dar de baja la cuenta con eliminación en cascada
router.delete('/usuarios/mi-cuenta', verificarPulseraVIP, async (req, res) => {
    try {
        const usuarioId = req.usuario.id;

        const anunciosUsuario = await Anuncio.find({ autor: usuarioId }, '_id');
        const idsAnuncios     = anunciosUsuario.map(a => a._id);

        await Oferta.deleteMany({ anuncio: { $in: idsAnuncios } });
        await Oferta.deleteMany({ comprador: usuarioId });

        if (idsAnuncios.length > 0) {
            await Usuario.updateMany(
                { favoritos: { $in: idsAnuncios } },
                { $pull: { favoritos: { $in: idsAnuncios } } }
            );
        }

        await Anuncio.deleteMany({ autor: usuarioId });
        await Usuario.findByIdAndDelete(usuarioId);

        res.json({ mensaje: '¡Cuenta eliminada! Toda tu información ha sido borrada.' });
    } catch (error) {
        console.log('🔴 Error al dar de baja usuario:', error);
        res.status(500).json({ error: 'Error al eliminar la cuenta' });
    }
});

// GET /api/usuarios/:username/anuncios — anuncios públicos de un usuario (con paginación)
router.get('/api/usuarios/:username/anuncios', async (req, res) => {
    try {
        const usuario = await Usuario.findOne({ username: req.params.username });
        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

        const pagina = parseInt(req.query.page) || 1;
        const limite = Math.min(parseInt(req.query.limite) || 4, 20);
        const saltar = (pagina - 1) * limite;

        const anunciosUsuario = await Anuncio.find({ autor: usuario._id })
            .sort({ _id: -1 })
            .skip(saltar)
            .limit(limite);

        const totalAnuncios = await Anuncio.countDocuments({ autor: usuario._id });
        const totalPaginas  = Math.ceil(totalAnuncios / limite);

        res.json({ anuncios: anunciosUsuario, paginaActual: pagina, totalPaginas });
    } catch (error) {
        console.log('🔴 Error al buscar perfil:', error);
        res.status(500).json({ error: 'Error al cargar los anuncios del usuario' });
    }
});

module.exports = router;
