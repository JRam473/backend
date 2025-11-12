// backend/src/services/moderacionImagenService.ts - VERSIÓN COMPATIBLE
import { ModeloClient } from './modeloClient';
import { pool } from '../utils/baseDeDatos';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

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
}

export interface ImageModerationOptions {
  tipoContenido: 'experiencia' | 'lugar' | 'pdf' | 'general';
  idContenido?: string | number | undefined;
}

export class ModeracionImagenService {
  private modeloClient: ModeloClient;
  private tempDir: string;

  constructor() {
    this.modeloClient = new ModeloClient();
    this.tempDir = path.join(process.cwd(), 'temp_images');
    this.ensureTempDir();
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      console.log('📁 Directorio temporal de imágenes creado:', this.tempDir);
    }
  }

  /**
   * ✅ MÉTODO COMPATIBLE PARA PDF ANALYSIS SERVICE
   * Mantiene la firma original para compatibilidad
   */
  async moderarImagen(
    imagePath: string, 
    ipUsuario: string, 
    hashNavegador: string
  ): Promise<ImageModerationResult> {
    console.log(`🖼️ Moderación compatible (sin options): ${imagePath}`);
    
    // Usar opciones por defecto para mantener compatibilidad
    const options: ImageModerationOptions = {
      tipoContenido: 'pdf', // Tipo específico para PDF Analysis
      idContenido: undefined
    };
    
    return await this.moderarImagenConOpciones(imagePath, ipUsuario, hashNavegador, options);
  }

  /**
   * ✅ NUEVO MÉTODO CON OPCIONES (para nuevo código)
   */
  async moderarImagenConOpciones(
    imagePath: string, 
    ipUsuario: string, 
    hashNavegador: string,
    options: ImageModerationOptions
  ): Promise<ImageModerationResult> {
    console.log(`🖼️ Moderación con opciones: ${imagePath} para ${options.tipoContenido}`);
    
    // Si es una ruta temporal, usar el método temporal
    if (imagePath.includes('temp_images')) {
      return await this.moderarImagenTemporal(imagePath, ipUsuario, hashNavegador, options);
    }
    
    // Para rutas normales, usar el método directo
    try {
      const servidorListo = await this.modeloClient.waitForServerReady(10);
      
      if (!servidorListo) {
        console.warn('⚠️ Servidor de modelos no disponible, usando fallback...');
        return await this.usarMetodoOriginal(imagePath, ipUsuario, hashNavegador, options);
      }

      const resultado = await this.modeloClient.analizarImagen(imagePath);

      await this.registrarLogModeracionImagen({
        imagePath,
        ipUsuario,
        hashNavegador,
        resultado,
        esAprobado: resultado.es_apto,
        tipoContenido: options.tipoContenido
      });

      if (!resultado.es_apto) {
        const motivo = this.generarMotivoRechazo(resultado);
        return {
          esAprobado: false,
          motivoRechazo: motivo,
          puntuacionRiesgo: resultado.puntuacion_riesgo,
          detalles: resultado
        };
      }

      // Para imágenes ya existentes, no las movemos, solo retornamos aprobación
      return {
        esAprobado: true,
        puntuacionRiesgo: resultado.puntuacion_riesgo,
        detalles: resultado
      };

    } catch (error) {
      console.error('❌ Error en moderación de imagen:', error);
      return await this.usarMetodoOriginal(imagePath, ipUsuario, hashNavegador, options);
    }
  }

  /**
   * ✅ CREAR IMAGEN TEMPORAL
   */
  async crearImagenTemporal(fileBuffer: Buffer, originalname: string): Promise<TempImageResult> {
    try {
      // Limpiar archivos temporales previos ANTES de crear nuevos
      this.cleanTempDir();

      // Generar nombre único para el archivo temporal
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const extension = path.extname(originalname) || '.jpg';
      const filename = `temp_${timestamp}_${randomSuffix}${extension}`;
      const tempPath = path.join(this.tempDir, filename);

      // Guardar archivo temporal
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
   * ✅ MODERAR IMAGEN TEMPORAL - CON DESTINO ESPECÍFICO
   */
  async moderarImagenTemporal(
    tempPath: string, 
    ipUsuario: string, 
    hashNavegador: string,
    options: ImageModerationOptions
  ): Promise<ImageModerationResult> {
    console.log(`🖼️ Moderando imagen temporal: ${tempPath} para ${options.tipoContenido}`);
    
    try {
      // Esperar a que el servidor esté listo
      const servidorListo = await this.modeloClient.waitForServerReady(10);
      
      if (!servidorListo) {
        console.warn('⚠️ Servidor de modelos no disponible, usando fallback...');
        return await this.usarMetodoOriginal(tempPath, ipUsuario, hashNavegador, options);
      }

      // Analizar imagen temporal
      const resultado = await this.modeloClient.analizarImagen(tempPath);

      // Registrar log de moderación
      await this.registrarLogModeracionImagen({
        imagePath: tempPath,
        ipUsuario,
        hashNavegador,
        resultado,
        esAprobado: resultado.es_apto,
        esTemporal: true,
        tipoContenido: options.tipoContenido
      });

      if (!resultado.es_apto) {
        const motivo = this.generarMotivoRechazo(resultado);
        
        // ❌ IMAGEN RECHAZADA: Eliminar temporal inmediatamente
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

      // ✅ IMAGEN APROBADA: Mover a ubicación específica según el tipo
      const rutaFinal = await this.moverImagenAprobada(tempPath, options);
      
      return {
        esAprobado: true,
        puntuacionRiesgo: resultado.puntuacion_riesgo,
        detalles: resultado,
        tempPath: tempPath,
        rutaFinal: rutaFinal
      };

    } catch (error) {
      console.error('❌ Error en moderación de imagen temporal:', error);
      
      // En caso de error, eliminar temporal inmediatamente
      await this.eliminarArchivo(tempPath);
      console.log('🗑️ Imagen temporal eliminada por error');
      
      return await this.usarMetodoOriginal(tempPath, ipUsuario, hashNavegador, options);
    }
  }

  /**
   * ✅ MOVER IMAGEN APROBADA A DIRECTORIO ESPECÍFICO
   */
  private async moverImagenAprobada(tempPath: string, options: ImageModerationOptions): Promise<string> {
    try {
      const filename = path.basename(tempPath);
      
      // Definir directorio destino según el tipo de contenido
      let destDir: string;
      let rutaRelativa: string;

      switch (options.tipoContenido) {
        case 'experiencia':
          destDir = path.join(process.cwd(), 'uploads', 'images', 'experiencias');
          rutaRelativa = `/uploads/images/experiencias/${filename}`;
          break;
        
        case 'lugar':
          destDir = path.join(process.cwd(), 'uploads', 'images', 'lugares');
          rutaRelativa = `/uploads/images/lugares/${filename}`;
          break;
        
        case 'pdf':
          // Para PDF Analysis, usar directorio temporal o aprobadas
          destDir = path.join(process.cwd(), 'uploads', 'images', 'aprobadas');
          rutaRelativa = `/uploads/images/aprobadas/${filename}`;
          break;
        
        default:
          // Fallback a aprobadas genéricas
          destDir = path.join(process.cwd(), 'uploads', 'images', 'aprobadas');
          rutaRelativa = `/uploads/images/aprobadas/${filename}`;
      }
      
      // Crear directorio si no existe
      await fsPromises.mkdir(destDir, { recursive: true });
      
      const destPath = path.join(destDir, filename);
      
      // Mover archivo
      await fsPromises.rename(tempPath, destPath);
      
      console.log(`✅ Imagen aprobada movida a: ${destPath} (${options.tipoContenido})`);
      
      // Retornar ruta relativa para la base de datos
      return rutaRelativa;
      
    } catch (error) {
      console.error('❌ Error moviendo imagen aprobada:', error);
      
      // Si falla el movimiento, eliminar el temporal
      await this.eliminarArchivo(tempPath);
      throw new Error('No se pudo guardar la imagen aprobada');
    }
  }

  /**
   * ✅ MÉTODO FALLBACK ORIGINAL MEJORADO
   */
  private async usarMetodoOriginal(
    imagePath: string, 
    ipUsuario: string, 
    hashNavegador: string,
    options: ImageModerationOptions
  ): Promise<ImageModerationResult> {
    console.log('🔄 Usando método PythonBridge como fallback...');
    
    try {
      const { PythonBridge } = await import('../utils/pythonBridge');
      const bridge = new PythonBridge();
      const resultado = await bridge.esImagenApta(imagePath);

      await this.registrarLogModeracionImagen({
        imagePath,
        ipUsuario,
        hashNavegador,
        resultado: resultado.detalles || null,
        esAprobado: resultado.esApto,
        tipoContenido: options.tipoContenido
      });

      if (!resultado.esApto) {
        return {
          esAprobado: false,
          motivoRechazo: resultado.detalles?.error || 'Contenido inapropiado',
          puntuacionRiesgo: resultado.detalles?.puntuacion_riesgo || 1.0,
          detalles: resultado.detalles
        };
      }

      // Si es una imagen temporal aprobada, moverla al destino específico
      if (imagePath.includes('temp_images') && resultado.esApto) {
        const rutaFinal = await this.moverImagenAprobada(imagePath, options);
        return {
          esAprobado: true,
          puntuacionRiesgo: resultado.detalles?.puntuacion_riesgo || 0.1,
          detalles: resultado.detalles,
          rutaFinal: rutaFinal
        };
      }

      return {
        esAprobado: true,
        puntuacionRiesgo: resultado.detalles?.puntuacion_riesgo || 0.1,
        detalles: resultado.detalles
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
   * ✅ MÉTODO DE CONVENIENCIA PARA EXPERIENCIAS
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

  /**
   * ✅ MÉTODO DE CONVENIENCIA PARA LUGARES
   */
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

  /**
   * ✅ MÉTODO DE CONVENIENCIA PARA PDF ANALYSIS
   */
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
   * ✅ LIMPIAR DIRECTORIO TEMPORAL
   */
  private cleanTempDir(): void {
    try {
      const files = fs.readdirSync(this.tempDir);
      
      for (const file of files) {
        if (file.startsWith('temp_') && (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))) {
          try {
            const filePath = path.join(this.tempDir, file);
            fs.unlinkSync(filePath);
            console.log(`🧹 Temporal limpiado: ${file}`);
          } catch (error) {
            // Ignorar errores de eliminación
            console.log(`⚠️ No se pudo eliminar: ${file}`);
          }
        }
      }
    } catch (error) {
      // Si hay error al limpiar, continuar
      console.log('⚠️ Error limpiando directorio temporal:', error);
    }
  }

  /**
   * ✅ ELIMINAR ARCHIVO CON MANEJO DE ERRORES
   */
  private async eliminarArchivo(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await fsPromises.unlink(filePath);
        console.log(`🗑️ Archivo eliminado: ${filePath}`);
      }
    } catch (error) {
      console.error(`❌ Error eliminando archivo ${filePath}:`, error);
    }
  }

  /**
   * ✅ LIMPIAR IMÁGENES TEMPORALES (método público opcional)
   */
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

  private generarMotivoRechazo(detalles: any): string {
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
          log.tipoContenido || 'general'
        ]
      );
      console.log('✅ Log de moderación registrado');
    } catch (error) {
      console.error('❌ Error registrando log de moderación:', error);
    }
  }
}