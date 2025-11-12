// middleware/verificarPropiedadExperiencia.ts
import { Request, Response, NextFunction } from 'express';
import { pool } from '../utils/baseDeDatos';
import { generarHashNavegador } from '../utils/hashNavegador';

export const verificarPropiedadExperiencia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const hashNavegador = generarHashNavegador(req);

    // Verificar si la experiencia existe y pertenece al usuario
    const result = await pool.query(
      'SELECT id FROM experiencias WHERE id = $1 AND hash_navegador = $2',
      [id, hashNavegador]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Experiencia no encontrada o no tienes permisos para modificarla' 
      });
    }

    next();
  } catch (error) {
    console.error('Error verificando propiedad de experiencia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};