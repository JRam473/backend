import { Request, Response } from 'express';

import { pool } from '../utils/baseDeDatos';
import { generarToken } from '../utils/jwt';
import { compararContraseña, hashContraseña } from '../utils/hashPassword'; // ✅ Usar tu utilidad existente

export const administradorController = {
  // Login local
  async login(req: Request, res: Response) {
    const { email, contraseña } = req.body;
    
    try {
      const result = await pool.query(
        'SELECT * FROM administradores WHERE email = $1 AND contraseña IS NOT NULL',
        [email]
      );
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      
      const admin = result.rows[0];
      const contraseñaValida = await compararContraseña(contraseña, admin.contraseña);
      
      if (!contraseñaValida) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      
      // Actualizar último login
      await pool.query(
        'UPDATE administradores SET ultimo_login = NOW() WHERE id = $1',
        [admin.id]
      );
      
      const token = generarToken({
        id: admin.id,
        email: admin.email,
        rol: admin.rol,
        tipo: 'admin'
      });
      
      res.json({
        token,
        administrador: {
          id: admin.id,
          usuario: admin.usuario,
          email: admin.email,
          rol: admin.rol,
          avatar_url: admin.avatar_url
        }
      });
    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({ error: 'Error en el servidor' });
    }
  },

  // Establecer contraseña para admin existente
  async setPassword(req: Request, res: Response) {
    const { email, password } = req.body;
    
    try {
      // ✅ USAR la función de hash de tu utilidad existente
      const hashedPassword = await hashContraseña(password);
      
      const result = await pool.query(
        `UPDATE administradores 
         SET contraseña = $1, actualizado_en = NOW()
         WHERE email = $2 AND contraseña IS NULL
         RETURNING id, usuario, email, rol, avatar_url`,
        [hashedPassword, email]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Administrador no encontrado o ya tiene contraseña' 
        });
      }
      
      const admin = result.rows[0];
      const token = generarToken({
        id: admin.id,
        email: admin.email,
        rol: admin.rol,
        tipo: 'admin'
      });
      
      res.json({
        message: 'Contraseña establecida exitosamente',
        token,
        administrador: admin
      });
    } catch (error) {
      console.error('Error estableciendo contraseña:', error);
      res.status(500).json({ error: 'Error al establecer contraseña' });
    }
  },

  // Registrar nuevo administrador con contraseña
  async register(req: Request, res: Response) {
    const { email, password, username } = req.body;
    
    try {
      // Verificar si el email ya existe
      const existingAdmin = await pool.query(
        'SELECT id FROM administradores WHERE email = $1',
        [email]
      );
      
      if (existingAdmin.rows.length > 0) {
        return res.status(409).json({ 
          error: 'El administrador ya existe' 
        });
      }
      
      const hashedPassword = await hashContraseña(password);
      
      const result = await pool.query(
        `INSERT INTO administradores 
         (usuario, email, contraseña, proveedor, rol, verificado)
         VALUES ($1, $2, $3, 'local', 'admin', true)
         RETURNING id, usuario, email, rol, avatar_url`,
        [username, email, hashedPassword]
      );
      
      const admin = result.rows[0];
      const token = generarToken({
        id: admin.id,
        email: admin.email,
        rol: admin.rol,
        tipo: 'admin'
      });
      
      res.status(201).json({
        message: 'Administrador registrado exitosamente',
        token,
        administrador: admin
      });
    } catch (error) {
      console.error('Error registrando administrador:', error);
      res.status(500).json({ error: 'Error al registrar administrador' });
    }
  },

  // Perfil del admin
  async obtenerPerfil(req: Request, res: Response) {
    res.json({
      administrador: req.administrador
    });
  }
};