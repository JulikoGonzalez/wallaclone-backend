const express = require('express');
const router = express.Router();
const Usuario      = require('../models/Usuario');
const Notificacion = require('../models/Notificacion');
const verificarPulseraVIP = require('../middlewares/auth');

// GET /mis-notificaciones — notificaciones no leídas (actualiza ultimaActividad)
router.get('/mis-notificaciones', verificarPulseraVIP, async (req, res) => {
    try {
        await Usuario.findByIdAndUpdate(req.usuario.id, { ultimaActividad: new Date() });

        const notificaciones = await Notificacion.find({
            usuario: req.usuario.id,
            leida:   false
        })
        .populate('anuncio', 'nombre _id')
        .sort({ createdAt: -1 });

        res.json(notificaciones);
    } catch (error) {
        console.log('🔴 Error al cargar notificaciones:', error);
        res.status(500).json({ error: 'Error al cargar las notificaciones' });
    }
});

// POST /notificaciones/:id/leer — marcar una notificación como leída
router.post('/notificaciones/:id/leer', verificarPulseraVIP, async (req, res) => {
    try {
        const notif = await Notificacion.findOne({ _id: req.params.id, usuario: req.usuario.id });
        if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });
        notif.leida = true;
        await notif.save();
        res.json({ mensaje: 'Notificación marcada como leída' });
    } catch (error) {
        console.log('🔴 Error al marcar notificación:', error);
        res.status(500).json({ error: 'Error al actualizar la notificación' });
    }
});

module.exports = router;
