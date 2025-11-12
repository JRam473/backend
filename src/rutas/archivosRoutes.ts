// rutas/archivosRoutes.ts
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { cargaArchivosController } from '../controladores/cargaArchivosController';
import { autenticarAdmin } from '../middleware/autenticacion';
import { validacion } from '../middleware/validacion';

const router = Router();

// Configuración de multer para fotos de lugares (admin only)
const storageLugares = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../images/lugares'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'lugar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configuración de multer para experiencias (público)
const storageExperiencias = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../images/experiencias'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'experiencia-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configuración de multer para PDFs de lugares (admin only)
const storagePDFs = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../pdfs/lugares'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'pdf-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadLugar = multer({ 
  storage: storageLugares,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (tiposPermitidos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Use JPEG, PNG o WebP'));
    }
  }
});

const uploadExperiencia = multer({ 
  storage: storageExperiencias,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (tiposPermitidos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Use JPEG, PNG o WebP'));
    }
  }
});

const uploadPDF = multer({
  storage: storagePDFs,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB para PDFs
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'));
    }
  }
});

// Manejo de errores de multer
const manejarErrorMulter = (error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande' });
    }
  } else if (error) {
    return res.status(400).json({ error: error.message });
  }
  next();
};

// ========== RUTAS PARA FOTOS DE LUGARES (Admin only) ==========
router.post('/lugares/fotos', 
  autenticarAdmin, 
  uploadLugar.single('foto'), 
  manejarErrorMulter,
  validacion.validarArchivoImagen, 
  cargaArchivosController.subirFotoLugar
);

router.delete('/lugares/fotos/:fotoId', 
  autenticarAdmin, 
  cargaArchivosController.eliminarFotoLugar
);

router.patch('/lugares/fotos/:fotoId/principal', 
  autenticarAdmin, 
  cargaArchivosController.marcarFotoPrincipal
);

// ========== RUTAS PARA PDFs DE LUGARES (Admin only) ==========
router.post('/lugares/pdf', 
  autenticarAdmin, 
  uploadPDF.single('pdf'), 
  manejarErrorMulter,
  validacion.validarArchivoPDF,
  cargaArchivosController.subirPDFLugar
);

router.delete('/lugares/pdf/:lugarId', 
  autenticarAdmin, 
  cargaArchivosController.eliminarPDFLugar
);

// ========== RUTA PÚBLICA PARA SUBIR EXPERIENCIAS ==========
router.post('/experiencias', 
  uploadExperiencia.single('foto'), 
  manejarErrorMulter,
  validacion.validarArchivoImagen, 
  validacion.validarExperiencia, 
  cargaArchivosController.subirExperiencia
);

export default router;