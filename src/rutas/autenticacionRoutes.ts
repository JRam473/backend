import { Router } from 'express';
import passport from '../utils/oauth.js';
import { autenticacionController } from '../controladores/autenticacionController.js';

const router = Router();

// Iniciar flujo OAuth con Google - Permitir estado
router.get('/google', (req, res, next) => {
  // ✅ Solución: Asegurar que el state sea string
  const state = typeof req.query.state === 'string' ? req.query.state : '/';
  
  console.log('🔐 Iniciando OAuth con estado:', state);
  
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    state: state // ✅ Ahora es siempre string
  })(req, res, next);
});

// Callback después de la autenticación de Google
router.get('/google/callback', 
  passport.authenticate('google', { 
    session: false,
    failureRedirect: '/login' // ✅ Opcional: agregar redirección en caso de error
  }),
  autenticacionController.callbackGoogle
);

export default router;