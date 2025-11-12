//contrladore/cargaArchivosController.ts
import { Request, Response } from 'express';
import { pool } from '../utils/baseDeDatos';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp'; // Necesario para obtener dimensiones de imagen

export const cargaArchivosController = {
  // Subir foto para lugar (admin only)
  async subirFotoLugar(req: Request, res: Response) {
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
        // Eliminar archivo subido si el lugar no existe
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Lugar no encontrado' });
      }

      // Obtener dimensiones de la imagen usando sharp
      let anchoImagen: number | null = null;
      let altoImagen: number | null = null;
      
      try {
        const metadata = await sharp(req.file.path).metadata();
        anchoImagen = metadata.width || null;
        altoImagen = metadata.height || null;
      } catch (sharpError) {
        console.warn('No se pudieron obtener las dimensiones de la imagen:', sharpError);
      }

      // Ruta relativa para acceso web
      const rutaRelativa = `/uploads/images/lugares/${req.file.filename}`;
      
      // Obtener el máximo orden actual para este lugar
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
          rutaRelativa,
          req.file.path,
          descripcion || '',
          esPrincipal === 'true',
          ordenResult.rows[0].siguiente_orden,
          anchoImagen,
          altoImagen,
          req.file.size,
          req.file.mimetype
        ]
      );

      res.status(201).json({
        mensaje: 'Foto subida exitosamente',
        foto: result.rows[0]
      });
    } catch (error) {
      console.error('Error subiendo foto:', error);
      // Limpiar archivo en caso de error
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Error al subir foto' });
    }
  },

  // Subir PDF para lugar (admin only)
  async subirPDFLugar(req: Request, res: Response) {
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
        // Eliminar archivo subido si el lugar no existe
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Lugar no encontrado' });
      }

      // Ruta relativa para acceso web
      const rutaRelativa = `/uploads/pdfs/${req.file.filename}`;

      // Si ya existe un PDF, eliminarlo físicamente
      const lugar = lugarResult.rows[0];
      if (lugar.pdf_url) {
        const rutaAnterior = path.join(__dirname, '../../', lugar.pdf_url);
        if (fs.existsSync(rutaAnterior)) {
          fs.unlinkSync(rutaAnterior);
        }
      }

      const result = await pool.query(
        `UPDATE lugares 
         SET pdf_url = $1, actualizado_en = NOW()
         WHERE id = $2
         RETURNING *`,
        [rutaRelativa, lugarId]
      );

      res.status(201).json({
        mensaje: 'PDF subido exitosamente',
        lugar: result.rows[0]
      });
    } catch (error) {
      console.error('Error subiendo PDF:', error);
      // Limpiar archivo en caso de error
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Error al subir PDF' });
    }
  },

  // Eliminar PDF de lugar (admin only)
  async eliminarPDFLugar(req: Request, res: Response) {
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
      
      // Eliminar archivo físico si existe
      if (lugar.pdf_url) {
        const rutaPDF = path.join(__dirname, '../../', lugar.pdf_url);
        if (fs.existsSync(rutaPDF)) {
          fs.unlinkSync(rutaPDF);
        }
      }

      // Actualizar BD
      await pool.query(
        'UPDATE lugares SET pdf_url = NULL, actualizado_en = NOW() WHERE id = $1',
        [lugarId]
      );

      res.json({ mensaje: 'PDF eliminado exitosamente' });
    } catch (error) {
      console.error('Error eliminando PDF:', error);
      res.status(500).json({ error: 'Error al eliminar PDF' });
    }
  },

  // Subir experiencia (público)
  async subirExperiencia(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó imagen' });
      }

      const { descripcion, lugarId } = req.body;

      // Obtener dimensiones de la imagen usando sharp
      let anchoImagen: number | null = null;
      let altoImagen: number | null = null;
      
      try {
        const metadata = await sharp(req.file.path).metadata();
        anchoImagen = metadata.width || null;
        altoImagen = metadata.height || null;
      } catch (sharpError) {
        console.warn('No se pudieron obtener las dimensiones de la imagen:', sharpError);
      }

      // Ruta relativa para acceso web
      const rutaRelativa = `/uploads/images/experiencias/${req.file.filename}`;

      const result = await pool.query(
        `INSERT INTO experiencias 
         (url_foto, descripcion, ruta_almacenamiento, lugar_id,
          ancho_imagen, alto_imagen, tamaño_archivo, tipo_archivo, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendiente')
         RETURNING *`,
        [
          rutaRelativa,
          descripcion || '',
          req.file.path,
          lugarId || null,
          anchoImagen,
          altoImagen,
          req.file.size,
          req.file.mimetype
        ]
      );

      res.status(201).json({
        mensaje: 'Experiencia subida exitosamente. En proceso de moderación.',
        experiencia: result.rows[0]
      });
    } catch (error) {
      console.error('Error subiendo experiencia:', error);
      // Limpiar archivo en caso de error
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Error al subir experiencia' });
    }
  },

  // Eliminar foto de lugar (admin only)
  async eliminarFotoLugar(req: Request, res: Response) {
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
      
      // Eliminar archivo físico
      if (fs.existsSync(foto.ruta_almacenamiento)) {
        fs.unlinkSync(foto.ruta_almacenamiento);
      }

      res.json({ mensaje: 'Foto eliminada exitosamente' });
    } catch (error) {
      console.error('Error eliminando foto:', error);
      res.status(500).json({ error: 'Error al eliminar foto' });
    }
  },

  // Marcar foto como principal (admin only)
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