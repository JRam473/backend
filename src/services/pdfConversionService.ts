// services/pdfConversionService.ts - VERSIÓN COMPLETAMENTE CORREGIDA
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(require('child_process').exec);

export interface ConversionResult {
  success: boolean;
  images: string[];
  error?: string;
  method?: string;
}

export class PdfConversionService {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp_pdfs');
    this.ensureTempDir();
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * ✅ CONVERSIÓN UNIVERSAL PDF A IMÁGENES
   * Intenta múltiples métodos en orden de preferencia
   */
  async convertPdfToImages(pdfPath: string): Promise<ConversionResult> {
    // Limpiar archivos temporales previos
    this.cleanTempDir();

    const methods = [
      this.convertWithPdf2Pic.bind(this),
      this.convertWithPdfPoppler.bind(this),
      this.convertWithPdfToPpm.bind(this),
      this.convertWithImageMagick.bind(this),
      this.convertWithGhostscript.bind(this)
    ];

    for (const method of methods) {
      try {
        console.log(`🔄 Intentando método: ${method.name}`);
        const result = await method(pdfPath);
        
        if (result.success && result.images.length > 0) {
          console.log(`✅ Conversión exitosa con ${result.method}: ${result.images.length} imágenes`);
          return result;
        }
      } catch (error) {
        console.log(`❌ ${method.name} falló:`, error instanceof Error ? error.message : 'Error desconocido');
        // Continuar con el siguiente método
      }
    }

    return {
      success: false,
      images: [],
      error: 'Todos los métodos de conversión fallaron'
    };
  }

