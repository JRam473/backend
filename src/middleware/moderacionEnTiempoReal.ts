// backend/src/middleware/moderacionEnTiempoReal.ts - VERSIÓN SOLO TEXTO CORREGIDA
import { Request, Response, NextFunction } from 'express';
import { ModeracionService } from '../services/moderacionService';

const moderacionService = new ModeracionService();

declare global {
  namespace Express {
    interface Request {
      moderacionResultado?: any;
    }
  }
}

export const moderacionEnTiempoReal = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Solo aplicar a métodos que crean contenido
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    console.log('🛡️ Aplicando moderación en tiempo real (solo texto)...');

    // ✅ EXTRAER TEXTO DE FORMA SEGURA
    const texto = req.body?.descripcion || req.body?.comentario || req.body?.contenido || '';
    
    const ipUsuario = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const hashNavegador = Buffer.from(userAgent).toString('base64').substring(0, 32);

    // Si no hay texto para moderar, continuar
    if (!texto || texto.trim() === '') {
      console.log('ℹ️ No hay texto para moderar, continuando...');
      return next();
    }

    console.log(`📝 Texto a moderar: ${texto.length} caracteres`);

    // ✅ EJECUTAR MODERACIÓN SOLO DE TEXTO
    const resultado = await moderacionService.moderarTexto(texto.trim(), ipUsuario, hashNavegador);

    if (!resultado.esAprobado) {
      console.log(`❌ Texto rechazado: ${resultado.motivoRechazo}`);
      return res.status(400).json({
        success: false,
        error: 'CONTENIDO_RECHAZADO',
        message: 'El contenido no cumple con nuestras políticas',
        motivo: resultado.motivoRechazo,
        detalles: {
          puntuacion: resultado.puntuacionGeneral,
          tipo: 'moderacion_texto',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('✅ Texto aprobado por moderación automática');
    next();

  } catch (error) {
    console.error('❌ Error en moderación en tiempo real:', error);
    
    // En caso de error, ser permisivo y continuar
    console.log('⚠️ Error en moderación, continuando sin moderación...');
    next();
  }
};