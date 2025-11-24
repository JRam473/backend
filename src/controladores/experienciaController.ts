// controladores/experienciaController.ts - VERSIÓN CLOUDINARY
import { pool } from '../utils/baseDeDatos.js';
import { generarHashNavegador } from '../utils/hashNavegador.js';
import { ModeracionService } from '../services/moderacionService.js';
import { ModeracionImagenService } from '../services/moderacionImagenService.js';
import { CloudinaryService } from '../services/cloudinaryService.js'; // 🆕 NUEVO
import { Request, Response } from 'express';
import fs from 'fs/promises';
import { constants } from 'buffer';

// ✅ FUNCIONES AUXILIARES (se mantienen igual)
const generarSugerencias = (tipoProblema: string): string[] => {
  const sugerencias: string[] = [];
  
  if (tipoProblema === 'texto') {
    sugerencias.push('Evita lenguaje ofensivo, insultos o palabras vulgares');
    sugerencias.push('No incluyas contenido comercial, promociones o spam');
    sugerencias.push('Asegúrate de que el texto sea coherente y tenga sentido');
    sugerencias.push('No incluyas enlaces, emails o números de teléfono');
    sugerencias.push('Usa un lenguaje respetuoso y apropiado para la comunidad');
  } else if (tipoProblema === 'nombre_usuario') {
    sugerencias.push('Usa un nombre apropiado y respetuoso');
    sugerencias.push('Evita lenguaje ofensivo o inapropiado');
    sugerencias.push('No uses nombres comerciales o promocionales');
    sugerencias.push('El nombre debe ser adecuado para todas las edades');
    sugerencias.push('Puedes dejar el campo vacío para aparecer como "Usuario Anónimo"');
  } else {
    sugerencias.push('Revisa el contenido antes de publicarlo');
    sugerencias.push('Asegúrate de que cumpla con las políticas de la comunidad');
  }
  
  return sugerencias;
};

const analizarMotivoRechazo = (resultadoModeracion: any): { 
  mensajeUsuario: string; 
  tipoProblema: string; 
  detallesEspecificos: string[] 
} => {
  const detallesEspecificos: string[] = [];
  let mensajeUsuario = 'El contenido no cumple con nuestras políticas';
  let tipoProblema = 'general';

  if (resultadoModeracion.detalles?.texto && !resultadoModeracion.detalles.texto.esAprobado) {
    tipoProblema = 'texto';
    const texto = resultadoModeracion.detalles.texto;
    
    if (texto.razon.includes('ofensivo')) {
      mensajeUsuario = 'El texto contiene lenguaje ofensivo o inapropiado';
      detallesEspecificos.push('Se detectaron palabras ofensivas');
      if (texto.palabrasOfensivas?.length > 0) {
        detallesEspecificos.push(`Palabras problemáticas: ${texto.palabrasOfensivas.slice(0, 3).join(', ')}`);
      }
    } else if (texto.razon.includes('spam')) {
      mensajeUsuario = 'El texto contiene contenido comercial no permitido';
      detallesEspecificos.push('Se detectó contenido promocional o spam');
    } else if (texto.razon.includes('sin sentido')) {
      mensajeUsuario = 'El texto no tiene sentido o es muy corto';
      detallesEspecificos.push('El texto debe ser coherente y tener al menos algunas palabras con sentido');
    } else if (texto.razon.includes('URL') || texto.razon.includes('email') || texto.razon.includes('teléfono')) {
      mensajeUsuario = 'El texto contiene enlaces o información de contacto';
      detallesEspecificos.push('No se permiten URLs, emails o números de teléfono');
    }
  }

  return { mensajeUsuario, tipoProblema, detallesEspecificos };
};

// ✅ FUNCIÓN PARA MODERAR NOMBRE DE USUARIO (se mantiene igual)
const moderarNombreUsuario = async (
  nombreUsuario: string | undefined, 
  ipUsuario: string, 
  hashNavegador: string,
  moderacionService: ModeracionService
): Promise<{ esAprobado: boolean; motivoRechazo?: string; detalles?: any }> => {
  
  if (!nombreUsuario || !nombreUsuario.trim()) {
    return { esAprobado: true };
  }

  const nombreLimpio = nombreUsuario.trim();

  if (nombreLimpio.length > 50) {
    return { 
      esAprobado: false, 
      motivoRechazo: 'El nombre de usuario no puede exceder los 50 caracteres' 
    };
  }

  if (nombreLimpio.length < 2) {
    return { 
      esAprobado: false, 
      motivoRechazo: 'El nombre de usuario debe tener al menos 2 caracteres' 
    };
  }

  try {
    const resultadoModeracion = await moderacionService.moderarTexto(
      nombreLimpio,
      ipUsuario,
      hashNavegador
    );

    if (!resultadoModeracion.esAprobado) {
      return {
        esAprobado: false,
        motivoRechazo: resultadoModeracion.motivoRechazo || 'El nombre de usuario no es apropiado',
        detalles: resultadoModeracion.detalles
      };
    }

    return { 
      esAprobado: true,
      detalles: resultadoModeracion.detalles
    };
  } catch (error) {
    console.error('❌ Error en moderación de nombre de usuario:', error);
    return { esAprobado: true };
  }
};

// ✅ MOVER ESTA FUNCIÓN FUERA DEL CONTROLADOR (arriba, con las otras funciones auxiliares)

/**
 * ✅ FUNCIÓN AUXILIAR: Limpiar mensajes de error para el frontend
 */
