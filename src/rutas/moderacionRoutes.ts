  import { Router } from 'express';
  import { moderacionController } from '../controladores/moderacionController.js';
  import { uploadExperienciaMiddleware } from '../utils/multerExperiencias.js';
  // Si tienes middleware de autenticación admin, impórtalo aquí

  const router = Router();

  // 🔍 RUTAS PÚBLICAS PARA VALIDACIÓN
  // ✅ CORREGIDO: No usar .single() porque uploadExperienciaMiddleware ya lo incluye
  router.post(
    '/validar-imagen',
    uploadExperienciaMiddleware, // ← Ya incluye .single('imagen') internamente
    moderacionController.validarImagenPrev
  );


  // 📊 RUTAS DE ANÁLISIS (pueden ser públicas o protegidas)
  router.post(
    '/analizar-imagen',
    uploadExperienciaMiddleware, // ← Ya incluye .single('imagen') internamente
    moderacionController.analizarImagen
  );

  // 📋 RUTAS ADMIN PARA LOGS Y ESTADÍSTICAS
  router.get('/admin/logs-imagenes', moderacionController.obtenerLogsImagenes);
  router.get('/admin/estadisticas-imagenes', moderacionController.obtenerEstadisticasImagenes);
  router.get('/admin/estadisticas-vista', moderacionController.obtenerEstadisticasVista);
  router.delete('/admin/limpiar-logs', moderacionController.limpiarLogsAntiguos);

  export default router;