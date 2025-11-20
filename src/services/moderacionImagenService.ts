// services/moderacionImagenService.ts - VERSIÓN CON CLIP INTEGRADO (CORREGIDA)
import { CloudinaryService } from './cloudinaryService.js';
import { pool } from '../utils/baseDeDatos.js';
import fs from 'fs';
import path from 'path';

// ✅ NUEVO: Importar servicios CLIP integrados
import { clipAnalyzerService } from './ClipAnalyzerService.js';
import { clipImageDownloader } from './ClipImageDownloader.js';
import { ClipAnalysisResult } from '../types/ClipTypes.js';

const fsPromises = fs.promises;

export interface TempImageResult {
  success: boolean;
  tempPath?: string;
  filename?: string;
  error?: string;
}

export interface ImageModerationResult {
  esAprobado: boolean;
  motivoRechazo?: string;
  puntuacionRiesgo: number;
  detalles?: any;
  tempPath?: string;
  rutaFinal?: string;
  cloudinaryUrl?: string;
  publicId?: string;
}

export interface ImageModerationOptions {
  tipoContenido: 'experiencia' | 'lugar' | 'pdf' | 'general';
  idContenido?: string | number | undefined;
  usarCloudinary?: boolean;
}

export class ModeracionImagenService {
  private cloudinaryService: CloudinaryService;
  private tempDir: string;
  private clipInicializado: boolean = false;

  constructor() {
    this.cloudinaryService = new CloudinaryService();
    this.tempDir = path.join(process.cwd(), 'temp_images');
    this.ensureTempDir();
  }

  /**
   * ✅ INICIALIZAR CLIP (llamar desde server.ts)
   */
  async inicializar(): Promise<void> {
    if (this.clipInicializado) return;

    console.log('🔄 Inicializando moderación de imágenes con CLIP...');
    this.clipInicializado = await clipAnalyzerService.inicializarModelos();
    
    if (this.clipInicializado) {
      console.log('✅ Moderación de imágenes CLIP inicializada');
    } else {
      console.error('❌ No se pudo inicializar CLIP para moderación de imágenes');
    }
  }

