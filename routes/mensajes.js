const express = require('express');
const router = express.Router();
const Anuncio      = require('../models/Anuncio');
const Usuario      = require('../models/Usuario');
const Mensaje      = require('../models/Mensaje');
const Notificacion = require('../models/Notificacion');
const verificarPulseraVIP = require('../middlewares/auth');
const transporter  = require('../utils/email');

const UMBRAL_ACTIVO_MS = 5 * 60 * 1000;

// POST /anuncios/:id/mensajes — enviar mensaje a otro miembro sobre un anuncio
router.post('/anuncios/:id/mensajes', verificarPulseraVIP, async (req, res) => {
    try {
        const { destinatarioId, texto } = req.body;

        if (!texto || texto.trim() === '') {
            return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
        }
        if (destinatarioId === req.usuario.id) {
            return res.status(400).json({ error: 'No puedes enviarte un mensaje a ti mismo' });
        }

        const anuncio = await Anuncio.findById(req.params.id);
        if (!anuncio) return res.status(404).json({ error: 'Anuncio no encontrado' });

        const destinatario = await Usuario.findById(destinatarioId);
        if (!destinatario) return res.status(404).json({ error: 'Usuario destinatario no encontrado' });

        const nuevoMensaje = await Mensaje.create({
            anuncio:      req.params.id,
            remitente:    req.usuario.id,
            destinatario: destinatarioId,
            texto:        texto.trim()
        });

        // Notificar al destinatario
        await Notificacion.create({
            usuario: destinatarioId,
            anuncio: req.params.id,
            tipo:    'mensaje_nuevo',
            datos: {
                anuncioId:       req.params.id,
                anuncioNombre:   anuncio.nombre,
                remitenteId:     req.usuario.id,
                remitenteNombre: req.usuario.username,
                textoPreview:    texto.trim().substring(0, 60)
            }
        });

        const estaActivo = destinatario.ultimaActividad &&
            (Date.now() - destinatario.ultimaActividad.getTime()) < UMBRAL_ACTIVO_MS;

        if (!estaActivo && destinatario.email) {
            const urlChat = `${process.env.BASE_URL}/chat.html?anuncioId=${req.params.id}&conUsuarioId=${req.usuario.id}&conUsuario=${encodeURIComponent(req.usuario.username)}`;
            transporter.sendMail({
                from:    `"Wallaclone" <${process.env.EMAIL_USER}>`,
                to:      destinatario.email,
                subject: `Nuevo mensaje de ${req.usuario.username} en Wallaclone`,
                html: `
                    <h2>Tienes un nuevo mensaje</h2>
                    <p><strong>${req.usuario.username}</strong> te ha enviado un mensaje sobre el anuncio <strong>${anuncio.nombre}</strong>:</p>
                    <blockquote style="border-left:4px solid #13c1ac; padding-left:15px; color:#555; margin:15px 0;">${texto.trim()}</blockquote>
                    <br>
                    <a href="${urlChat}" style="display:inline-block; padding:10px 20px; background:#4a90d9; color:white; border-radius:4px; text-decoration:none; font-weight:bold;">💬 Abrir el chat</a>
                `
            }).catch(err => console.log('🔴 Error al enviar email de mensaje:', err.message));
        }

        res.status(201).json({ mensaje: 'Mensaje enviado', data: nuevoMensaje });
    } catch (error) {
        console.log('🔴 Error al enviar mensaje:', error);
        res.status(500).json({ error: 'Error al enviar el mensaje' });
    }
});

// GET /anuncios/:id/mensajes/:usuarioId — ver conversación con otro usuario sobre un anuncio
router.get('/anuncios/:id/mensajes/:usuarioId', verificarPulseraVIP, async (req, res) => {
    try {
        const miId   = req.usuario.id;
        const otroId = req.params.usuarioId;

        const mensajes = await Mensaje.find({
            anuncio: req.params.id,
            $or: [
                { remitente: miId,   destinatario: otroId },
                { remitente: otroId, destinatario: miId   }
            ]
        })
        .populate('remitente', 'username')
        .sort({ createdAt: 1 });

        res.json(mensajes);
    } catch (error) {
        console.log('🔴 Error al cargar mensajes:', error);
        res.status(500).json({ error: 'Error al cargar los mensajes' });
    }
});

// GET /mis-conversaciones — todas las conversaciones del usuario agrupadas
router.get('/mis-conversaciones', verificarPulseraVIP, async (req, res) => {
    try {
        const miId = req.usuario.id;

        const mensajes = await Mensaje.find({
            $or: [{ remitente: miId }, { destinatario: miId }]
        })
        .populate('anuncio',      'nombre')
        .populate('remitente',    'username')
        .populate('destinatario', 'username')
        .sort({ createdAt: -1 });

        const mapa = {};
        mensajes.forEach(msg => {
            const otroUsuario = msg.remitente._id.toString() === miId
                ? msg.destinatario
                : msg.remitente;
            const clave = `${msg.anuncio._id}-${otroUsuario._id}`;
            if (!mapa[clave]) {
                mapa[clave] = {
                    anuncioId:         msg.anuncio._id,
                    anuncioNombre:     msg.anuncio.nombre,
                    otroUsuarioId:     otroUsuario._id,
                    otroUsuarioNombre: otroUsuario.username,
                    ultimoMensaje:     msg.texto,
                    fecha:             msg.createdAt
                };
            }
        });

        res.json(Object.values(mapa));
    } catch (error) {
        console.log('🔴 Error al cargar conversaciones:', error);
        res.status(500).json({ error: 'Error al cargar las conversaciones' });
    }
});

module.exports = router;
