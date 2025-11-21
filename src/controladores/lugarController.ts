// controladores/lugarController.ts - VERSIÓN CLOUDINARY
import { Request, Response } from 'express';
import { pool } from '../utils/baseDeDatos.js';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { ModeracionService } from '../services/moderacionService.js';
import { generarHashNavegador } from '../utils/hashNavegador.js';
import { ModeracionImagenService } from '../services/moderacionImagenService.js';
import { PdfAnalysisService } from '../services/pdfAnalysisService.js';
import { CloudinaryService } from '../services/cloudinaryService.js'; // 🆕 NUEVO


const generarSugerenciasLugar = (tipoProblema: string): string[] => {
  const sugerencias: string[] = [];
  
  if (tipoProblema === 'texto') {
    sugerencias.push('Evita lenguaje ofensivo, insultos o palabras vulgares');
    sugerencias.push('No incluyas contenido comercial, promociones o spam');
    sugerencias.push('Asegúrate de que el texto sea coherente y tenga sentido');
    sugerencias.push('No incluyas enlaces, emails o números de teléfono');
    sugerencias.push('Usa un lenguaje respetuoso y apropiado para la comunidad');
  } else if (tipoProblema === 'nombre') {
    sugerencias.push('Usa un nombre apropiado y respetuoso para el lugar');
    sugerencias.push('Evita lenguaje ofensivo o inapropiado en el nombre');
    sugerencias.push('No uses nombres comerciales o promocionales');
    sugerencias.push('El nombre debe ser descriptivo y adecuado para todas las edades');
  } else if (tipoProblema === 'descripcion') {
    sugerencias.push('La descripción debe ser clara y descriptiva');
    sugerencias.push('Evita contenido promocional o comercial');
    sugerencias.push('Incluye información útil sobre el lugar');
    sugerencias.push('Mantén un lenguaje apropiado y respetuoso');
  } else if (tipoProblema === 'descripcion_foto') {
    sugerencias.push('La descripción de la foto debe ser apropiada y relacionada con la imagen');
    sugerencias.push('Evita lenguaje ofensivo o inapropiado en la descripción');
    sugerencias.push('No incluyas contenido comercial o promocional');
    sugerencias.push('La descripción debe ser relevante para la imagen del lugar');
  } else if (tipoProblema === 'imagen') {
    sugerencias.push('Asegúrate de que la imagen no contenga contenido violento o gráfico');
    sugerencias.push('No incluyas armas o elementos peligrosos');
    sugerencias.push('Usa imágenes apropiadas para todas las edades');
    sugerencias.push('Verifica que la imagen sea clara y de buena calidad');
  } else if (tipoProblema === 'pdf') {
    sugerencias.push('Asegúrate de que el PDF no contenga lenguaje ofensivo o inapropiado');
    sugerencias.push('Verifica que el contenido del PDF sea apropiado para todas las edades');
    sugerencias.push('No incluyas contenido promocional, spam o enlaces no permitidos');
    sugerencias.push('El PDF debe ser un archivo válido y legible');
  } else {
    sugerencias.push('Revisa el contenido antes de publicarlo');
    sugerencias.push('Asegúrate de que cumpla con las políticas de la comunidad');
  }
  
  return sugerencias;
};
// ✅ FUNCIÓN MEJORADA PARA ANALIZAR MOTIVOS DE RECHAZO (INCLUYENDO PDF)
const analizarMotivoRechazoLugar = (resultadoModeracion: any): { 
  mensajeUsuario: string; 
  tipoProblema: string; 
  detallesEspecificos: string[];
  campoEspecifico: 'nombre' | 'descripcion' | 'descripcion_foto' | 'imagen' | 'pdf' | 'ambos';
} => {
  const detallesEspecificos: string[] = [];
  let mensajeUsuario = 'El contenido no cumple con nuestras políticas';
  let tipoProblema = 'general';
  let campoEspecifico: 'nombre' | 'descripcion' | 'descripcion_foto' | 'imagen' | 'pdf' | 'ambos' = 'ambos';

  // ✅ DETECCIÓN MEJORADA DE PROBLEMAS ESPECÍFICOS (INCLUYENDO PDF)
  if (resultadoModeracion.detalles?.texto && !resultadoModeracion.detalles.texto.esAprobado) {
    tipoProblema = 'texto';
    const texto = resultadoModeracion.detalles.texto;
    
    if (texto.razon?.includes('ofensivo')) {
      mensajeUsuario = 'El texto contiene lenguaje ofensivo o inapropiado';
      detallesEspecificos.push('Se detectaron palabras ofensivas');
      if (texto.palabrasOfensivas?.length > 0) {
        detallesEspecificos.push(`Palabras problemáticas: ${texto.palabrasOfensivas.slice(0, 3).join(', ')}`);
      }
    } else if (texto.razon?.includes('spam')) {
      mensajeUsuario = 'El texto contiene contenido comercial no permitido';
      detallesEspecificos.push('Se detectó contenido promocional o spam');
    } else if (texto.razon?.includes('sin sentido')) {
      mensajeUsuario = 'El texto no tiene sentido o es muy corto';
      detallesEspecificos.push('El texto debe ser coherente y tener al menos algunas palabras con sentido');
    } else if (texto.razon?.includes('URL') || texto.razon?.includes('email') || texto.razon?.includes('teléfono')) {
      mensajeUsuario = 'El texto contiene enlaces o información de contacto';
      detallesEspecificos.push('No se permiten URLs, emails o números de teléfono');
    }
  } else if (resultadoModeracion.detalles?.imagen && !resultadoModeracion.detalles.imagen.esAprobado) {
    tipoProblema = 'imagen';
    campoEspecifico = 'imagen';
    mensajeUsuario = 'La imagen no cumple con las políticas de contenido';
    detallesEspecificos.push(resultadoModeracion.motivoRechazo || 'Contenido inapropiado detectado en la imagen');
  } else if (resultadoModeracion.detalles?.pdf && !resultadoModeracion.detalles.pdf.esAprobado) {
    tipoProblema = 'pdf';
    campoEspecifico = 'pdf';
    mensajeUsuario = 'El PDF no cumple con las políticas de contenido';
    detallesEspecificos.push(resultadoModeracion.motivoRechazo || 'Contenido inapropiado detectado en el PDF');
  }

  // ✅ ANÁLISIS DEL MOTIVO GENERAL SI NO HAY DETALLES ESPECÍFICOS
  if (detallesEspecificos.length === 0 && resultadoModeracion.motivoRechazo) {
    const motivo = resultadoModeracion.motivoRechazo.toLowerCase();
    
    if (motivo.includes('nombre')) {
      campoEspecifico = 'nombre';
      mensajeUsuario = 'El nombre del lugar no cumple con las políticas';
    } else if (motivo.includes('descripción') || motivo.includes('descripcion')) {
      campoEspecifico = 'descripcion';
      mensajeUsuario = 'La descripción del lugar no cumple con las políticas';
    } else if (motivo.includes('foto') || motivo.includes('imagen')) {
      campoEspecifico = 'descripcion_foto';
      mensajeUsuario = 'La descripción de la foto no cumple con las políticas';
    } else if (motivo.includes('pdf')) {
      campoEspecifico = 'pdf';
      mensajeUsuario = 'El archivo PDF no cumple con las políticas';
    }
    
    detallesEspecificos.push(resultadoModeracion.motivoRechazo);
  }

  return { mensajeUsuario, tipoProblema, detallesEspecificos, campoEspecifico };
};

// ✅ INTERFAZ PARA ESTADO DE EDICIÓN
interface EstadoEdicion {
  nombreModificado: boolean;
  descripcionModificada: boolean;
  ubicacionModificada: boolean;
  categoriaModificada: boolean;
  imagenModificada: boolean;
  pdfModificado: boolean;
  camposModificados: string[];
}

