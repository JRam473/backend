// utils/baseDeDatos.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

function getDatabaseConfig() {
  // ✅ EN RAILWAY: Usar DATABASE_URL que Railway inyecta automáticamente
  if (process.env.DATABASE_URL) {
    console.log('🔗 Usando DATABASE_URL de Railway');
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    };
  }

  // ✅ EN DESARROLLO: Usar variables individuales
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

export const pool = new Pool(getDatabaseConfig());

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