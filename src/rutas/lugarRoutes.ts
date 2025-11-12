// rutas/lugarRoutes.ts - VERSIÓN CORREGIDA
import { Router } from 'express';
import { lugarController } from '../controladores/lugarController';
import { autenticarAdmin } from '../middleware/autenticacion';
import { validacion } from '../middleware/validacion';
import { uploadImage, uploadPDF, uploadMultipleImages } from '../utils/multerConfig';

const router = Router();

// ==================== RUTAS PÚBLICAS ====================
router.get('/', lugarController.obtenerLugares);
router.get('/categorias', lugarController.obtenerCategorias);
router.get('/:id', lugarController.obtenerLugarPorId);
router.get('/:id/galeria', lugarController.obtenerGaleriaLugar);

// ==================== RUTAS DE MODERACIÓN (PÚBLICAS/PROTEGIDAS) ====================
router.post('/moderacion/validar-texto', lugarController.validarTextoPrev);
router.get('/moderacion/motivos-rechazo', lugarController.obtenerMotivosRechazo);
router.post('/moderacion/analizar-texto', lugarController.analizarTexto);
router.post('/moderacion/validar-descripcion-foto', lugarController.validarDescripcionFotoPrev);
router.post('/moderacion/analizar-descripcion-foto', lugarController.analizarDescripcionFoto);

// ==================== RUTAS PROTEGIDAS (ADMIN ONLY) ====================

// ✅ NUEVA: Ruta para subir PDF temporal (para creación de lugares)
router.post('/pdf-temporal', 
  autenticarAdmin, 
  uploadPDF.single('pdf'),
  validacion.validarArchivoPDF,
  lugarController.subirPDFTemporal  // ← Esta función debe existir en el controlador
);

// ✅ CORREGIDO: Ruta para validación previa de cambios
router.post('/:id/validar-cambios',
  autenticarAdmin,
  lugarController.validarCambiosLugar
);

// Crear lugar CON soporte para imagen
router.post('/', 
  autenticarAdmin, 
  uploadImage.single('imagen'),
  validacion.validarCrearLugar, 
  lugarController.crearLugar
);

// ✅ CORREGIDO: Usar validación específica para actualización
router.put('/:id', 
  autenticarAdmin, 
  validacion.validarActualizarLugar,
  lugarController.actualizarLugar
);

// Eliminar lugar (admin)
router.delete('/:id', 
  autenticarAdmin, 
  lugarController.eliminarLugar
);

// Subir imagen principal (admin)
router.post('/:id/imagen', 
  autenticarAdmin, 
  uploadImage.single('imagen'),
  validacion.validarArchivoImagen,
  lugarController.subirImagenLugar
);

// Subir múltiples imágenes (admin)
router.post('/:id/imagenes', 
  autenticarAdmin, 
  uploadMultipleImages,
  lugarController.subirMultipleImagenesLugar
);

// Subir PDF (admin)
router.post('/:id/pdf-con-moderacion', 
  autenticarAdmin, 
  uploadPDF.single('pdf'),
  validacion.validarArchivoPDF,
  lugarController.subirPDFLugarConModeracion  
);

// Eliminar imagen de galería (admin)
router.delete('/:id/galeria/:imagenId', 
  autenticarAdmin, 
  lugarController.eliminarImagenGaleria
);

// Establecer imagen como principal (admin)
router.put('/:id/galeria/:imagenId/principal', 
  autenticarAdmin, 
  lugarController.establecerImagenPrincipal
);

// Actualizar descripción de imagen CON moderación
router.put('/:id/galeria/:imagenId/descripcion', 
  autenticarAdmin, 
  lugarController.actualizarDescripcionImagen
);

// Eliminar imagen principal (con reemplazo)
router.delete('/:id/imagen-principal', 
  autenticarAdmin, 
  lugarController.eliminarImagenPrincipal
);

// Eliminar PDF
router.delete('/:id/pdf',
  autenticarAdmin,
  lugarController.eliminarPDFLugar
);

// Reemplazar imagen principal (admin)
router.put('/:id/imagen-principal', 
  autenticarAdmin,
  uploadImage.single('imagen'),
  validacion.validarArchivoImagen,
  lugarController.reemplazarImagenPrincipal
);

export default router;