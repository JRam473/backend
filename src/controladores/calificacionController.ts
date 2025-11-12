//controladores/calificacionController.ts
import { Request, Response } from 'express';
import { pool } from '../utils/baseDeDatos';
import { generarHashNavegador } from '../utils/hashNavegador';

export const calificacionController = {
  // Calificar lugar con control por IP/Navegador
  async calificarLugar(req: Request, res: Response) {
    const { lugarId, calificacion, comentario } = req.body;
    const hashNavegador = generarHashNavegador(req);
    
    try {
      // Verificar si el lugar existe
      const lugarResult = await pool.query(
        'SELECT id FROM lugares WHERE id = $1',
        [lugarId]
      );
      
      if (lugarResult.rows.length === 0) {
        return res.status(404).json({ error: 'Lugar no encontrado' });
      }
      
      // Upsert de calificación
      const result = await pool.query(
        `INSERT INTO calificaciones_lugares 
         (lugar_id, calificacion, comentario, ip_usuario, hash_navegador)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (lugar_id, hash_navegador) 
         DO UPDATE SET 
           calificacion = EXCLUDED.calificacion,
           comentario = EXCLUDED.comentario,
           actualizado_en = NOW()
         RETURNING *`,
        [lugarId, calificacion, comentario, req.ip, hashNavegador]
      );
      
      // El trigger actualiza automáticamente el promedio en lugares
      res.json({
        mensaje: 'Calificación guardada exitosamente',
        calificacion: result.rows[0]
      });
    } catch (error) {
      console.error('Error calificando lugar:', error);
      res.status(500).json({ error: 'Error al guardar calificación' });
    }
  },

  // Obtener mi calificación actual
  async obtenerMiCalificacion(req: Request, res: Response) {
    const { lugarId } = req.params;
    const hashNavegador = generarHashNavegador(req);
    
    try {
      const result = await pool.query(
        'SELECT * FROM calificaciones_lugares WHERE lugar_id = $1 AND hash_navegador = $2',
        [lugarId, hashNavegador]
      );
      
      res.json({
        calificacion: result.rows[0] || null
      });
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener calificación' });
    }
  },

  // Obtener calificaciones de un lugar (para admin)
  async obtenerCalificacionesLugar(req: Request, res: Response) {
    const { lugarId } = req.params;
    
    try {
      const result = await pool.query(
        `SELECT cl.*, l.nombre as lugar_nombre 
         FROM calificaciones_lugares cl
         JOIN lugares l ON cl.lugar_id = l.id
         WHERE cl.lugar_id = $1
         ORDER BY cl.creado_en DESC`,
        [lugarId]
      );
      
      res.json({
        calificaciones: result.rows
      });
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener calificaciones' });
    }
  },
// En controladores/administradorController.ts - AGREGAR ESTA FUNCIÓN
async obtenerCalificacionesParaEstadisticas(req: Request, res: Response) {
  const { lugarId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT calificacion 
       FROM calificaciones_lugares 
       WHERE lugar_id = $1`,
      [lugarId]
    );
    
    res.json({
      calificaciones: result.rows
    });
  } catch (error) {
    console.error('Error obteniendo calificaciones para estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener calificaciones' });
  }
}


};