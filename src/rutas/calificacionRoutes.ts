//rutas/calificacionRoutes.ts
import { Router } from 'express';
import { calificacionController } from '../controladores/calificacionController.js';
import { autenticarAdmin } from '../middleware/autenticacion.js';
import { validacion } from '../middleware/validacion.js';

const router = Router();

// Rutas públicas
router.post('/', validacion.validarCalificacion, calificacionController.calificarLugar);
router.get('/lugar/:lugarId/mi-calificacion', calificacionController.obtenerMiCalificacion);

// Rutas protegidas (admin only)
router.get('/lugar/:lugarId', autenticarAdmin, calificacionController.obtenerCalificacionesLugar);

// En tus rutas - AGREGAR ESTA RUTA
// NUEVA RUTA: Estadísticas públicas de calificaciones
router.get('/lugar/:lugarId/estadisticas', calificacionController.obtenerCalificacionesParaEstadisticas);


export default router;