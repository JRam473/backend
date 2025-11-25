// middleware/ipNavegador.ts
import { Request, Response, NextFunction } from 'express';
import { generarHashNavegador } from '../utils/hashNavegador.js';

// Extender la interfaz Request localmente
declare module 'express' {
  interface Request {
    hashNavegador?: string;
    normalizedIp?: string;
  }
}

export const middlewareIpNavegador = (req: Request, res: Response, next: NextFunction) => {
  try {
    // ✅ Añadir hash de navegador a todas las requests
    req.hashNavegador = generarHashNavegador(req);
    
    // ✅ Añadir IP normalizada para logging
    const ip = req.ip || 'unknown';
    if (ip.includes(':')) {
      // Para IPv6, usar formato simplificado
      req.normalizedIp = `ipv6_${ip.split(':').slice(0, 2).join(':')}...`;
    } else {
      req.normalizedIp = ip;
    }
    
    next();
  } catch (error) {
    console.error('❌ Error en middlewareIpNavegador:', error);
    // Continuar sin hash en caso de error
    req.hashNavegador = 'error_generating_hash';
    next();
  }
};