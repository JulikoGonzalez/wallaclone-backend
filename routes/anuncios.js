const express = require('express');
const router = express.Router();
const Anuncio = require('../models/Anuncio');
const Usuario = require('../models/Usuario');
const Notificacion = require('../models/Notificacion');
const verificarPulseraVIP = require('../middlewares/auth');
const transporter = require('../utils/email');
const generarSlug = require('../utils/slugify');

const UMBRAL_ACTIVO_MS = 5 * 60 * 1000;

// GET /anuncios — listado público con filtros y paginación
router.get('/anuncios', async (req, res) => {
    try {
        const { nombre, precioMin, precioMax, tag, page, limite: limiteQuery } = req.query;

        const pagina = parseInt(page) || 1;
        const limite = Math.min(parseInt(limiteQuery) || 4, 20);
        const saltar = (pagina - 1) * limite;

        const filtro = {};
        if (nombre)    filtro.nombre = new RegExp(nombre, 'i');
        if (tag)       filtro.tags   = tag;
        if (precioMin || precioMax) {
            filtro.precio = {};
            if (precioMin) filtro.precio.$gte = parseInt(precioMin);
            if (precioMax) filtro.precio.$lte = parseInt(precioMax);
        }

        const listadoAnuncios = await Anuncio.find(filtro)
            .populate('autor', 'username')
            .sort({ _id: -1 })
            .skip(saltar)
            .limit(limite);

        const totalAnuncios = await Anuncio.countDocuments(filtro);
        const totalPaginas  = Math.ceil(totalAnuncios / limite);

        res.json({ anuncios: listadoAnuncios, paginaActual: pagina, totalPaginas });
    } catch (error) {
        console.log('🔴 Error al buscar anuncios:', error);
        res.status(500).json({ mensaje: 'Hubo un error al buscar los anuncios' });
    }
});

// GET /anuncios/:id — detalle público
router.get('/anuncios/:id', async (req, res) => {
    try {
        const anuncio = await Anuncio.findById(req.params.id).populate('autor', 'username');
        if (!anuncio) return res.status(404).json({ error: 'Anuncio no encontrado' });
        res.json(anuncio);
    } catch (error) {
        console.log('🔴 Error al cargar detalle:', error);
        res.status(500).json({ error: 'Error al cargar el anuncio' });
    }
});

// GET /mis-anuncios — anuncios del usuario autenticado
router.get('/mis-anuncios', verificarPulseraVIP, async (req, res) => {
    try {
        const misAnuncios = await Anuncio.find({ autor: req.usuario.id });
        res.json(misAnuncios);
    } catch (error) {
        console.log('🔴 Error al buscar tus anuncios:', error);
        res.status(500).json({ error: 'Error al cargar tus anuncios.' });
    }
});

// POST /anuncios — crear anuncio
router.post('/anuncios', verificarPulseraVIP, async (req, res) => {
    try {
        const { nombre, descripcion, precio, tipo, foto, tags } = req.body;

        const nuevoAnuncio = await Anuncio.create({
            nombre, descripcion, precio, tipo, foto, tags,
            autor: req.usuario.id
        });

        res.status(201).json({ mensaje: '¡Anuncio creado con éxito!', anuncio: nuevoAnuncio });
    } catch (error) {
        console.log('🔴 Error al crear anuncio:', error);
        res.status(500).json({ error: 'Error al crear el anuncio. Comprueba los datos.' });
    }
});

