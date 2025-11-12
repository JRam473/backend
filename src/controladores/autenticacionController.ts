import { Request, Response } from 'express';
import { pool } from '../utils/baseDeDatos';
import { generarToken } from '../utils/jwt';

export const autenticacionController = {
  async callbackGoogle(req: Request, res: Response) {
    try {
      const profile = req.user as any;
      const adminEmail = process.env.ADMIN_EMAIL;
      
      console.log('🔐 Perfil completo de Google recibido:', profile);
      
      // ✅ Obtener email de forma segura
      const userEmail = profile.emails?.[0]?.value;
      
      if (!userEmail) {
        console.error('❌ Email no disponible en el perfil de Google');
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_email`);
      }
      
      console.log('📧 Email obtenido:', userEmail);
      console.log('📧 Email autorizado:', adminEmail);
      
      // Solo permitir el email autorizado
      if (userEmail !== adminEmail) {
        console.log('❌ Email no autorizado:', userEmail);
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=unauthorized`);
      }
      
      // Upsert del administrador
      const result = await pool.query(
        `INSERT INTO administradores (usuario, email, proveedor, id_proveedor, avatar_url, rol, verificado)
         VALUES ($1, $2, 'google', $3, $4, 'super_admin', true)
         ON CONFLICT (email) 
         DO UPDATE SET 
           usuario = EXCLUDED.usuario,
           avatar_url = EXCLUDED.avatar_url,
           ultimo_login = NOW(),
           actualizado_en = NOW()
         RETURNING *`,
        [
          profile.displayName || userEmail.split('@')[0],
          userEmail,
          profile.id,
          profile.photos?.[0]?.value
        ]
      );
      
      const admin = result.rows[0];
      const token = generarToken({
        id: admin.id,
        email: admin.email,
        rol: admin.rol,
        tipo: 'admin'
      });
      
      console.log('✅ Administrador autenticado:', admin.email);
      
      // ✅ OBTENER LA RUTA ORIGINAL DEL ESTADO
      const originalPath = profile._originalPath || '/';
      console.log('📍 Ruta original recuperada:', originalPath);
      
      // ✅ REDIRIGIR CON LA RUTA ORIGINAL EN EL ESTADO
      const redirectUrl = `${process.env.FRONTEND_URL}/oauth-callback?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(originalPath)}`;
      console.log('🔄 Redirigiendo a:', redirectUrl);
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('❌ Error en callback Google:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
    }
  }
};