const limpiarMensajeError = (mensaje: string): string => {
  if (!mensaje) return 'Contenido no aprobado';
  
  // ✅ ELIMINAR CONTRADICCIONES Y DUPLICADOS
  let mensajeLimpio = mensaje
    .replace(/Contenido aprobado/g, '') // Eliminar "Contenido aprobado" si está presente
    .replace(/Contenido no aprobado/g, 'Contenido no aprobado') // Mantener solo uno
    .replace(/\s+/g, ' ') // Eliminar espacios múltiples
    .trim();
  
  // ✅ SI QUEDA VACÍO, USAR MENSAJE POR DEFECTO
  if (!mensajeLimpio) {
    return 'Contenido no aprobado';
  }
  
  // ✅ GARANTIZAR QUE EMPIECE CON "Contenido no aprobado"
  if (!mensajeLimpio.startsWith('Contenido no aprobado')) {
    mensajeLimpio = `Contenido no aprobado: ${mensajeLimpio}`;
  }
  
  // ✅ ELIMINAR DUPLICADOS AL FINAL
  mensajeLimpio = mensajeLimpio
    .replace(/(Contenido no aprobado: )+/g, 'Contenido no aprobado: ')
    .replace(/(Contenido no aprobado)+/g, 'Contenido no aprobado');
  
  return mensajeLimpio;
};

export const experienciaController = {
  /**
   * 🆕 CREAR EXPERIENCIA CON CLOUDINARY
   */
  async crearExperiencia(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService(); // 🆕 NUEVO
    
    try {
      const file = req.file;
      const { descripcion, lugar_id, nombre_usuario } = req.body;

      if (!file || !descripcion?.trim()) {
        return res.status(400).json({ 
          success: false,
          error: 'Imagen y descripción son requeridos' 
        });
      }

      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';

      const moderacionService = new ModeracionService();
      const moderacionImagenService = new ModeracionImagenService();

      // ✅ 1. LEER ARCHIVO Y MODERAR IMAGEN DESDE BUFFER
      const fileBuffer = await fs.readFile(file.path);
      
      // Moderar la imagen antes de subirla a Cloudinary
      const resultadoImagen = await moderacionImagenService.moderarImagenDesdeBuffer(
        fileBuffer,
        file.filename,
        ipUsuario,
        hashNavegador
      );

      if (!resultadoImagen.esAprobado) {
        await fs.unlink(file.path);
        return res.status(400).json({
          success: false,
          error: 'IMAGEN_RECHAZADA',
          message: 'La imagen no cumple con las políticas de contenido',
          motivo: resultadoImagen.motivoRechazo
        });
      }

      // ✅ 2. MODERAR TEXTO
      const resultadoTexto = await moderacionService.moderarContenidoEnTiempoReal({
        texto: descripcion,
        ipUsuario,
        hashNavegador
      });

      if (!resultadoTexto.esAprobado) {
        await fs.unlink(file.path);
        return res.status(400).json({
          success: false,
          error: 'CONTENIDO_RECHAZADO',
          message: 'El texto no cumple con las políticas de contenido'
        });
      }

      // ✅ 3. SUBIR A CLOUDINARY
      const cloudinaryResult = await cloudinaryService.subirArchivo(
        fileBuffer,
        file.filename,
        process.env.CLOUDINARY_EXPERIENCIAS_FOLDER || 'experiencias'
      );

      // ✅ 4. LIMPIAR ARCHIVO TEMPORAL
      await fs.unlink(file.path);

      // ✅ 5. CREAR EXPERIENCIA CON URLs DE CLOUDINARY
      const result = await pool.query(
        `INSERT INTO experiencias (
          lugar_id, url_foto, descripcion, ruta_almacenamiento,
          ip_usuario, hash_navegador, nombre_usuario,
          ancho_imagen, alto_imagen, tamaño_archivo, tipo_archivo, estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pendiente') 
        RETURNING *`,
        [
          lugar_id || null,
          cloudinaryResult.secure_url,    // ← URL de Cloudinary
          descripcion.trim(),
          cloudinaryResult.public_id,     // ← public_id para eliminación
          ipUsuario,
          hashNavegador,
          nombre_usuario?.trim() || 'Usuario Anónimo',
          cloudinaryResult.width || null,
          cloudinaryResult.height || null,
          cloudinaryResult.bytes,
          `image/${cloudinaryResult.format}`
        ]
      );

      console.log('✅ Experiencia creada con Cloudinary');

      res.status(201).json({
        success: true,
        mensaje: 'Experiencia creada exitosamente',
        experiencia: result.rows[0]
      });

    } catch (error) {
      // Limpiar archivo en caso de error
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      
      console.error('❌ Error creando experiencia:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al crear experiencia' 
      });
    }
  },


  /**
 * ✅ NUEVO: Validar texto Y nombre de usuario antes de subir archivos multimedia
 */

