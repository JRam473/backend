//utils/hashNavegador.ts
import { Request } from 'express';
import { createHash } from 'crypto';

export function generarHashNavegador(req: Request): string {
  const fingerprint = `${req.ip}-${req.headers['user-agent']}-${req.headers['accept-language']}`;
  return createHash('md5').update(fingerprint).digest('hex');
}

export function validarHashNavegador(hash: string, req: Request): boolean {
  const currentHash = generarHashNavegador(req);
  return hash === currentHash;
}