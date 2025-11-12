// utils/multerConfig.ts
import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import fs from 'fs';

// Configuración de almacenamiento para imágenes
const imageStorage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    const uploadDir = 'uploads/images/lugares/';
    
    // Asegurar que el directorio existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('📁 Directorio creado:', uploadDir);
    }
    
    console.log('📁 Guardando en directorio:', uploadDir);
    cb(null, uploadDir);
  },
  filename: (req: Request, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `imagen-${uniqueSuffix}${ext}`;
    
    console.log('📝 Guardando archivo como:', filename);
    console.log('📝 Archivo original:', file.originalname);
    console.log('📝 MIME type:', file.mimetype);
    
    cb(null, filename);
  }
});

// Configuración de almacenamiento para PDFs
const pdfStorage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    cb(null, 'uploads/pdfs/');
  },
  filename: (req: Request, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'pdf-' + uniqueSuffix + '.pdf');
  }
});

// Filtros de archivos
const imageFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  console.log('🔍 [MULTER FILTER] Procesando archivo:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname
  });

  const allowedMimes = [
    'image/jpeg', 
    'image/jpg',  // ← AÑADIDO explícitamente
    'image/png', 
    'image/webp',
    'image/gif'   // ← AÑADIDO temporalmente para debug
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    console.log('✅ [MULTER FILTER] Archivo aceptado');
    cb(null, true);
  } else {
    console.error('❌ [MULTER FILTER] Tipo de archivo no permitido:', file.mimetype);
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo se permiten: ${allowedMimes.join(', ')}`));
  }
};

const pdfFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PDF'));
  }
};

// Configuraciones de multer
export const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB límite
  }
});

export const uploadPDF = multer({
  storage: pdfStorage,
  fileFilter: pdfFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB límite
  }
});

export const uploadMultipleImages = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  }
}).array('imagenes', 10); // Máximo 10 imágenes