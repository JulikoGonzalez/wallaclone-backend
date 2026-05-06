const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    // NUEVO: Una lista para guardar la referencia a los anuncios favoritos
    favoritos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Anuncio' }],
    resetToken: { type: String },
    resetTokenExpiry: { type: Date },
    ultimaActividad: { type: Date, default: null }
});

const Usuario = mongoose.model('Usuario', usuarioSchema);
module.exports = Usuario;