// services/cloudinaryService.ts - VERSIÓN COMPLETA Y CORREGIDA
import { v2 as cloudinary } from 'cloudinary';
import stream from 'stream';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  format: string;
  resource_type: string;
  bytes: number;
  width: number | null;
  height: number | null;
  folder: string;
}

export class CloudinaryService {
  constructor() {
    this.configurarCloudinary();
  }

  private configurarCloudinary(): void {
    try {
      console.log('🔧 Configurando Cloudinary...');
      
      const cloudinaryUrl = process.env.CLOUDINARY_URL;
      
      if (cloudinaryUrl && cloudinaryUrl.includes('cloudinary://')) {
        console.log('✅ Usando CLOUDINARY_URL');
        cloudinary.config(cloudinaryUrl);
        return;
      }

      console.log('🔄 CLOUDINARY_URL no encontrada, usando variables individuales');
      
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      if (!cloudName || !apiKey || !apiSecret) {
        throw new Error('Faltan credenciales de Cloudinary');
      }

      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true
      });

      console.log('✅ Cloudinary configurado con variables individuales');
      console.log(`📊 Cloud Name: ${cloudName}`);
      console.log(`🔑 API Key: ${apiKey.substring(0, 8)}...`);

    } catch (error) {
      console.error('❌ Error configurando Cloudinary:', error);
      throw error;
    }
  }

  async subirArchivo(
    fileBuffer: Buffer,
    fileName: string,
    folder: string = 'general',
    esPDF: boolean = false
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      console.log(`📤 Subiendo: ${fileName} a folder: ${folder}, tipo: ${esPDF ? 'PDF' : 'auto'}`);

      // CONFIGURACIÓN ESPECIAL PARA PDFs
      const uploadOptions: any = {
        folder: folder,
        public_id: this.generarPublicId(fileName),
      };

      if (esPDF) {
        // ✅ CONFIGURACIÓN ESPECÍFICA PARA PDFs
        uploadOptions.resource_type = 'raw'; // IMPORTANTE: 'raw' para PDFs
        uploadOptions.type = 'upload';
        uploadOptions.access_mode = 'public'; // Asegurar acceso público
        uploadOptions.invalidate = true; // Forzar refresco CDN
      } else {
        uploadOptions.resource_type = 'auto'; // Para imágenes, videos, etc.
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('❌ Error subiendo a Cloudinary:', error);
            reject(error);
          } else if (result) {
            console.log('✅ Archivo subido exitosamente');
            console.log('📊 Detalles del upload:', {
              url: result.secure_url,
              resource_type: result.resource_type,
              format: result.format,
              bytes: result.bytes
            });
            
            const uploadResult: CloudinaryUploadResult = {
              secure_url: result.secure_url || '',
              public_id: result.public_id || '',
              format: result.format || (esPDF ? 'pdf' : 'jpg'),
              resource_type: result.resource_type || (esPDF ? 'raw' : 'image'),
              bytes: result.bytes || 0,
              width: result.width ?? null,
              height: result.height ?? null,
              folder: folder
            };
            
            resolve(uploadResult);
          } else {
            reject(new Error('No result from Cloudinary'));
          }
        }
      );

      // Manejo de errores en el stream
      uploadStream.on('error', (error) => {
        console.error('❌ Error en stream de upload:', error);
        reject(error);
      });

      const bufferStream = new stream.PassThrough();
      bufferStream.end(fileBuffer);
      bufferStream.pipe(uploadStream);
    });
  }

  /**
   * MÉTODO ESPECÍFICO PARA SUBIR PDFs
   */
  async subirPDF(
    fileBuffer: Buffer,
    fileName: string,
    folder: string = 'pdfs_lugares'
  ): Promise<CloudinaryUploadResult> {
    console.log('📄 Subiendo PDF con configuración específica...');
    
    return this.subirArchivo(fileBuffer, fileName, folder, true);
  }

  /**
   * Eliminar archivo de Cloudinary
   */
  async eliminarArchivo(publicId: string, resourceType: string = 'image'): Promise<void> {
    try {
      const options = {
        resource_type: resourceType,
        invalidate: true
      };
      
      await cloudinary.uploader.destroy(publicId, options);
      console.log('✅ Archivo eliminado de Cloudinary:', publicId);
    } catch (error) {
      console.error('❌ Error eliminando archivo de Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Eliminar PDF específicamente
   */
  async eliminarPDF(publicId: string): Promise<void> {
    return this.eliminarArchivo(publicId, 'raw');
  }

  /**
   * Extraer public_id desde URL de Cloudinary
   */
  extraerPublicId(url: string): string | null {
    try {
      const matches = url.match(/\/upload\/(?:v\d+\/)?([^\.]+)/);
      return matches && matches[1] ? matches[1] : null;
    } catch (error) {
      console.error('Error extrayendo public_id:', error);
      return null;
    }
  }

  /**
   * Verificar si una URL es de Cloudinary
   */
  esUrlCloudinary(url: string): boolean {
    return url.includes('cloudinary.com');
  }

  /**
   * Verificar si un archivo es accesible públicamente
   */
  async verificarAccesoArchivo(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const esAccesible = response.ok;
      const contentType = response.headers.get('content-type');
      
      console.log('📊 Estado de verificación archivo:', {
        url: url,
        status: response.status,
        ok: response.ok,
        contentType: contentType,
        accesible: esAccesible
      });

      return esAccesible;
    } catch (error) {
      console.error('❌ Error verificando acceso al archivo:', error);
      return false;
    }
  }

  /**
   * ✅ MÉTODO IMPLEMENTADO: Verificar acceso específico para PDFs
   */
  async verificarAccesoPDF(url: string): Promise<boolean> {
    try {
      console.log('🔍 Verificando acceso específico para PDF:', url);
      
      const response = await fetch(url, { 
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/pdf, */*'
        }
      });
      
      const esAccesible = response.ok;
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      
      console.log('📊 Estado de verificación PDF:', {
        url: url,
        status: response.status,
        ok: response.ok,
        contentType: contentType,
        contentLength: contentLength,
        accesible: esAccesible
      });

      // Verificación adicional: si es un PDF válido
      if (esAccesible && contentType && contentType.includes('application/pdf')) {
        console.log('✅ PDF accesible y con tipo de contenido correcto');
        return true;
      } else if (esAccesible) {
        console.warn('⚠️ Archivo accesible pero tipo de contenido inesperado:', contentType);
        return true; // Aún así considerar accesible
      }

      return esAccesible;
    } catch (error) {
      console.error('❌ Error verificando acceso al PDF:', error);
      return false;
    }
  }

  /**
   * Generar URL optimizada para visualización de PDFs
   */
  generarUrlVisualizacionPDF(publicId: string): string {
    const url = cloudinary.url(publicId, {
      resource_type: 'raw',
      type: 'upload',
      flags: 'attachment', // Forzar descarga en lugar de vista previa
      secure: true
    });

    console.log('🔗 URL generada para PDF:', {
      publicId,
      url
    });

    return url;
  }

  private generarPublicId(fileName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    // Limpiar nombre para Cloudinary
    const cleanName = nameWithoutExt
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 100);
      
    return `${cleanName}_${timestamp}_${random}`;
  }
}