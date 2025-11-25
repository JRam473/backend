// middleware/rateLimiting.ts
import rateLimit from 'express-rate-limit';
import { keyGeneratorRateLimit } from '../utils/hashNavegador.js';

/**
 * ✅ RATE LIMITING GENERAL - Compatible con IPv6
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite de 100 requests por IP por ventana
  message: {
    success: false,
    error: 'Demasiadas solicitudes desde esta IP, intenta nuevamente en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyGeneratorRateLimit // ✅ Usar el key generator corregido
});

/**
 * ✅ RATE LIMITING PARA SUBIR ARCHIVOS
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // Máximo 10 uploads por hora
  message: {
    success: false,
    error: 'Límite de subida de archivos excedido. Intenta nuevamente en una hora.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyGeneratorRateLimit
});

/**
 * ✅ RATE LIMITING PARA AUTENTICACIÓN
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 intentos de login
  message: {
    success: false,
    error: 'Demasiados intentos de autenticación. Intenta nuevamente en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyGeneratorRateLimit
});

/**
 * ✅ RATE LIMITING PARA CHATBOT
 */
export const chatbotRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // Máximo 10 mensajes por minuto
  message: {
    success: false,
    error: 'Límite de mensajes excedido. Espera un momento antes de enviar otro mensaje.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyGeneratorRateLimit
});