  /**
   * ✅ VERIFICAR SI CLIP ESTÁ LISTO
   */
  private async verificarClipListo(): Promise<boolean> {
    if (!this.clipInicializado) {
      await this.inicializar();
    }
    return clipAnalyzerService.estaListo();
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      console.log('📁 Directorio temporal de imágenes creado:', this.tempDir);
    }
  }

  /**
   * ✅ MÉTODO COMPATIBLE PARA PDF ANALYSIS SERVICE
   */
  async moderarImagen(
    imagePath: string, 
    ipUsuario: string, 
    hashNavegador: string
  ): Promise<ImageModerationResult> {
    console.log(`🖼️ Moderación compatible: ${imagePath}`);
    
    const esCloudinary = imagePath.includes('cloudinary.com');
    
    const options: ImageModerationOptions = {
      tipoContenido: 'pdf',
      idContenido: undefined,
      usarCloudinary: esCloudinary
    };
    
    return await this.moderarImagenConOpciones(imagePath, ipUsuario, hashNavegador, options);
  }

  /**
   * ✅ MÉTODO PRINCIPAL CON OPCIONES (AHORA USANDO CLIP INTEGRADO)
   */
  async moderarImagenConOpciones(
    imagePath: string, 
    ipUsuario: string, 
    hashNavegador: string,
    options: ImageModerationOptions
  ): Promise<ImageModerationResult> {
    console.log(`🖼️ Moderación con CLIP integrado: ${imagePath} para ${options.tipoContenido}`);
    
    // Si es una URL de Cloudinary, analizarla directamente
    if (this.esUrlCloudinary(imagePath)) {
      console.log('🌐 Detectada URL de Cloudinary, analizando directamente...');
      return await this.moderarImagenCloudinary(imagePath, ipUsuario, hashNavegador, options);
    }
    
    // Si es una ruta temporal, usar el método temporal
    if (imagePath.includes('temp_images')) {
      return await this.moderarImagenTemporal(imagePath, ipUsuario, hashNavegador, options);
    }
    
    // Para rutas locales normales
    try {
      const clipListo = await this.verificarClipListo();
      
      if (!clipListo) {
        console.warn('⚠️ CLIP integrado no disponible');
        return await this.metodoFallbackServidorNoDisponible(imagePath, ipUsuario, hashNavegador, options);
      }

      // ✅ NUEVO: Usar CLIP integrado en lugar de servidor externo
      const resultado = await this.analizarImagenConClip(imagePath);

      await this.registrarLogModeracionImagen({
        imagePath,
        ipUsuario,
        hashNavegador,
        resultado,
        esAprobado: resultado.es_apto,
        tipoContenido: options.tipoContenido,
        
      });

      if (!resultado.es_apto) {
        const motivo = this.generarMotivoRechazoClip(resultado);
        return {
          esAprobado: false,
          motivoRechazo: motivo,
          puntuacionRiesgo: resultado.puntuacion_riesgo,
          detalles: resultado
        };
      }

      return {
        esAprobado: true,
        puntuacionRiesgo: resultado.puntuacion_riesgo,
        detalles: resultado
      };

    } catch (error) {
      console.error('❌ Error en moderación de imagen con CLIP:', error);
      return await this.metodoFallbackServidorNoDisponible(imagePath, ipUsuario, hashNavegador, options);
    }
  }

  /**
   * ✅ NUEVO: Analizar imagen usando CLIP integrado
   */
  private async analizarImagenConClip(imagePath: string): Promise<ClipAnalysisResult> {
    console.log(`🔍 Analizando con CLIP integrado: ${imagePath}`);
    
    // Determinar tipo de imagen y preparar ruta
    let rutaAnalisis: string;
    let tipoOrigen: 'url' | 'local';

    if (clipImageDownloader.esUrl(imagePath)) {
      console.log(`🌐 Descargando imagen desde URL: ${imagePath}`);
      const descarga = await clipImageDownloader.descargarImagenDesdeUrl(imagePath);
      
      if (!descarga.success || !descarga.tempPath) {
        throw new Error(descarga.error || 'Error desconocido al descargar imagen');
      }
      
      rutaAnalisis = descarga.tempPath;
      tipoOrigen = 'url';
    } else {
      const verificacion = await clipImageDownloader.verificarArchivoLocal(imagePath);
      
      if (!verificacion.success || !verificacion.tempPath) {
        throw new Error(verificacion.error || 'Error verificando archivo local');
      }
      
      rutaAnalisis = verificacion.tempPath;
      tipoOrigen = 'local';
    }

    try {
      // Realizar análisis con CLIP
      const resultado = await clipAnalyzerService.analizarImagen(rutaAnalisis);

      // ✅ CORREGIDO: Usar fsPromises.unlink en lugar de fs.unlink
      if (tipoOrigen === 'url' && rutaAnalisis !== imagePath) {
        await fsPromises.unlink(rutaAnalisis).catch(error => 
          console.warn(`⚠️ No se pudo eliminar archivo temporal: ${error.message}`)
        );
      }

      return resultado;
    } catch (error) {
      // ✅ CORREGIDO: Usar fsPromises.unlink en lugar de fs.unlink
      if (tipoOrigen === 'url' && rutaAnalisis !== imagePath) {
        await fsPromises.unlink(rutaAnalisis).catch(error => 
          console.warn(`⚠️ No se pudo eliminar archivo temporal: ${error.message}`)
        );
      }
      throw error;
    }
  }

  /**
   * ✅ NUEVO: Moderar imagen desde URL de Cloudinary usando CLIP
   */
  private async moderarImagenCloudinary(
    cloudinaryUrl: string,
    ipUsuario: string, 
    hashNavegador: string,
    options: ImageModerationOptions
  ): Promise<ImageModerationResult> {
    try {
      console.log(`🌐 Analizando imagen de Cloudinary con CLIP: ${cloudinaryUrl}`);
      
      const clipListo = await this.verificarClipListo();
      
      if (!clipListo) {
        console.warn('⚠️ CLIP integrado no disponible para Cloudinary');
        return {
          esAprobado: false,
          motivoRechazo: 'Servicio de moderación no disponible',
          puntuacionRiesgo: 1.0
        };
      }

      // ✅ NUEVO: Usar CLIP integrado para analizar URL de Cloudinary
      const resultado = await this.analizarImagenConClip(cloudinaryUrl);

      await this.registrarLogModeracionImagen({
        imagePath: cloudinaryUrl,
        ipUsuario,
        hashNavegador,
        resultado,
        esAprobado: resultado.es_apto,
        tipoContenido: options.tipoContenido,
        
      });

      if (!resultado.es_apto) {
        const motivo = this.generarMotivoRechazoClip(resultado);
        return {
          esAprobado: false,
          motivoRechazo: motivo,
          puntuacionRiesgo: resultado.puntuacion_riesgo,
          detalles: resultado,
          cloudinaryUrl: cloudinaryUrl
        };
      }

      return {
        esAprobado: true,
        puntuacionRiesgo: resultado.puntuacion_riesgo,
        detalles: resultado,
        cloudinaryUrl: cloudinaryUrl
      };

    } catch (error) {
      console.error('❌ Error moderando imagen de Cloudinary con CLIP:', error);
      return {
        esAprobado: false,
        motivoRechazo: 'Error al analizar imagen de Cloudinary',
        puntuacionRiesgo: 1.0,
        cloudinaryUrl: cloudinaryUrl
      };
    }
  }

  /**
   * ✅ Moderar imagen desde buffer
   */
  async moderarImagenDesdeBuffer(
    fileBuffer: Buffer,
    fileName: string,
    ipUsuario: string,
    hashNavegador: string
  ): Promise<ImageModerationResult> {
    console.log(`🖼️ Moderando imagen desde buffer con CLIP: ${fileName}`);
    
    try {
      // Crear imagen temporal
      const tempResult = await this.crearImagenTemporal(fileBuffer, fileName);
      
      if (!tempResult.success || !tempResult.tempPath) {
        return {
          esAprobado: false,
          motivoRechazo: 'Error al procesar la imagen',
          puntuacionRiesgo: 1.0
        };
      }

      // Moderar la imagen temporal usando CLIP
      const resultado = await this.moderarImagenTemporal(
        tempResult.tempPath,
        ipUsuario,
        hashNavegador,
        {
          tipoContenido: 'experiencia',
          idContenido: undefined
        }
      );

      return resultado;

    } catch (error) {
      console.error('❌ Error moderando imagen desde buffer:', error);
      return {
        esAprobado: false,
        motivoRechazo: 'Error al procesar la imagen',
        puntuacionRiesgo: 1.0
      };
    }
  }

  /**
   * ✅ CREAR IMAGEN TEMPORAL
   */
  async crearImagenTemporal(fileBuffer: Buffer, originalname: string): Promise<TempImageResult> {
    try {
      this.cleanTempDir();

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const extension = path.extname(originalname) || '.jpg';
      const filename = `temp_${timestamp}_${randomSuffix}${extension}`;
      const tempPath = path.join(this.tempDir, filename);

      await fsPromises.writeFile(tempPath, fileBuffer);
      
      console.log(`📥 Imagen temporal creada: ${tempPath}`);
      
      return {
        success: true,
        tempPath: tempPath,
        filename: filename
      };
    } catch (error) {
      console.error('❌ Error creando imagen temporal:', error);
      return {
        success: false,
        error: 'Error al crear imagen temporal'
      };
    }
  }

  /**
   * ✅ MODERAR IMAGEN TEMPORAL (ACTUALIZADO CON CLIP)
   */
  async moderarImagenTemporal(
    tempPath: string, 
    ipUsuario: string, 
    hashNavegador: string,
    options: ImageModerationOptions
  ): Promise<ImageModerationResult> {
    console.log(`🖼️ Moderando imagen temporal con CLIP: ${tempPath} para ${options.tipoContenido}`);
    
    try {
      const clipListo = await this.verificarClipListo();
      
      if (!clipListo) {
        console.warn('⚠️ CLIP integrado no disponible');
        return await this.metodoFallbackServidorNoDisponible(tempPath, ipUsuario, hashNavegador, options);
      }

      // ✅ NUEVO: Usar CLIP integrado para analizar la imagen temporal
      const resultado = await this.analizarImagenConClip(tempPath);

      await this.registrarLogModeracionImagen({
        imagePath: tempPath,
        ipUsuario,
        hashNavegador,
        resultado,
        esAprobado: resultado.es_apto,
        esTemporal: true,
        tipoContenido: options.tipoContenido,
        
      });

      if (!resultado.es_apto) {
        const motivo = this.generarMotivoRechazoClip(resultado);
        
        await this.eliminarArchivo(tempPath);
        console.log('🗑️ Imagen temporal rechazada eliminada');
        
        return {
          esAprobado: false,
          motivoRechazo: motivo,
          puntuacionRiesgo: resultado.puntuacion_riesgo,
          detalles: resultado,
          tempPath: tempPath
        };
      }

      // ✅ IMAGEN APROBADA: SUBIR A CLOUDINARY
      if (options.usarCloudinary !== false) {
        const fileBuffer = await fsPromises.readFile(tempPath);
        const cloudinaryResult = await this.cloudinaryService.subirArchivo(
          fileBuffer,
          path.basename(tempPath),
          this.obtenerFolderCloudinary(options.tipoContenido)
        );

        // Limpiar archivo temporal
        await this.eliminarArchivo(tempPath);

        return {
          esAprobado: true,
          puntuacionRiesgo: resultado.puntuacion_riesgo,
          detalles: resultado,
          cloudinaryUrl: cloudinaryResult.secure_url,
          publicId: cloudinaryResult.public_id,
          tempPath: tempPath
        };
      } else {
        // Si no se usa Cloudinary, mantener archivo temporal
        return {
          esAprobado: true,
          puntuacionRiesgo: resultado.puntuacion_riesgo,
          detalles: resultado,
          tempPath: tempPath
        };
      }

    } catch (error) {
      console.error('❌ Error en moderación de imagen temporal con CLIP:', error);
      await this.eliminarArchivo(tempPath);
      return await this.metodoFallbackServidorNoDisponible(tempPath, ipUsuario, hashNavegador, options);
    }
  }

  /**
   * ✅ NUEVO: Método fallback cuando CLIP no está disponible
   */
  private async metodoFallbackServidorNoDisponible(
    imagePath: string, 
    ipUsuario: string, 
    hashNavegador: string,
    options: ImageModerationOptions
  ): Promise<ImageModerationResult> {
    console.log('🔄 Usando método fallback (CLIP no disponible)...');
    
    try {
      // ✅ ESTRATEGIA DE FALLBACK MEJORADA
      
      // 1. Si es una imagen temporal, rechazarla por seguridad
      if (imagePath.includes('temp_images')) {
        await this.eliminarArchivo(imagePath);
        
        return {
          esAprobado: false,
          motivoRechazo: 'Servicio de moderación no disponible. Por seguridad, la imagen fue rechazada.',
          puntuacionRiesgo: 1.0,
          detalles: { 
            error: 'CLIP integrado no disponible',
            accion: 'imagen_rechazada_por_seguridad'
          }
        };
      }

      // 2. Para URLs de Cloudinary existentes, asumir que ya fueron moderadas
      if (this.esUrlCloudinary(imagePath)) {
        console.log('⚠️ Asumiendo imagen de Cloudinary como aprobada (fallback)');
        
        await this.registrarLogModeracionImagen({
          imagePath,
          ipUsuario,
          hashNavegador,
          resultado: { fallback: true, motivo: 'clip_no_disponible' },
          esAprobado: true,
          tipoContenido: options.tipoContenido,
          
        });

        return {
          esAprobado: true,
          puntuacionRiesgo: 0.1, // Riesgo bajo en fallback
          detalles: { fallback: true, motivo: 'clip_no_disponible' },
          cloudinaryUrl: imagePath
        };
      }

      // 3. Para otras rutas, rechazar por seguridad
      return {
        esAprobado: false,
        motivoRechazo: 'Servicio de moderación no disponible. No se puede procesar la imagen.',
        puntuacionRiesgo: 1.0,
        detalles: { 
          error: 'CLIP integrado no disponible',
          accion: 'rechazado_por_seguridad'
        }
      };

    } catch (error) {
      console.error('❌ Error en método fallback:', error);
      return {
        esAprobado: false,
        motivoRechazo: 'Error en el sistema de moderación',
        puntuacionRiesgo: 1.0,
        detalles: { error: error instanceof Error ? error.message : 'Error desconocido' }
      };
    }
  }

  /**
   * ✅ Obtener folder de Cloudinary según tipo de contenido
   */
  private obtenerFolderCloudinary(tipoContenido: string): string {
    switch (tipoContenido) {
      case 'experiencia':
        return process.env.CLOUDINARY_EXPERIENCIAS_FOLDER || 'experiencias';
      case 'lugar':
        return process.env.CLOUDINARY_LUGARES_FOLDER || 'lugares';
      case 'pdf':
        return process.env.CLOUDINARY_PDFS_FOLDER || 'pdfs';
      default:
        return 'general';
    }
  }

  /**
   * ✅ Detectar si es URL de Cloudinary
   */
  private esUrlCloudinary(url: string): boolean {
    return url.includes('cloudinary.com') || url.startsWith('http');
  }

  /**
   * ✅ MÉTODOS DE CONVENIENCIA
   */
  async moderarImagenExperiencia(
    imagePath: string, 
    ipUsuario: string, 
    hashNavegador: string,
    experienciaId?: string | number
  ): Promise<ImageModerationResult> {
    return await this.moderarImagenConOpciones(imagePath, ipUsuario, hashNavegador, {
      tipoContenido: 'experiencia',
      idContenido: experienciaId
    });
  }

  async moderarImagenLugar(
    imagePath: string, 
    ipUsuario: string, 
    hashNavegador: string,
    lugarId?: string | number
  ): Promise<ImageModerationResult> {
    return await this.moderarImagenConOpciones(imagePath, ipUsuario, hashNavegador, {
      tipoContenido: 'lugar',
      idContenido: lugarId
    });
  }

  async moderarImagenPDF(
    imagePath: string, 
    ipUsuario: string, 
    hashNavegador: string
  ): Promise<ImageModerationResult> {
    return await this.moderarImagenConOpciones(imagePath, ipUsuario, hashNavegador, {
      tipoContenido: 'pdf',
      idContenido: undefined
    });
  }

  /**
   * ✅ MÉTODOS DE LIMPIEZA Y UTILIDAD
   */
  private cleanTempDir(): void {
    try {
      const files = fs.readdirSync(this.tempDir);
      
      for (const file of files) {
        if (file.startsWith('temp_') && (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))) {
          try {
            const filePath = path.join(this.tempDir, file);
            // ✅ CORREGIDO: Usar fsPromises.unlink
            fs.unlinkSync(filePath);
            console.log(`🧹 Temporal limpiado: ${file}`);
          } catch (error) {
            console.log(`⚠️ No se pudo eliminar: ${file}`);
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Error limpiando directorio temporal:', error);
    }
  }

  private async eliminarArchivo(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        // ✅ CORREGIDO: Ya está usando fsPromises.unlink correctamente
        await fsPromises.unlink(filePath);
        console.log(`🗑️ Archivo eliminado: ${filePath}`);
      }
    } catch (error) {
      console.error(`❌ Error eliminando archivo ${filePath}:`, error);
    }
  }

  async limpiarTemporales(): Promise<{ success: boolean; limpiados: number }> {
    try {
      let limpiados = 0;
      const files = fs.readdirSync(this.tempDir);
      
      for (const file of files) {
        if (file.startsWith('temp_')) {
          try {
            const filePath = path.join(this.tempDir, file);
            await fsPromises.unlink(filePath);
            limpiados++;
            console.log(`🧹 Temporal eliminado: ${file}`);
          } catch (error) {
            console.error(`❌ Error eliminando ${file}:`, error);
          }
        }
      }

      console.log(`✅ Limpieza manual completada: ${limpiados} archivos`);
      return { success: true, limpiados };
      
    } catch (error) {
      console.error('❌ Error en limpieza manual:', error);
      return { success: false, limpiados: 0 };
    }
  }

  /**
   * ✅ NUEVO: Generar motivo de rechazo para resultados CLIP
   */
  private generarMotivoRechazoClip(resultado: ClipAnalysisResult): string {
    if (resultado.razones_rechazo && resultado.razones_rechazo.length > 0) {
      return resultado.razones_rechazo.join('; ');
    }
    
    return `La imagen no cumple con las políticas de contenido (riesgo: ${Math.round(resultado.puntuacion_riesgo * 100)}%)`;
  }

  /**
   * ✅ MANTENER: Método de rechazo original para compatibilidad
   */
  private generarMotivoRechazo(detalles: any): string {
    // Para compatibilidad con el formato antiguo
    if (detalles.razones_rechazo) {
      return this.generarMotivoRechazoClip(detalles);
    }

    const motivos: string[] = [];
    if (detalles.analisis_violencia?.es_violento) {
      const prob = Math.round(detalles.analisis_violencia.probabilidad_violencia * 100);
      motivos.push(`Contenido inapropiado (${prob}% confianza)`);
    }
    if (detalles.analisis_armas?.armas_detectadas) {
      const conf = Math.round(detalles.analisis_armas.confianza * 100);
      motivos.push(`Elementos prohibidos (${conf}% confianza)`);
    }
    return motivos.join('; ') || 'La imagen no cumple con las políticas de contenido';
  }

  private async registrarLogModeracionImagen(log: {
    imagePath: string;
    ipUsuario: string;
    hashNavegador: string;
    resultado: any;
    esAprobado: boolean;
    esTemporal?: boolean;
    tipoContenido?: string;
  }): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO logs_moderacion_imagenes 
         (ruta_imagen, ip_usuario, hash_navegador, resultado_analisis, es_aprobado, es_temporal, tipo_contenido, creado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          log.imagePath,
          log.ipUsuario,
          log.hashNavegador,
          log.resultado ? JSON.stringify(log.resultado) : null,
          log.esAprobado,
          log.esTemporal || false,
          log.tipoContenido || 'general',
          
        ]
      );
      console.log('✅ Log de moderación registrado');
    } catch (error) {
      console.error('❌ Error registrando log de moderación:', error);
    }
  }

  /**
   * ✅ NUEVO: Método para verificar estado del CLIP
   */
  obtenerEstadoClip() {
    return clipAnalyzerService.obtenerEstado();
  }

  /**
   * ✅ NUEVO: Método para verificar si CLIP está listo
   */
  estaListo(): boolean {
    return clipAnalyzerService.estaListo();
  }
}