// ✅ rutas/experienciaRoutes.ts (VERSIÓN ACTUALIZADA CON MODERACIÓN)
import { Router } from 'express';
import { experienciaController } from '../controladores/experienciaController';
import { uploadExperienciaMiddleware } from '../utils/multerExperiencias'; // ✅ CORREGIDO: usar el middleware correcto
import { moderacionEnTiempoReal } from '../middleware/moderacionEnTiempoReal';

const router = Router();

// ✅ RUTAS PÚBLICAS (SIN MODERACIÓN)
router.get('/', experienciaController.obtenerExperiencias);
router.get('/:id', experienciaController.obtenerExperienciaPorId);
router.post('/:id/vista', experienciaController.registrarVista);
router.get('/usuario/mis-experiencias', experienciaController.obtenerMisExperiencias);

// ✅ NUEVAS RUTAS DE MODERACIÓN (SIN SUBIDA DE ARCHIVOS)
router.post('/moderacion/validar-texto', experienciaController.validarTextoPrev);
router.get('/moderacion/motivos-rechazo', experienciaController.obtenerMotivosRechazo);


// ✅ RUTAS QUE CREAN CONTENIDO (CON MODERACIÓN)
router.post('/',
  uploadExperienciaMiddleware, // ✅ Multer primero
  moderacionEnTiempoReal,      // Luego moderación
  experienciaController.crearExperiencia // Finalmente el controlador
);

// Para edición (con moderación)
router.put('/:id',
  moderacionEnTiempoReal,
  experienciaController.editarExperiencia
);

// ✅ NUEVA RUTA: Editar experiencia con imagen
router.put(
  '/:id/con-imagen',
  uploadExperienciaMiddleware, // ✅ CORREGIDO: usar el middleware correcto en lugar de 'upload'
  moderacionEnTiempoReal,      // ✅ AGREGAR moderación para la nueva imagen
  experienciaController.editarExperienciaConImagen
);

router.delete('/:id', experienciaController.eliminarExperiencia);

// Rutas protegidas (admin only)
router.get('/admin/estadisticas', experienciaController.obtenerEstadisticas);

export default router;