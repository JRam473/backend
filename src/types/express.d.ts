import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      administrador?: {
        id: string;
        usuario: string;
        email: string;
        rol: string;
        avatar_url?: string;
      };
      hashNavegador?: string;
    }
  }
}