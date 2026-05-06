require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

mongoose.connect(process.env.DATABASE_URL)
    .then(() => console.log('🟢 Conectado con éxito a la base de datos de Wallaclone'))
    .catch((error) => console.log('🔴 Error al conectar a la base de datos:', error.message));

app.use(require('./routes/auth'));
app.use(require('./routes/anuncios'));
app.use(require('./routes/ofertas'));
app.use(require('./routes/mensajes'));
app.use(require('./routes/favoritos'));
app.use(require('./routes/usuarios'));
app.use(require('./routes/notificaciones'));

// Rutas visuales — deben ir al final para no capturar rutas de la API
app.get('/anuncio/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'detalle.html'));
});

app.get('/:username', (req, res, next) => {
    if (req.params.username.includes('.')) return next();
    res.sendFile(path.join(__dirname, 'public', 'perfil.html'));
});

const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => {
    console.log(`Servidor arrancado. Escuchando en http://localhost:${PUERTO}`);
});