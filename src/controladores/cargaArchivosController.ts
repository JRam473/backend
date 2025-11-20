// controladores/cargaArchivosController.ts - VERSIÓN CORREGIDA
import { Request, Response } from 'express';
import { pool } from '../utils/baseDeDatos';
import fs from 'fs/promises';
import { CloudinaryService } from '../services/cloudinaryService';

export const cargaArchivosController = {
  // Subir foto para lugar (admin only)
  async subirFotoLugar(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService();
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó archivo' });
      }

      const { lugarId, descripcion, esPrincipal } = req.body;
      
      // Verificar que el lugar existe
      const lugarResult = await pool.query(
        'SELECT id FROM lugares WHERE id = $1',
        [lugarId]
      );
      
      if (lugarResult.rows.length === 0) {
        await fs.unlink(req.file.path);
        return res.status(404).json({ error: 'Lugar no encontrado' });
      }

      // Leer archivo y subir a Cloudinary
      const fileBuffer = await fs.readFile(req.file.path);
      const cloudinaryResult = await cloudinaryService.subirArchivo(
        fileBuffer,
        req.file.filename,
        process.env.CLOUDINARY_LUGARES_FOLDER || 'lugares'
      );

      // Limpiar archivo local
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
          cloudinaryResult.width,    // ← number | null (compatible)
          cloudinaryResult.height,   // ← number | null (compatible)
          cloudinaryResult.bytes,
          req.file.mimetype
        ]
      );

      res.status(201).json({
        mensaje: 'Foto subida exitosamente a Cloudinary',
        foto: result.rows[0]
      });
    } catch (error) {
      console.error('Error subiendo foto a Cloudinary:', error);
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      res.status(500).json({ error: 'Error al subir foto' });
    }
  },

  // Subir PDF para lugar (admin only)
  async subirPDFLugar(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService();
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó archivo PDF' });
      }

      const { lugarId } = req.body;
      
      // Verificar que el lugar existe
      const lugarResult = await pool.query(
        'SELECT id, pdf_url FROM lugares WHERE id = $1',
        [lugarId]
      );
      
      if (lugarResult.rows.length === 0) {
        await fs.unlink(req.file.path);
        return res.status(404).json({ error: 'Lugar no encontrado' });
      }

      // Leer archivo y subir a Cloudinary
      const fileBuffer = await fs.readFile(req.file.path);
      const cloudinaryResult = await cloudinaryService.subirArchivo(
        fileBuffer,
        req.file.filename,
        process.env.CLOUDINARY_PDFS_FOLDER || 'pdfs'
      );

      // Limpiar archivo local
      await fs.unlink(req.file.path);

      // Si ya existe un PDF en Cloudinary, eliminarlo
      const lugar = lugarResult.rows[0];
      if (lugar.pdf_url && cloudinaryService.esUrlCloudinary(lugar.pdf_url)) {
        const publicId = cloudinaryService.extraerPublicId(lugar.pdf_url);
        if (publicId) {
          await cloudinaryService.eliminarArchivo(publicId).catch(console.error);
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
        mensaje: 'PDF subido exitosamente a Cloudinary',
        lugar: result.rows[0]
      });
    } catch (error) {
      console.error('Error subiendo PDF a Cloudinary:', error);
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      res.status(500).json({ error: 'Error al subir PDF' });
    }
  },

  // Eliminar PDF de lugar (admin only)
  async eliminarPDFLugar(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService();
    
    try {
      const { lugarId } = req.params;

      const result = await pool.query(
        'SELECT pdf_url FROM lugares WHERE id = $1',
        [lugarId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Lugar no encontrado' });
      }

      const lugar = result.rows[0];
      
      // Eliminar archivo de Cloudinary si existe
      if (lugar.pdf_url && cloudinaryService.esUrlCloudinary(lugar.pdf_url)) {
        const publicId = cloudinaryService.extraerPublicId(lugar.pdf_url);
        if (publicId) {
          await cloudinaryService.eliminarArchivo(publicId);
        }
      }

      // Actualizar BD
      await pool.query(
        'UPDATE lugares SET pdf_url = NULL, actualizado_en = NOW() WHERE id = $1',
        [lugarId]
      );

      res.json({ mensaje: 'PDF eliminado exitosamente de Cloudinary' });
    } catch (error) {
      console.error('Error eliminando PDF de Cloudinary:', error);
      res.status(500).json({ error: 'Error al eliminar PDF' });
    }
  },

  // Subir experiencia (público)
  async subirExperiencia(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService();
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó imagen' });
      }

      const { descripcion, lugarId } = req.body;

      // Leer archivo y subir a Cloudinary
      const fileBuffer = await fs.readFile(req.file.path);
      const cloudinaryResult = await cloudinaryService.subirArchivo(
        fileBuffer,
        req.file.filename,
        process.env.CLOUDINARY_EXPERIENCIAS_FOLDER || 'experiencias'
      );

      // Limpiar archivo local
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
          cloudinaryResult.width,    // ← number | null (compatible)
          cloudinaryResult.height,   // ← number | null (compatible)
          cloudinaryResult.bytes,
          req.file.mimetype
        ]
      );

      res.status(201).json({
        mensaje: 'Experiencia subida exitosamente a Cloudinary. En proceso de moderación.',
        experiencia: result.rows[0]
      });
    } catch (error) {
      console.error('Error subiendo experiencia a Cloudinary:', error);
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      res.status(500).json({ error: 'Error al subir experiencia' });
    }
  },

  // Eliminar foto de lugar (admin only)
  async eliminarFotoLugar(req: Request, res: Response) {
    const cloudinaryService = new CloudinaryService();
    
    try {
      const { fotoId } = req.params;

      const result = await pool.query(
        'DELETE FROM fotos_lugares WHERE id = $1 RETURNING *',
        [fotoId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Foto no encontrada' });
      }

      const foto = result.rows[0];
      
      // Eliminar archivo de Cloudinary si es una URL de Cloudinary
      if (foto.ruta_almacenamiento && cloudinaryService.esUrlCloudinary(foto.url_foto)) {
        const publicId = cloudinaryService.extraerPublicId(foto.url_foto) || foto.ruta_almacenamiento;
        await cloudinaryService.eliminarArchivo(publicId);
      }

      res.json({ mensaje: 'Foto eliminada exitosamente de Cloudinary' });
    } catch (error) {
      console.error('Error eliminando foto de Cloudinary:', error);
      res.status(500).json({ error: 'Error al eliminar foto' });
    }
  },

  // Marcar foto como principal (sin cambios)
  async marcarFotoPrincipal(req: Request, res: Response) {
    try {
      const { fotoId } = req.params;

      const result = await pool.query(
        'UPDATE fotos_lugares SET es_principal = true WHERE id = $1 RETURNING *',
        [fotoId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Foto no encontrada' });
      }

      res.json({
        mensaje: 'Foto marcada como principal',
        foto: result.rows[0]
      });
    } catch (error) {
      console.error('Error marcando foto principal:', error);
      res.status(500).json({ error: 'Error al marcar foto como principal' });
    }
  }
};