// services/ClipImageDownloader.ts - VERSIÓN CORREGIDA
import axios from 'axios';
import fs from 'fs-extra';
import tmp from 'tmp';
import { URL } from 'url';

export interface DownloadResult {
  success: boolean;
  tempPath?: string;
  error?: string;
  size?: number;
}

export class ClipImageDownloader {
  private timeout: number = 30000;
  private maxSizeMB: number = 10;

  esUrl(valor: string): boolean {
    try {
      const url = new URL(valor);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async descargarImagenDesdeUrl(url: string): Promise<DownloadResult> {
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return { success: false, error: "URL debe usar HTTP/HTTPS" };
      }

      const config = {
        method: 'get',
        url: url,
        responseType: 'stream' as const,
        timeout: this.timeout,
        maxContentLength: this.maxSizeMB * 1024 * 1024
      };

      const response = await axios(config);

      // Verificar tipo de contenido
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        return { success: false, error: `URL no apunta a una imagen: ${contentType}` };
      }

      // Crear archivo temporal
      const tempFile = tmp.fileSync({ postfix: '.jpg' });
      const writer = fs.createWriteStream(tempFile.name);

      return new Promise((resolve) => {
        let downloadedSize = 0;
        
        // ✅ TYPECAST CORREGIDO
        const stream = response.data as NodeJS.ReadableStream;
        
        stream.on('data', (chunk: Buffer) => {
          downloadedSize += chunk.length;
          if (downloadedSize > this.maxSizeMB * 1024 * 1024) {
            writer.destroy();
            fs.unlinkSync(tempFile.name);
            resolve({ success: false, error: `Imagen excede ${this.maxSizeMB}MB` });
          }
        });

        stream.pipe(writer);

        writer.on('finish', () => {
          console.log(`✅ Imagen descargada: ${downloadedSize} bytes`);
          resolve({ 
            success: true, 
            tempPath: tempFile.name, 
            size: downloadedSize 
          });
        });

        writer.on('error', (error) => {
          fs.unlinkSync(tempFile.name);
          resolve({ success: false, error: `Error guardando imagen: ${error.message}` });
        });
      });

    } catch (error: any) {
      if (error.response) {
        return { success: false, error: `Error HTTP ${error.response.status}: ${error.response.statusText}` };
      }
      return { success: false, error: `Error procesando URL: ${error.message}` };
    }
  }

  async verificarArchivoLocal(ruta: string): Promise<DownloadResult> {
    try {
      const existe = await fs.pathExists(ruta);
      if (!existe) {
        return { success: false, error: `Archivo no encontrado: ${ruta}` };
      }
      
      const stats = await fs.stat(ruta);
      if (stats.size > this.maxSizeMB * 1024 * 1024) {
        return { success: false, error: `Archivo demasiado grande (> ${this.maxSizeMB}MB)` };
      }
      
      return { success: true, tempPath: ruta, size: stats.size };
    } catch (error: any) {
      return { success: false, error: `Error verificando archivo local: ${error.message}` };
    }
  }
}

export const clipImageDownloader = new ClipImageDownloader();