const mongoose = require('mongoose');

const mensajeSchema = new mongoose.Schema({
    anuncio:      { type: mongoose.Schema.Types.ObjectId, ref: 'Anuncio',  required: true },
    remitente:    { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario',  required: true },
    destinatario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario',  required: true },
    texto:        { type: String, required: true, trim: true }
}, { timestamps: true });

const Mensaje = mongoose.model('Mensaje', mensajeSchema);
module.exports = Mensaje;