  /**
   * ✅ MÉTODO 1: pdf2pic (Librería JavaScript pura)
   */
  private async convertWithPdf2Pic(pdfPath: string): Promise<ConversionResult> {
    try {
      const { fromPath } = require('pdf2pic');
      
      const options = {
        density: 150,
        saveFilename: "page",
        savePath: this.tempDir,
        format: "png",
        width: 1200,
        height: 1600
      };
      
      const convert = fromPath(pdfPath, options);
      const result = await convert.bulk(-1); // Convertir todas las páginas
      
      const images = result
        .map((page: any) => page.path)
        .filter((path: string) => fs.existsSync(path) && fs.statSync(path).size > 0);
      
      return {
        success: images.length > 0,
        images,
        method: 'pdf2pic'
      };
    } catch (error) {
      throw new Error(`pdf2pic: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * ✅ MÉTODO 2: pdf-poppler (Wrapper Node.js para poppler)
   */
  private async convertWithPdfPoppler(pdfPath: string): Promise<ConversionResult> {
    try {
      const poppler = require('pdf-poppler');
      
      const opts = {
        format: 'png',
        out_dir: this.tempDir,
        out_prefix: 'page',
        page: null // todas las páginas
      };
      
      await poppler.convert(pdfPath, opts);
      
      const images = this.getValidImagesFromTempDir('page');
      return {
        success: images.length > 0,
        images,
        method: 'pdf-poppler'
      };
    } catch (error) {
      throw new Error(`pdf-poppler: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * ✅ MÉTODO 3: pdftoppm (Herramienta sistema - Linux/Mac)
   */
  private async convertWithPdfToPpm(pdfPath: string): Promise<ConversionResult> {
    try {
      const outputPattern = path.join(this.tempDir, 'page');
      await execAsync(`pdftoppm -png -r 150 "${pdfPath}" "${outputPattern}"`);
      
      const images = this.getValidImagesFromTempDir('page');
      return {
        success: images.length > 0,
        images,
        method: 'pdftoppm'
      };
    } catch (error) {
      throw new Error(`pdftoppm: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * ✅ MÉTODO 4: ImageMagick (Multiplataforma)
   */
  private async convertWithImageMagick(pdfPath: string): Promise<ConversionResult> {
    try {
      const outputPattern = path.join(this.tempDir, 'page_%d.png');
      
      // Probar ambos comandos posibles
      const commands = [
        `magick -density 150 "${pdfPath}" "${outputPattern}"`,
        `convert -density 150 "${pdfPath}" "${outputPattern}"`
      ];

      for (const command of commands) {
        try {
          await execAsync(command);
          const images = this.getValidImagesFromTempDir('page_');
          if (images.length > 0) {
            return {
              success: true,
              images,
              method: 'imagemagick'
            };
          }
        } catch {
          // Continuar con el siguiente comando
        }
      }
      
      throw new Error('ImageMagick no disponible');
    } catch (error) {
      throw new Error(`imagemagick: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * ✅ MÉTODO 5: Ghostscript (Multiplataforma)
   */
  private async convertWithGhostscript(pdfPath: string): Promise<ConversionResult> {
    try {
      const outputPattern = path.join(this.tempDir, 'page_%d.png');
      
      await execAsync(
        `gs -dNOPAUSE -sDEVICE=png16m -r150 -sOutputFile="${outputPattern}" "${pdfPath}" -dBATCH -dQUIET`
      );
      
      const images = this.getValidImagesFromTempDir('page_');
      return {
        success: images.length > 0,
        images,
        method: 'ghostscript'
      };
    } catch (error) {
      throw new Error(`ghostscript: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * ✅ OBTENER IMÁGENES VÁLIDAS DEL DIRECTORIO TEMPORAL
   */
  private getValidImagesFromTempDir(prefix: string): string[] {
    try {
      return fs.readdirSync(this.tempDir)
        .filter(file => 
          file.startsWith(prefix) && 
          (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))
        )
        .map(file => path.join(this.tempDir, file))
        .filter(filePath => {
          try {
            return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
          } catch {
            return false;
          }
        })
        .sort((a, b) => {
          // Ordenar por número de página
          const numA = this.extractPageNumber(a, prefix);
          const numB = this.extractPageNumber(b, prefix);
          return numA - numB;
        });
    } catch (error) {
      return [];
    }
  }

  /**
   * ✅ EXTRAER NÚMERO DE PÁGINA DEL NOMBRE DEL ARCHIVO - COMPLETAMENTE CORREGIDO
   */
  private extractPageNumber(filename: string, prefix: string): number {
    const baseName = path.basename(filename);
    const withoutPrefix = baseName.replace(prefix, '');
    const withoutExt = withoutPrefix.split('.')[0] || '';
    const numbers = withoutExt.match(/\d+/g);
    return numbers && numbers.length > 0 ? parseInt(numbers[0]) : 0;
  }

  /**
   * ✅ LIMPIAR DIRECTORIO TEMPORAL
   */
  private cleanTempDir(): void {
    try {
      const files = fs.readdirSync(this.tempDir);
      
      for (const file of files) {
        if (file.startsWith('page') && (file.endsWith('.png') || file.endsWith('.jpg'))) {
          try {
            fs.unlinkSync(path.join(this.tempDir, file));
          } catch (error) {
            // Ignorar errores de eliminación
          }
        }
      }
    } catch (error) {
      // Si hay error al limpiar, continuar
    }
  }

/**
 * ✅ LIMPIAR ARCHIVOS TEMPORALES ESPECÍFICOS - VERSIÓN MEJORADA
 */
async cleanupImages(imagePaths: string[]): Promise<void> {
  console.log(`🔄 Iniciando limpieza de ${imagePaths.length} imágenes...`);
  
  for (const imagePath of imagePaths) {
    try {
      if (fs.existsSync(imagePath)) {
        console.log(`🗑️ Eliminando: ${imagePath}`);
        await fs.promises.unlink(imagePath);
        console.log(`✅ Eliminado: ${imagePath}`);
      } else {
        console.log(`⚠️ Archivo no encontrado (ya eliminado?): ${imagePath}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error(`❌ Error eliminando ${imagePath}:`, errorMessage);
    }
  }
  
  console.log(`✅ Limpieza completada para ${imagePaths.length} archivos`);
}
}