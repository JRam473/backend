//utils/baseDeDatos.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'tahiticc',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Verificar conexión
pool.on('connect', () => {
  console.log('✅ Conectado a la base de datos PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Error de conexión a la base de datos:', err);
});

// Función para probar conexión
export const probarConexion = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Conexión a BD exitosa');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Error conectando a BD:', error);
    return false;
  }
};

export default pool;