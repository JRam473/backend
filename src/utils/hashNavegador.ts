// utils/hashNavegador.ts
import { Request } from 'express';
import { createHash } from 'crypto';

export function generarHashNavegador(req: Request): string {
  const ip = req.headers['x-forwarded-for']?.[0] || req.ip || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  const fingerprint = `${ip}-${userAgent}-${acceptLanguage}-${acceptEncoding}`;
  return createHash('md5').update(fingerprint).digest('hex');
}

export function validarHashNavegador(hash: string, req: Request): boolean {
  const currentHash = generarHashNavegador(req);
  return hash === currentHash;
}