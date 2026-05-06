const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const verificarPulseraVIP = require('../middlewares/auth');

// POST /favoritos/:id — añadir o quitar de favoritos (toggle desde detalle)
router.post('/favoritos/:id', verificarPulseraVIP, async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.usuario.id);
        const indice  = usuario.favoritos.findIndex(id => id.toString() === req.params.id);

        if (indice === -1) {
            usuario.favoritos.push(req.params.id);
            await usuario.save();
            res.json({ mensaje: '¡Añadido a favoritos!' });
        } else {
            usuario.favoritos.splice(indice, 1);
            await usuario.save();
            res.json({ mensaje: 'Eliminado de favoritos' });
        }
    } catch (error) {
        console.log('🔴 Error con favoritos:', error);
        res.status(500).json({ error: 'Error al gestionar los favoritos' });
    }
});

// DELETE /favoritos/:id — eliminar un anuncio de favoritos (solo el propio usuario)
router.delete('/favoritos/:id', verificarPulseraVIP, async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.usuario.id);
        const indice  = usuario.favoritos.findIndex(id => id.toString() === req.params.id);

        if (indice === -1) {
            return res.status(404).json({ error: 'Ese anuncio no está en tus favoritos' });
        }

        usuario.favoritos.splice(indice, 1);
        await usuario.save();
        res.json({ mensaje: 'Anuncio eliminado de tus favoritos' });
    } catch (error) {
        console.log('🔴 Error al eliminar favorito:', error);
        res.status(500).json({ error: 'Error al eliminar el favorito' });
    }
});

// GET /favoritos — listar todos los favoritos del usuario (con datos del anuncio y su autor)
router.get('/favoritos', verificarPulseraVIP, async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.usuario.id).populate({
            path: 'favoritos',
            populate: { path: 'autor', select: 'username' }
        });
        res.json(usuario.favoritos);
    } catch (error) {
        console.log('🔴 Error al buscar favoritos:', error);
        res.status(500).json({ error: 'Error al cargar tus favoritos' });
    }
});

module.exports = router;
