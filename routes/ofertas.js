const express = require('express');
const router = express.Router();
const Anuncio = require('../models/Anuncio');
const Oferta  = require('../models/Oferta');
const verificarPulseraVIP = require('../middlewares/auth');

// POST /anuncios/:id/ofertas — hacer una oferta sobre un anuncio ajeno
router.post('/anuncios/:id/ofertas', verificarPulseraVIP, async (req, res) => {
    try {
        const anuncio = await Anuncio.findById(req.params.id);
        if (!anuncio) return res.status(404).json({ error: 'Anuncio no encontrado' });

        if (anuncio.autor.toString() === req.usuario.id) {
            return res.status(400).json({ error: 'No puedes hacer una oferta sobre tu propio anuncio' });
        }
        if (anuncio.vendido) {
            return res.status(400).json({ error: 'Este anuncio ya está vendido' });
        }

        const { precio, mensaje } = req.body;
        if (!precio || precio <= 0) {
            return res.status(400).json({ error: 'El precio de la oferta debe ser mayor que 0' });
        }

        const ofertaExistente = await Oferta.findOne({
            anuncio: req.params.id,
            comprador: req.usuario.id,
            estado: 'pendiente'
        });
        if (ofertaExistente) {
            return res.status(400).json({ error: 'Ya tienes una oferta pendiente en este anuncio' });
        }

        const nuevaOferta = await Oferta.create({
            anuncio: req.params.id,
            comprador: req.usuario.id,
            precio,
            mensaje
        });

        res.status(201).json({ mensaje: '¡Oferta enviada con éxito!', oferta: nuevaOferta });
    } catch (error) {
        console.log('🔴 Error al crear oferta:', error);
        res.status(500).json({ error: 'Error al enviar la oferta' });
    }
});

// GET /anuncios/:id/ofertas — ver ofertas recibidas (solo el dueño)
router.get('/anuncios/:id/ofertas', verificarPulseraVIP, async (req, res) => {
    try {
        const anuncio = await Anuncio.findById(req.params.id);
        if (!anuncio) return res.status(404).json({ error: 'Anuncio no encontrado' });

        if (anuncio.autor.toString() !== req.usuario.id) {
            return res.status(403).json({ error: 'Solo el dueño del anuncio puede ver las ofertas' });
        }

        const ofertas = await Oferta.find({ anuncio: req.params.id })
            .populate('comprador', 'username')
            .sort({ createdAt: -1 });

        res.json(ofertas);
    } catch (error) {
        console.log('🔴 Error al cargar ofertas:', error);
        res.status(500).json({ error: 'Error al cargar las ofertas' });
    }
});

// PUT /ofertas/:id/estado — aceptar o rechazar una oferta
router.put('/ofertas/:id/estado', verificarPulseraVIP, async (req, res) => {
    try {
        const oferta = await Oferta.findById(req.params.id).populate('anuncio');
        if (!oferta) return res.status(404).json({ error: 'Oferta no encontrada' });

        if (oferta.anuncio.autor.toString() !== req.usuario.id) {
            return res.status(403).json({ error: 'Solo el dueño del anuncio puede gestionar las ofertas' });
        }
        if (oferta.estado !== 'pendiente') {
            return res.status(400).json({ error: 'Esta oferta ya fue procesada' });
        }

        const { accion } = req.body;
        if (accion === 'aceptar') {
            oferta.estado = 'aceptada';
            await Anuncio.findByIdAndUpdate(oferta.anuncio._id, { reservado: true });
        } else if (accion === 'rechazar') {
            oferta.estado = 'rechazada';
        } else {
            return res.status(400).json({ error: 'Acción no válida. Usa "aceptar" o "rechazar"' });
        }

        await oferta.save();
        res.json({ mensaje: `Oferta ${oferta.estado} correctamente`, oferta });
    } catch (error) {
        console.log('🔴 Error al gestionar oferta:', error);
        res.status(500).json({ error: 'Error al gestionar la oferta' });
    }
});

// GET /mis-ofertas — ofertas enviadas por el usuario autenticado
router.get('/mis-ofertas', verificarPulseraVIP, async (req, res) => {
    try {
        const misOfertas = await Oferta.find({ comprador: req.usuario.id })
            .populate('anuncio', 'nombre precio tipo')
            .sort({ createdAt: -1 });

        res.json(misOfertas);
    } catch (error) {
        console.log('🔴 Error al cargar mis ofertas:', error);
        res.status(500).json({ error: 'Error al cargar tus ofertas' });
    }
});

module.exports = router;
