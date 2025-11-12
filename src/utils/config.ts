//utils/config.ts
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Servidor
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Base de datos
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    name: process.env.DB_NAME || 'tahiticc',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'supersecreto',
    expiresIn: process.env.JWT_EXPIRES_IN || '60m',
  },

  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
  },

  // Administrador
  admin: {
    email: process.env.ADMIN_EMAIL || 'juanramiro139@gmail.com',
  },

  // Uploads
  uploads: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
};

export default config;