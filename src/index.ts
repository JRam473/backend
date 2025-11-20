// ✅ ARCHIVO PRINCIPAL SIMPLIFICADO - CON CLIP INTEGRADO
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import passport from './utils/oauth';
import { middlewareIpNavegador } from './middleware/ipNavegador';

// ✅ SISTEMA ESENCIAL DE MODERACIÓN
import { ModeracionService } from './services/moderacionService';
import { ModeracionImagenService } from './services/moderacionImagenService';
import { pool } from './utils/baseDeDatos';

// ✅ NUEVO: Importar servicio CLIP para estado
import { clipAnalyzerService } from './services/ClipAnalyzerService';

// Rutas existentes
import administradorRoutes from './rutas/administradorRoutes';
import autenticacionRoutes from './rutas/autenticacionRoutes';
import lugarRoutes from './rutas/lugarRoutes';
import experienciaRoutes from './rutas/experienciaRoutes';
import calificacionRoutes from './rutas/calificacionRoutes';
import archivosRoutes from './rutas/archivosRoutes';

// RUTAS DE MODERACIÓN
import moderacionRoutes from './rutas/moderacionRoutes';

const app = express();

// ✅ MIDDLEWARES GLOBALES
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(passport.initialize());
app.use(middlewareIpNavegador);

// ✅ SERVIR ARCHIVOS ESTÁTICOS
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/images', express.static(path.join(__dirname, '../uploads/images')));
app.use('/pdfs', express.static(path.join(__dirname, '../uploads/pdfs')));

// ✅ RUTA DE SALUD BÁSICA (ACTUALIZADA)
app.get('/api/health', (req, res) => {
  const clipEstado = clipAnalyzerService.obtenerEstado();
  
  res.json({ 
    success: true,
    status: 'OK', 
    message: 'Servidor Tahitic funcionando',
    timestamp: new Date().toISOString(),
    servicios: {
      base_datos: 'activo',
      moderacion_texto: 'activo',
      moderacion_imagenes: clipEstado.modelos_listos ? 'activo' : 'inicializando',
      clip_modelo: clipEstado
    }
  });
});

// ✅ NUEVA RUTA: ESTADO DEL CLIP
app.get('/api/clip/status', (req, res) => {
  const estado = clipAnalyzerService.obtenerEstado();
  
  res.json({
    success: true,
    servicio: 'CLIP Image Analysis',
    estado: estado,
    capacidades: [
      "deteccion_violencia_fisica",
      "deteccion_sangre_heridas", 
      "deteccion_armas",
      "deteccion_contenido_+18",
      "deteccion_drogas_alcohol"
    ],
    modelo: "CLIP-base-patch32",
    version: "2.0.0-integrado"
  });
});

// ✅ RUTA PARA VERIFICAR TABLAS DE BD
app.get('/api/debug/tables', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    res.json({ 
      success: true,
      tables: result.rows.map((row: any) => row.table_name),
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error obteniendo tablas:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error obteniendo tablas de la BD' 
    });
  }
});

// ✅ RUTAS PÚBLICAS
app.use('/api/auth', autenticacionRoutes);

// ✅ RUTAS DE MODERACIÓN
app.use('/api/moderacion', moderacionRoutes);

// ✅ RUTAS CON MODERACIÓN INTEGRADA
app.use('/api/lugares', lugarRoutes);
app.use('/api/experiencias', experienciaRoutes);
app.use('/api/calificaciones', calificacionRoutes);

// ✅ RUTAS PROTEGIDAS (admin)
app.use('/api/admin', administradorRoutes);
app.use('/api/archivos', archivosRoutes);

