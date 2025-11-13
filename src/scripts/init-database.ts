import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// ✅ CONFIGURACIÓN MEJORADA DE DETECCIÓN DE RUTAS
function findSqlFile(): string {
  const possiblePaths = [
    path.join(__dirname, 'init-db.sql'), // Misma carpeta
    path.join(process.cwd(), 'dist/scripts/init-db.sql'), // Dist compilado
    path.join(process.cwd(), 'scripts/init-db.sql'), // Desarrollo
    path.join(__dirname, '../../scripts/init-db.sql'), // Desde dist/scripts
    path.join(__dirname, '../scripts/init-db.sql'), // Otra posible ruta
  ];

  for (const sqlPath of possiblePaths) {
    console.log(`🔍 Buscando en: ${sqlPath}`);
    if (fs.existsSync(sqlPath)) {
      console.log(`✅ Encontrado: ${sqlPath}`);
      return sqlPath;
    }
  }

  // Listar archivos para debugging
  try {
    const files = fs.readdirSync(__dirname);
    console.log('📁 Archivos en directorio actual:', files);
  } catch (e) {
    console.log('❌ No se pudo leer el directorio actual');
  }

  throw new Error(`No se encontró init-db.sql en ninguna ruta posible`);
}

export async function initializeDatabase(): Promise<void> {
  console.log('🔄 INICIANDO MIGRACIÓN DE BASE DE DATOS...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🔌 Conectando a la base de datos...');
    const client = await pool.connect();
    console.log('✅ Conectado a PostgreSQL');

    // ✅ ENCONTRAR ARCHIVO SQL
    const sqlFilePath = findSqlFile();
    
    // ✅ LEER Y EJECUTAR SCRIPT SQL
    console.log(`📖 Leyendo archivo SQL: ${sqlFilePath}`);
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('🚀 Ejecutando script SQL...');
    await client.query(sqlScript);
    
    console.log('✅ Base de datos inicializada correctamente');
    client.release();
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('❌ Error en migración:', errorMessage);
    throw error;
  } finally {
    await pool.end();
  }
}