//middleware/autenticacion.ts
import { Request, Response, NextFunction } from 'express';
import { verificarToken } from '../utils/jwt';
import { pool } from '../utils/baseDeDatos';

// Extender la interfaz Request de Express
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
    }
  }
}

export const autenticarAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token de administrador requerido' });
  }
  
  try {
    const decoded = verificarToken(token);
    
    if (decoded.tipo !== 'admin') {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }
    
    const result = await pool.query(
      'SELECT id, usuario, email, rol, avatar_url FROM administradores WHERE id = $1',
      [decoded.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Administrador no encontrado' });
    }
    
    req.administrador = result.rows[0];
    next();
  } catch (error) {
    if (error instanceof Error) {
      res.status(401).json({ error: error.message });
    } else {
      res.status(401).json({ error: 'Token inválido' });
    }
  }
};