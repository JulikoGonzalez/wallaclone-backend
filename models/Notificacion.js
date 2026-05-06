const mongoose = require('mongoose');
const ObjectId = mongoose.Schema.Types.ObjectId;

const notificacionSchema = new mongoose.Schema({
    usuario: { type: ObjectId, ref: 'Usuario', required: true },
    anuncio: { type: ObjectId, ref: 'Anuncio', required: true },
    tipo:    { type: String, default: 'favorito_vendido' },
    datos:   { type: mongoose.Schema.Types.Mixed, default: {} },
    leida:   { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Notificacion', notificacionSchema);
