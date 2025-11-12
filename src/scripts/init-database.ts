// backend/src/scripts/init-database.ts
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

async function initializeDatabase() {
  console.log('🔄 FORZANDO migración de base de datos...');
  
  // ✅ USA LA MISMA CONFIGURACIÓN que baseDeDatos.ts
  function getDatabaseConfig() {
    if (process.env.DATABASE_URL) {
      console.log('🔗 Usando DATABASE_URL de Railway');
      return {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      };
    }
    
    console.log('🔗 Usando configuración local de BD');
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_NAME || 'tahiticc',
      ssl: false
    };
  }

  const pool = new Pool(getDatabaseConfig());

  try {
    // ✅ CONEXIÓN FORZADA - Si falla, todo se detiene
    console.log('🔌 Conectando a la base de datos...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conectado a PostgreSQL');

    // ✅ VERIFICAR SI EL ARCHIVO SQL EXISTE
    const sqlPath = path.join(__dirname, 'init-db.sql');
    
    if (!fs.existsSync(sqlPath)) {
      console.error('❌ ERROR: No se encontró init-db.sql');
      console.log('📁 Buscando en:', sqlPath);
      throw new Error('Archivo init-db.sql no encontrado');
    }

    console.log('📋 Leyendo archivo SQL...');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    if (!sql || sql.trim().length === 0) {
      throw new Error('Archivo init-db.sql está vacío');
    }

    console.log('🚀 Ejecutando migración SQL...');
    
    // ✅ EJECUTAR TODO EL SQL DE UNA VEZ
    await pool.query(sql);
    console.log('✅ Base de datos inicializada CORRECTAMENTE');
    
    // ✅ VERIFICACIÓN EXTRA
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📊 Tablas creadas:', tables.rows.map((row: any) => row.table_name));
    console.log('🎉 MIGRACIÓN COMPLETADA - Total tablas:', tables.rows.length);
    
  } catch (error) {
    // ✅ CORREGIDO: Manejo seguro de errores en TypeScript
    let errorMessage = 'Error desconocido en migración';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String((error as any).message);
    }
    
    console.error('💥 ERROR CRÍTICO en migración:', errorMessage);
    
    // ❌ SI FALLA LA MIGRACIÓN, DETENER TODO
    throw new Error(`Fallo en migración de BD: ${errorMessage}`);
  } finally {
    await pool.end();
  }
}

// ✅ EJECUTAR SIEMPRE que se llame este script
if (require.main === module) {
  console.log('🚀 INICIANDO MIGRACIÓN FORZADA DE BD');
  initializeDatabase()
    .then(() => {
      console.log('🎉 MIGRACIÓN EXITOSA - Saliendo...');
      process.exit(0);
    })
    .catch((error) => {
      // ✅ CORREGIDO: Manejo seguro en el catch principal
      let errorMessage = 'Error desconocido';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      console.error('💥 MIGRACIÓN FALLIDA:', errorMessage);
      process.exit(1);
    });
}

export { initializeDatabase };