// ✅ RUTA DE ESTADO DE MODERACIÓN (ACTUALIZADA)
app.get('/api/moderacion/estado', async (req, res) => {
  try {
    const logsStats = await pool.query(`
      SELECT 
        accion,
        COUNT(*) as total,
        AVG(LENGTH(contenido_texto)) as avg_longitud_texto
      FROM logs_moderacion 
      WHERE creado_en >= NOW() - INTERVAL '7 days'
      GROUP BY accion
    `);

    const logsImagenesStats = await pool.query(`
      SELECT 
        es_aprobado,
        COUNT(*) as total
      FROM logs_moderacion_imagenes 
      WHERE creado_en >= NOW() - INTERVAL '7 days'
      GROUP BY es_aprobado
    `);

    const clipEstado = clipAnalyzerService.obtenerEstado();

    res.json({
      success: true,
      sistema: 'activo',
      periodo: '7 días',
      clip: clipEstado,
      estadisticas: {
        texto: {
          logs: logsStats.rows
        },
        imagenes: {
          logs: logsImagenesStats.rows,
          total_analizadas: logsImagenesStats.rows.reduce((acc, row) => acc + parseInt(row.total), 0)
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo estado de moderación:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error obteniendo estado del sistema' 
    });
  }
});

// ✅ MANEJO DE RUTAS NO ENCONTRADAS
app.use('/api/', (req, res) => {
  console.log(`❌ Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// ✅ MANEJO GLOBAL DE ERRORES
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Error global no manejado:', error);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    detalle: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// ✅ FUNCIÓN PARA INICIALIZAR BASE DE DATOS
async function initializeDatabase() {
  console.log('🔄 Verificando estructura de la base de datos...');
  
  try {
    // Verificar si las tablas principales existen
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('administradores', 'lugares', 'experiencias')
    `);

    const existingTables = tablesCheck.rows.map((row: any) => row.table_name);
    
    if (existingTables.length >= 3) {
      console.log('✅ Tablas principales ya existen:', existingTables);
      return true;
    }

    console.log('📋 Algunas tablas no existen, ejecutando inicialización...');
    
    // Importar y ejecutar el script de inicialización
    try {
      // En producción, el archivo compilado estará en dist/scripts
      const initScriptPath = process.env.NODE_ENV === 'production' 
        ? '../scripts/init-database.js'
        : './scripts/init-database';
      
      const { initializeDatabase } = require(initScriptPath);
      await initializeDatabase();
      console.log('✅ Base de datos inicializada exitosamente');
      return true;
    } catch (initError) {
      console.error('❌ Error ejecutando script de inicialización:', initError);
      
      // Fallback: crear tablas básicas manualmente
      console.log('🔄 Intentando creación manual de tablas...');
      await createBasicTables();
      return true;
    }
  } catch (error) {
    console.error('❌ Error verificando/inicializando base de datos:', error);
    return false;
  }
}

// ✅ FUNCIÓN DE FALLBACK PARA CREAR TABLAS BÁSICAS
async function createBasicTables() {
  try {
    // Tabla de administradores básica
    await pool.query(`
      CREATE TABLE IF NOT EXISTS administradores (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        nombre VARCHAR(255),
        es_administrador BOOLEAN DEFAULT TRUE,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insertar admin por defecto
    await pool.query(`
      INSERT INTO administradores (email, nombre, es_administrador) 
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO NOTHING
    `, ['juanramiro139@gmail.com', 'Juan Ramiro', true]);

    console.log('✅ Tablas básicas creadas exitosamente');
  } catch (error) {
    console.error('❌ Error creando tablas básicas:', error);
    throw error;
  }
}

// ✅ INICIALIZACIÓN DEL SERVIDOR
const PORT = process.env.PORT || 4000;

const iniciarServidor = async () => {
  try {
    // ✅ VERIFICAR CONEXIÓN A BD
    console.log('🔌 Verificando conexión a la base de datos...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conectado a la base de datos PostgreSQL');

    // ✅ INICIALIZAR BASE DE DATOS (TABLAS)
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      throw new Error('No se pudo inicializar la base de datos');
    }

    // ✅ INICIALIZAR SERVICIOS DE MODERACIÓN
    console.log('🔄 Inicializando servicios de moderación...');
    const moderacionService = new ModeracionService();
    const moderacionImagenService = new ModeracionImagenService();
    
    // ✅ NUEVO: Inicializar CLIP para moderación de imágenes
    console.log('🎯 Inicializando CLIP para moderación de imágenes...');
    await moderacionImagenService.inicializar();
    
    const clipEstado = clipAnalyzerService.obtenerEstado();
    console.log('✅ Servicios de moderación listos');

    // ✅ MONITOREO PERIÓDICO SIMPLE (ACTUALIZADO)
    const intervaloMonitoreo = setInterval(async () => {
      try {
        const logsTextoRecientes = await pool.query(`
          SELECT COUNT(*) as total 
          FROM logs_moderacion 
          WHERE creado_en >= NOW() - INTERVAL '1 hour'
        `);
        
        const logsImagenesRecientes = await pool.query(`
          SELECT COUNT(*) as total 
          FROM logs_moderacion_imagenes 
          WHERE creado_en >= NOW() - INTERVAL '1 hour'
        `);
        
        const totalTexto = parseInt(logsTextoRecientes.rows[0].total);
        const totalImagenes = parseInt(logsImagenesRecientes.rows[0].total);
        const clipListo = clipAnalyzerService.estaListo();
        
        if (totalTexto > 0 || totalImagenes > 0) {
          console.log(`📊 Moderación: ${totalTexto} textos + ${totalImagenes} imágenes en la última hora | CLIP: ${clipListo ? '✅' : '❌'}`);
        }
      } catch (error) {
        console.error('❌ Error en monitoreo periódico:', error);
      }
    }, 30 * 60 * 1000); // Cada 30 minutos

    // ✅ MANEJO GRACCIOSO DE APAGADO
    const shutdown = async () => {
      console.log('🛑 Apagando servidor...');
      clearInterval(intervaloMonitoreo);
      
      try {
        await pool.end();
        console.log('✅ Conexión a BD cerrada');
      } catch (error) {
        console.error('❌ Error cerrando conexión a BD:', error);
      }
      
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // ✅ INICIAR SERVIDOR
    app.listen(PORT, () => {
      const clipListo = clipAnalyzerService.estaListo();
      
      console.log('\n=== ✅ SISTEMA DE MODERACIÓN INICIALIZADO ===');
      console.log('🌐 Puerto:', PORT);
      console.log('🗄️  BD:', process.env.DB_NAME || 'PostgreSQL Railway');
      console.log('🔐 JWT:', process.env.JWT_SECRET ? '✅ Configurado' : '❌ Faltante');
      console.log('📝 Análisis de texto:', '✅ ACTIVO');
      console.log('🖼️ Análisis de imágenes CLIP:', clipListo ? '✅ ACTIVO' : '🔄 INICIALIZANDO');
      console.log('🤖 Modelo CLIP:', clipEstado.modelo);
      console.log('🚀 Servidor ejecutándose en puerto', PORT);
      console.log('============================================\n');
      
      // ✅ LOG ADICIONAL SI CLIP NO ESTÁ LISTO
      if (!clipListo) {
        console.log('⏳ CLIP se está inicializando en segundo plano...');
        console.log('📸 Las imágenes se procesarán cuando CLIP esté listo');
      }
    });

  } catch (error) {
    console.error('❌ Error crítico al iniciar servidor:', error);
    
    try {
      await pool.end();
    } catch (e) {
      // Ignorar errores al cerrar
    }
    
    process.exit(1);
  }
};

// ✅ EJECUTAR INICIALIZACIÓN
iniciarServidor();