export const lugarController = {
  // Obtener todos los lugares (público) - SIN CAMBIOS
  async obtenerLugares(req: Request, res: Response) {
    try {
      console.log('📋 Obteniendo lista de lugares...');
      
      const { categoria, pagina = 1, limite = 20 } = req.query;
      const offset = (Number(pagina) - 1) * Number(limite);

      let query = `
        SELECT 
          l.*,
          COALESCE(COUNT(DISTINCT cl.id), 0) as total_calificaciones,
          COALESCE(COUNT(DISTINCT e.id), 0) as total_experiencias
        FROM lugares l
        LEFT JOIN calificaciones_lugares cl ON l.id = cl.lugar_id
        LEFT JOIN experiencias e ON l.id = e.lugar_id
      `;
      
      let countQuery = 'SELECT COUNT(*) FROM lugares l';
      const queryParams: any[] = [];
      const countParams: any[] = [];

      if (categoria && categoria !== '') {
        query += ' WHERE l.categoria = $1';
        countQuery += ' WHERE l.categoria = $1';
        queryParams.push(categoria);
        countParams.push(categoria);
      }

      query += ` 
        GROUP BY l.id
        ORDER BY 
          COALESCE(l.puntuacion_promedio, 0) DESC, 
          COALESCE(l.total_calificaciones, 0) DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `;
      
      queryParams.push(Number(limite), offset);

      console.log('🔍 Ejecutando query de lugares...');
      
      const [result, countResult] = await Promise.all([
        pool.query(query, queryParams),
        pool.query(countQuery, countParams)
      ]);

      const total = parseInt(countResult.rows[0]?.count || '0');

      console.log(`✅ Encontrados ${result.rows.length} lugares de ${total} totales`);

      res.json({
        success: true,
        lugares: result.rows,
        total: total,
        pagina: Number(pagina),
        totalPaginas: Math.ceil(total / Number(limite))
      });
    } catch (error) {
      console.error('❌ Error obteniendo lugares:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al obtener lugares',
        detalle: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      });
    }
  },

  // Obtener lugar por ID (público) - SIN CAMBIOS
  async obtenerLugarPorId(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      console.log('🔍 Obteniendo lugar por ID:', id);

      const lugarResult = await pool.query(
        `SELECT l.*, 
                COUNT(DISTINCT e.id) as total_experiencias
         FROM lugares l
         LEFT JOIN experiencias e ON l.id = e.lugar_id
         WHERE l.id = $1
         GROUP BY l.id`,
        [id]
      );

      if (lugarResult.rows.length === 0) {
        console.log('❌ Lugar no encontrado:', id);
        return res.status(404).json({ 
          success: false,
          error: 'Lugar no encontrado' 
        });
      }

      const fotosResult = await pool.query(
        'SELECT * FROM fotos_lugares WHERE lugar_id = $1 ORDER BY es_principal DESC, orden ASC',
        [id]
      );

      const experienciasResult = await pool.query(
        `SELECT e.* 
         FROM experiencias e 
         WHERE e.lugar_id = $1
         ORDER BY e.creado_en DESC
         LIMIT 10`,
        [id]
      );

      console.log(`✅ Lugar encontrado: ${lugarResult.rows[0].nombre}`);

      res.json({
        success: true,
        lugar: lugarResult.rows[0],
        fotos: fotosResult.rows,
        experiencias: experienciasResult.rows
      });
    } catch (error) {
      console.error('❌ Error obteniendo lugar:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al obtener lugar',
        detalle: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  },

  /**
   * ✅ NUEVO: Validar texto previo para lugares (igual que experiencias)
   */
  async validarTextoPrev(req: Request, res: Response) {
    try {
      const { nombre, descripcion } = req.body;
      
      if (!nombre?.trim() && !descripcion?.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Nombre o descripción requeridos para validación'
        });
      }

      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';

      console.log('🔍 Validando texto de lugar previo:', {
        nombre: nombre ? `"${nombre.substring(0, 30)}..."` : 'undefined',
        descripcion: descripcion ? `"${descripcion.substring(0, 50)}..."` : 'undefined',
        hash: hashNavegador.substring(0, 10) + '...',
        ip: ipUsuario
      });

      const moderacionService = new ModeracionService();

      // Crear texto combinado para moderación (nombre + descripción)
      const textoParaModerar = [nombre, descripcion].filter(Boolean).join(' ');
      
      if (!textoParaModerar.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Texto requerido para validación'
        });
      }

      const resultadoModeracion = await moderacionService.moderarTexto(
        textoParaModerar,
        ipUsuario,
        hashNavegador
      );

      // ✅ SI ES RECHAZADO: Devolver motivo específico del log
      if (!resultadoModeracion.esAprobado) {
        console.log('❌ Texto de lugar rechazado en validación previa:', resultadoModeracion.motivoRechazo);
        
        // Buscar el log más reciente para obtener detalles específicos
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
          
          // Extraer detalles específicos del resultado de moderación
          try {
            const resultado = JSON.parse(log.resultado_moderacion);
            if (resultado.analisisTexto) {
              const analisis = resultado.analisisTexto;
              if (analisis.palabrasOfensivas?.length > 0) {
                detallesEspecificos.push(`Palabras problemáticas: ${analisis.palabrasOfensivas.slice(0, 3).join(', ')}`);
              }
              if (analisis.razon) {
                detallesEspecificos.push(`Razón: ${analisis.razon}`);
              }
            }
          } catch (error) {
            console.error('Error parseando resultado moderación:', error);
          }
        }

        // ✅ ANÁLISIS ESPECÍFICO PARA DETERMINAR EL CAMPO PROBLEMÁTICO
        const { mensajeUsuario, tipoProblema, campoEspecifico } = analizarMotivoRechazoLugar(resultadoModeracion);

        return res.status(400).json({
          success: false,
          error: 'TEXTO_RECHAZADO',
          message: mensajeUsuario,
          motivo: motivoDetallado,
          tipo: tipoProblema,
          detalles: {
            puntuacion: resultadoModeracion.puntuacionGeneral,
            problemas: detallesEspecificos,
            sugerencias: generarSugerenciasLugar(tipoProblema),
            campoEspecifico: campoEspecifico,
            timestamp: new Date().toISOString()
          }
        });
      }

      // ✅ SI TODO ES APROBADO
      console.log('✅ Texto de lugar aprobado en validación previa');
      
      res.json({
        success: true,
        esAprobado: true,
        mensaje: 'Contenido aprobado, puedes continuar con la creación/actualización del lugar',
        puntuacion: resultadoModeracion.puntuacionGeneral,
        campos_aprobados: {
          nombre: !!nombre?.trim(),
          descripcion: !!descripcion?.trim()
        },
        detalles: {
          texto: resultadoModeracion.detalles?.texto
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error validando contenido de lugar:', errorMessage);
      
      res.status(500).json({
        success: false,
        error: 'Error al validar contenido del lugar',
        message: errorMessage
      });
    }
  },

  /**
   * ✅ NUEVO: Obtener motivos de rechazo específicos desde logs para lugares
   */
  async obtenerMotivosRechazo(req: Request, res: Response) {
    try {
      const { hash_navegador, limite = 10, tipo_contenido = 'lugar' } = req.query;
      
      let query = `
        SELECT motivo, accion, tipo_contenido, creado_en, resultado_moderacion
        FROM logs_moderacion 
        WHERE accion = 'rechazado'
        AND tipo_contenido = $1
      `;
      let params: any[] = [tipo_contenido];
      
      if (hash_navegador) {
        query += ' AND hash_navegador = $2';
        params.push(hash_navegador);
      }
      
      query += ' ORDER BY creado_en DESC LIMIT $' + (params.length + 1);
      params.push(limite);

      const result = await pool.query(query, params);
      
      const motivos = result.rows.map(row => {
        let detalles = null;
        try {
          detalles = row.resultado_moderacion ? JSON.parse(row.resultado_moderacion) : null;
        } catch (error) {
          console.error('Error parseando resultado moderación:', error);
        }
        
        return {
          motivo: row.motivo,
          accion: row.accion,
          tipoContenido: row.tipo_contenido,
          fecha: row.creado_en,
          detalles: detalles
        };
      });

      res.json({
        success: true,
        motivos,
        total: result.rows.length,
        tipo_contenido: tipo_contenido
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error obteniendo motivos de rechazo para lugares:', errorMessage);
      
      res.status(500).json({
        success: false,
        error: 'Error al obtener motivos de rechazo'
      });
    }
  },

  /**
   * ✅ NUEVO: Validar y analizar texto específico para lugares (endpoint genérico)
   */
  async analizarTexto(req: Request, res: Response) {
    try {
      const { texto, tipo_campo = 'general' } = req.body; // 'nombre', 'descripcion', 'general'
      
      if (!texto?.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Texto requerido para análisis'
        });
      }

      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';

      console.log('🔍 Analizando texto para lugar:', {
        tipo_campo,
        texto: texto.substring(0, 100) + '...',
        hash: hashNavegador.substring(0, 10) + '...',
        ip: ipUsuario
      });

      const moderacionService = new ModeracionService();

      const resultadoModeracion = await moderacionService.moderarTexto(
        texto.trim(),
        ipUsuario,
        hashNavegador
      );

      // ✅ SI ES RECHAZADO: Devolver análisis detallado
      if (!resultadoModeracion.esAprobado) {
        console.log('❌ Texto rechazado en análisis:', resultadoModeracion.motivoRechazo);
        
        const { mensajeUsuario, tipoProblema, detallesEspecificos, campoEspecifico } = 
          analizarMotivoRechazoLugar(resultadoModeracion);

        return res.json({
          success: true,
          esAprobado: false,
          mensaje: mensajeUsuario,
          motivo: resultadoModeracion.motivoRechazo,
          tipo: tipoProblema,
          campoEspecifico: campoEspecifico,
          puntuacion: resultadoModeracion.puntuacionGeneral,
          detalles: {
            problemas: detallesEspecificos,
            sugerencias: generarSugerenciasLugar(tipoProblema),
            analisisCompleto: resultadoModeracion.detalles
          },
          timestamp: new Date().toISOString()
        });
      }

      // ✅ SI ES APROBADO: Devolver resultado positivo con detalles
      console.log('✅ Texto aprobado en análisis');
      
      res.json({
        success: true,
        esAprobado: true,
        mensaje: 'Texto aprobado para uso en el lugar',
        puntuacion: resultadoModeracion.puntuacionGeneral,
        tipo_campo: tipo_campo,
        detalles: {
          analisisCompleto: resultadoModeracion.detalles,
          confianza: (1 - (resultadoModeracion.puntuacionGeneral || 0)) * 100,
          recomendaciones: resultadoModeracion.puntuacionGeneral > 0.3 ? 
            ['El texto tiene un riesgo moderado, considera revisarlo'] : 
            ['El texto es apropiado para publicar']
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error analizando texto de lugar:', errorMessage);
      
      res.status(500).json({
        success: false,
        error: 'Error al analizar texto',
        message: errorMessage
      });
    }
  },


  /**
   * ✅ ACTUALIZADO: Crear lugar con Cloudinary
   */
  async crearLugar(req: Request, res: Response) {
    const client = await pool.connect();
    const cloudinaryService = new CloudinaryService(); // 🆕 NUEVO
    
    try {
      const imageFile = req.file; // Archivo de imagen
      const { nombre, descripcion, ubicacion, categoria, foto_principal_url, pdf_url } = req.body;

      // ✅ VERIFICAR QUE LOS DATOS LLEGUEN CORRECTAMENTE
      console.log('📦 Datos recibidos para crear lugar:', {
        tieneArchivoImagen: !!imageFile,
        tienePdfUrl: !!pdf_url,
        nombre: nombre ? `"${nombre.substring(0, 30)}..."` : 'undefined',
        descripcion: descripcion ? `"${descripcion.substring(0, 50)}..."` : 'undefined',
        ubicacion: ubicacion || 'undefined',
        categoria: categoria || 'undefined',
        pdf_url: pdf_url ? 'PROPORCIONADO' : 'NO_PROPORCIONADO'
      });

      // Validaciones básicas
      if (!nombre?.trim() || !descripcion?.trim() || !ubicacion?.trim() || !categoria?.trim()) {
        // Limpiar archivo si existe
        if (imageFile) {
          await fsPromises.unlink(imageFile.path).catch(console.error);
        }
        return res.status(400).json({
          success: false,
          error: 'Nombre, descripción, ubicación y categoría son requeridos'
        });
      }

      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';

      console.log('📍 Nuevo lugar desde:', {
        hashNavegador: hashNavegador.substring(0, 10) + '...',
        ip: ipUsuario,
        nombre: nombre
      });

      const moderacionService = new ModeracionService();
      const moderacionImagenService = new ModeracionImagenService();

      // ✅ INICIAR TRANSACCIÓN PARA GARANTIZAR CONSISTENCIA
      await client.query('BEGIN');

      // ✅ 1. PRIMERO MODERAR EL TEXTO (NOMBRE + DESCRIPCIÓN)
      const textoParaModerar = `${nombre} ${descripcion}`;
      
      console.log('🔍 Enviando texto para moderación:', textoParaModerar.substring(0, 100) + '...');
      
      const resultadoModeracionTexto = await moderacionService.moderarContenidoEnTiempoReal({
        texto: textoParaModerar,
        ipUsuario,
        hashNavegador
      });

      if (!resultadoModeracionTexto.esAprobado) {
        console.log('❌ Contenido de lugar rechazado por moderación:', resultadoModeracionTexto.motivoRechazo);
        
        // Limpiar archivo si existe
        if (imageFile) {
          await fsPromises.unlink(imageFile.path).catch(console.error);
        }
        
        await client.query('ROLLBACK');

        return res.status(400).json({
          success: false,
          error: 'CONTENIDO_RECHAZADO',
          message: 'El contenido no cumple con las políticas de moderación',
          motivo: resultadoModeracionTexto.motivoRechazo,
          tipo: 'moderacion_texto',
          detalles: {
            puntuacion: resultadoModeracionTexto.puntuacionGeneral,
            problemas: [resultadoModeracionTexto.motivoRechazo || 'Texto no aprobado por moderación'],
            sugerencias: [
              'Revisa que el texto sea coherente y tenga sentido',
              'Evita contenido ofensivo o inapropiado',
              'Asegúrate de que el texto sea descriptivo y claro'
            ],
            campoEspecifico: 'descripcion',
            timestamp: new Date().toISOString()
          }
        });
      }

      // ✅ 2. MODERAR Y SUBIR IMAGEN A CLOUDINARY SI SE PROPORCIONA
      let imagenAprobada = true;
      let resultadoModeracionImagen = null;
      let cloudinaryImageResult = null;
      let rutaImagenFinal = foto_principal_url;

      if (imageFile) {
        console.log('🖼️ Iniciando moderación de imagen para lugar...');
        
        // 🆕 NUEVO: Leer archivo y moderar desde buffer
        const fileBuffer = await fsPromises.readFile(imageFile.path);
        resultadoModeracionImagen = await moderacionImagenService.moderarImagenDesdeBuffer(
          fileBuffer,
          imageFile.filename,
          ipUsuario,
          hashNavegador
        );

        if (!resultadoModeracionImagen.esAprobado) {
          imagenAprobada = false;
          console.log('❌ Imagen rechazada por moderación:', resultadoModeracionImagen.motivoRechazo);
          
          // Eliminar archivo subido
          await fsPromises.unlink(imageFile.path).catch(console.error);
          
          await client.query('ROLLBACK');
          
          return res.status(400).json({
            success: false,
            error: 'IMAGEN_RECHAZADA',
            message: 'La imagen no cumple con las políticas de contenido',
            motivo: resultadoModeracionImagen.motivoRechazo,
            tipo: 'imagen',
            detalles: {
              puntuacion: resultadoModeracionImagen.puntuacionRiesgo,
              problemas: [resultadoModeracionImagen.motivoRechazo || 'Contenido inapropiado detectado'],
              sugerencias: generarSugerenciasLugar('imagen'),
              timestamp: new Date().toISOString()
            }
          });
        }

        console.log('✅ Imagen aprobada por moderación para lugar');

        // 🆕 NUEVO: Subir a Cloudinary
        cloudinaryImageResult = await cloudinaryService.subirArchivo(
          fileBuffer,
          imageFile.filename,
          process.env.CLOUDINARY_LUGARES_FOLDER || 'lugares'
        );

        // 🆕 NUEVO: Limpiar archivo temporal
        await fsPromises.unlink(imageFile.path);

        rutaImagenFinal = cloudinaryImageResult.secure_url;
      }

      // ✅ 3. SOLO SI TODO ESTÁ APROBADO, INSERTAR LUGAR (INCLUYENDO PDF SI EXISTE)
      const result = await client.query(
        `INSERT INTO lugares 
         (nombre, descripcion, ubicacion, categoria, foto_principal_url, pdf_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          nombre.trim(), 
          descripcion.trim(), 
          ubicacion.trim(), 
          categoria.trim(), 
          rutaImagenFinal || null, 
          pdf_url || null
        ]
      );

      const lugar = result.rows[0];

      // ✅ 4. SI HAY IMAGEN APROBADA, GUARDAR EN fotos_lugares CON DATOS DE CLOUDINARY
      if (imageFile && imagenAprobada && cloudinaryImageResult) {
        await client.query(
          `INSERT INTO fotos_lugares 
           (lugar_id, url_foto, es_principal, descripcion, orden, 
            ruta_almacenamiento, tamaño_archivo, tipo_archivo, ancho_imagen, alto_imagen)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            lugar.id,
            cloudinaryImageResult.secure_url,
            true,
            'Imagen principal del lugar',
            1,
            cloudinaryImageResult.public_id, // 🆕 public_id para eliminación
            cloudinaryImageResult.bytes,
            `image/${cloudinaryImageResult.format}`,
            cloudinaryImageResult.width || null,
            cloudinaryImageResult.height || null
          ]
        );
      }

      await client.query('COMMIT');

      console.log('✅ Lugar creado y publicado con Cloudinary:', {
        id: lugar.id,
        nombre: lugar.nombre,
        moderacion_texto: 'aprobado',
        moderacion_imagen: imagenAprobada ? 'aprobado' : 'sin imagen',
        moderacion_pdf: pdf_url ? 'aprobado' : 'sin pdf'
      });

      // Respuesta al usuario
      res.status(201).json({
        success: true,
        mensaje: 'Lugar creado exitosamente.',
        lugar: {
          id: lugar.id,
          nombre: lugar.nombre,
          descripcion: lugar.descripcion,
          ubicacion: lugar.ubicacion,
          categoria: lugar.categoria,
          foto_principal_url: lugar.foto_principal_url,
          pdf_url: lugar.pdf_url,
          creado_en: lugar.creado_en
        },
        moderacion: {
          texto: {
            esAprobado: true,
            puntuacion: resultadoModeracionTexto.puntuacionGeneral
          },
          imagen: imageFile ? {
            esAprobado: imagenAprobada,
            puntuacion: resultadoModeracionImagen?.puntuacionRiesgo
          } : null,
          pdf: pdf_url ? {
            esAprobado: true,
            url: pdf_url
          } : null
        }
      });

    } catch (error) {
      await client.query('ROLLBACK').catch(console.error);
      
      // Limpiar archivo en caso de error
      if (req.file) {
        await fsPromises.unlink(req.file.path).catch(console.error);
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error creando lugar:', errorMessage);
      res.status(500).json({ 
        success: false,
        error: 'Error al crear lugar' 
      });
    } finally {
      client.release();
    }
  },

// En lugarController.ts - Método subirPDFTemporal mejorado

/**
 * ✅ VERSIÓN MEJORADA: Subir PDF temporal con manejo completo
 */
async subirPDFTemporal(req: Request, res: Response) {
  const cloudinaryService = new CloudinaryService();
  
  try {
    console.log('📄 Iniciando upload de PDF temporal...');

    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No se proporcionó ningún PDF' 
      });
    }

    console.log('📊 Detalles del archivo PDF:', {
      nombre: req.file.filename,
      tamaño: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    });

    const hashNavegador = generarHashNavegador(req);
    const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';

    // ✅ 1. VALIDACIÓN DE ARCHIVO PDF
    if (req.file.mimetype !== 'application/pdf') {
      await fsPromises.unlink(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'ARCHIVO_NO_PDF',
        message: 'El archivo debe ser un PDF válido',
        detalles: {
          mimetype_recibido: req.file.mimetype,
          mimetype_esperado: 'application/pdf'
        }
      });
    }

    // ✅ 2. ANÁLISIS DE CONTENIDO (local primero)
    const pdfAnalysisService = new PdfAnalysisService();
    
    console.log('🔍 Validando PDF básico...');
    const validacionBasica = await pdfAnalysisService.validarPDFBasico(req.file.path);
    
    if (!validacionBasica.valido) {
      await fsPromises.unlink(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'PDF_INVALIDO',
        message: validacionBasica.error || 'PDF no válido',
        detalles: {
          problemas: [validacionBasica.error || 'Archivo PDF no válido'],
          sugerencias: [
            'Asegúrate de que el archivo sea un PDF válido',
            'Verifica que el PDF no esté corrupto',
            'Intenta con otro archivo PDF'
          ]
        }
      });
    }

    console.log('✅ PDF válido, analizando contenido...');
    const resultadoAnalisis = await pdfAnalysisService.analizarTextoPDF(
      req.file.path,
      ipUsuario,
      hashNavegador
    );

    // ✅ 3. SI ES RECHAZADO POR MODERACIÓN
    if (!resultadoAnalisis.esAprobado) {
      console.log('❌ PDF rechazado por moderación:', resultadoAnalisis.motivo);
      await fsPromises.unlink(req.file.path);
      
      return res.status(400).json({
        success: false,
        error: 'PDF_RECHAZADO',
        message: 'El contenido del PDF no cumple con las políticas de moderación',
        motivo: resultadoAnalisis.motivo,
        tipo: 'pdf_texto',
        detalles: {
          puntuacion: resultadoAnalisis.puntuacion,
          problemas: [resultadoAnalisis.motivo || 'Contenido inapropiado detectado'],
          sugerencias: [
            'Revisa que el PDF no contenga lenguaje ofensivo o inapropiado',
            'Asegúrate de que el contenido sea apropiado para todos los públicos',
            'Evita contenido promocional, spam o enlaces no permitidos'
          ],
          metadata: resultadoAnalisis.metadata
        }
      });
    }

    console.log('✅ PDF aprobado por moderación, subiendo a Cloudinary...');

    // ✅ 4. SUBIR A CLOUDINARY CON CONFIGURACIÓN ESPECÍFICA
    const fileBuffer = await fsPromises.readFile(req.file.path);
    const cloudinaryResult = await cloudinaryService.subirPDF(
      fileBuffer,
      req.file.filename,
      process.env.CLOUDINARY_PDFS_FOLDER || 'pdfs_lugares'
    );

    // ✅ 5. LIMPIAR ARCHIVO TEMPORAL
    await fsPromises.unlink(req.file.path);

    console.log('🎉 PDF procesado exitosamente:', {
      url: cloudinaryResult.secure_url,
      public_id: cloudinaryResult.public_id,
      tamaño: cloudinaryResult.bytes
    });

    // ✅ 6. VERIFICACIÓN FINAL DE ACCESO
    const esAccesible = await cloudinaryService.verificarAccesoPDF(cloudinaryResult.secure_url);

    // ✅ 7. RESPUESTA COMPLETA
    res.json({
      success: true,
      mensaje: 'PDF aprobado y subido exitosamente',
      url_pdf: cloudinaryResult.secure_url,
      es_accesible: esAccesible,
      detalles_cloudinary: {
        public_id: cloudinaryResult.public_id,
        folder: cloudinaryResult.folder,
        resource_type: cloudinaryResult.resource_type,
        formato: cloudinaryResult.format,
        bytes: cloudinaryResult.bytes
      },
      moderacion: {
        esAprobado: true,
        puntuacion: resultadoAnalisis.puntuacion,
        metadata: resultadoAnalisis.metadata
      },
      archivo: {
        nombre: req.file.filename,
        tamaño: req.file.size,
        tipo: req.file.mimetype
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Error crítico subiendo PDF temporal:', error);
    
    // Limpieza en caso de error
    if (req.file?.path) {
      try {
        await fsPromises.unlink(req.file.path);
        console.log('🧹 Archivo temporal limpiado por error');
      } catch (unlinkError) {
        console.error('Error limpiando archivo temporal:', unlinkError);
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Error interno al procesar PDF',
      detalle: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : 'Contacta al administrador'
    });
  }
},

  /**
   * ✅ MEJORADO: Actualizar lugar con manejo completo de todos los estados de edición
   */
  async actualizarLugar(req: Request, res: Response) {
    const client = await pool.connect();
    
    try {
      const { id } = req.params;
      const { nombre, descripcion, ubicacion, categoria, foto_principal_url, pdf_url } = req.body;

      console.log('✏️ Actualizando lugar con análisis completo de cambios:', id);

      // ✅ 1. OBTENER LUGAR ACTUAL Y ANALIZAR CAMBIOS
      const lugarActual = await client.query(
        'SELECT * FROM lugares WHERE id = $1',
        [id]
      );

      if (lugarActual.rows.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'Lugar no encontrado' 
        });
      }

      const lugar = lugarActual.rows[0];
      
      // ✅ ANÁLISIS DETALLADO DE CAMBIOS
      const estadoEdicion: EstadoEdicion = {
        nombreModificado: nombre !== undefined && nombre !== lugar.nombre,
        descripcionModificada: descripcion !== undefined && descripcion !== lugar.descripcion,
        ubicacionModificada: ubicacion !== undefined && ubicacion !== lugar.ubicacion,
        categoriaModificada: categoria !== undefined && categoria !== lugar.categoria,
        imagenModificada: foto_principal_url !== undefined && foto_principal_url !== lugar.foto_principal_url,
        pdfModificado: pdf_url !== undefined && pdf_url !== lugar.pdf_url,
        camposModificados: []
      };

      // ✅ IDENTIFICAR CAMPOS MODIFICADOS
      if (estadoEdicion.nombreModificado) estadoEdicion.camposModificados.push('nombre');
      if (estadoEdicion.descripcionModificada) estadoEdicion.camposModificados.push('descripcion');
      if (estadoEdicion.ubicacionModificada) estadoEdicion.camposModificados.push('ubicacion');
      if (estadoEdicion.categoriaModificada) estadoEdicion.camposModificados.push('categoria');
      if (estadoEdicion.imagenModificada) estadoEdicion.camposModificados.push('imagen');
      if (estadoEdicion.pdfModificado) estadoEdicion.camposModificados.push('pdf');

      console.log('🔍 Estado de edición:', {
        lugarId: id,
        cambios: estadoEdicion.camposModificados,
        detalles: {
          nombre: estadoEdicion.nombreModificado ? 'MODIFICADO' : 'sin cambios',
          descripcion: estadoEdicion.descripcionModificada ? 'MODIFICADO' : 'sin cambios',
          ubicacion: estadoEdicion.ubicacionModificada ? 'MODIFICADO' : 'sin cambios',
          categoria: estadoEdicion.categoriaModificada ? 'MODIFICADO' : 'sin cambios',
          imagen: estadoEdicion.imagenModificada ? 'MODIFICADO' : 'sin cambios',
          pdf: estadoEdicion.pdfModificado ? 'MODIFICADO' : 'sin cambios'
        }
      });

      // ✅ 2. VALIDAR QUE HAYA AL MENOS UN CAMPO PARA ACTUALIZAR
      if (estadoEdicion.camposModificados.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No se proporcionaron campos para actualizar',
          detalles: {
            campos_recibidos: { nombre, descripcion, ubicacion, categoria, foto_principal_url, pdf_url },
            campos_actuales: {
              nombre: lugar.nombre,
              descripcion: lugar.descripcion,
              ubicacion: lugar.ubicacion,
              categoria: lugar.categoria,
              foto_principal_url: lugar.foto_principal_url,
              pdf_url: lugar.pdf_url
            }
          }
        });
      }

      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';
      const moderacionService = new ModeracionService();

      await client.query('BEGIN');

      // ✅ 3. MODERACIÓN DE TEXTO SOLO SI SE MODIFICAN NOMBRE O DESCRIPCIÓN
      if (estadoEdicion.nombreModificado || estadoEdicion.descripcionModificada) {
        console.log('🔍 Cambios en texto detectados, aplicando moderación...');
        
        // Usar valores nuevos o existentes para la moderación
        const nombreParaModerar = nombre !== undefined ? nombre : lugar.nombre;
        const descripcionParaModerar = descripcion !== undefined ? descripcion : lugar.descripcion;
        
        // Crear texto combinado para moderación
        const textoParaModerar = `${nombreParaModerar} ${descripcionParaModerar}`;
        
        console.log('📝 Texto para moderación:', {
          nombre: nombreParaModerar?.substring(0, 50) + '...',
          descripcion: descripcionParaModerar?.substring(0, 100) + '...',
          hash: hashNavegador.substring(0, 10) + '...'
        });

        const resultadoModeracion = await moderacionService.moderarContenidoEnTiempoReal({
          texto: textoParaModerar,
          ipUsuario,
          hashNavegador
        });

        // ✅ SI ES RECHAZADO: Rollback y responder con error detallado
        if (!resultadoModeracion.esAprobado) {
          console.log('❌ Contenido rechazado por moderación:', resultadoModeracion.motivoRechazo);
          
          await client.query('ROLLBACK');

          const { mensajeUsuario, tipoProblema, detallesEspecificos, campoEspecifico } = 
            analizarMotivoRechazoLugar(resultadoModeracion);
          
          return res.status(400).json({
            success: false,
            error: 'CONTENIDO_RECHAZADO',
            message: mensajeUsuario,
            motivo: resultadoModeracion.motivoRechazo,
            tipo: tipoProblema,
            detalles: {
              puntuacion: resultadoModeracion.puntuacionGeneral,
              problemas: detallesEspecificos,
              sugerencias: generarSugerenciasLugar(tipoProblema),
              campoEspecifico: campoEspecifico,
              campos_afectados: estadoEdicion.camposModificados.filter(campo => 
                campo === 'nombre' || campo === 'descripcion'
              ),
              timestamp: new Date().toISOString()
            }
          });
        }
        
        console.log('✅ Texto aprobado para actualización');
      } else {
        console.log('⏭️ No hay cambios en texto, omitiendo moderación');
      }

      // ✅ 4. CONSTRUIR QUERY DINÁMICA SOLO PARA CAMPOS MODIFICADOS
      const camposActualizar: string[] = [];
      const valores: any[] = [];
      let contador = 1;

      // Solo incluir campos que realmente han cambiado
      if (estadoEdicion.nombreModificado) {
        camposActualizar.push(`nombre = $${contador}`);
        valores.push(nombre);
        contador++;
      }

      if (estadoEdicion.descripcionModificada) {
        camposActualizar.push(`descripcion = $${contador}`);
        valores.push(descripcion);
        contador++;
      }

      if (estadoEdicion.ubicacionModificada) {
        camposActualizar.push(`ubicacion = $${contador}`);
        valores.push(ubicacion);
        contador++;
      }

      if (estadoEdicion.categoriaModificada) {
        camposActualizar.push(`categoria = $${contador}`);
        valores.push(categoria);
        contador++;
      }

      if (estadoEdicion.imagenModificada) {
        camposActualizar.push(`foto_principal_url = $${contador}`);
        valores.push(foto_principal_url);
        contador++;
      }

      if (estadoEdicion.pdfModificado) {
        camposActualizar.push(`pdf_url = $${contador}`);
        valores.push(pdf_url);
        contador++;
      }

      // Siempre actualizar la fecha de modificación
      camposActualizar.push(`actualizado_en = NOW()`);

      // ✅ 5. EJECUTAR ACTUALIZACIÓN
      valores.push(id);
      
      const query = `
        UPDATE lugares 
        SET ${camposActualizar.join(', ')}
        WHERE id = $${contador}
        RETURNING *
      `;

      console.log('🛠️ Ejecutando actualización:', {
        query: query.replace(/\s+/g, ' '),
        valores: valores.slice(0, -1), // Excluir el ID para el log
        totalCampos: camposActualizar.length - 1 // Excluir actualizado_en
      });

      const result = await client.query(query, valores);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'No se pudo actualizar el lugar'
        });
      }

      await client.query('COMMIT');

      const lugarActualizado = result.rows[0];
      
      console.log('✅ Lugar actualizado exitosamente:', {
        id: lugarActualizado.id,
        cambios: estadoEdicion.camposModificados,
        totalCamposModificados: estadoEdicion.camposModificados.length
      });

      // ✅ 6. RESPUESTA DETALLADA
      res.json({
        success: true,
        mensaje: 'Lugar actualizado exitosamente',
        lugar: lugarActualizado,
        cambios: {
          total: estadoEdicion.camposModificados.length,
          campos: estadoEdicion.camposModificados,
          detalles: {
            nombre: estadoEdicion.nombreModificado,
            descripcion: estadoEdicion.descripcionModificada,
            ubicacion: estadoEdicion.ubicacionModificada,
            categoria: estadoEdicion.categoriaModificada,
            imagen: estadoEdicion.imagenModificada,
            pdf: estadoEdicion.pdfModificado
          }
        },
        moderacion: {
          texto_aplicada: estadoEdicion.nombreModificado || estadoEdicion.descripcionModificada,
          resultado: 'aprobado'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      await client.query('ROLLBACK').catch(console.error);
      
      console.error('❌ Error actualizando lugar:', error);
      
      res.status(500).json({ 
        success: false,
        error: 'Error al actualizar lugar',
        detalle: error instanceof Error ? error.message : 'Error desconocido'
      });
    } finally {
      client.release();
    }
  },

  /**
   * ✅ NUEVO: Endpoint para validar cambios antes de actualizar
   */
  async validarCambiosLugar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { nombre, descripcion, ubicacion, categoria } = req.body;

      console.log('🔍 Validando cambios previos para lugar:', id);

      // ✅ 1. OBTENER LUGAR ACTUAL
      const lugarActual = await pool.query(
        'SELECT * FROM lugares WHERE id = $1',
        [id]
      );

      if (lugarActual.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Lugar no encontrado'
        });
      }

      const lugar = lugarActual.rows[0];
      
      // ✅ 2. ANALIZAR CAMBIOS PROPUESTOS
      const cambiosPropuestos = {
        nombre: nombre !== undefined && nombre !== lugar.nombre ? { 
          actual: lugar.nombre, 
          nuevo: nombre,
          modificado: true 
        } : { modificado: false },
        
        descripcion: descripcion !== undefined && descripcion !== lugar.descripcion ? { 
          actual: lugar.descripcion, 
          nuevo: descripcion,
          modificado: true 
        } : { modificado: false },
        
        ubicacion: ubicacion !== undefined && ubicacion !== lugar.ubicacion ? { 
          actual: lugar.ubicacion, 
          nuevo: ubicacion,
          modificado: true 
        } : { modificado: false },
        
        categoria: categoria !== undefined && categoria !== lugar.categoria ? { 
          actual: lugar.categoria, 
          nuevo: categoria,
          modificado: true 
        } : { modificado: false }
      };

      const camposAModerar = [];
      if (cambiosPropuestos.nombre.modificado) camposAModerar.push('nombre');
      if (cambiosPropuestos.descripcion.modificado) camposAModerar.push('descripcion');

      console.log('📊 Análisis de cambios propuestos:', {
        lugarId: id,
        camposAModerar,
        cambiosPropuestos
      });

      // ✅ 3. MODERACIÓN SOLO SI HAY CAMBIOS EN TEXTO
      if (camposAModerar.length > 0) {
        const hashNavegador = generarHashNavegador(req);
        const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';
        const moderacionService = new ModeracionService();

        const nombreParaModerar = cambiosPropuestos.nombre.modificado ? nombre : lugar.nombre;
        const descripcionParaModerar = cambiosPropuestos.descripcion.modificado ? descripcion : lugar.descripcion;
        
        const textoParaModerar = `${nombreParaModerar} ${descripcionParaModerar}`;

        const resultadoModeracion = await moderacionService.moderarContenidoEnTiempoReal({
          texto: textoParaModerar,
          ipUsuario,
          hashNavegador
        });

        if (!resultadoModeracion.esAprobado) {
          console.log('❌ Validación previa fallida:', resultadoModeracion.motivoRechazo);
          
          const { mensajeUsuario, tipoProblema, detallesEspecificos, campoEspecifico } = 
            analizarMotivoRechazoLugar(resultadoModeracion);

          return res.status(400).json({
            success: false,
            error: 'VALIDACION_RECHAZADA',
            message: mensajeUsuario,
            motivo: resultadoModeracion.motivoRechazo,
            tipo: tipoProblema,
            detalles: {
              puntuacion: resultadoModeracion.puntuacionGeneral,
              problemas: detallesEspecificos,
              sugerencias: generarSugerenciasLugar(tipoProblema),
              campoEspecifico: campoEspecifico,
              campos_afectados: camposAModerar,
              timestamp: new Date().toISOString()
            }
          });
        }

        console.log('✅ Validación previa aprobada');
        
        return res.json({
          success: true,
          esAprobado: true,
          mensaje: 'Cambios validados correctamente',
          cambios: cambiosPropuestos,
          moderacion: {
            aplicada: true,
            campos_moderados: camposAModerar,
            puntuacion: resultadoModeracion.puntuacionGeneral,
            resultado: 'aprobado'
          },
          timestamp: new Date().toISOString()
        });
      }

      // ✅ 4. SI NO HAY CAMBIOS EN TEXTO, SOLO INFORMAR
      console.log('⏭️ No hay cambios que requieran moderación');
      
      res.json({
        success: true,
        esAprobado: true,
        mensaje: 'Cambios validados (no requieren moderación)',
        cambios: cambiosPropuestos,
        moderacion: {
          aplicada: false,
          campos_moderados: [],
          resultado: 'no_requerido'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error validando cambios:', error);
      
      res.status(500).json({
        success: false,
        error: 'Error al validar cambios',
        detalle: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  },

// controladores/lugarController.ts - VERSIÓN OPTIMIZADA
async eliminarLugar(req: Request, res: Response) {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    console.log('🗑️ Eliminando lugar con transacción manual:', id);

    await client.query('BEGIN');

    // 1. Verificar que el lugar existe
    const lugarExistente = await client.query(
      'SELECT id, nombre FROM lugares WHERE id = $1',
      [id]
    );

    if (lugarExistente.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false,
        error: 'Lugar no encontrado' 
      });
    }

    const lugar = lugarExistente.rows[0];
    console.log(`📍 Eliminando: ${lugar.nombre}`);

    // 2. Contar registros para logging
    const fotosCount = await client.query(
      'SELECT COUNT(*) FROM fotos_lugares WHERE lugar_id = $1',
      [id]
    );
    
    const experienciasCount = await client.query(
      'SELECT COUNT(*) FROM experiencias WHERE lugar_id = $1',
      [id]
    );
    
    const calificacionesCount = await client.query(
      'SELECT COUNT(*) FROM calificaciones_lugares WHERE lugar_id = $1',
      [id]
    );

    console.log(`📊 Registros relacionados: ${fotosCount.rows[0].count} fotos, ${experienciasCount.rows[0].count} experiencias, ${calificacionesCount.rows[0].count} calificaciones`);

    // 3. Eliminar en orden manual (evita triggers problemáticos)
    console.log('🗑️ Eliminando calificaciones...');
    await client.query(
      'DELETE FROM calificaciones_lugares WHERE lugar_id = $1',
      [id]
    );

    console.log('🗑️ Eliminando experiencias...');
    await client.query(
      'DELETE FROM experiencias WHERE lugar_id = $1',
      [id]
    );

    console.log('🗑️ Eliminando fotos...');
    await client.query(
      'DELETE FROM fotos_lugares WHERE lugar_id = $1',
      [id]
    );

    console.log('🗑️ Eliminando lugar...');
    const result = await client.query(
      'DELETE FROM lugares WHERE id = $1 RETURNING *',
      [id]
    );

    await client.query('COMMIT');

    console.log('✅ Lugar eliminado exitosamente:', {
      id: id,
      nombre: lugar.nombre,
      fotos: fotosCount.rows[0].count,
      experiencias: experienciasCount.rows[0].count,
      calificaciones: calificacionesCount.rows[0].count
    });

    res.json({ 
      success: true,
      mensaje: 'Lugar eliminado exitosamente',
      estadisticas: {
        fotos_eliminadas: parseInt(fotosCount.rows[0].count),
        experiencias_eliminadas: parseInt(experienciasCount.rows[0].count),
        calificaciones_eliminadas: parseInt(calificacionesCount.rows[0].count)
      }
    });

  } catch (error) {
    await client.query('ROLLBACK').catch(console.error);
    
    console.error('❌ Error eliminando lugar:', error);
    
    // Manejo específico del error de triggers
    if (error instanceof Error && error.message.includes('tuple to be deleted')) {
      return res.status(500).json({ 
        success: false,
        error: 'No se puede eliminar el lugar debido a restricciones de la base de datos',
        detalle: 'Existen dependencias que impiden la eliminación',
        solucion: 'Contacte al administrador del sistema'
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Error al eliminar lugar',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  } finally {
    client.release();
  }
},

  // Obtener categorías únicas (público) - SIN CAMBIOS
  async obtenerCategorias(req: Request, res: Response) {
    try {
      console.log('📂 Obteniendo categorías...');

      const result = await pool.query(
        'SELECT DISTINCT categoria FROM lugares WHERE categoria IS NOT NULL ORDER BY categoria'
      );

      console.log(`✅ Encontradas ${result.rows.length} categorías`);

      res.json({
        success: true,
        categorias: result.rows.map(row => row.categoria)
      });
    } catch (error) {
      console.error('❌ Error obteniendo categorías:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al obtener categorías',
        detalle: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  },

  /**
   * ✅ ACTUALIZADO: Subir imagen principal CON Cloudinary
   */
  async subirImagenLugar(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService(); // 🆕 NUEVO
    
    try {
      const { id } = req.params;
      
      console.log('🖼️ Subiendo imagen principal para lugar con moderación y Cloudinary:', id);

      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: 'No se proporcionó ninguna imagen' 
        });
      }

      // ✅ MODERACIÓN DE IMAGEN
      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';

      const moderacionImagenService = new ModeracionImagenService();
      
      // 🆕 NUEVO: Leer y moderar desde buffer
      const fileBuffer = await fsPromises.readFile(req.file.path);
      const resultadoModeracion = await moderacionImagenService.moderarImagenDesdeBuffer(
        fileBuffer,
        req.file.filename,
        ipUsuario,
        hashNavegador
      );

      if (!resultadoModeracion.esAprobado) {
        console.log('❌ Imagen rechazada por moderación:', resultadoModeracion.motivoRechazo);
        
        // Eliminar archivo subido
        try {
          await fsPromises.unlink(req.file.path);
        } catch (error) {
          console.error('Error eliminando archivo:', error);
        }
        
        return res.status(400).json({
          success: false,
          error: 'IMAGEN_RECHAZADA',
          message: 'La imagen no cumple con las políticas de contenido',
          motivo: resultadoModeracion.motivoRechazo,
          tipo: 'imagen',
          detalles: {
            puntuacion: resultadoModeracion.puntuacionRiesgo,
            problemas: [resultadoModeracion.motivoRechazo || 'Contenido inapropiado detectado'],
            sugerencias: generarSugerenciasLugar('imagen'),
            timestamp: new Date().toISOString()
          }
        });
      }

      console.log('✅ Imagen aprobada por moderación para lugar:', id);

      // Verificar que el lugar existe
      const lugarResult = await pool.query(
        'SELECT id, nombre FROM lugares WHERE id = $1',
        [id]
      );

      if (lugarResult.rows.length === 0) {
        // Eliminar archivo si el lugar no existe
        if (req.file.path) {
          try {
            await fsPromises.unlink(req.file.path);
          } catch (error) {
            console.error('Error eliminando archivo:', error);
          }
        }
        return res.status(404).json({ 
          success: false,
          error: 'Lugar no encontrado' 
        });
      }

      // 🆕 NUEVO: Subir a Cloudinary
      const cloudinaryResult = await cloudinaryService.subirArchivo(
        fileBuffer,
        req.file.filename,
        process.env.CLOUDINARY_LUGARES_FOLDER || 'lugares'
      );

      // 🆕 NUEVO: Limpiar archivo temporal
      await fsPromises.unlink(req.file.path);

      // Verificar si ya existe una imagen principal
      const imagenPrincipalExistente = await pool.query(
        'SELECT id, ruta_almacenamiento FROM fotos_lugares WHERE lugar_id = $1 AND es_principal = true',
        [id]
      );

      let result;
      
      if (imagenPrincipalExistente.rows.length > 0) {
        // Actualizar la imagen principal existente
        const imagenId = imagenPrincipalExistente.rows[0].id;
        
        // 🆕 NUEVO: Eliminar imagen anterior de Cloudinary
        if (imagenPrincipalExistente.rows[0].ruta_almacenamiento && 
            cloudinaryService.esUrlCloudinary(imagenPrincipalExistente.rows[0].ruta_almacenamiento)) {
          try {
            await cloudinaryService.eliminarArchivo(imagenPrincipalExistente.rows[0].ruta_almacenamiento);
            console.log('🗑️ Imagen anterior eliminada de Cloudinary');
          } catch (error) {
            console.warn('⚠️ No se pudo eliminar la imagen anterior de Cloudinary:', error);
          }
        }

        result = await pool.query(
          `UPDATE fotos_lugares 
           SET url_foto = $1, ruta_almacenamiento = $2, tamaño_archivo = $3, 
               tipo_archivo = $4, ancho_imagen = $5, alto_imagen = $6, actualizado_en = NOW()
           WHERE id = $7
           RETURNING id`,
          [
            cloudinaryResult.secure_url,
            cloudinaryResult.public_id,
            cloudinaryResult.bytes,
            `image/${cloudinaryResult.format}`,
            cloudinaryResult.width || null,
            cloudinaryResult.height || null,
            imagenId
          ]
        );
      } else {
        // Insertar nueva imagen principal
        result = await pool.query(
          `INSERT INTO fotos_lugares (lugar_id, url_foto, es_principal, descripcion, orden, 
           ruta_almacenamiento, tamaño_archivo, tipo_archivo, ancho_imagen, alto_imagen)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            id,
            cloudinaryResult.secure_url,
            true,
            'Imagen principal del lugar',
            1,
            cloudinaryResult.public_id,
            cloudinaryResult.bytes,
            `image/${cloudinaryResult.format}`,
            cloudinaryResult.width || null,
            cloudinaryResult.height || null
          ]
        );
      }

      // Actualizar también la foto_principal_url en la tabla lugares
      await pool.query(
        'UPDATE lugares SET foto_principal_url = $1, actualizado_en = NOW() WHERE id = $2',
        [cloudinaryResult.secure_url, id]
      );

      console.log('✅ Imagen principal subida y aprobada para lugar con Cloudinary:', id);

      res.json({
        success: true,
        mensaje: 'Imagen subida exitosamente',
        url_imagen: cloudinaryResult.secure_url,
        es_principal: true,
        imagen_id: result.rows[0].id,
        moderacion: {
          esAprobado: true,
          puntuacionRiesgo: resultadoModeracion.puntuacionRiesgo,
          timestamp: new Date().toISOString()
        },
        archivo: {
          nombre: req.file.filename,
          tamaño: cloudinaryResult.bytes,
          tipo: `image/${cloudinaryResult.format}`
        }
      });

    } catch (error) {
      console.error('❌ Error subiendo imagen:', error);
      
      if (req.file?.path) {
        try {
          await fsPromises.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error eliminando archivo:', unlinkError);
        }
      }
      
      res.status(500).json({ 
        success: false,
        error: 'Error al subir imagen',
        detalle: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  },

  /**
   * ✅ ACTUALIZADO: Subir múltiples imágenes CON Cloudinary
   */
  async subirMultipleImagenesLugar(req: Request, res: Response) {
    const client = await pool.connect();
    const cloudinaryService = new CloudinaryService(); // 🆕 NUEVO
    
    try {
      const { id } = req.params;
      
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ 
          success: false,
          error: 'No se proporcionaron imágenes' 
        });
      }

      console.log('📤 Subiendo múltiples imágenes para galería del lugar con moderación y Cloudinary:', id);

      await client.query('BEGIN');

      // 1. Verificar que el lugar existe
      const lugarResult = await client.query(
        'SELECT id, nombre, foto_principal_url FROM lugares WHERE id = $1',
        [id]
      );

      if (lugarResult.rows.length === 0) {
        await client.query('ROLLBACK');
        // Eliminar archivos subidos
        for (const file of req.files) {
          if (file.path) {
            try {
              await fsPromises.unlink(file.path);
            } catch (error) {
              console.error('Error eliminando archivo:', error);
            }
          }
        }
        return res.status(404).json({ 
          success: false,
          error: 'Lugar no encontrado' 
        });
      }

      const lugar = lugarResult.rows[0];
      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';
      const moderacionImagenService = new ModeracionImagenService();

      // ✅ MODERAR Y SUBIR CADA IMAGEN A CLOUDINARY
      const imagenesAceptadas = [];
      
      for (const file of req.files) {
        // 🆕 NUEVO: Leer y moderar desde buffer
        const fileBuffer = await fsPromises.readFile(file.path);
        const resultadoModeracion = await moderacionImagenService.moderarImagenDesdeBuffer(
          fileBuffer,
          file.filename,
          ipUsuario,
          hashNavegador
        );

        if (!resultadoModeracion.esAprobado) {
          console.log('❌ Imagen rechazada en galería:', file.filename, resultadoModeracion.motivoRechazo);
          // Eliminar archivo rechazado
          try {
            await fsPromises.unlink(file.path);
          } catch (error) {
            console.error('Error eliminando archivo:', error);
          }
        } else {
          // 🆕 NUEVO: Subir a Cloudinary
          const cloudinaryResult = await cloudinaryService.subirArchivo(
            fileBuffer,
            file.filename,
            process.env.CLOUDINARY_LUGARES_FOLDER || 'lugares'
          );
          
          // 🆕 NUEVO: Limpiar archivo temporal
          await fsPromises.unlink(file.path);
          
          imagenesAceptadas.push({
            file,
            cloudinaryResult,
            resultadoModeracion
          });
          console.log('✅ Imagen aprobada para galería:', file.filename);
        }
      }

      if (imagenesAceptadas.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Todas las imágenes fueron rechazadas por moderación',
          detalles: {
            total_enviadas: req.files.length,
            total_rechazadas: req.files.length,
            sugerencias: generarSugerenciasLugar('imagen')
          }
        });
      }

      console.log(`✅ ${imagenesAceptadas.length}/${req.files.length} imágenes aprobadas para galería`);

      // 2. Obtener el máximo orden actual
      const maxOrdenResult = await client.query(
        'SELECT COALESCE(MAX(orden), 0) as max_orden FROM fotos_lugares WHERE lugar_id = $1',
        [id]
      );
      
      let orden = maxOrdenResult.rows[0].max_orden + 1;
      const imagenesSubidas = [];

      // 3. Insertar cada imagen aprobada como NO principal
      for (const { file, cloudinaryResult } of imagenesAceptadas) {
        console.log('💾 Guardando imagen de galería aprobada en Cloudinary:', {
          nombre: file.filename,
          orden: orden,
          es_principal: false
        });

        // Insertar imagen EXPLÍCITAMENTE como no principal
        const result = await client.query(
          `INSERT INTO fotos_lugares 
           (lugar_id, url_foto, ruta_almacenamiento, descripcion, es_principal, orden,
            ancho_imagen, alto_imagen, tamaño_archivo, tipo_archivo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, url_foto, es_principal, orden`,
          [
            id,
            cloudinaryResult.secure_url,
            cloudinaryResult.public_id,
            `Imagen ${orden} - ${lugar.nombre}`,
            false,
            orden,
            cloudinaryResult.width || null,
            cloudinaryResult.height || null,
            cloudinaryResult.bytes,
            `image/${cloudinaryResult.format}`
          ]
        );

        const imagenInsertada = result.rows[0];
        console.log('✅ Imagen de galería insertada en Cloudinary:', {
          id: imagenInsertada.id, 
          es_principal: imagenInsertada.es_principal
        });

        imagenesSubidas.push({
          id: imagenInsertada.id,
          url: imagenInsertada.url_foto,
          es_principal: imagenInsertada.es_principal,
          orden: imagenInsertada.orden,
          nombre: file.filename
        });

        orden++;
      }

      await client.query('COMMIT');
      console.log('✅ Galería actualizada - Imágenes aprobadas agregadas a Cloudinary:', imagenesSubidas.length);

      res.json({
        success: true,
        mensaje: `${imagenesSubidas.length} imágenes agregadas a la galería`,
        imagenes: imagenesSubidas,
        total: imagenesSubidas.length,
        estadisticas: {
          total_enviadas: req.files.length,
          total_aprobadas: imagenesAceptadas.length,
          total_rechazadas: req.files.length - imagenesAceptadas.length
        },
        nota: 'Las imágenes se agregaron a la galería sin establecer como principal'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error subiendo imágenes a galería:', error);
      
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          if (file.path) {
            try { 
              await fsPromises.unlink(file.path); 
            } catch (unlinkError) { 
              console.error('Error eliminando archivo:', unlinkError);
            }
          }
        }
      }
      
      res.status(500).json({ 
        success: false,
        error: 'Error al agregar imágenes a la galería',
        detalle: error instanceof Error ? error.message : 'Error desconocido'
      });
    } finally {
      client.release();
    }
  },

 /**
   * ✅ NUEVO: Endpoint específico para analizar descripciones de fotos - CORREGIDO
   */
  async analizarDescripcionFoto(req: Request, res: Response) {
    try {
      const { descripcion } = req.body;
      
      if (!descripcion?.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Descripción de foto requerida para análisis'
        });
      }

      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';

      console.log('🔍 Analizando descripción de foto:', {
        descripcion: descripcion.substring(0, 100) + '...',
        hash: hashNavegador.substring(0, 10) + '...',
        ip: ipUsuario
      });

      const moderacionService = new ModeracionService();

      // ✅ CORREGIDO: Solo 3 argumentos
      const resultadoModeracion = await moderacionService.moderarTexto(
        descripcion.trim(),
        ipUsuario,
        hashNavegador
      );

      // ✅ SI ES RECHAZADO: Devolver análisis detallado
      if (!resultadoModeracion.esAprobado) {
        console.log('❌ Descripción de foto rechazada en análisis:', resultadoModeracion.motivoRechazo);
        
        const { mensajeUsuario, tipoProblema, detallesEspecificos } = 
          analizarMotivoRechazoLugar(resultadoModeracion);

        return res.json({
          success: true,
          esAprobado: false,
          mensaje: mensajeUsuario,
          motivo: resultadoModeracion.motivoRechazo,
          tipo: tipoProblema,
          campoEspecifico: 'descripcion_foto',
          puntuacion: resultadoModeracion.puntuacionGeneral,
          detalles: {
            problemas: detallesEspecificos,
            sugerencias: generarSugerenciasLugar('descripcion_foto'),
            analisisCompleto: resultadoModeracion.detalles
          },
          timestamp: new Date().toISOString()
        });
      }

      // ✅ SI ES APROBADO: Devolver resultado positivo con detalles
      console.log('✅ Descripción de foto aprobada en análisis');
      
      res.json({
        success: true,
        esAprobado: true,
        mensaje: 'Descripción de foto aprobada',
        puntuacion: resultadoModeracion.puntuacionGeneral,
        tipo_campo: 'descripcion_foto',
        detalles: {
          analisisCompleto: resultadoModeracion.detalles,
          confianza: (1 - (resultadoModeracion.puntuacionGeneral || 0)) * 100,
          recomendaciones: resultadoModeracion.puntuacionGeneral > 0.3 ? 
            ['La descripción tiene un riesgo moderado, considera revisarla'] : 
            ['La descripción es apropiada para publicar']
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error analizando descripción de foto:', errorMessage);
      
      res.status(500).json({
        success: false,
        error: 'Error al analizar descripción de foto',
        message: errorMessage
      });
    }
  },

  // ✅ ACTUALIZADO: Subir PDF SIN moderación
  async subirPDFLugar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó ningún PDF' });
      }

      // ✅ MODIFICADO: NO hay moderación de PDF en backend
      console.log('✅ PDF aceptado sin análisis (moderación en frontend)');

      // Verificar que el lugar existe
      const lugarResult = await pool.query(
        'SELECT id FROM lugares WHERE id = $1',
        [id]
      );

      if (lugarResult.rows.length === 0) {
        // ✅ CORREGIDO: Usar fsPromises.unlink
        if (req.file.path) {
          try {
            await fsPromises.unlink(req.file.path);
          } catch (error) {
            console.error('Error eliminando archivo:', error);
          }
        }
        return res.status(404).json({ error: 'Lugar no encontrado' });
      }

      const rutaPDF = `/uploads/pdfs/${req.file.filename}`;

      // Actualizar el PDF en la tabla lugares
      await pool.query(
        'UPDATE lugares SET pdf_url = $1, actualizado_en = NOW() WHERE id = $2',
        [rutaPDF, id]
      );

      console.log('✅ PDF subido para lugar:', id);

      res.json({
        mensaje: 'PDF subido exitosamente',
        url_pdf: rutaPDF,
        archivo: {
          nombre: req.file.filename,
          tamaño: req.file.size,
          tipo: req.file.mimetype
        }
      });
    } catch (error) {
      console.error('Error subiendo PDF:', error);
      
      // Eliminar archivo en caso de error
      if (req.file?.path) {
        try {
          await fsPromises.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error eliminando archivo:', unlinkError);
        }
      }
      
      res.status(500).json({ error: 'Error al subir PDF' });
    }
  },


  // controladores/lugarController.ts - AGREGAR este método

  /**
   * ✅ ACTUALIZADO: Subir PDF CON moderación Y Cloudinary
   */
  async subirPDFLugarConModeracion(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService(); // 🆕 NUEVO
    
    try {
      const { id } = req.params;
      
      console.log('📄 Subiendo PDF con moderación Y CLOUDINARY para lugar:', id);

      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: 'No se proporcionó ningún PDF' 
        });
      }

      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';

      // ✅ Análisis del PDF
      const pdfAnalysisService = new PdfAnalysisService();
      
      const validacionBasica = await pdfAnalysisService.validarPDFBasico(req.file.path);
      if (!validacionBasica.valido) {
        await fsPromises.unlink(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'PDF_INVALIDO',
          message: validacionBasica.error || 'PDF no válido',
          detalles: {
            problemas: [validacionBasica.error || 'Archivo PDF no válido'],
            sugerencias: [
              'Asegúrate de que el archivo sea un PDF válido',
              'Verifica que el tamaño no supere los 10MB',
              'Intenta con otro archivo PDF'
            ]
          }
        });
      }

      console.log('✅ PDF válido, procediendo con análisis de contenido...');

      // Análisis de contenido textual
      const resultadoAnalisis = await pdfAnalysisService.analizarTextoPDF(
        req.file.path,
        ipUsuario,
        hashNavegador
      );

      // ✅ SI EL PDF ES RECHAZADO
      if (!resultadoAnalisis.esAprobado) {
        console.log('❌ PDF rechazado por moderación:', resultadoAnalisis.motivo);
        
        await fsPromises.unlink(req.file.path);
        
        return res.status(400).json({
          success: false,
          error: 'PDF_RECHAZADO',
          message: 'El contenido del PDF no cumple con las políticas de moderación',
          motivo: resultadoAnalisis.motivo,
          tipo: 'pdf_texto',
          detalles: {
            puntuacion: resultadoAnalisis.puntuacion,
            problemas: [resultadoAnalisis.motivo || 'Contenido inapropiado detectado'],
            sugerencias: [
              'Revisa que el PDF no contenga lenguaje ofensivo o inapropiado',
              'Asegúrate de que el contenido sea apropiado para todos los públicos',
              'Evita contenido promocional, spam o enlaces no permitidos'
            ],
            metadata: resultadoAnalisis.metadata
          }
        });
      }

      console.log('✅ PDF aprobado por moderación');

      // Verificar que el lugar existe
      const lugarResult = await pool.query(
        'SELECT id, nombre FROM lugares WHERE id = $1',
        [id]
      );

      if (lugarResult.rows.length === 0) {
        await fsPromises.unlink(req.file.path);
        return res.status(404).json({ 
          success: false,
          error: 'Lugar no encontrado' 
        });
      }

      // 🆕 NUEVO: SUBIR A CLOUDINARY
      const fileBuffer = await fsPromises.readFile(req.file.path);
      const cloudinaryResult = await cloudinaryService.subirArchivo(
        fileBuffer,
        req.file.filename,
        process.env.CLOUDINARY_PDFS_FOLDER || 'pdfs_lugares'
      );

      // 🆕 NUEVO: Limpiar archivo temporal
      await fsPromises.unlink(req.file.path);

      // 🆕 NUEVO: Actualizar BD con URL de Cloudinary
      await pool.query(
        'UPDATE lugares SET pdf_url = $1, actualizado_en = NOW() WHERE id = $2',
        [cloudinaryResult.secure_url, id]  // ← URL de Cloudinary, no local
      );

      const lugar = lugarResult.rows[0];
      console.log('✅ PDF subido y aprobado para lugar CON CLOUDINARY:', lugar.nombre);

      res.json({
        success: true,
        mensaje: 'PDF subido y aprobado exitosamente',
        url_pdf: cloudinaryResult.secure_url,  // ← URL de Cloudinary
        moderacion: {
          esAprobado: true,
          puntuacion: resultadoAnalisis.puntuacion,
          metadata: resultadoAnalisis.metadata
        },
        archivo: {
          nombre: req.file.filename,
          tamaño: req.file.size,
          tipo: req.file.mimetype,
          public_id: cloudinaryResult.public_id
        },
        cloudinary: {
          public_id: cloudinaryResult.public_id,
          folder: cloudinaryResult.folder,
          resource_type: cloudinaryResult.resource_type
        }
      });

    } catch (error) {
      console.error('❌ Error subiendo PDF con moderación:', error);
      
      if (req.file?.path) {
        try {
          await fsPromises.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error eliminando archivo:', unlinkError);
        }
      }
      
      res.status(500).json({ 
        success: false,
        error: 'Error al subir PDF',
        detalle: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  },


  // Obtener galería de imágenes de un lugar - SIN CAMBIOS
  async obtenerGaleriaLugar(req: Request, res: Response) {
    try {
      const { id } = req.params;

      console.log('📸 Obteniendo galería para lugar:', id);

      // Verificar que el lugar existe
      const lugarExists = await pool.query(
        'SELECT id, nombre FROM lugares WHERE id = $1',
        [id]
      );

      if (lugarExists.rows.length === 0) {
        return res.status(404).json({ error: 'Lugar no encontrado' });
      }

      const lugar = lugarExists.rows[0];

      // Obtener imágenes de la galería
      const result = await pool.query(
        `SELECT 
          id, 
          url_foto, 
          descripcion, 
          es_principal, 
          orden, 
          creado_en
         FROM fotos_lugares 
         WHERE lugar_id = $1 
         ORDER BY es_principal DESC, orden ASC`,
        [id]
      );

      console.log(`🖼️ Encontradas ${result.rows.length} imágenes para ${lugar.nombre}`);

      res.json({
        lugar_id: id,
        lugar_nombre: lugar.nombre,
        imagenes: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Error obteniendo galería:', error);
      res.status(500).json({ error: 'Error al obtener galería de imágenes' });
    }
  },

  /**
   * ✅ ACTUALIZADO: Eliminar imagen de la galería CON Cloudinary
   */
  async eliminarImagenGaleria(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService(); // 🆕 NUEVO
    
    try {
      const { id, imagenId } = req.params;

      // Verificar que la imagen pertenece al lugar
      const imagenResult = await pool.query(
        'SELECT * FROM fotos_lugares WHERE id = $1 AND lugar_id = $2',
        [imagenId, id]
      );

      if (imagenResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'Imagen no encontrada o no pertenece al lugar' 
        });
      }

      const imagen = imagenResult.rows[0];

      // No permitir eliminar la imagen principal
      if (imagen.es_principal) {
        return res.status(400).json({ 
          success: false,
          error: 'No se puede eliminar la imagen principal' 
        });
      }

      // 🆕 NUEVO: Eliminar de Cloudinary si es una URL de Cloudinary
      if (imagen.ruta_almacenamiento && cloudinaryService.esUrlCloudinary(imagen.url_foto)) {
        try {
          await cloudinaryService.eliminarArchivo(imagen.ruta_almacenamiento);
          console.log('🗑️ Imagen eliminada de Cloudinary:', imagen.ruta_almacenamiento);
        } catch (error) {
          console.warn('⚠️ No se pudo eliminar la imagen de Cloudinary:', error);
        }
      }

      // Eliminar de la base de datos
      await pool.query(
        'DELETE FROM fotos_lugares WHERE id = $1',
        [imagenId]
      );

      res.json({ 
        success: true,
        mensaje: 'Imagen eliminada exitosamente' 
      });
    } catch (error) {
      console.error('Error eliminando imagen:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al eliminar imagen' 
      });
    }
  },
  // Establecer imagen como principal - SIN CAMBIOS
  async establecerImagenPrincipal(req: Request, res: Response) {
    try {
      const { id, imagenId } = req.params;

      // Iniciar transacción para asegurar consistencia
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        // 1. Verificar que la imagen pertenece al lugar
        const imagenResult = await client.query(
          'SELECT * FROM fotos_lugares WHERE id = $1 AND lugar_id = $2',
          [imagenId, id]
        );

        if (imagenResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Imagen no encontrada o no pertenece al lugar' });
        }

        // 2. Actualizar todas las imágenes del lugar a no principales
        await client.query(
          'UPDATE fotos_lugares SET es_principal = false WHERE lugar_id = $1',
          [id]
        );

        // 3. Establecer la imagen seleccionada como principal
        await client.query(
          'UPDATE fotos_lugares SET es_principal = true WHERE id = $1',
          [imagenId]
        );

        // 4. Obtener la URL de la nueva imagen principal
        const nuevaPrincipalResult = await client.query(
          'SELECT url_foto FROM fotos_lugares WHERE id = $1',
          [imagenId]
        );

        const nuevaUrl = nuevaPrincipalResult.rows[0].url_foto;

        // 5. Actualizar también la foto_principal_url en la tabla lugares
        await client.query(
          'UPDATE lugares SET foto_principal_url = $1 WHERE id = $2',
          [nuevaUrl, id]
        );

        await client.query('COMMIT');

        res.json({ 
          mensaje: 'Imagen establecida como principal exitosamente',
          nueva_imagen_principal: nuevaUrl
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error estableciendo imagen principal:', error);
      res.status(500).json({ error: 'Error al establecer imagen principal' });
    }
  },

 /**
   * ✅ NUEVO: Validar descripción de foto antes de crear/actualizar - CORREGIDO
   */
  async validarDescripcionFotoPrev(req: Request, res: Response) {
    try {
      const { descripcion } = req.body;
      
      if (!descripcion?.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Descripción de foto requerida para validación'
        });
      }

      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';

      console.log('🔍 Validando descripción de foto previo:', {
        descripcion: descripcion ? `"${descripcion.substring(0, 50)}..."` : 'undefined',
        hash: hashNavegador.substring(0, 10) + '...',
        ip: ipUsuario
      });

      const moderacionService = new ModeracionService();

      // ✅ CORREGIDO: Solo 3 argumentos
      const resultadoModeracion = await moderacionService.moderarTexto(
        descripcion.trim(),
        ipUsuario,
        hashNavegador
      );

      // ✅ SI ES RECHAZADO: Devolver motivo específico del log
      if (!resultadoModeracion.esAprobado) {
        console.log('❌ Descripción de foto rechazada en validación previa:', resultadoModeracion.motivoRechazo);
        
        // Buscar el log más reciente para obtener detalles específicos
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
          
          // Extraer detalles específicos del resultado de moderación
          try {
            const resultado = JSON.parse(log.resultado_moderacion);
            if (resultado.analisisTexto) {
              const analisis = resultado.analisisTexto;
              if (analisis.palabrasOfensivas?.length > 0) {
                detallesEspecificos.push(`Palabras problemáticas: ${analisis.palabrasOfensivas.slice(0, 3).join(', ')}`);
              }
              if (analisis.razon) {
                detallesEspecificos.push(`Razón: ${analisis.razon}`);
              }
            }
          } catch (error) {
            console.error('Error parseando resultado moderación:', error);
          }
        }

        // ✅ ANÁLISIS ESPECÍFICO PARA DESCRIPCIONES DE FOTOS
        const { mensajeUsuario, tipoProblema, campoEspecifico } = analizarMotivoRechazoLugar(resultadoModeracion);

        return res.status(400).json({
          success: false,
          error: 'TEXTO_RECHAZADO',
          message: mensajeUsuario,
          motivo: motivoDetallado,
          tipo: tipoProblema,
          detalles: {
            puntuacion: resultadoModeracion.puntuacionGeneral,
            problemas: detallesEspecificos,
            sugerencias: generarSugerenciasLugar('descripcion_foto'),
            campoEspecifico: 'descripcion_foto',
            timestamp: new Date().toISOString()
          }
        });
      }

      // ✅ SI TODO ES APROBADO
      console.log('✅ Descripción de foto aprobada en validación previa');
      
      res.json({
        success: true,
        esAprobado: true,
        mensaje: 'Descripción de foto aprobada, puedes continuar',
        puntuacion: resultadoModeracion.puntuacionGeneral,
        detalles: {
          texto: resultadoModeracion.detalles?.texto
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error validando descripción de foto:', errorMessage);
      
      res.status(500).json({
        success: false,
        error: 'Error al validar descripción de foto',
        message: errorMessage
      });
    }
  },


  /**
   * ✅ MEJORADO: Actualizar descripción de imagen con mejor manejo de errores
   */
  async actualizarDescripcionImagen(req: Request, res: Response) {
    const client = await pool.connect();
    
    try {
      const { id, imagenId } = req.params;
      const { descripcion } = req.body;

      if (!descripcion || descripcion.trim().length === 0) {
        return res.status(400).json({ 
          success: false,
          error: 'La descripción es requerida' 
        });
      }

      console.log('✏️ Actualizando descripción de imagen con moderación:', { 
        lugarId: id, 
        imagenId, 
        descripcion: descripcion.substring(0, 50) + '...' 
      });

      await client.query('BEGIN');

      // ✅ 1. VERIFICAR QUE LA IMAGEN PERTENECE AL LUGAR
      const imagenResult = await client.query(
        'SELECT * FROM fotos_lugares WHERE id = $1 AND lugar_id = $2',
        [imagenId, id]
      );

      if (imagenResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ 
          success: false,
          error: 'Imagen no encontrada o no pertenece al lugar' 
        });
      }

      const imagenActual = imagenResult.rows[0];
      
      // ✅ 2. VERIFICAR SI LA DESCRIPCIÓN REALMENTE CAMBIÓ
      if (descripcion.trim() === imagenActual.descripcion) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'La descripción proporcionada es igual a la actual',
          detalles: {
            descripcion_actual: imagenActual.descripcion,
            descripcion_nueva: descripcion.trim()
          }
        });
      }

      // ✅ 3. APLICAR MODERACIÓN A LA NUEVA DESCRIPCIÓN
      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';
      const moderacionService = new ModeracionService();
      
      const resultadoModeracion = await moderacionService.moderarTexto(
        descripcion.trim(),
        ipUsuario,
        hashNavegador
      );

      // ✅ SI ES RECHAZADO: Rollback y responder con error
      if (!resultadoModeracion.esAprobado) {
        await client.query('ROLLBACK');
        
        console.log('❌ Descripción de imagen rechazada por moderación:', resultadoModeracion.motivoRechazo);
        
        const { mensajeUsuario, tipoProblema, detallesEspecificos } = analizarMotivoRechazoLugar(resultadoModeracion);

        return res.status(400).json({
          success: false,
          error: 'DESCRIPCION_RECHAZADA',
          message: mensajeUsuario,
          motivo: resultadoModeracion.motivoRechazo,
          tipo: tipoProblema,
          detalles: {
            puntuacion: resultadoModeracion.puntuacionGeneral,
            problemas: detallesEspecificos,
            sugerencias: generarSugerenciasLugar('descripcion_foto'),
            campoEspecifico: 'descripcion_foto',
            timestamp: new Date().toISOString()
          }
        });
      }

      // ✅ 4. ACTUALIZAR DESCRIPCIÓN APROBADA
      await client.query(
        'UPDATE fotos_lugares SET descripcion = $1, actualizado_en = NOW() WHERE id = $2',
        [descripcion.trim(), imagenId]
      );

      await client.query('COMMIT');

      console.log('✅ Descripción de imagen actualizada y aprobada:', { 
        imagenId, 
        lugarId: id 
      });

      res.json({ 
        success: true,
        mensaje: 'Descripción actualizada exitosamente',
        imagen: {
          id: imagenId,
          descripcion: descripcion.trim(),
          lugar_id: id,
          es_principal: imagenActual.es_principal
        },
        moderacion: {
          esAprobado: true,
          puntuacion: resultadoModeracion.puntuacionGeneral,
          timestamp: new Date().toISOString()
        },
        cambios: {
          descripcion_anterior: imagenActual.descripcion,
          descripcion_nueva: descripcion.trim(),
          modificado: true
        }
      });

    } catch (error) {
      await client.query('ROLLBACK').catch(console.error);
      
      console.error('❌ Error actualizando descripción:', error);
      
      // Manejar errores de moderación específicos
      if (error instanceof Error && error.message.includes('DESCRIPCION_RECHAZADA')) {
        return res.status(400).json({
          success: false,
          error: 'DESCRIPCION_RECHAZADA',
          message: error.message
        });
      }
      
      res.status(500).json({ 
        success: false,
        error: 'Error al actualizar descripción',
        detalle: error instanceof Error ? error.message : 'Error desconocido'
      });
    } finally {
      client.release();
    }
  },

  /**
   * ✅ ACTUALIZADO: Eliminar imagen principal CON Cloudinary
   */
  async eliminarImagenPrincipal(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService(); // 🆕 NUEVO
    
    try {
      const { id } = req.params;

      // Obtener la imagen principal actual
      const imagenPrincipalResult = await pool.query(
        'SELECT * FROM fotos_lugares WHERE lugar_id = $1 AND es_principal = true',
        [id]
      );

      if (imagenPrincipalResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'No se encontró imagen principal' 
        });
      }

      const imagenPrincipal = imagenPrincipalResult.rows[0];

      // 🆕 NUEVO: Eliminar imagen de Cloudinary
      if (imagenPrincipal.ruta_almacenamiento && cloudinaryService.esUrlCloudinary(imagenPrincipal.url_foto)) {
        try {
          await cloudinaryService.eliminarArchivo(imagenPrincipal.ruta_almacenamiento);
          console.log('🗑️ Imagen principal eliminada de Cloudinary:', imagenPrincipal.ruta_almacenamiento);
        } catch (error) {
          console.warn('⚠️ No se pudo eliminar la imagen principal de Cloudinary:', error);
        }
      }

      // Buscar una imagen alternativa para establecer como principal
      const imagenesAlternativas = await pool.query(
        'SELECT * FROM fotos_lugares WHERE lugar_id = $1 AND es_principal = false ORDER BY orden ASC LIMIT 1',
        [id]
      );

      let nuevaImagenPrincipal = null;

      if (imagenesAlternativas.rows.length > 0) {
        // Establecer la primera imagen alternativa como principal
        nuevaImagenPrincipal = imagenesAlternativas.rows[0];
        
        await pool.query(
          'UPDATE fotos_lugares SET es_principal = true WHERE id = $1',
          [nuevaImagenPrincipal.id]
        );

        // Actualizar la foto_principal_url en la tabla lugares
        await pool.query(
          'UPDATE lugares SET foto_principal_url = $1 WHERE id = $2',
          [nuevaImagenPrincipal.url_foto, id]
        );
      } else {
        // No hay imágenes alternativas, dejar sin imagen principal
        await pool.query(
          'UPDATE lugares SET foto_principal_url = NULL WHERE id = $1',
          [id]
        );
      }

      // Eliminar de la base de datos
      await pool.query(
        'DELETE FROM fotos_lugares WHERE id = $1',
        [imagenPrincipal.id]
      );

      res.json({
        success: true,
        mensaje: 'Imagen principal eliminada exitosamente',
        nueva_imagen_principal: nuevaImagenPrincipal ? {
          id: nuevaImagenPrincipal.id,
          url_foto: nuevaImagenPrincipal.url_foto
        } : null
      });
    } catch (error) {
      console.error('Error eliminando imagen principal:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al eliminar imagen principal' 
      });
    }
  },
 /**
   * ✅ ACTUALIZADO: Eliminar PDF de lugar CON Cloudinary
   */
  async eliminarPDFLugar(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService(); // 🆕 NUEVO
    
    try {
      const { id } = req.params;

      // Verificar que el lugar existe
      const lugarResult = await pool.query(
        'SELECT id, pdf_url FROM lugares WHERE id = $1',
        [id]
      );

      if (lugarResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'Lugar no encontrado' 
        });
      }

      const lugar = lugarResult.rows[0];

      // ✅ MEJORADO: Si existe un PDF en Cloudinary, eliminarlo de allí
      if (lugar.pdf_url && cloudinaryService.esUrlCloudinary(lugar.pdf_url)) {
        try {
          // Extraer public_id de la URL de Cloudinary
          const publicId = cloudinaryService.extraerPublicId(lugar.pdf_url);
          if (publicId) {
            await cloudinaryService.eliminarArchivo(publicId);
            console.log('🗑️ PDF eliminado de Cloudinary:', publicId);
          }
        } catch (error) {
          console.warn('⚠️ No se pudo eliminar el PDF de Cloudinary:', error);
        }
      } 
      // ✅ MANTENER: Compatibilidad con archivos locales (por si acaso)
      else if (lugar.pdf_url && lugar.pdf_url.startsWith('/uploads/')) {
        const pdfPath = path.join(__dirname, '..', '..', lugar.pdf_url);
        try {
          await fsPromises.access(pdfPath);
          await fsPromises.unlink(pdfPath);
          console.log('🗑️ PDF local eliminado:', pdfPath);
        } catch (error) {
          console.log('Archivo PDF local no encontrado o no se pudo eliminar:', error);
        }
      }

      // Actualizar la base de datos
      await pool.query(
        'UPDATE lugares SET pdf_url = NULL, actualizado_en = NOW() WHERE id = $1',
        [id]
      );

      res.json({ 
        success: true,
        mensaje: 'PDF eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error eliminando PDF:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al eliminar PDF' 
      });
    }
  },

 /**
   * ✅ ACTUALIZADO: Reemplazar imagen principal CON Cloudinary
   */
  async reemplazarImagenPrincipal(req: Request, res: Response) {
    const client = await pool.connect();
    const cloudinaryService = new CloudinaryService(); // 🆕 NUEVO
    
    try {
      const { id } = req.params;
      
      console.log('🔄 Reemplazando imagen principal para lugar con moderación y Cloudinary:', id);

      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: 'Archivo es requerido' 
        });
      }

      // ✅ NUEVO: Moderación de imagen
      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';

      const moderacionImagenService = new ModeracionImagenService();
      
      // 🆕 NUEVO: Leer y moderar desde buffer
      const fileBuffer = await fsPromises.readFile(req.file.path);
      const resultadoModeracion = await moderacionImagenService.moderarImagenDesdeBuffer(
        fileBuffer,
        req.file.filename,
        ipUsuario,
        hashNavegador
      );

      if (!resultadoModeracion.esAprobado) {
        console.log('❌ Imagen rechazada por moderación:', resultadoModeracion.motivoRechazo);
        
        // Eliminar archivo subido
        try {
          await fsPromises.unlink(req.file.path);
        } catch (error) {
          console.error('Error eliminando archivo:', error);
        }
        
        return res.status(400).json({
          success: false,
          error: 'IMAGEN_RECHAZADA',
          message: 'La imagen no cumple con las políticas de contenido',
          motivo: resultadoModeracion.motivoRechazo,
          tipo: 'imagen',
          detalles: {
            puntuacion: resultadoModeracion.puntuacionRiesgo,
            problemas: [resultadoModeracion.motivoRechazo || 'Contenido inapropiado detectado'],
            sugerencias: generarSugerenciasLugar('imagen'),
            timestamp: new Date().toISOString()
          }
        });
      }

      console.log('✅ Imagen aprobada para reemplazar imagen principal');

      await client.query('BEGIN');

      // 1. Verificar que el lugar existe
      const lugarResult = await client.query(
        'SELECT id, nombre FROM lugares WHERE id = $1',
        [id]
      );

      if (lugarResult.rows.length === 0) {
        // Eliminar archivo si el lugar no existe
        if (req.file.path) {
          try {
            await fsPromises.unlink(req.file.path);
          } catch (error) {
            console.error('Error eliminando archivo:', error);
          }
        }
        await client.query('ROLLBACK');
        return res.status(404).json({ 
          success: false,
          error: 'Lugar no encontrado' 
        });
      }

      const lugar = lugarResult.rows[0];
      
      // 🆕 NUEVO: Subir a Cloudinary
      const cloudinaryResult = await cloudinaryService.subirArchivo(
        fileBuffer,
        req.file.filename,
        process.env.CLOUDINARY_LUGARES_FOLDER || 'lugares'
      );

      // 🆕 NUEVO: Limpiar archivo temporal
      await fsPromises.unlink(req.file.path);

      console.log('📍 Reemplazando imagen principal para:', lugar.nombre);

      // 2. Obtener la imagen principal actual
      const imagenPrincipalActual = await client.query(
        'SELECT id, ruta_almacenamiento FROM fotos_lugares WHERE lugar_id = $1 AND es_principal = true',
        [id]
      );

      let imagenActualId: string | null = null;

      if (imagenPrincipalActual.rows.length > 0) {
        // 3. Reemplazar imagen principal existente
        const imagenActual = imagenPrincipalActual.rows[0];
        imagenActualId = imagenActual.id;
        
        console.log('📸 Imagen principal actual encontrada:', imagenActualId);

        // 🆕 NUEVO: Eliminar imagen anterior de Cloudinary
        if (imagenActual.ruta_almacenamiento && cloudinaryService.esUrlCloudinary(imagenActual.ruta_almacenamiento)) {
          try {
            await cloudinaryService.eliminarArchivo(imagenActual.ruta_almacenamiento);
            console.log('🗑️ Imagen anterior eliminada de Cloudinary');
          } catch (error) {
            console.warn('⚠️ No se pudo eliminar la imagen anterior de Cloudinary:', error);
          }
        }

        // Actualizar la imagen existente (manteniendo es_principal = true)
        await client.query(
          `UPDATE fotos_lugares 
           SET url_foto = $1, 
               ruta_almacenamiento = $2, 
               tamaño_archivo = $3, 
               tipo_archivo = $4,
               ancho_imagen = $5,
               alto_imagen = $6,
               actualizado_en = NOW()
           WHERE id = $7`,
          [
            cloudinaryResult.secure_url,
            cloudinaryResult.public_id,
            cloudinaryResult.bytes,
            `image/${cloudinaryResult.format}`,
            cloudinaryResult.width || null,
            cloudinaryResult.height || null,
            imagenActualId
          ]
        );
        
      } else {
        // 4. Crear nueva imagen principal si no existe
        console.log('➕ Creando nueva imagen principal...');
        
        const result = await client.query(
          `INSERT INTO fotos_lugares 
           (lugar_id, url_foto, es_principal, descripcion, orden, 
            ruta_almacenamiento, tamaño_archivo, tipo_archivo, ancho_imagen, alto_imagen)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            id,
            cloudinaryResult.secure_url,
            true,
            'Imagen principal del lugar',
            1,
            cloudinaryResult.public_id,
            cloudinaryResult.bytes,
            `image/${cloudinaryResult.format}`,
            cloudinaryResult.width || null,
            cloudinaryResult.height || null
          ]
        );
        
        imagenActualId = result.rows[0].id;
      }

      // 5. Actualizar la foto_principal_url en la tabla lugares
      await client.query(
        'UPDATE lugares SET foto_principal_url = $1, actualizado_en = NOW() WHERE id = $2',
        [cloudinaryResult.secure_url, id]
      );

      await client.query('COMMIT');
      console.log('✅ Imagen principal reemplazada y aprobada exitosamente en Cloudinary');

      res.json({
        success: true,
        mensaje: 'Imagen principal reemplazada exitosamente',
        url_imagen: cloudinaryResult.secure_url,
        imagen_id: imagenActualId,
        es_principal: true,
        moderacion: {
          esAprobado: true,
          puntuacionRiesgo: resultadoModeracion.puntuacionRiesgo,
          timestamp: new Date().toISOString()
        },
        archivo: {
          nombre: req.file.filename,
          tamaño: cloudinaryResult.bytes,
          tipo: `image/${cloudinaryResult.format}`
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error reemplazando imagen principal:', error);
      
      if (req.file?.path) {
        try { 
          await fsPromises.unlink(req.file.path); 
        } catch (unlinkError) { 
          console.error('Error eliminando archivo:', unlinkError);
        }
      }
      
      res.status(500).json({ 
        success: false,
        error: 'Error al reemplazar imagen principal',
        detalle: error instanceof Error ? error.message : 'Error desconocido'
      });
    } finally {
      client.release();
    }
  },
  // 🔒 MÉTODOS PRIVADOS - Actualizados para solo texto

/**
 * Analizar motivo de rechazo para mensajes específicos al usuario (actualizado para incluir descripciones de fotos)
 */
analizarMotivoRechazo(resultadoModeracion: any): { 
  mensajeUsuario: string; 
  tipoProblema: string; 
  detallesEspecificos: string[];
  campoEspecifico: 'nombre' | 'descripcion' | 'descripcion_foto' | 'ambos';
} {
  const detallesEspecificos: string[] = [];
  let mensajeUsuario = 'El contenido no cumple con nuestras políticas';
  let tipoProblema = 'general';
  let campoEspecifico: 'nombre' | 'descripcion' | 'descripcion_foto' | 'ambos' = 'ambos';

  console.log('🔍 Analizando motivo de rechazo:', resultadoModeracion);

  // ✅ CORREGIDO: Verificar la estructura real del objeto de moderación
  if (!resultadoModeracion.esAprobado) {
    tipoProblema = 'texto';
    
    // Obtener el motivo de rechazo
    const motivoRechazo = resultadoModeracion.motivoRechazo || '';
    const puntuacionGeneral = resultadoModeracion.puntuacionGeneral || 0;
    
    // ✅ CORREGIDO: Analizar el motivo de rechazo directamente
    if (motivoRechazo.includes('ofensivo') || motivoRechazo.includes('ofensiva') || motivoRechazo.includes('inapropiado')) {
      mensajeUsuario = 'El contenido contiene lenguaje ofensivo o inapropiado';
      detallesEspecificos.push('Se detectaron palabras ofensivas en el contenido');
      
      // ✅ MEJORADO: Determinar campo específico basado en contexto
      if (motivoRechazo.includes('nombre') || resultadoModeracion.tipoContenido === 'nombre') {
        campoEspecifico = 'nombre';
        mensajeUsuario = 'El nombre contiene lenguaje ofensivo o inapropiado';
      } else if (motivoRechazo.includes('descripción') || motivoRechazo.includes('descripcion') || resultadoModeracion.tipoContenido === 'descripcion') {
        campoEspecifico = 'descripcion';
        mensajeUsuario = 'La descripción contiene lenguaje ofensivo o inapropiado';
      } else if (motivoRechazo.includes('foto') || motivoRechazo.includes('imagen') || resultadoModeracion.tipoContenido === 'descripcion_foto') {
        campoEspecifico = 'descripcion_foto';
        mensajeUsuario = 'La descripción de la foto contiene lenguaje ofensivo o inapropiado';
      }
      
    } else if (motivoRechazo.includes('spam') || motivoRechazo.includes('comercial') || motivoRechazo.includes('promocional')) {
      mensajeUsuario = 'El contenido contiene elementos comerciales no permitidos';
      detallesEspecificos.push('Se detectó contenido promocional o spam');
      
      // ✅ MEJORADO: Determinar campo específico
      if (motivoRechazo.includes('foto') || motivoRechazo.includes('imagen') || resultadoModeracion.tipoContenido === 'descripcion_foto') {
        campoEspecifico = 'descripcion_foto';
        mensajeUsuario = 'La descripción de la foto contiene contenido comercial no permitido';
      } else if (motivoRechazo.includes('descripción') || motivoRechazo.includes('descripcion') || resultadoModeracion.tipoContenido === 'descripcion') {
        campoEspecifico = 'descripcion';
        mensajeUsuario = 'La descripción contiene contenido comercial no permitido';
      } else {
        campoEspecifico = 'descripcion';
        mensajeUsuario = 'El contenido contiene elementos comerciales no permitidos';
      }
      
    } else if (motivoRechazo.includes('sentido') || motivoRechazo.includes('coherente') || motivoRechazo.includes('incomprensible')) {
      mensajeUsuario = 'El contenido no tiene sentido o es muy corto';
      detallesEspecificos.push('El texto debe ser coherente y tener sentido');
      
      // ✅ MEJORADO: Determinar campo específico
      if (motivoRechazo.includes('foto') || motivoRechazo.includes('imagen') || resultadoModeracion.tipoContenido === 'descripcion_foto') {
        campoEspecifico = 'descripcion_foto';
        mensajeUsuario = 'La descripción de la foto no tiene sentido o es muy corta';
      } else if (motivoRechazo.includes('descripción') || motivoRechazo.includes('descripcion') || resultadoModeracion.tipoContenido === 'descripcion') {
        campoEspecifico = 'descripcion';
        mensajeUsuario = 'La descripción no tiene sentido o es muy corta';
      } else {
        campoEspecifico = 'descripcion';
        mensajeUsuario = 'El contenido no tiene sentido o es muy corto';
      }
      
    } else if (motivoRechazo.includes('URL') || motivoRechazo.includes('email') || motivoRechazo.includes('teléfono') || motivoRechazo.includes('enlace') || motivoRechazo.includes('contacto')) {
      mensajeUsuario = 'El contenido contiene enlaces o información de contacto no permitida';
      detallesEspecificos.push('No se permiten URLs, emails o números de teléfono');
      
      // ✅ MEJORADO: Determinar campo específico
      if (motivoRechazo.includes('foto') || motivoRechazo.includes('imagen') || resultadoModeracion.tipoContenido === 'descripcion_foto') {
        campoEspecifico = 'descripcion_foto';
        mensajeUsuario = 'La descripción de la foto contiene enlaces o información de contacto';
      } else if (motivoRechazo.includes('descripción') || motivoRechazo.includes('descripcion') || resultadoModeracion.tipoContenido === 'descripcion') {
        campoEspecifico = 'descripcion';
        mensajeUsuario = 'La descripción contiene enlaces o información de contacto';
      } else {
        campoEspecifico = 'descripcion';
        mensajeUsuario = 'El contenido contiene enlaces o información de contacto';
      }
    } else {
      // Motivo genérico
      detallesEspecificos.push(motivoRechazo || 'Contenido no aprobado por las políticas de moderación');
    }

    // ✅ NUEVO: Agregar detalles específicos del análisis si están disponibles
    if (resultadoModeracion.detalles?.analisisTexto) {
      const analisis = resultadoModeracion.detalles.analisisTexto;
      
      if (analisis.palabrasOfensivas?.length > 0) {
        detallesEspecificos.push(`Palabras detectadas: ${analisis.palabrasOfensivas.slice(0, 3).join(', ')}`);
      }
      
      if (analisis.razon) {
        detallesEspecificos.push(`Razón: ${analisis.razon}`);
      }
    }
  }

  // Agregar puntuación a los detalles si está disponible
  if (resultadoModeracion.puntuacionGeneral) {
    detallesEspecificos.push(`Puntuación de riesgo: ${(resultadoModeracion.puntuacionGeneral * 100).toFixed(1)}%`);
  }

  // ✅ NUEVO: Si no hay detalles específicos, agregar uno genérico
  if (detallesEspecificos.length === 0) {
    detallesEspecificos.push('El contenido no cumple con las políticas de la comunidad');
  }

  console.log('✅ Resultado del análisis:', { 
    mensajeUsuario, 
    tipoProblema, 
    detallesEspecificos, 
    campoEspecifico,
    motivoRechazo: resultadoModeracion.motivoRechazo 
  });

  return { mensajeUsuario, tipoProblema, detallesEspecificos, campoEspecifico };
},

/**
 * Generar sugerencias según el tipo de problema (actualizado para incluir descripciones de fotos)
 */
generarSugerencias(tipoProblema: string): string[] {
  const sugerencias: string[] = [];
  
  // ✅ ACTUALIZADO: Sugerencias específicas por tipo de problema
  if (tipoProblema === 'texto' || tipoProblema === 'general') {
    sugerencias.push('Evita lenguaje ofensivo, insultos o palabras vulgares');
    sugerencias.push('No incluyas contenido comercial, promociones o spam');
    sugerencias.push('Asegúrate de que el texto sea coherente y tenga sentido');
    sugerencias.push('No incluyas enlaces, emails o números de teléfono');
    sugerencias.push('Usa un lenguaje respetuoso y apropiado para la comunidad');
  } else if (tipoProblema === 'nombre') {
    sugerencias.push('Usa un nombre apropiado y respetuoso para el lugar');
    sugerencias.push('Evita lenguaje ofensivo o inapropiado en el nombre');
    sugerencias.push('No uses nombres comerciales o promocionales');
    sugerencias.push('El nombre debe ser descriptivo y adecuado para todas las edades');
    sugerencias.push('Mantén el nombre relevante y relacionado con el lugar');
  } else if (tipoProblema === 'descripcion') {
    sugerencias.push('La descripción debe ser clara y descriptiva');
    sugerencias.push('Evita contenido promocional o comercial');
    sugerencias.push('Incluye información útil sobre el lugar');
    sugerencias.push('Mantén un lenguaje apropiado y respetuoso');
    sugerencias.push('Describe características relevantes del lugar');
  } else if (tipoProblema === 'descripcion_foto') {
    sugerencias.push('La descripción de la foto debe ser apropiada y relacionada con la imagen');
    sugerencias.push('Evita lenguaje ofensivo o inapropiado en la descripción');
    sugerencias.push('No incluyas contenido comercial o promocional');
    sugerencias.push('La descripción debe ser relevante para la imagen del lugar');
    sugerencias.push('Describe lo que se ve en la imagen de manera objetiva');
  } else {
    sugerencias.push('Revisa el contenido antes de publicarlo');
    sugerencias.push('Asegúrate de que cumpla con las políticas de la comunidad');
    sugerencias.push('Verifica que el texto sea apropiado para todos los públicos');
  }
  
  return sugerencias;
}
};