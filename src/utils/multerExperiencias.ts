// utils/multerExperiencias.ts
import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import fs from 'fs';

// Configuración de almacenamiento para imágenes de experiencias
const experienciaStorage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    const uploadDir = 'uploads/images/experiencias/';
    
    // Asegurar que el directorio existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('📁 Directorio creado:', uploadDir);
    }
    
    console.log('📁 Guardando imagen de experiencia en:', uploadDir);
    cb(null, uploadDir);
  },
  filename: (req: Request, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `experiencia-${uniqueSuffix}${ext}`;
    
    console.log('📝 Guardando archivo como:', filename);
    console.log('📝 Archivo original:', file.originalname);
    console.log('📝 MIME type:', file.mimetype);
    
    cb(null, filename);
  }
});

// Filtro de archivos para experiencias
const experienciaFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  console.log('🔍 [MULTER EXPERIENCIAS] Procesando archivo:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname
  });

  const allowedMimes = [
    'image/jpeg', 
    'image/jpg',
    'image/png', 
    'image/webp',
    'image/gif'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    console.log('✅ [MULTER EXPERIENCIAS] Archivo aceptado');
    cb(null, true);
  } else {
    console.error('❌ [MULTER EXPERIENCIAS] Tipo de archivo no permitido:', file.mimetype);
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo se permiten: ${allowedMimes.join(', ')}`));
  }
};

// Configuración de multer para experiencias
export const uploadExperiencia = multer({
  storage: experienciaStorage,
  fileFilter: experienciaFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB límite
  }
});

// Middleware específico para subir una imagen de experiencia
export const uploadExperienciaMiddleware = uploadExperiencia.single('imagen');