async validarTextoPrev(req: Request, res: Response) {
  try {
    const { texto, nombre_usuario } = req.body;
    
    if (!texto?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Texto requerido para validación'
      });
    }

    const hashNavegador = generarHashNavegador(req);
    const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';

    console.log('🔍 Validando texto y nombre previo:', {
      texto: texto.substring(0, 50) + '...',
      nombre_usuario: nombre_usuario || 'undefined (anónimo)',
      hash: hashNavegador.substring(0, 10) + '...',
      ip: ipUsuario
    });

    const moderacionService = new ModeracionService();

    // ✅ 1. VALIDAR NOMBRE DE USUARIO PRIMERO
    const resultadoModeracionNombre = await moderarNombreUsuario(
      nombre_usuario,
      ipUsuario,
      hashNavegador,
      moderacionService
    );

    if (!resultadoModeracionNombre.esAprobado) {
      console.log('❌ Nombre de usuario rechazado en validación previa:', resultadoModeracionNombre.motivoRechazo);
      
      let detallesEspecificos: string[] = [];
      
      if (resultadoModeracionNombre.detalles?.texto) {
        const texto = resultadoModeracionNombre.detalles.texto;
        if (texto.palabrasOfensivas?.length > 0) {
          detallesEspecificos.push(`Palabras problemáticas: ${texto.palabrasOfensivas.slice(0, 3).join(', ')}`);
        }
      }

      return res.status(400).json({
        success: false,
        error: 'NOMBRE_USUARIO_RECHAZADO',
        message: 'El nombre de usuario no cumple con las políticas de contenido',
        motivo: resultadoModeracionNombre.motivoRechazo,
        tipo: 'nombre_usuario',
        detalles: {
          problemas: detallesEspecificos,
          sugerencias: generarSugerencias('nombre_usuario'),
          timestamp: new Date().toISOString()
        }
      });
    }

    // ✅ 2. VALIDAR TEXTO PRINCIPAL
    const resultadoModeracion = await moderacionService.moderarTexto(
      texto,
      ipUsuario,
      hashNavegador
    );

    // ✅ CORREGIDO: CAPTURAR CORRECTAMENTE EL MOTIVO DE RECHAZO
    if (!resultadoModeracion.esAprobado) {
      console.log('❌ Texto rechazado en validación previa:', resultadoModeracion.motivoRechazo);
      
      // ✅ BUSCAR EL LOG MÁS RECIENTE PARA OBTENER DETALLES ESPECÍFICOS
      const logReciente = await pool.query(
        `SELECT motivo, resultado_moderacion 
         FROM logs_moderacion 
         WHERE hash_navegador = $1 
         ORDER BY creado_en DESC 
         LIMIT 1`,
        [hashNavegador]
      );

      let motivoDetallado = resultadoModeracion.motivoRechazo;
      let detallesEspecificos: string[] = [];

      if (logReciente.rows.length > 0) {
        const log = logReciente.rows[0];
        
        // ✅ CORREGIDO: USAR EL MOTIVO DEL LOG DIRECTAMENTE
        motivoDetallado = log.motivo || resultadoModeracion.motivoRechazo;
        
        // ✅ CORREGIDO: PROCESAR CORRECTAMENTE EL RESULTADO DE MODERACIÓN
        try {
          let resultadoModeracionObj;
          
          if (typeof log.resultado_moderacion === 'string') {
            resultadoModeracionObj = JSON.parse(log.resultado_moderacion);
          } else {
            resultadoModeracionObj = log.resultado_moderacion;
          }
          
          // ✅ EXTRAER INFORMACIÓN ESPECÍFICA DEL ANÁLISIS
          if (resultadoModeracionObj && resultadoModeracionObj.analisisTexto) {
            const analisis = resultadoModeracionObj.analisisTexto;
            
            if (analisis.palabrasOfensivas?.length > 0) {
              detallesEspecificos.push(`${analisis.palabrasOfensivas.length} palabras ofensivas detectadas`);
              detallesEspecificos.push(`Ejemplos: ${analisis.palabrasOfensivas.slice(0, 3).join(', ')}`);
            }
            
            // ✅ CORREGIDO: USAR LA RAZÓN DEL ANÁLISIS, NO CONCATENAR
            if (analisis.razon && !analisis.razon.includes('Contenido aprobado')) {
              detallesEspecificos.push(analisis.razon);
            }
          }
        } catch (error) {
          console.error('Error procesando resultado moderación:', error);
          // ✅ FALLBACK SEGURO
          detallesEspecificos.push('Lenguaje inapropiado detectado');
        }
      }

 
const mensajeLimpio = limpiarMensajeError(motivoDetallado || 'Contenido no aprobado');
      
      return res.status(400).json({
        success: false,
        error: 'TEXTO_RECHAZADO',
        message: mensajeLimpio, // ✅ USAR MENSAJE LIMPIO
        motivo: motivoDetallado,
        detalles: {
          puntuacion: resultadoModeracion.puntuacionGeneral,
          problemas: detallesEspecificos,
          sugerencias: generarSugerencias('texto'),
          timestamp: new Date().toISOString()
        }
      });
    }

    // ✅ SI TODO ES APROBADO
    console.log('✅ Texto y nombre aprobados en validación previa');
    
    res.json({
      success: true,
      esAprobado: true,
      mensaje: 'Contenido aprobado, puedes continuar con la subida de archivos',
      puntuacion: resultadoModeracion.puntuacionGeneral,
      nombre_usuario_aprobado: !!nombre_usuario?.trim(),
      detalles: {
        texto: resultadoModeracion.detalles?.texto
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error validando contenido:', errorMessage);
    
    res.status(500).json({
      success: false,
      error: 'Error al validar contenido',
      message: errorMessage
    });
  }
},



  /**
   * ✅ NUEVO: Obtener motivos de rechazo específicos desde logs
   */
  async obtenerMotivosRechazo(req: Request, res: Response) {
    try {
      const { hash_navegador, limite = 10 } = req.query;
      
      let query = `
        SELECT motivo, accion, tipo_contenido, creado_en, resultado_moderacion
        FROM logs_moderacion 
        WHERE accion = 'rechazado'
      `;
      let params: any[] = [];
      
      if (hash_navegador) {
        query += ' AND hash_navegador = $1';
        params.push(hash_navegador);
      }
      
      query += ' ORDER BY creado_en DESC LIMIT $' + (params.length + 1);
      params.push(limite);

      const result = await pool.query(query, params);
      
      const motivos = result.rows.map(row => ({
        motivo: row.motivo,
        accion: row.accion,
        tipoContenido: row.tipo_contenido,
        fecha: row.creado_en,
        detalles: row.resultado_moderacion ? JSON.parse(row.resultado_moderacion) : null
      }));

      res.json({
        success: true,
        motivos,
        total: result.rows.length
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error obteniendo motivos de rechazo:', errorMessage);
      
      res.status(500).json({
        success: false,
        error: 'Error al obtener motivos de rechazo'
      });
    }
  },

  /**
   * ✅ NUEVO: Endpoint específico para editar nombre de usuario
   */
  async editarNombreUsuario(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { nombre_usuario } = req.body;
      const hashNavegador = generarHashNavegador(req);

      // Verificar que la experiencia existe y pertenece al usuario
      const experienciaActual = await pool.query(
        'SELECT * FROM experiencias WHERE id = $1 AND hash_navegador = $2',
        [id, hashNavegador]
      );

      if (experienciaActual.rows.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'Experiencia no encontrada o no tienes permisos para editarla' 
        });
      }

      const actual = experienciaActual.rows[0];
      const moderacionService = new ModeracionService();

      // ✅ MODERAR NOMBRE DE USUARIO CON ANÁLISIS DE TEXTO
      const resultadoModeracion = await moderarNombreUsuario(
        nombre_usuario,
        actual.ip_usuario,
        hashNavegador,
        moderacionService
      );

      if (!resultadoModeracion.esAprobado) {
        let detallesEspecificos: string[] = [];
        
        if (resultadoModeracion.detalles?.texto) {
          const texto = resultadoModeracion.detalles.texto;
          if (texto.palabrasOfensivas?.length > 0) {
            detallesEspecificos.push(`Palabras problemáticas: ${texto.palabrasOfensivas.slice(0, 3).join(', ')}`);
          }
        }

        return res.status(400).json({
          success: false,
          error: 'NOMBRE_USUARIO_RECHAZADO',
          message: 'El nombre de usuario no cumple con las políticas de contenido',
          motivo: resultadoModeracion.motivoRechazo,
          tipo: 'nombre_usuario',
          detalles: {
            problemas: detallesEspecificos,
            sugerencias: generarSugerencias('nombre_usuario')
          }
        });
      }

      // Actualizar nombre de usuario
      const nombreUsuarioFinal = nombre_usuario?.trim() || 'Usuario Anónimo';
      
      const result = await pool.query(
        `UPDATE experiencias 
         SET nombre_usuario = $1, 
             actualizado_en = NOW()
         WHERE id = $2 AND hash_navegador = $3 
         RETURNING *`,
        [
          nombreUsuarioFinal,
          id,
          hashNavegador
        ]
      );

      res.json({
        success: true,
        mensaje: 'Nombre de usuario actualizado exitosamente.',
        experiencia: result.rows[0]
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error editando nombre de usuario:', errorMessage);
      res.status(500).json({ 
        success: false,
        error: 'Error al editar nombre de usuario' 
      });
    }
  },

  /**
   * Editar experiencia con moderación DE TEXTO Y NOMBRE DE USUARIO
   */
  async editarExperiencia(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { descripcion, nombre_usuario } = req.body;

      const hashNavegador = generarHashNavegador(req);

      // Verificar que la experiencia existe y pertenece al usuario
      const experienciaActual = await pool.query(
        'SELECT * FROM experiencias WHERE id = $1 AND hash_navegador = $2',
        [id, hashNavegador]
      );

      if (experienciaActual.rows.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'Experiencia no encontrada o no tienes permisos para editarla' 
        });
      }

      const actual = experienciaActual.rows[0];
      const moderacionService = new ModeracionService();

      // ✅ 1. MODERAR NOMBRE DE USUARIO SI SE ACTUALIZA
      if (nombre_usuario !== undefined && nombre_usuario !== actual.nombre_usuario) {
        const resultadoModeracionNombre = await moderarNombreUsuario(
          nombre_usuario,
          actual.ip_usuario,
          hashNavegador,
          moderacionService
        );

        if (!resultadoModeracionNombre.esAprobado) {
          let detallesEspecificos: string[] = [];
          
          if (resultadoModeracionNombre.detalles?.texto) {
            const texto = resultadoModeracionNombre.detalles.texto;
            if (texto.palabrasOfensivas?.length > 0) {
              detallesEspecificos.push(`Palabras problemáticas: ${texto.palabrasOfensivas.slice(0, 3).join(', ')}`);
            }
          }

          return res.status(400).json({
            success: false,
            error: 'NOMBRE_USUARIO_RECHAZADO',
            message: 'El nombre de usuario no cumple con las políticas de contenido',
            motivo: resultadoModeracionNombre.motivoRechazo,
            tipo: 'nombre_usuario',
            detalles: {
              problemas: detallesEspecificos,
              sugerencias: generarSugerencias('nombre_usuario')
            }
          });
        }
      }

      // ✅ 2. MODERAR DESCRIPCIÓN SI SE ACTUALIZA
      if (descripcion !== undefined && descripcion !== actual.descripcion) {
        const resultadoModeracion = await moderacionService.moderarContenidoEnTiempoReal({
          texto: descripcion,
          ipUsuario: actual.ip_usuario,
          hashNavegador
        });

        // ✅ SI ES RECHAZADO: Responder inmediatamente con motivo específico
        if (!resultadoModeracion.esAprobado) {
          // ✅ MEJORADO: Buscar log reciente para detalles
          const logReciente = await pool.query(
            `SELECT motivo, resultado_moderacion 
             FROM logs_moderacion 
             WHERE hash_navegador = $1 
             ORDER BY creado_en DESC 
             LIMIT 1`,
            [hashNavegador]
          );

          let motivoDetallado = resultadoModeracion.motivoRechazo;
          let detallesEspecificos: string[] = [];

          if (logReciente.rows.length > 0) {
            const log = logReciente.rows[0];
            motivoDetallado = log.motivo;
            
            try {
              const resultado = JSON.parse(log.resultado_moderacion);
              if (resultado.analisisTexto) {
                const analisis = resultado.analisisTexto;
                if (analisis.palabrasOfensivas?.length > 0) {
                  detallesEspecificos.push(`Palabras problemáticas: ${analisis.palabrasOfensivas.slice(0, 3).join(', ')}`);
                }
              }
            } catch (error) {
              console.error('Error parseando resultado moderación:', error);
            }
          }
          
          return res.status(400).json({
            success: false,
            error: 'CONTENIDO_RECHAZADO',
            message: 'El texto no cumple con las políticas de contenido',
            motivo: motivoDetallado,
            tipo: 'texto',
            detalles: {
              puntuacion: resultadoModeracion.puntuacionGeneral,
              problemas: detallesEspecificos,
              sugerencias: generarSugerencias('texto')
            }
          });
        }
      }

      // Actualizar experiencia
      const nombreUsuarioFinal = nombre_usuario !== undefined ? 
        (nombre_usuario?.trim() || 'Usuario Anónimo') : 
        actual.nombre_usuario;

      const result = await pool.query(
        `UPDATE experiencias 
         SET descripcion = $1, 
             nombre_usuario = $2,
             actualizado_en = NOW()
         WHERE id = $3 AND hash_navegador = $4 
         RETURNING *`,
        [
          descripcion !== undefined ? descripcion : actual.descripcion,
          nombreUsuarioFinal,
          id,
          hashNavegador
        ]
      );

      res.json({
        success: true,
        mensaje: 'Experiencia actualizada exitosamente.',
        experiencia: result.rows[0]
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error editando experiencia:', errorMessage);
      res.status(500).json({ 
        success: false,
        error: 'Error al editar experiencia' 
      });
    }
  },



  /**
   * 🆕 ELIMINAR EXPERIENCIA CON CLOUDINARY
   */
  async eliminarExperiencia(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService(); // 🆕 NUEVO
    
    try {
      const { id } = req.params;
      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';

      console.log('🗑️ Intentando eliminar experiencia:', {
        id,
        hashNavegador: hashNavegador.substring(0, 10) + '...',
        ipUsuario
      });

      // ✅ VERIFICACIÓN MEJORADA: Buscar por múltiples criterios
      const experienciaExistente = await pool.query(
        `SELECT * FROM experiencias 
         WHERE id = $1 
         AND (hash_navegador = $2 OR ip_usuario = $3)`,
        [id, hashNavegador, ipUsuario]
      );

      if (experienciaExistente.rows.length === 0) {
        console.log('❌ Experiencia no encontrada con los criterios actuales');
        
        // ✅ DIAGNÓSTICO: Obtener información de la experiencia para debugging
        const experienciaInfo = await pool.query(
          'SELECT id, hash_navegador, ip_usuario, creado_en FROM experiencias WHERE id = $1',
          [id]
        );

        if (experienciaInfo.rows.length === 0) {
          return res.status(404).json({ 
            success: false,
            error: 'Experiencia no encontrada en el sistema'
          });
        }

        return res.status(403).json({ 
          success: false,
          error: 'No tienes permisos para eliminar esta experiencia',
          detalles: {
            motivo: 'La experiencia fue creada desde un navegador o IP diferente',
            solucion: 'Intenta desde el mismo navegador y red donde la creaste'
          }
        });
      }

      // ✅ ELIMINACIÓN: Primero obtener info para limpiar archivos
      const experiencia = experienciaExistente.rows[0];
      
      // ✅ ELIMINAR IMAGEN DE CLOUDINARY SI EXISTE
      if (experiencia.ruta_almacenamiento && cloudinaryService.esUrlCloudinary(experiencia.url_foto)) {
        try {
          await cloudinaryService.eliminarArchivo(experiencia.ruta_almacenamiento);
          console.log('🗑️ Imagen eliminada de Cloudinary:', experiencia.ruta_almacenamiento);
        } catch (error) {
          console.warn('⚠️ No se pudo eliminar la imagen de Cloudinary:', error);
        }
      }

      // Eliminar de la base de datos
      const result = await pool.query(
        'DELETE FROM experiencias WHERE id = $1 RETURNING *',
        [id]
      );

      // Limpiar vistas relacionadas
      await pool.query(
        'DELETE FROM vistas_experiencias WHERE experiencia_id = $1',
        [id]
      );

      console.log('✅ Experiencia eliminada exitosamente de Cloudinary');

      res.json({ 
        success: true,
        mensaje: 'Experiencia eliminada exitosamente',
        experiencia: result.rows[0]
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error eliminando experiencia:', errorMessage);
      res.status(500).json({ 
        success: false,
        error: 'Error al eliminar experiencia',
        detalles: errorMessage
      });
    }
  },

  /**
   * Obtener experiencias del usuario actual - YA ACTUALIZADO
   */
  async obtenerMisExperiencias(req: Request, res: Response) {
    try {
      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || 'unknown';

      console.log('🔍 Obteniendo experiencias para:', {
        hash: hashNavegador.substring(0, 10) + '...',
        ip: ipUsuario
      });

      const result = await pool.query(
        `SELECT e.*, l.nombre as lugar_nombre, l.ubicacion as lugar_ubicacion
         FROM experiencias e
         LEFT JOIN lugares l ON e.lugar_id = l.id
         WHERE e.hash_navegador = $1 OR e.ip_usuario = $2
         ORDER BY e.creado_en DESC`,
        [hashNavegador, ipUsuario]
      );

      console.log(`📊 Encontradas ${result.rows.length} experiencias para el usuario`);

      res.json({
        success: true,
        experiencias: result.rows,
        total: result.rows.length
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error obteniendo mis experiencias:', errorMessage);
      res.status(500).json({ 
        success: false,
        error: 'Error al obtener experiencias' 
      });
    }
  },

  /**
   * Obtener todas las experiencias (público) - TODAS SON APROBADAS - ACTUALIZADO CON nombre_usuario
   */
  async obtenerExperiencias(req: Request, res: Response) {
    try {
      const { pagina = 1, limite = 20 } = req.query;
      const offset = (Number(pagina) - 1) * Number(limite);

      const result = await pool.query(
        `SELECT e.*, l.nombre as lugar_nombre, l.ubicacion as lugar_ubicacion
         FROM experiencias e
         LEFT JOIN lugares l ON e.lugar_id = l.id
         ORDER BY e.creado_en DESC
         LIMIT $1 OFFSET $2`,
        [limite, offset]
      );

      const countResult = await pool.query('SELECT COUNT(*) FROM experiencias');

      res.json({
        success: true,
        experiencias: result.rows,
        total: parseInt(countResult.rows[0].count),
        pagina: Number(pagina),
        totalPaginas: Math.ceil(parseInt(countResult.rows[0].count) / Number(limite))
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error obteniendo experiencias:', errorMessage);
      res.status(500).json({ 
        success: false,
        error: 'Error al obtener experiencias' 
      });
    }
  },

  /**
   * Obtener experiencia por ID (público) - ACTUALIZADO CON nombre_usuario
   */
  async obtenerExperienciaPorId(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT e.*, l.nombre as lugar_nombre, l.ubicacion as lugar_ubicacion
         FROM experiencias e
         LEFT JOIN lugares l ON e.lugar_id = l.id
         WHERE e.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'Experiencia no encontrada' 
        });
      }

      // Incrementar contador de vistas
      await pool.query(
        'UPDATE experiencias SET contador_vistas = contador_vistas + 1 WHERE id = $1',
        [id]
      );

      res.json({ 
        success: true,
        experiencia: result.rows[0] 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error obteniendo experiencia:', errorMessage);
      res.status(500).json({ 
        success: false,
        error: 'Error al obtener experiencia' 
      });
    }
  },

/**
 * Registrar vista de experiencia - VERSIÓN MEJORADA Y LIMPIA
 */
async registrarVista(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    // Mejor detección de IP
    const ipUsuario = req.headers['x-forwarded-for']?.[0] || 
                     req.ip || 
                     req.connection.remoteAddress || 
                     'unknown';
    
    const agenteUsuario = req.get('User-Agent') || '';
    const hashNavegador = generarHashNavegador(req);

    // Verificar que la experiencia existe
    const expResult = await pool.query(
      'SELECT id FROM experiencias WHERE id = $1',
      [id]
    );

    if (expResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Experiencia no encontrada' 
      });
    }

    // Verificar si ya existe una vista en las últimas 24 horas
    const vistaExistente = await pool.query(
      `SELECT id FROM vistas_experiencias 
       WHERE experiencia_id = $1 
       AND (
         (ip_usuario = $2 AND agente_usuario = $3) 
         OR hash_navegador = $4
       )
       AND visto_en >= NOW() - INTERVAL '24 hours'
       LIMIT 1`,
      [id, ipUsuario, agenteUsuario, hashNavegador]
    );

    if (vistaExistente.rows.length === 0) {
      // Insertar nueva vista
      await pool.query(
        `INSERT INTO vistas_experiencias 
         (experiencia_id, ip_usuario, agente_usuario, hash_navegador) 
         VALUES ($1, $2, $3, $4)`,
        [id, ipUsuario, agenteUsuario, hashNavegador]
      );

      // Actualizar contador en la tabla experiencias
      await pool.query(
        'UPDATE experiencias SET contador_vistas = contador_vistas + 1 WHERE id = $1',
        [id]
      );
      
      res.json({ 
        success: true,
        mensaje: 'Vista registrada exitosamente',
        experiencia_id: id,
        tipo: 'nueva_vista'
      });
    } else {
      res.json({ 
        success: true,
        mensaje: 'Vista ya registrada anteriormente',
        experiencia_id: id,
        tipo: 'vista_duplicada'
      });
    }

  } catch (error) {
    console.error('❌ Error registrando vista:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al registrar vista' 
    });
  }
},

  /**
   * Obtener estadísticas generales (admin only) - ACTUALIZADO CON nombre_usuario
   */
  async obtenerEstadisticas(req: Request, res: Response) {
    try {
      // Estadísticas básicas
      const totalResult = await pool.query('SELECT COUNT(*) FROM experiencias');
      const vistasResult = await pool.query('SELECT SUM(contador_vistas) FROM experiencias');
      
      // Experiencias por día (últimos 7 días)
      const tendenciasResult = await pool.query(`
        SELECT 
          DATE(creado_en) as fecha,
          COUNT(*) as cantidad
        FROM experiencias 
        WHERE creado_en >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(creado_en)
        ORDER BY fecha DESC
      `);

      // Top experiencias más vistas
      const topVistasResult = await pool.query(`
        SELECT id, descripcion, nombre_usuario, contador_vistas as vistas
        FROM experiencias 
        ORDER BY contador_vistas DESC 
        LIMIT 10
      `);

      // Estadísticas de uso por usuario (basado en hash_navegador)
      const usuariosResult = await pool.query(`
        SELECT 
          COUNT(DISTINCT hash_navegador) as usuarios_unicos,
          COUNT(*) as total_experiencias,
          AVG(contador_vistas) as promedio_vistas_por_experiencia
        FROM experiencias
      `);

      // ✅ NUEVO: Estadísticas de nombres de usuario
      const nombresUsuarioResult = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN nombre_usuario != 'Usuario Anónimo' THEN 1 END) as con_nombre,
          COUNT(CASE WHEN nombre_usuario = 'Usuario Anónimo' THEN 1 END) as anonimos
        FROM experiencias
      `);

      res.json({
        success: true,
        estadisticas: {
          total_experiencias: parseInt(totalResult.rows[0].count),
          total_vistas: parseInt(vistasResult.rows[0].sum || '0'),
          usuarios_unicos: parseInt(usuariosResult.rows[0].usuarios_unicos),
          total_experiencias_subidas: parseInt(usuariosResult.rows[0].total_experiencias),
          promedio_vistas_por_experiencia: parseFloat(usuariosResult.rows[0].promedio_vistas_por_experiencia || '0'),
          // ✅ NUEVAS ESTADÍSTICAS
          experiencias_con_nombre: parseInt(nombresUsuarioResult.rows[0].con_nombre),
          experiencias_anonimas: parseInt(nombresUsuarioResult.rows[0].anonimos),
          porcentaje_con_nombre: parseFloat(
            (parseInt(nombresUsuarioResult.rows[0].con_nombre) / parseInt(nombresUsuarioResult.rows[0].total) * 100).toFixed(2)
          )
        },
        tendencias: tendenciasResult.rows,
        top_vistas: topVistasResult.rows
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error obteniendo estadísticas:', errorMessage);
      res.status(500).json({ 
        success: false,
        error: 'Error al obtener estadísticas' 
      });
    }
  },

  /**
   * Obtener estadísticas de vistas únicas - SIN CAMBIOS
   */
  async obtenerEstadisticasVistasUnicas(req: Request, res: Response) {
    try {
      const { experiencia_id } = req.params;
      
      const result = await pool.query(`
        SELECT 
          COUNT(DISTINCT ip_usuario) as vistas_unicas_ip,
          COUNT(DISTINCT hash_navegador) as vistas_unicas_hash,
          COUNT(*) as vistas_totales
        FROM vistas_experiencias 
        WHERE experiencia_id = $1
        AND visto_en >= NOW() - INTERVAL '30 days'
      `, [experiencia_id]);

      res.json({
        success: true,
        estadisticas: result.rows[0]
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error obteniendo estadísticas de vistas:', errorMessage);
      res.status(500).json({ 
        success: false,
        error: 'Error al obtener estadísticas' 
      });
    }
  },

  /**
   * 🆕 EDITAR EXPERIENCIA CON IMAGEN - CLOUDINARY
   */
  async editarExperienciaConImagen(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService(); // 🆕 NUEVO
    
    try {
      const { id } = req.params;
      const { descripcion, nombre_usuario } = req.body;
      const file = req.file;
      const hashNavegador = generarHashNavegador(req);

      console.log('🔄 Editando experiencia con imagen:', { 
        id, 
        tieneNuevaImagen: !!file,
        descripcion: descripcion ? `"${descripcion.substring(0, 50)}..."` : 'undefined',
        nombre_usuario: nombre_usuario ? `"${nombre_usuario}"` : 'undefined (sin cambios)'
      });

      // Verificar que la experiencia existe y pertenece al usuario
      const experienciaActual = await pool.query(
        'SELECT * FROM experiencias WHERE id = $1 AND hash_navegador = $2',
        [id, hashNavegador]
      );

      if (experienciaActual.rows.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'Experiencia no encontrada o no tienes permisos para editarla' 
        });
      }

      const actual = experienciaActual.rows[0];
      const moderacionService = new ModeracionService();
      const moderacionImagenService = new ModeracionImagenService();

      // ✅ 1. MODERAR NOMBRE DE USUARIO SI SE ACTUALIZA
      if (nombre_usuario !== undefined && nombre_usuario !== actual.nombre_usuario) {
        const resultadoModeracionNombre = await moderarNombreUsuario(
          nombre_usuario,
          actual.ip_usuario,
          hashNavegador,
          moderacionService
        );

        if (!resultadoModeracionNombre.esAprobado) {
          let detallesEspecificos: string[] = [];
          
          if (resultadoModeracionNombre.detalles?.texto) {
            const texto = resultadoModeracionNombre.detalles.texto;
            if (texto.palabrasOfensivas?.length > 0) {
              detallesEspecificos.push(`Palabras problemáticas: ${texto.palabrasOfensivas.slice(0, 3).join(', ')}`);
            }
          }

          return res.status(400).json({
            success: false,
            error: 'NOMBRE_USUARIO_RECHAZADO',
            message: 'El nombre de usuario no cumple con las políticas de contenido',
            motivo: resultadoModeracionNombre.motivoRechazo,
            tipo: 'nombre_usuario',
            detalles: {
              problemas: detallesEspecificos,
              sugerencias: generarSugerencias('nombre_usuario')
            }
          });
        }
      }

      // ✅ 2. MODERAR DESCRIPCIÓN SI SE ACTUALIZA
      if (descripcion !== undefined && descripcion !== actual.descripcion) {
        const resultadoModeracion = await moderacionService.moderarContenidoEnTiempoReal({
          texto: descripcion,
          ipUsuario: actual.ip_usuario,
          hashNavegador
        });

        if (!resultadoModeracion.esAprobado) {
          const logReciente = await pool.query(
            `SELECT motivo, resultado_moderacion 
             FROM logs_moderacion 
             WHERE hash_navegador = $1 
             ORDER BY creado_en DESC 
             LIMIT 1`,
            [hashNavegador]
          );

          let motivoDetallado = resultadoModeracion.motivoRechazo;
          let detallesEspecificos: string[] = [];

          if (logReciente.rows.length > 0) {
            const log = logReciente.rows[0];
            motivoDetallado = log.motivo;
            
            try {
              const resultado = JSON.parse(log.resultado_moderacion);
              if (resultado.analisisTexto) {
                const analisis = resultado.analisisTexto;
                if (analisis.palabrasOfensivas?.length > 0) {
                  detallesEspecificos.push(`Palabras problemáticas: ${analisis.palabrasOfensivas.slice(0, 3).join(', ')}`);
                }
              }
            } catch (error) {
              console.error('Error parseando resultado moderación:', error);
            }
          }
          
          return res.status(400).json({
            success: false,
            error: 'CONTENIDO_RECHAZADO',
            message: 'El texto no cumple con las políticas de contenido',
            motivo: motivoDetallado,
            tipo: 'texto',
            detalles: {
              puntuacion: resultadoModeracion.puntuacionGeneral,
              problemas: detallesEspecificos,
              sugerencias: generarSugerencias('texto')
            }
          });
        }
      }

      // ✅ MODERACIÓN Y SUBIDA DE NUEVA IMAGEN A CLOUDINARY
      let nuevaUrlFoto = actual.url_foto;
      let nuevaRutaAlmacenamiento = actual.ruta_almacenamiento;

      if (file) {
        console.log('🖼️ Procesando nueva imagen para experiencia:', id);
        
        // Leer archivo y moderar
        const fileBuffer = await fs.readFile(file.path);
        const resultadoModeracionImagen = await moderacionImagenService.moderarImagenDesdeBuffer(
          fileBuffer,
          file.filename,
          actual.ip_usuario,
          hashNavegador
        );

        if (!resultadoModeracionImagen.esAprobado) {
          await fs.unlink(file.path);
          return res.status(400).json({
            success: false,
            error: 'IMAGEN_RECHAZADA',
            message: 'La imagen no cumple con las políticas de contenido',
            motivo: resultadoModeracionImagen.motivoRechazo,
            tipo: 'imagen',
            detalles: {
              puntuacion: resultadoModeracionImagen.puntuacionRiesgo,
              problemas: [resultadoModeracionImagen.motivoRechazo || 'Contenido inapropiado detectado'],
              sugerencias: [
                'Asegúrate de que la imagen no contenga contenido violento o gráfico',
                'No incluyas armas o elementos peligrosos',
                'Usa imágenes apropiadas para todas las edades'
              ],
              timestamp: new Date().toISOString()
            }
          });
        }

        // Subir nueva imagen a Cloudinary
        const cloudinaryResult = await cloudinaryService.subirArchivo(
          fileBuffer,
          file.filename,
          process.env.CLOUDINARY_EXPERIENCIAS_FOLDER || 'experiencias'
        );

        // Limpiar archivo temporal
        await fs.unlink(file.path);

        // ✅ ELIMINAR IMAGEN ANTERIOR DE CLOUDINARY
        if (actual.ruta_almacenamiento && cloudinaryService.esUrlCloudinary(actual.url_foto)) {
          try {
            await cloudinaryService.eliminarArchivo(actual.ruta_almacenamiento);
            console.log('🗑️ Imagen anterior eliminada de Cloudinary:', actual.ruta_almacenamiento);
          } catch (error) {
            console.warn('⚠️ No se pudo eliminar la imagen anterior de Cloudinary:', error);
          }
        }

        // Actualizar URLs
        nuevaUrlFoto = cloudinaryResult.secure_url;
        nuevaRutaAlmacenamiento = cloudinaryResult.public_id;
      }

      // ✅ ACTUALIZAR EXPERIENCIA EN LA BASE DE DATOS
      const nombreUsuarioFinal = nombre_usuario !== undefined ? 
        (nombre_usuario?.trim() || 'Usuario Anónimo') : 
        actual.nombre_usuario;

      const descripcionFinal = descripcion !== undefined ? descripcion : actual.descripcion;

      let experienciaActualizada;

      if (file) {
        // Si hay nueva imagen, actualizar campos de archivo
        const result = await pool.query(
          `UPDATE experiencias 
           SET descripcion = $1,
               url_foto = $2,
               ruta_almacenamiento = $3,
               nombre_usuario = $4,
               actualizado_en = NOW()
           WHERE id = $5 AND hash_navegador = $6 
           RETURNING *`,
          [
            descripcionFinal,
            nuevaUrlFoto,
            nuevaRutaAlmacenamiento,
            nombreUsuarioFinal,
            id,
            hashNavegador
          ]
        );

        experienciaActualizada = result.rows[0];
      } else {
        // Si no hay archivo, actualizar sin campos de archivo
        const result = await pool.query(
          `UPDATE experiencias 
           SET descripcion = $1,
               nombre_usuario = $2,
               actualizado_en = NOW()
           WHERE id = $3 AND hash_navegador = $4 
           RETURNING *`,
          [
            descripcionFinal,
            nombreUsuarioFinal,
            id,
            hashNavegador
          ]
        );

        experienciaActualizada = result.rows[0];
      }

      console.log('✅ Experiencia actualizada en Cloudinary:', {
        id: experienciaActualizada.id,
        nuevaImagen: !!file,
        descripcionCambiada: descripcion !== actual.descripcion,
        nombreUsuarioCambiado: nombre_usuario !== actual.nombre_usuario
      });

      res.json({
        success: true,
        mensaje: file 
          ? 'Experiencia e imagen actualizadas exitosamente.' 
          : 'Experiencia actualizada exitosamente.',
        experiencia: experienciaActualizada
      });

    } catch (error) {
      // Limpiar archivo en caso de error
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error editando experiencia con imagen:', errorMessage);
      res.status(500).json({ 
        success: false,
        error: 'Error al editar experiencia' 
      });
    }
  }
};