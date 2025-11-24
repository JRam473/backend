// utils/multerConfig.ts - VERSIÓN CORREGIDA CON CREACIÓN DE DIRECTORIOS
import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import fs from 'fs';

// ✅ FUNCIÓN PARA CREAR DIRECTORIOS DE FORMA SÍNCRONA
const ensureDirectoryExists = (directoryPath: string): void => {
  try {
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
      console.log('📁 Directorio creado:', directoryPath);
    }
  } catch (error) {
    console.error('❌ Error creando directorio:', directoryPath, error);
    throw error;
  }
};

// ✅ CONFIGURACIÓN DE ALMACENAMIENTO PARA IMÁGENES (CORREGIDA)
const imageStorage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    const uploadDir = 'uploads/images/lugares/';
    
    try {
      // ✅ CREAR DIRECTORIO SI NO EXISTE
      ensureDirectoryExists(uploadDir);
      console.log('📁 Guardando imagen en:', uploadDir);
      cb(null, uploadDir);
    } catch (error) {
      console.error('❌ Error configurando destino de imagen:', error);
      cb(error as Error, uploadDir);
    }
  },
  filename: (req: Request, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `imagen-${uniqueSuffix}${ext}`;
    
    console.log('📝 Guardando imagen como:', filename);
    console.log('📝 Archivo original:', file.originalname);
    console.log('📝 MIME type:', file.mimetype);
    
    cb(null, filename);
  }
});

// ✅ CONFIGURACIÓN DE ALMACENAMIENTO PARA PDFs (CORREGIDA)
const pdfStorage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    const uploadDir = 'uploads/pdfs/';
    
    try {
      // ✅ CREAR DIRECTORIO SI NO EXISTE
      ensureDirectoryExists(uploadDir);
      console.log('📁 Guardando PDF en:', uploadDir);
      cb(null, uploadDir);
    } catch (error) {
      console.error('❌ Error configurando destino de PDF:', error);
      cb(error as Error, uploadDir);
    }
  },
  filename: (req: Request, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `pdf-${uniqueSuffix}.pdf`;
    
    console.log('📝 Guardando PDF como:', filename);
    cb(null, filename);
  }
});

// ✅ CONFIGURACIÓN DE ALMACENAMIENTO PARA EXPERIENCIAS
const experienciaStorage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    const uploadDir = 'uploads/experiencias/';
    
    try {
      // ✅ CREAR DIRECTORIO SI NO EXISTE
      ensureDirectoryExists(uploadDir);
      console.log('📁 Guardando experiencia en:', uploadDir);
      cb(null, uploadDir);
    } catch (error) {
      console.error('❌ Error configurando destino de experiencia:', error);
      cb(error as Error, uploadDir);
    }
  },
  filename: (req: Request, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `experiencia-${uniqueSuffix}${ext}`;
    
    console.log('📝 Guardando experiencia como:', filename);
    cb(null, filename);
  }
});

// ✅ CONFIGURACIÓN DE ALMACENAMIENTO PARA TEMPORALES (análisis)
const tempStorage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    const uploadDir = 'uploads/temp/';
    
    try {
      // ✅ CREAR DIRECTORIO SI NO EXISTE
      ensureDirectoryExists(uploadDir);
      console.log('📁 Guardando temporal en:', uploadDir);
      cb(null, uploadDir);
    } catch (error) {
      console.error('❌ Error configurando destino temporal:', error);
      cb(error as Error, uploadDir);
    }
  },
  filename: (req: Request, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `temp-${uniqueSuffix}${ext}`;
    
    console.log('📝 Guardando temporal como:', filename);
    cb(null, filename);
  }
});

// ✅ FILTROS DE ARCHIVOS (sin cambios)
const imageFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  console.log('🔍 [MULTER FILTER] Procesando archivo:', {
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
    console.log('✅ [MULTER FILTER] Archivo aceptado');
    cb(null, true);
  } else {
    console.error('❌ [MULTER FILTER] Tipo de archivo no permitido:', file.mimetype);
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo se permiten: ${allowedMimes.join(', ')}`));
  }
};

const pdfFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'application/pdf') {
    console.log('✅ [MULTER FILTER] PDF aceptado');
    cb(null, true);
  } else {
    console.error('❌ [MULTER FILTER] Tipo de archivo no permitido para PDF:', file.mimetype);
    cb(new Error('Solo se permiten archivos PDF'));
  }
};

// ✅ CONFIGURACIONES DE MULTER
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

export const uploadExperiencia = multer({
  storage: experienciaStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  }
});

export const uploadTemp = multer({
  storage: tempStorage,
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Aceptar tanto imágenes como PDFs para análisis temporal
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      console.log('✅ [MULTER TEMP] Archivo aceptado para análisis:', file.mimetype);
      cb(null, true);
    } else {
      console.error('❌ [MULTER TEMP] Tipo de archivo no permitido:', file.mimetype);
      cb(new Error(`Tipo de archivo no permitido para análisis: ${file.mimetype}`));
    }
  },
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

// ✅ FUNCIÓN PARA INICIALIZAR DIRECTORIOS AL INICIAR LA APLICACIÓN
export const initializeUploadDirectories = (): void => {
  console.log('📁 Inicializando directorios de upload...');
  
  const directories = [
    'uploads/images/lugares/',
    'uploads/pdfs/',
    'uploads/experiencias/',
    'uploads/temp/',
    'uploads/images/experiencias/'
  ];
  
  directories.forEach(dir => {
    try {
      ensureDirectoryExists(dir);
    } catch (error) {
      console.error(`❌ Error inicializando directorio ${dir}:`, error);
    }
  });
  
  console.log('✅ Directorios de upload inicializados');
};