// PUT /anuncios/:id — editar anuncio (solo propietario)
router.put('/anuncios/:id', verificarPulseraVIP, async (req, res) => {
    try {
        const anuncio = await Anuncio.findById(req.params.id);
        if (!anuncio) return res.status(404).json({ error: 'Anuncio no encontrado' });

        if (anuncio.autor.toString() !== req.usuario.id) {
            return res.status(403).json({ error: 'No tienes permiso para editar este anuncio' });
        }

        const { nombre, descripcion, precio, tipo, foto, tags } = req.body;
        const cambios = {};
        if (nombre)           cambios.nombre      = nombre;
        if (descripcion)      cambios.descripcion = descripcion;
        if (precio)           cambios.precio      = precio;
        if (tipo)             cambios.tipo        = tipo;
        if (foto !== undefined) cambios.foto      = foto;
        if (tags)             cambios.tags        = tags;

        if (Object.keys(cambios).length === 0) {
            return res.status(400).json({ error: 'No se han enviado datos para actualizar' });
        }

        const precioAnterior    = anuncio.precio;
        const anuncioActualizado = await Anuncio.findByIdAndUpdate(req.params.id, cambios, { new: true, runValidators: true });

        // Notificar cambio de precio a usuarios que tienen este anuncio como favorito
        const precioNuevo = parseFloat(precio);
        if (precio !== undefined && precioNuevo !== precioAnterior) {
            const interesados  = await Usuario.find({ favoritos: anuncio._id });
            const slug         = generarSlug(anuncio.nombre);
            const urlDetalle   = `${process.env.BASE_URL}/anuncio/${slug}-${anuncio._id}`;
            const urlFavoritos = `${process.env.BASE_URL}/favoritos.html`;

            for (const usuario of interesados) {
                await Notificacion.create({
                    usuario: usuario._id,
                    anuncio: anuncio._id,
                    tipo:    'favorito_precio',
                    datos:   { precioAnterior, precioNuevo }
                });

                const estaActivo = usuario.ultimaActividad &&
                    (Date.now() - usuario.ultimaActividad.getTime()) < UMBRAL_ACTIVO_MS;

                if (!estaActivo && usuario.email) {
                    transporter.sendMail({
                        from:    `"Wallaclone" <${process.env.EMAIL_USER}>`,
                        to:      usuario.email,
                        subject: `El precio de "${anuncio.nombre}" ha cambiado`,
                        html: `
                            <h2>Un artículo de tus favoritos ha cambiado de precio</h2>
                            <p>El artículo <strong>${anuncio.nombre}</strong> que tienes guardado como favorito
                            ha bajado su precio de <strong style="text-decoration:line-through;">${precioAnterior} €</strong>
                            a <strong style="color:#13c1ac;">${precioNuevo} €</strong>.</p>
                            <br>
                            <a href="${urlDetalle}" style="display:inline-block; padding:10px 20px; background:#13c1ac; color:white; border-radius:4px; text-decoration:none; margin-right:10px; font-weight:bold;">Ver detalle del artículo</a>
                            <a href="${urlFavoritos}" style="display:inline-block; padding:10px 20px; background:#ff4d4d; color:white; border-radius:4px; text-decoration:none; font-weight:bold;">Gestionar mis favoritos</a>
                        `
                    }).catch(err => console.log('🔴 Error al enviar email de notificación:', err.message));
                }
            }
        }

        res.json({ mensaje: '¡Anuncio actualizado con éxito!', anuncio: anuncioActualizado });
    } catch (error) {
        console.log('🔴 Error al editar anuncio:', error);
        res.status(500).json({ error: 'Error al editar el anuncio. Comprueba los datos.' });
    }
});

// DELETE /anuncios/:id — borrar anuncio (solo propietario)
router.delete('/anuncios/:id', verificarPulseraVIP, async (req, res) => {
    try {
        const anuncio = await Anuncio.findById(req.params.id);
        if (!anuncio) return res.status(404).json({ error: 'Anuncio no encontrado' });

        if (anuncio.autor.toString() !== req.usuario.id) {
            return res.status(403).json({ error: 'No tienes permiso para borrar este anuncio' });
        }

        await Anuncio.findByIdAndDelete(req.params.id);
        res.json({ mensaje: '¡Anuncio borrado con éxito!' });
    } catch (error) {
        console.log('🔴 Error al borrar:', error);
        res.status(500).json({ error: 'Error al intentar borrar el anuncio.' });
    }
});

