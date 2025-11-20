import { Router } from 'express';
import { administradorController } from '../controladores/administradorController.js';
import { autenticarAdmin } from '../middleware/autenticacion.js';

const router = Router();

// Login local
router.post('/login', administradorController.login);

// Registrar nuevo admin
router.post('/register', administradorController.register);

// Establecer contraseña para admin existente
router.post('/set-password', administradorController.setPassword);

// Rutas protegidas
router.get('/perfil', autenticarAdmin, administradorController.obtenerPerfil);

export default router;