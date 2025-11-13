// ✅ ARCHIVO PRINCIPAL CORREGIDO - RUTAS FIJAS
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
import { AnalizadorTexto } from './utils/analizadorTexto';
import { pool } from './utils/baseDeDatos';

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

// ✅ RUTA DE SALUD BÁSICA
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'OK', 
    message: 'Servidor Tahitic funcionando',
    timestamp: new Date().toISOString()
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
app.use('/api/moderacion', moderacionRoutes);
app.use('/api/lugares', lugarRoutes);
app.use('/api/experiencias', experienciaRoutes);
app.use('/api/calificaciones', calificacionRoutes);
app.use('/api/admin', administradorRoutes);
app.use('/api/archivos', archivosRoutes);

// ✅ RUTA DE ESTADO DE MODERACIÓN
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

    res.json({
      success: true,
      sistema: 'activo',
      periodo: '7 días',
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

// ✅ MANEJO GLOBAL DE ERRORES (CORREGIDO)
app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Error global no manejado:', error);
  
  const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';
  const errorDetail = process.env.NODE_ENV === 'development' ? errorMessage : undefined;
  
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    detalle: errorDetail
  });
});

// ✅ FUNCIÓN MEJORADA - DETECCIÓN AUTOMÁTICA DE RUTAS (CORREGIDA)
async function initializeDatabase() {
  console.log('🔄 INICIANDO MIGRACIÓN COMPLETA...');
  
  try {
    // ✅ DETECTAR RUTA CORRECTA DEL SCRIPT - INICIALIZADA CON VALOR POR DEFECTO
    let initScriptPath: string = '';
    
    if (process.env.NODE_ENV === 'production') {
      // En producción: probar diferentes rutas posibles
      const possiblePaths = [
        './scripts/init-database.js',      // Railway
        '../scripts/init-database.js',     // Otra posible ruta
        './init-database.js',              // Raíz de dist
        path.join(__dirname, 'scripts/init-database.js') // Ruta absoluta
      ];
      
      for (const possiblePath of possiblePaths) {
        try {
          // Verificar si el módulo existe
          require.resolve(possiblePath);
          initScriptPath = possiblePath;
          console.log(`✅ Encontrado script en: ${possiblePath}`);
          break;
        } catch (e) {
          // Continuar con la siguiente ruta
          continue;
        }
      }
      
      // ✅ VERIFICAR QUE SE ENCONTRÓ UNA RUTA VÁLIDA
      if (!initScriptPath) {
        throw new Error('No se pudo encontrar el script de migración en producción');
      }
    } else {
      // En desarrollo: usar TypeScript directamente
      initScriptPath = './scripts/init-database';
    }
    
    console.log(`📂 Ejecutando: ${initScriptPath}`);
    
    const { initializeDatabase: runMigration } = require(initScriptPath);
    await runMigration();
    
    console.log('✅ Migración completa ejecutada exitosamente');
    return true;
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido en migración';
    
    console.error('💥 ERROR CRÍTICO en migración:', errorMessage);
    
    // ❌ NO HAY FALLBACK - SI FALLA, EL SERVIDOR NO INICIA
    throw new Error(`Fallo en migración de BD: ${errorMessage}`);
  }
}

// ✅ INICIALIZACIÓN DEL SERVIDOR - SIN FALLBACK
const PORT = parseInt(process.env.PORT || '4000');

const iniciarServidor = async () => {
  try {
    console.log('🚀 INICIANDO SERVIDOR TAHITIC...');
    console.log('🏷️  Ambiente:', process.env.NODE_ENV);
    console.log('🌐 Puerto:', PORT);
    
    // ✅ VERIFICAR CONEXIÓN A BD
    console.log('🔌 Verificando conexión a la base de datos...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conectado a la base de datos PostgreSQL');

    // ✅ EJECUTAR MIGRACIÓN COMPLETA (SIN FALLBACK)
    console.log('🔄 EJECUTANDO MIGRACIÓN COMPLETA...');
    await initializeDatabase();
    
    console.log('✅ BASE DE DATOS INICIALIZADA CORRECTAMENTE');

    // ✅ VERIFICAR TABLAS CREADAS
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📊 TABLAS CREADAS:', tables.rows.map((row: any) => row.table_name));
    console.log('🎉 TOTAL TABLAS:', tables.rows.length);

    // ✅ INICIALIZAR SERVICIOS DE MODERACIÓN
    console.log('🔄 Inicializando servicios de moderación...');
    const moderacionService = new ModeracionService();
    const moderacionImagenService = new ModeracionImagenService();
    console.log('✅ Servicios de moderación listos');

    // ✅ MONITOREO PERIÓDICO (CORREGIDO)
    const intervaloMonitoreo = setInterval(async () => {
      try {
        await pool.query('SELECT 1 FROM administradores LIMIT 1');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        console.error('❌ Error en verificación periódica de BD:', errorMessage);
      }
    }, 15 * 60 * 1000);

    // ✅ MANEJO GRACCIOSO DE APAGADO
    const shutdown = async () => {
      console.log('🛑 Apagando servidor...');
      clearInterval(intervaloMonitoreo);
      await pool.end();
      console.log('✅ Conexión a BD cerrada');
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // ✅ INICIAR SERVIDOR (CORREGIDO)
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n' + '='.repeat(60));
      console.log('🎉 SERVIDOR TAHITIC INICIADO CORRECTAMENTE');
      console.log('🌐 URL: http://localhost:' + PORT);
      console.log('🏷️  Ambiente:', process.env.NODE_ENV);
      console.log('🗄️  Base de datos:', 'PostgreSQL Railway');
      console.log('📊 Tablas totales:', tables.rows.length);
      console.log('🔐 JWT:', process.env.JWT_SECRET ? '✅ Configurado' : '❌ Faltante');
      console.log('📝 Moderación texto:', '✅ ACTIVO');
      console.log('🖼️ Moderación imágenes:', '✅ ACTIVO');
      console.log('='.repeat(60) + '\n');
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error crítico desconocido';
    
    console.error('💥 ERROR CRÍTICO AL INICIAR SERVIDOR:', errorMessage);
    
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