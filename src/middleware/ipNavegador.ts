import { Request, Response, NextFunction } from 'express';
import { generarHashNavegador } from '../utils/hashNavegador';

// Extender la interfaz Request localmente
declare module 'express' {
  interface Request {
    hashNavegador?: string;
  }
}

export const middlewareIpNavegador = (req: Request, res: Response, next: NextFunction) => {
  // Añadir hash de navegador a todas las requests
  req.hashNavegador = generarHashNavegador(req);
  next();
};