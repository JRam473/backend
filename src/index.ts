// ✅ ARCHIVO PRINCIPAL SIMPLIFICADO - CON CHATBOT INTEGRADO
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Configurar __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Importaciones dinámicas
let passport: any;
let pool: any;
let clipAnalyzerService: any;

// Rutas existentes
let administradorRoutes: any;
let autenticacionRoutes: any;
let lugarRoutes: any;
let experienciaRoutes: any;
let calificacionRoutes: any;
let archivosRoutes: any;
let moderacionRoutes: any;
let chatbotRoutes: any;

const app = express();

// ✅ MIDDLEWARES GLOBALES
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ FUNCIÓN ASÍNCRONA PARA INICIALIZAR
async function initializeApp() {
  try {
    console.log('🔄 Inicializando aplicación...');

    // ✅ CARGAR MÓDULOS ESENCIALES
    const passportModule = await import('./utils/oauth.js');
    passport = passportModule.default;
    
    const baseDeDatosModule = await import('./utils/baseDeDatos.js');
    pool = baseDeDatosModule.pool;
    
    const clipAnalyzerModule = await import('./services/ClipAnalyzerService.js');
    clipAnalyzerService = clipAnalyzerModule.clipAnalyzerService;

    // ✅ CARGAR RUTAS
    const [
      administradorRoutesModule,
      autenticacionRoutesModule,
      lugarRoutesModule,
      experienciaRoutesModule,
      calificacionRoutesModule,
      archivosRoutesModule,
      moderacionRoutesModule,
      chatbotRoutesModule
    ] = await Promise.all([
      import('./rutas/administradorRoutes.js'),
      import('./rutas/autenticacionRoutes.js'),
      import('./rutas/lugarRoutes.js'),
      import('./rutas/experienciaRoutes.js'),
      import('./rutas/calificacionRoutes.js'),
      import('./rutas/archivosRoutes.js'),
      import('./rutas/moderacionRoutes.js'),
      import('./rutas/chatbot.js')
    ]);

    administradorRoutes = administradorRoutesModule.default;
    autenticacionRoutes = autenticacionRoutesModule.default;
    lugarRoutes = lugarRoutesModule.default;
    experienciaRoutes = experienciaRoutesModule.default;
    calificacionRoutes = calificacionRoutesModule.default;
    archivosRoutes = archivosRoutesModule.default;
    moderacionRoutes = moderacionRoutesModule.default;
    chatbotRoutes = chatbotRoutesModule.default;

    // ✅ CONFIGURAR MIDDLEWARES
    app.use(passport.initialize());

    // ✅ SERVIR ARCHIVOS ESTÁTICOS
    app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

    // ✅ RUTAS PRINCIPALES (SIMPLIFICADAS)
    
    // RUTAS PÚBLICAS
    app.use('/api/auth', autenticacionRoutes);
    app.use('/api', chatbotRoutes); // ✅ Chatbot incluye sus propios endpoints

    // RUTAS DE CONTENIDO
    app.use('/api/lugares', lugarRoutes);
    app.use('/api/experiencias', experienciaRoutes);
    app.use('/api/calificaciones', calificacionRoutes);

    // RUTAS DE ADMINISTRACIÓN
    app.use('/api/admin', administradorRoutes);
    app.use('/api/archivos', archivosRoutes);
    app.use('/api/moderacion', moderacionRoutes);

    // ✅ ENDPOINTS DE ESTADO (SIMPLIFICADOS)
    
    // Health check principal
    app.get('/api/health', (req, res) => {
      const clipEstado = clipAnalyzerService.obtenerEstado();
      
      res.json({ 
        success: true,
        status: 'OK', 
        timestamp: new Date().toISOString(),
        servicios: {
          base_datos: 'activo',
          moderacion_imagenes: clipEstado.modelos_listos ? 'activo' : 'inicializando',
          clip_modelo: clipEstado.modelo || 'CLIP-base-patch32'
        }
      });
    });

    // Estado del CLIP
    app.get('/api/clip/status', (req, res) => {
      const estado = clipAnalyzerService.obtenerEstado();
      res.json({
        success: true,
        servicio: 'CLIP Image Analysis',
        estado: estado
      });
    });

    // ✅ MANEJO DE ERRORES
    app.use('/api/', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Ruta no encontrada',
        path: req.originalUrl
      });
    });

    app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('❌ Error:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    });

    // ✅ INICIALIZACIÓN DEL SERVIDOR
    const PORT = process.env.PORT || 4000;

    // Verificar conexión a BD
    await pool.query('SELECT NOW()');
    console.log('✅ Conectado a PostgreSQL');

    // Inicializar base de datos
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      throw new Error('No se pudo inicializar la base de datos');
    }

    // Inicializar servicios
    console.log('🎯 Inicializando servicios...');
    const moderacionImagenServiceModule = await import('./services/moderacionImagenService.js');
    const ModeracionImagenService = moderacionImagenServiceModule.ModeracionImagenService;
    const moderacionImagenService = new ModeracionImagenService();
    await moderacionImagenService.inicializar();

    const clipEstado = clipAnalyzerService.obtenerEstado();
    console.log('✅ Servicios listos');

    // Iniciar servidor
    app.listen(PORT, () => {
      const clipListo = clipAnalyzerService.estaListo();
      
      console.log('\n=== ✅ SISTEMA TAHITIC INICIALIZADO ===');
      console.log('🌐 Puerto:', PORT);
      console.log('🗄️  BD:', process.env.DB_NAME || 'PostgreSQL');
      console.log('🖼️  CLIP:', clipListo ? '✅ ACTIVO' : '🔄 INICIALIZANDO');
      console.log('🤖 Chatbot: ✅ INTEGRADO');
      console.log('🚀 Servidor ejecutándose');
      console.log('=====================================\n');
    });

  } catch (error) {
    console.error('❌ Error al inicializar aplicación:', error);
    process.exit(1);
  }
}

// ✅ FUNCIÓN PARA INICIALIZAR BASE DE DATOS (SIMPLIFICADA)
async function initializeDatabase() {
  try {
    // Verificar tablas principales
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('administradores', 'lugares', 'experiencias')
    `);

    if (tablesCheck.rows.length >= 3) {
      console.log('✅ Tablas principales existen');
      return true;
    }

    console.log('📋 Inicializando base de datos...');
    
    try {
      const initModule = await import('./scripts/init-database.js');
      await initModule.initializeDatabase();
      console.log('✅ BD inicializada');
      return true;
    } catch {
      // Fallback básico
      await pool.query(`
        CREATE TABLE IF NOT EXISTS administradores (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          nombre VARCHAR(255),
          es_administrador BOOLEAN DEFAULT TRUE,
          creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Tablas básicas creadas');
      return true;
    }
  } catch (error) {
    console.error('❌ Error con BD:', error);
    return false;
  }
}

// ✅ EJECUTAR
initializeApp();