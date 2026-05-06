const mongoose = require('mongoose');

const anuncioSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    descripcion: { type: String, required: true },
    precio: { type: Number, required: true },
    tipo: { type: String, enum: ['venta', 'busqueda'], required: true },
    foto: { type: String },
    tags: { type: [String], required: true },
    autor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    // ¡NUEVO! Interruptores de estado
    reservado: { type: Boolean, default: false }, // Por defecto, no está reservado
    vendido: { type: Boolean, default: false }    // Por defecto, no está vendido
});

const Anuncio = mongoose.model('Anuncio', anuncioSchema);
module.exports = Anuncio;