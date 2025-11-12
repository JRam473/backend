import { Request, Response } from 'express';
import { ModeracionImagenService } from '../services/moderacionImagenService';
import { pool } from '../utils/baseDeDatos';
import { generarHashNavegador } from '../utils/hashNavegador';
import fs from 'fs/promises';

export const moderacionController = {
  /**
   * Analizar imagen independientemente (para testing o uso externo)
   */
  async analizarImagen(req: Request, res: Response) {
    try {
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'Imagen requerida para análisis'
        });
      }

      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';

      const moderacionImagenService = new ModeracionImagenService();
      
      const resultado = await moderacionImagenService.moderarImagen(
        file.path,
        ipUsuario,
        hashNavegador
      );

      // Respuesta detallada para análisis
      res.json({
        success: true,
        esAprobado: resultado.esAprobado,
        puntuacionRiesgo: resultado.puntuacionRiesgo,
        motivoRechazo: resultado.motivoRechazo,
        detalles: resultado.detalles,
        imagen: {
          nombre: file.filename,
          tamaño: file.size,
          tipo: file.mimetype
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error analizando imagen:', errorMessage);
      
      res.status(500).json({
        success: false,
        error: 'Error al analizar imagen',
        message: errorMessage
      });
    }
  },

  /**
   * Obtener logs de moderación de imágenes (admin)
   */
  async obtenerLogsImagenes(req: Request, res: Response) {
    try {
      const { 
        pagina = 1, 
        limite = 20, 
        hash_navegador,
        es_aprobado 
      } = req.query;

      const offset = (Number(pagina) - 1) * Number(limite);
      
      let query = `
        SELECT id, ruta_imagen, ip_usuario, hash_navegador, 
               resultado_analisis, es_aprobado, error, creado_en
        FROM logs_moderacion_imagenes 
        WHERE 1=1
      `;
      let params: any[] = [];
      let paramCount = 0;

      if (hash_navegador) {
        paramCount++;
        query += ` AND hash_navegador = $${paramCount}`;
        params.push(hash_navegador);
      }

      if (es_aprobado !== undefined) {
        paramCount++;
        query += ` AND es_aprobado = $${paramCount}`;
        params.push(es_aprobado === 'true');
      }

      query += ` ORDER BY creado_en DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limite, offset);

      const result = await pool.query(query, params);
      
      // Contar total con los mismos filtros
      let countQuery = `SELECT COUNT(*) FROM logs_moderacion_imagenes WHERE 1=1`;
      let countParams: any[] = [];
      let countParamCount = 0;

      if (hash_navegador) {
        countParamCount++;
        countQuery += ` AND hash_navegador = $${countParamCount}`;
        countParams.push(hash_navegador);
      }

      if (es_aprobado !== undefined) {
        countParamCount++;
        countQuery += ` AND es_aprobado = $${countParamCount}`;
        countParams.push(es_aprobado === 'true');
      }

      const countResult = await pool.query(countQuery, countParams);

      res.json({
        success: true,
        logs: result.rows,
        total: parseInt(countResult.rows[0].count),
        pagina: Number(pagina),
        totalPaginas: Math.ceil(parseInt(countResult.rows[0].count) / Number(limite))
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error obteniendo logs de imágenes:', errorMessage);
      
      res.status(500).json({
        success: false,
        error: 'Error al obtener logs'
      });
    }
  },

  /**
   * Obtener estadísticas de moderación de imágenes
   */
  async obtenerEstadisticasImagenes(req: Request, res: Response) {
    try {
      // Estadísticas generales
      const totalResult = await pool.query(
        'SELECT COUNT(*) as total FROM logs_moderacion_imagenes'
      );
      
      const aprobadasResult = await pool.query(
        'SELECT COUNT(*) as aprobadas FROM logs_moderacion_imagenes WHERE es_aprobado = true'
      );
      
      const rechazadasResult = await pool.query(
        'SELECT COUNT(*) as rechazadas FROM logs_moderacion_imagenes WHERE es_aprobado = false'
      );

      // Tasa de rechazo por motivo - VERSIÓN CORREGIDA
      const motivosRechazoResult = await pool.query(`
        SELECT 
          COUNT(*) as cantidad,
          CASE 
            WHEN resultado_analisis->'analisis_violencia'->>'es_violento' = 'true' THEN 'violencia'
            WHEN resultado_analisis->'analisis_armas'->>'armas_detectadas' = 'true' THEN 'armas'
            WHEN error IS NOT NULL THEN 'error_analisis'
            ELSE 'otro'
          END as motivo
        FROM logs_moderacion_imagenes 
        WHERE es_aprobado = false
        GROUP BY motivo
        ORDER BY cantidad DESC
      `);

      // Tendencia últimos 7 días - VERSIÓN MEJORADA
      const tendenciaResult = await pool.query(`
        SELECT 
          DATE(creado_en) as fecha,
          COUNT(*) as total,
          SUM(CASE WHEN es_aprobado THEN 1 ELSE 0 END) as aprobadas,
          SUM(CASE WHEN NOT es_aprobado THEN 1 ELSE 0 END) as rechazadas,
          CAST(
            AVG(
              CASE 
                WHEN (resultado_analisis->'analisis_violencia'->>'probabilidad_violencia') IS NOT NULL 
                THEN CAST(resultado_analisis->'analisis_violencia'->>'probabilidad_violencia' AS NUMERIC)
                ELSE 0
              END
            ) AS NUMERIC(10,2)
          ) as avg_probabilidad_violencia
        FROM logs_moderacion_imagenes 
        WHERE creado_en >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(creado_en)
        ORDER BY fecha DESC
      `);

      // Estadísticas usando la vista
      const vistaEstadisticas = await pool.query(`
        SELECT * FROM estadisticas_moderacion_imagenes 
        WHERE fecha >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY fecha DESC
      `);

      const total = parseInt(totalResult.rows[0].total);
      const aprobadas = parseInt(aprobadasResult.rows[0].aprobadas);
      const rechazadas = parseInt(rechazadasResult.rows[0].rechazadas);
      const tasaAprobacion = total > 0 ? (aprobadas / total) * 100 : 0;

      res.json({
        success: true,
        estadisticas: {
          total: total,
          aprobadas: aprobadas,
          rechazadas: rechazadas,
          tasa_aprobacion: parseFloat(tasaAprobacion.toFixed(2)),
          tasa_rechazo: parseFloat(((rechazadas / total) * 100).toFixed(2))
        },
        motivos_rechazo: motivosRechazoResult.rows,
        tendencia: tendenciaResult.rows,
        vista_estadisticas: vistaEstadisticas.rows
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error obteniendo estadísticas:', errorMessage);
      
      res.status(500).json({
        success: false,
        error: 'Error al obtener estadísticas'
      });
    }
  },

  /**
   * Validar imagen antes de subir (endpoint separado)
   */
  async validarImagenPrev(req: Request, res: Response) {
    try {
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'Imagen requerida para validación'
        });
      }

      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';

      console.log('🔍 Validando imagen previa:', {
        nombre: file.filename,
        tamaño: file.size,
        tipo: file.mimetype,
        hash: hashNavegador.substring(0, 10) + '...'
      });

      const moderacionImagenService = new ModeracionImagenService();
      
      const resultado = await moderacionImagenService.moderarImagen(
        file.path,
        ipUsuario,
        hashNavegador
      );

      if (!resultado.esAprobado) {
        // Eliminar archivo si fue rechazado
        await fs.unlink(file.path).catch(console.error);
        
        return res.status(400).json({
          success: false,
          error: 'IMAGEN_RECHAZADA',
          message: 'La imagen no cumple con las políticas de contenido',
          motivo: resultado.motivoRechazo,
          tipo: 'imagen',
          detalles: {
            puntuacion: resultado.puntuacionRiesgo,
            problemas: [resultado.motivoRechazo || 'Contenido inapropiado'],
            sugerencias: [
              'Asegúrate de que la imagen no contenga contenido violento o gráfico',
              'No incluyas armas o elementos peligrosos',
              'Usa imágenes apropiadas para todas las edades'
            ],
            timestamp: new Date().toISOString()
          }
        });
      }

      // Imagen aprobada
      res.json({
        success: true,
        esAprobado: true,
        mensaje: 'Imagen aprobada, puedes continuar con el proceso',
        puntuacionRiesgo: resultado.puntuacionRiesgo,
        imagen: {
          nombre: file.filename,
          tamaño: file.size,
          tipo: file.mimetype,
          rutaTemporal: file.path
        },
        detalles: resultado.detalles
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error validando imagen:', errorMessage);
      
      // Eliminar archivo en caso de error
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      
      res.status(500).json({
        success: false,
        error: 'Error al validar imagen',
        message: errorMessage
      });
    }
  },

  /**
   * NUEVO: Obtener estadísticas usando la vista
   */
  async obtenerEstadisticasVista(req: Request, res: Response) {
    try {
      const { dias = 30 } = req.query;
      
      const resultado = await pool.query(`
        SELECT * FROM estadisticas_moderacion_imagenes 
        WHERE fecha >= CURRENT_DATE - INTERVAL '${dias} days'
        ORDER BY fecha DESC
      `);

      res.json({
        success: true,
        estadisticas: resultado.rows,
        total_dias: resultado.rows.length
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error obteniendo estadísticas de vista:', errorMessage);
      
      res.status(500).json({
        success: false,
        error: 'Error al obtener estadísticas'
      });
    }
  },

  /**
   * NUEVO: Limpiar logs antiguos (admin only)
   */
  async limpiarLogsAntiguos(req: Request, res: Response) {
    try {
      const { dias = 30 } = req.query;
      
      const resultado = await pool.query(
        'DELETE FROM logs_moderacion_imagenes WHERE creado_en < CURRENT_DATE - INTERVAL $1 days',
        [dias]
      );

      res.json({
        success: true,
        mensaje: `Logs antiguos eliminados (más de ${dias} días)`,
        registros_eliminados: resultado.rowCount
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error limpiando logs:', errorMessage);
      
      res.status(500).json({
        success: false,
        error: 'Error al limpiar logs'
      });
    }
  }
};
