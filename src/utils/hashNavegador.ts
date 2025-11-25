// utils/hashNavegador.ts
import { Request } from 'express';
import { createHash } from 'crypto';

/**
 * ✅ CORREGIDO: Función compatible con express-rate-limit para IPv6
 */
export function generarHashNavegador(req: Request): string {
  // Usar la IP normalizada de express-rate-limit
  const ip = normalizeIP(req.ip || 'unknown');
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  const fingerprint = `${ip}-${userAgent}-${acceptLanguage}-${acceptEncoding}`;
  return createHash('md5').update(fingerprint).digest('hex');
}

/**
 * ✅ NUEVO: Normalizar IP para compatibilidad con IPv6
 */
function normalizeIP(ip: string): string {
  if (!ip) return 'unknown';
  
  // Manejar IPv6 (direcciones con :)
  if (ip.includes(':')) {
    // Para IPv6, usar un hash o simplificar
    return createHash('md5').update(ip).digest('hex').substring(0, 16);
  }
  
  // Para IPv4, usar directamente
  return ip;
}

/**
 * ✅ NUEVO: Key generator específico para rate limiting
 */
export function keyGeneratorRateLimit(req: Request): string {
  // Esta función es específica para express-rate-limit
  const ip = req.ip || 'unknown';
  
  // Para IPv6, usar un método compatible
  if (ip.includes(':')) {
    // Hash de la IP IPv6 (método recomendado por express-rate-limit)
    return `ipv6_${createHash('md5').update(ip).digest('hex')}`;
  }
  
  // Para IPv4, usar directamente
  return ip;
}

export function validarHashNavegador(hash: string, req: Request): boolean {
  const currentHash = generarHashNavegador(req);
  return hash === currentHash;
}