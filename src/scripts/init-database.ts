// backend/src/scripts/init-database.ts
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

async function initializeDatabase() {
  console.log('🔄 Inicializando base de datos...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, 'init-db.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Ejecutar el SQL
    await pool.query(sql);
    console.log('✅ Base de datos inicializada correctamente');
    
    // Verificar tablas creadas
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('📊 Tablas creadas:', tables.rows.map((row: any) => row.table_name));
    
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar si es el módulo principal
if (require.main === module) {
   initializeDatabase().catch(console.error);
}

export { initializeDatabase };