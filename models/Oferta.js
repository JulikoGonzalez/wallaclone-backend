const mongoose = require('mongoose');

const ofertaSchema = new mongoose.Schema({
    anuncio:   { type: mongoose.Schema.Types.ObjectId, ref: 'Anuncio',  required: true },
    comprador: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario',  required: true },
    precio:    { type: Number, required: true },
    mensaje:   { type: String, default: '' },
    estado:    { type: String, enum: ['pendiente', 'aceptada', 'rechazada'], default: 'pendiente' }
}, { timestamps: true });

const Oferta = mongoose.model('Oferta', ofertaSchema);
module.exports = Oferta;
