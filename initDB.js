// Importamos las herramientas y nuestro molde
require('dotenv').config();
const mongoose = require('mongoose');
const Anuncio = require('./models/Anuncio');

async function inicializarBaseDeDatos() {
    if (process.env.NODE_ENV === 'production') {
        console.log('🔴 Este script no puede ejecutarse en producción.');
        process.exit(1);
    }

    try {
        // 1. Nos conectamos a la base de datos
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('🟢 Conectados a la BD para inyectar datos...');

        // 2. Borramos todo lo que hubiera antes para empezar limpios
        await Anuncio.deleteMany();
        console.log('🧹 Base de datos limpiada.');

        // 3. Creamos dos anuncios de prueba usando nuestro molde
        await Anuncio.create([
            {
                nombre: 'Bicicleta de montaña',
                descripcion: 'Casi nueva, usada solo dos veces en la montaña.',
                precio: 150,
                tipo: 'venta',
                foto: 'bici.jpg',
                tags: ['lifestyle']
            },
            {
                nombre: 'iPhone 13 Pro',
                descripcion: 'Busco iPhone 13 Pro en buen estado, pago al contado.',
                precio: 600,
                tipo: 'busqueda',
                foto: 'iphone.jpg',
                tags: ['mobile']
            }
        ]);
        console.log('✅ Anuncios de prueba inyectados con éxito!');

        // 4. Cerramos la conexión para terminar
        mongoose.connection.close();
    } catch (error) {
        console.log('🔴 Error al inyectar los datos:', error);
    }
}

// Ejecutamos la función
inicializarBaseDeDatos();