// PUT /anuncios/:id/estado — cambiar estado reservado/vendido (solo propietario)
router.put('/anuncios/:id/estado', verificarPulseraVIP, async (req, res) => {
    try {
        const anuncio = await Anuncio.findById(req.params.id);
        if (!anuncio) return res.status(404).json({ error: 'Anuncio no encontrado' });

        if (anuncio.autor.toString() !== req.usuario.id) {
            return res.status(403).json({ error: 'No tienes permiso para modificar este anuncio' });
        }

        const { accion } = req.body;

        if (accion === 'reservar') {
            const yaReservado = anuncio.reservado;
            anuncio.reservado = !anuncio.reservado;

            if (anuncio.reservado && !yaReservado) {
                await _notificarInteresados(anuncio, 'favorito_reservado', {}, {
                    subject: `Tu favorito "${anuncio.nombre}" ha sido reservado`,
                    html: (urlDetalle, urlFavoritos) => `
                        <h2>Un artículo de tus favoritos ha sido reservado</h2>
                        <p>El artículo <strong>${anuncio.nombre}</strong> que tienes guardado como favorito
                        ha sido marcado como <strong>reservado</strong>.</p>
                        <p>Si aún estás interesado, puedes contactar con el vendedor para hacer una contraoferta.</p>
                        <br>
                        <a href="${urlDetalle}" style="display:inline-block; padding:10px 20px; background:#ffa500; color:white; border-radius:4px; text-decoration:none; margin-right:10px; font-weight:bold;">Ver detalle del artículo</a>
                        <a href="${urlFavoritos}" style="display:inline-block; padding:10px 20px; background:#ff4d4d; color:white; border-radius:4px; text-decoration:none; font-weight:bold;">Gestionar mis favoritos</a>
                    `
                });
            }
        } else if (accion === 'vender') {
            const yaVendido = anuncio.vendido;
            anuncio.vendido = !anuncio.vendido;

            if (anuncio.vendido) {
                anuncio.reservado = false;

                if (!yaVendido) {
                    await _notificarInteresados(anuncio, 'favorito_vendido', {}, {
                        subject: `Tu favorito "${anuncio.nombre}" ya ha sido vendido`,
                        html: (urlDetalle, urlFavoritos) => `
                            <h2>Un artículo de tus favoritos se ha vendido</h2>
                            <p>El artículo <strong>${anuncio.nombre}</strong> que tienes guardado como favorito
                            ha sido marcado como <strong>vendido</strong> y ya no está disponible para su compra.</p>
                            <br>
                            <a href="${urlDetalle}" style="display:inline-block; padding:10px 20px; background:#13c1ac; color:white; border-radius:4px; text-decoration:none; margin-right:10px; font-weight:bold;">Ver detalle del artículo</a>
                            <a href="${urlFavoritos}" style="display:inline-block; padding:10px 20px; background:#ff4d4d; color:white; border-radius:4px; text-decoration:none; font-weight:bold;">Gestionar mis favoritos</a>
                        `
                    });
                }
            }
        }

        await anuncio.save();
        res.json({ mensaje: 'Estado actualizado', anuncio });
    } catch (error) {
        console.log('🔴 Error al cambiar estado:', error);
        res.status(500).json({ error: 'Error al cambiar el estado del anuncio.' });
    }
});

// Envía notificaciones (BD + email) a todos los usuarios que tienen el anuncio en favoritos
async function _notificarInteresados(anuncio, tipo, datos, emailOpts) {
    const interesados  = await Usuario.find({ favoritos: anuncio._id });
    const slug         = generarSlug(anuncio.nombre);
    const urlDetalle   = `${process.env.BASE_URL}/anuncio/${slug}-${anuncio._id}`;
    const urlFavoritos = `${process.env.BASE_URL}/favoritos.html`;

    for (const usuario of interesados) {
        await Notificacion.create({ usuario: usuario._id, anuncio: anuncio._id, tipo, datos });

        const estaActivo = usuario.ultimaActividad &&
            (Date.now() - usuario.ultimaActividad.getTime()) < UMBRAL_ACTIVO_MS;

        if (!estaActivo && usuario.email) {
            transporter.sendMail({
                from:    `"Wallaclone" <${process.env.EMAIL_USER}>`,
                to:      usuario.email,
                subject: emailOpts.subject,
                html:    emailOpts.html(urlDetalle, urlFavoritos)
            }).catch(err => console.log('🔴 Error al enviar email de notificación:', err.message));
        }
    }
}

module.exports = router;
