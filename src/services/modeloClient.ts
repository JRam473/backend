import fetch, { Response } from 'node-fetch';
import path from 'path';

export interface AnalisisImagenResultado {
  es_apto: boolean;
  analisis_violencia: any;
  analisis_armas: any;
  puntuacion_riesgo: number;
  tiempo_procesamiento?: number;
  ruta_imagen?: string;
  error?: string;
}

export class ModeloClient {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = process.env.MODEL_SERVER_URL || 'https://model-server-4q80.onrender.com ';
    this.timeout = 15000;
  }

  private async fetchWithTimeout(url: string, options: any = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private resolverRutaAbsoluta(imagePath: string): string {
    // Si ya es absoluta, retornar tal cual
    if (path.isAbsolute(imagePath)) {
      return imagePath;
    }
    
    // Convertir a ruta absoluta desde el directorio del proyecto
    const projectRoot = process.cwd();
    const rutaAbsoluta = path.join(projectRoot, imagePath);
    
    console.log(`📁 Resolviendo ruta:`);
    console.log(`   - Original: ${imagePath}`);
    console.log(`   - Absoluta: ${rutaAbsoluta}`);
    
    // Verificar si existe el archivo
    try {
      const fs = require('fs');
      const existe = fs.existsSync(rutaAbsoluta);
      console.log(`   - Existe: ${existe ? '✅' : '❌'}`);
    } catch (error) {
      console.log(`   - Error verificando existencia: ${error}`);
    }
    
    return rutaAbsoluta;
  }

  async waitForServerReady(maxAttempts: number = 30): Promise<boolean> {
    console.log('🔄 Esperando que el servidor de modelos esté listo...');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.fetchWithTimeout(`${this.baseUrl}/health`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json() as any;
        
        if (data.modelos_listos) {
          console.log('✅ Servidor de modelos listo!');
          return true;
        } else {
          console.log(`⏳ Servidor inicializando... (${data.status}) - ${attempt}/${maxAttempts}`);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log(`⏳ Timeout - Servidor no responde... (${attempt}/${maxAttempts})`);
        } else {
          console.log(`⏳ Servidor no disponible: ${error.message} (${attempt}/${maxAttempts})`);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.error('❌ Timeout esperando servidor de modelos');
    return false;
  }

  async analizarImagen(imagePath: string): Promise<AnalisisImagenResultado> {
    const inicio = Date.now();
    
    try {
      console.log(`🖼️ Analizando imagen: ${imagePath}`);
      
      // ✅ RESOLVER RUTA ABSOLUTA
      const rutaAbsoluta = this.resolverRutaAbsoluta(imagePath);
      
      const response = await this.fetchWithTimeout(`${this.baseUrl}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_path: rutaAbsoluta
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const resultado = await response.json() as AnalisisImagenResultado;
      const duracion = Date.now() - inicio;
      
      console.log(`✅ Análisis completado en ${duracion}ms`);
      console.log(`📊 Resultado: ${resultado.es_apto ? '✅ APTO' : '❌ NO APTO'} - Riesgo: ${resultado.puntuacion_riesgo}`);
      
      return {
        ...resultado,
        tiempo_procesamiento: duracion / 1000
      };

    } catch (error) {
      console.error('❌ Error analizando imagen:', error);
      
      const errorResult: AnalisisImagenResultado = {
        es_apto: false,
        analisis_violencia: {
          es_violento: false,
          probabilidad_violencia: 0.0,
          detalles_violencia: [],
          total_categorias_analizadas: 0,
          error: 'Servicio no disponible'
        },
        analisis_armas: {
          armas_detectadas: false,
          confianza: 0.0,
          detalles_armas: [],
          total_armas_detectadas: 0,
          modelo_utilizado: 'none',
          error: 'Servicio no disponible'
        },
        puntuacion_riesgo: 1.0,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
      
      return errorResult;
    }
  }

  async debugPaths(): Promise<any> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/debug-paths`);
      return await response.json();
    } catch (error) {
      console.error('❌ Error en debug:', error);
      return { error: error instanceof Error ? error.message : 'Error desconocido' };
    }
  }
}