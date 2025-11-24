// controladores/cargaArchivosController.ts - VERSIÓN SOLO CLOUDINARY
import { Request, Response } from 'express';
import { pool } from '../utils/baseDeDatos.js';
import fs from 'fs/promises';
import { CloudinaryService } from '../services/cloudinaryService.js';
import { ModeracionImagenService } from '../services/moderacionImagenService.js';
import { generarHashNavegador } from '../utils/hashNavegador.js';

export const cargaArchivosController = {
  /**
   * ✅ CORREGIDO: Subir foto para lugar (SOLO CLOUDINARY)
   */
  async subirFotoLugar(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService();
    const moderacionImagenService = new ModeracionImagenService();
    
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: 'No se proporcionó archivo' 
        });
      }

      const { lugarId, descripcion, esPrincipal } = req.body;
      
      // Verificar que el lugar existe
      const lugarResult = await pool.query(
        'SELECT id FROM lugares WHERE id = $1',
        [lugarId]
      );
      
      if (lugarResult.rows.length === 0) {
        await fs.unlink(req.file.path);
        return res.status(404).json({ 
          success: false,
          error: 'Lugar no encontrado' 
        });
      }

      // ✅ MODERACIÓN DE IMAGEN ANTES DE CLOUDINARY
      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';

      console.log('🖼️ Moderando imagen antes de subir a Cloudinary...');
      
      const fileBuffer = await fs.readFile(req.file.path);
      const resultadoModeracion = await moderacionImagenService.moderarImagenDesdeBuffer(
        fileBuffer,
        req.file.filename,
        ipUsuario,
        hashNavegador
      );

      if (!resultadoModeracion.esAprobado) {
        await fs.unlink(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'IMAGEN_RECHAZADA',
          message: 'La imagen no cumple con las políticas de contenido',
          motivo: resultadoModeracion.motivoRechazo,
          detalles: {
            puntuacion: resultadoModeracion.puntuacionRiesgo,
            problemas: [resultadoModeracion.motivoRechazo || 'Contenido inapropiado detectado']
          }
        });
      }

      console.log('✅ Imagen aprobada, subiendo a Cloudinary...');

      // ✅ SUBIR A CLOUDINARY SOLO SI ES APROBADA
      const cloudinaryResult = await cloudinaryService.subirArchivo(
        fileBuffer,
        req.file.filename,
        process.env.CLOUDINARY_LUGARES_FOLDER || 'lugares'
      );

      // ✅ LIMPIAR ARCHIVO TEMPORAL
      await fs.unlink(req.file.path);

      // Obtener el máximo orden actual
      const ordenResult = await pool.query(
        'SELECT COALESCE(MAX(orden), 0) + 1 as siguiente_orden FROM fotos_lugares WHERE lugar_id = $1',
        [lugarId]
      );

      const result = await pool.query(
        `INSERT INTO fotos_lugares 
         (lugar_id, url_foto, ruta_almacenamiento, descripcion, es_principal, orden,
          ancho_imagen, alto_imagen, tamaño_archivo, tipo_archivo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          lugarId,
          cloudinaryResult.secure_url,
          cloudinaryResult.public_id,
          descripcion || '',
          esPrincipal === 'true',
          ordenResult.rows[0].siguiente_orden,
          cloudinaryResult.width,
          cloudinaryResult.height,
          cloudinaryResult.bytes,
          req.file.mimetype
        ]
      );

      res.status(201).json({
        success: true,
        mensaje: 'Foto subida exitosamente a Cloudinary',
        foto: result.rows[0],
        moderacion: {
          esAprobado: true,
          puntuacionRiesgo: resultadoModeracion.puntuacionRiesgo
        }
      });
    } catch (error) {
      console.error('Error subiendo foto a Cloudinary:', error);
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      res.status(500).json({ 
        success: false,
        error: 'Error al subir foto' 
      });
    }
  },

  /**
   * ✅ CORREGIDO: Subir PDF para lugar (SOLO CLOUDINARY)
   */
  async subirPDFLugar(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService();
    
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: 'No se proporcionó archivo PDF' 
        });
      }

      const { lugarId } = req.body;
      
      // Verificar que el lugar existe
      const lugarResult = await pool.query(
        'SELECT id, pdf_url FROM lugares WHERE id = $1',
        [lugarId]
      );
      
      if (lugarResult.rows.length === 0) {
        await fs.unlink(req.file.path);
        return res.status(404).json({ 
          success: false,
          error: 'Lugar no encontrado' 
        });
      }

      // ✅ SUBIR DIRECTAMENTE A CLOUDINARY SIN ALMACENAMIENTO LOCAL
      const fileBuffer = await fs.readFile(req.file.path);
      const cloudinaryResult = await cloudinaryService.subirPDF(
        fileBuffer,
        req.file.filename,
        process.env.CLOUDINARY_PDFS_FOLDER || 'pdfs_lugares'
      );

      // ✅ LIMPIAR ARCHIVO TEMPORAL INMEDIATAMENTE
      await fs.unlink(req.file.path);

      // Si ya existe un PDF en Cloudinary, eliminarlo
      const lugar = lugarResult.rows[0];
      if (lugar.pdf_url && cloudinaryService.esUrlCloudinary(lugar.pdf_url)) {
        const publicId = cloudinaryService.extraerPublicId(lugar.pdf_url);
        if (publicId) {
          await cloudinaryService.eliminarPDF(publicId).catch(console.error);
        }
      }

      const result = await pool.query(
        `UPDATE lugares 
         SET pdf_url = $1, actualizado_en = NOW()
         WHERE id = $2
         RETURNING *`,
        [cloudinaryResult.secure_url, lugarId]
      );

      res.status(201).json({
        success: true,
        mensaje: 'PDF subido exitosamente a Cloudinary',
        lugar: result.rows[0],
        cloudinary: {
          url: cloudinaryResult.secure_url,
          public_id: cloudinaryResult.public_id
        }
      });
    } catch (error) {
      console.error('Error subiendo PDF a Cloudinary:', error);
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      res.status(500).json({ 
        success: false,
        error: 'Error al subir PDF' 
      });
    }
  },

  /**
   * ✅ CORREGIDO: Eliminar PDF de lugar (SOLO CLOUDINARY)
   */
  async eliminarPDFLugar(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService();
    
    try {
      const { lugarId } = req.params;

      const result = await pool.query(
        'SELECT pdf_url FROM lugares WHERE id = $1',
        [lugarId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'Lugar no encontrado' 
        });
      }

      const lugar = result.rows[0];
      
      // ✅ ELIMINAR SOLO DE CLOUDINARY SI EXISTE
      if (lugar.pdf_url && cloudinaryService.esUrlCloudinary(lugar.pdf_url)) {
        const publicId = cloudinaryService.extraerPublicId(lugar.pdf_url);
        if (publicId) {
          await cloudinaryService.eliminarPDF(publicId);
        }
      }

      // Actualizar BD
      await pool.query(
        'UPDATE lugares SET pdf_url = NULL, actualizado_en = NOW() WHERE id = $1',
        [lugarId]
      );

      res.json({ 
        success: true,
        mensaje: 'PDF eliminado exitosamente de Cloudinary' 
      });
    } catch (error) {
      console.error('Error eliminando PDF de Cloudinary:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al eliminar PDF' 
      });
    }
  },

  /**
   * ✅ CORREGIDO: Subir experiencia (SOLO CLOUDINARY)
   */
  async subirExperiencia(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService();
    const moderacionImagenService = new ModeracionImagenService();
    
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: 'No se proporcionó imagen' 
        });
      }

      const { descripcion, lugarId } = req.body;

      // ✅ MODERACIÓN DE IMAGEN ANTES DE CLOUDINARY
      const hashNavegador = generarHashNavegador(req);
      const ipUsuario = req.ip || req.connection.remoteAddress || 'unknown';

      console.log('🖼️ Moderando imagen de experiencia...');
      
      const fileBuffer = await fs.readFile(req.file.path);
      const resultadoModeracion = await moderacionImagenService.moderarImagenDesdeBuffer(
        fileBuffer,
        req.file.filename,
        ipUsuario,
        hashNavegador
      );

      if (!resultadoModeracion.esAprobado) {
        await fs.unlink(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'IMAGEN_RECHAZADA',
          message: 'La imagen no cumple con las políticas de contenido',
          motivo: resultadoModeracion.motivoRechazo,
          detalles: {
            puntuacion: resultadoModeracion.puntuacionRiesgo
          }
        });
      }

      console.log('✅ Imagen de experiencia aprobada, subiendo a Cloudinary...');

      // ✅ SUBIR A CLOUDINARY SOLO SI ES APROBADA
      const cloudinaryResult = await cloudinaryService.subirArchivo(
        fileBuffer,
        req.file.filename,
        process.env.CLOUDINARY_EXPERIENCIAS_FOLDER || 'experiencias'
      );

      // ✅ LIMPIAR ARCHIVO TEMPORAL
      await fs.unlink(req.file.path);

      const result = await pool.query(
        `INSERT INTO experiencias 
         (url_foto, descripcion, ruta_almacenamiento, lugar_id,
          ancho_imagen, alto_imagen, tamaño_archivo, tipo_archivo, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendiente')
         RETURNING *`,
        [
          cloudinaryResult.secure_url,
          descripcion || '',
          cloudinaryResult.public_id,
          lugarId || null,
          cloudinaryResult.width,
          cloudinaryResult.height,
          cloudinaryResult.bytes,
          req.file.mimetype
        ]
      );

      res.status(201).json({
        success: true,
        mensaje: 'Experiencia subida exitosamente a Cloudinary. En proceso de moderación.',
        experiencia: result.rows[0],
        moderacion: {
          esAprobado: true,
          puntuacionRiesgo: resultadoModeracion.puntuacionRiesgo
        }
      });
    } catch (error) {
      console.error('Error subiendo experiencia a Cloudinary:', error);
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      res.status(500).json({ 
        success: false,
        error: 'Error al subir experiencia' 
      });
    }
  },

  /**
   * ✅ CORREGIDO: Eliminar foto de lugar (SOLO CLOUDINARY)
   */
  async eliminarFotoLugar(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService();
    
    try {
      const { fotoId } = req.params;

      const result = await pool.query(
        'DELETE FROM fotos_lugares WHERE id = $1 RETURNING *',
        [fotoId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'Foto no encontrada' 
        });
      }

      const foto = result.rows[0];
      
      // ✅ ELIMINAR SOLO DE CLOUDINARY
      if (foto.ruta_almacenamiento && cloudinaryService.esUrlCloudinary(foto.url_foto)) {
        const publicId = cloudinaryService.extraerPublicId(foto.url_foto) || foto.ruta_almacenamiento;
        await cloudinaryService.eliminarArchivo(publicId);
      }

      res.json({ 
        success: true,
        mensaje: 'Foto eliminada exitosamente de Cloudinary' 
      });
    } catch (error) {
      console.error('Error eliminando foto de Cloudinary:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al eliminar foto' 
      });
    }
  },

  /**
   * ✅ CORREGIDO: Marcar foto como principal
   */
  async marcarFotoPrincipal(req: Request, res: Response) {
    try {
      const { fotoId } = req.params;

      const result = await pool.query(
        'UPDATE fotos_lugares SET es_principal = true WHERE id = $1 RETURNING *',
        [fotoId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'Foto no encontrada' 
        });
      }

      res.json({
        success: true,
        mensaje: 'Foto marcada como principal',
        foto: result.rows[0]
      });
    } catch (error) {
      console.error('Error marcando foto principal:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al marcar foto como principal' 
      });
    }
  },

  /**
   * ✅ NUEVO: Verificar estado de Cloudinary
   */
  async verificarEstadoCloudinary(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService();
    
    try {
      // Intentar una operación simple para verificar la conexión
      const testUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
      const esAccesible = await cloudinaryService.verificarAccesoArchivo(testUrl);

      res.json({
        success: true,
        cloudinary: {
          configurado: true,
          accesible: esAccesible,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error verificando estado de Cloudinary:', error);
      res.status(500).json({
        success: false,
        error: 'Cloudinary no está configurado correctamente'
      });
    }
  }
};