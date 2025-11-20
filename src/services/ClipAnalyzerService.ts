// services/ClipAnalyzerService.ts - VERSIÓN EQUIVALENTE AL PYTHON
import { pipeline, RawImage } from '@xenova/transformers';
import { ClipAnalysisResult, CategoryScore, ClipHealthStatus } from '../types/ClipTypes';

export class ClipAnalyzerService {
  private classifier: any = null;
  private cargado: boolean = false;
  private inicializacionEnCurso: boolean = false;
  
  // ✅ CATEGORÍAS EQUIVALENTES AL PYTHON - MÍNIMAS PERO EFECTIVAS
  private readonly categorias: string[] = [
    // Contenido peligroso (alto riesgo)
    "violence", "blood", "weapon", "gun", "knife",
    "nudity", "sexual content", "drugs",
    // Contenido seguro (bajo riesgo)  
    "safe", "normal", "peaceful"
  ];

  async inicializarModelos(): Promise<boolean> {
    if (this.inicializacionEnCurso || this.cargado) {
      return this.cargado;
    }

    this.inicializacionEnCurso = true;
    console.log("🎯 Inicializando servicio CLIP...");

    try {
      console.log("📦 Cargando modelo CLIP...");
      // ✅ USAR MODELO MÁS PEQUEÑO EQUIVALENTE
      this.classifier = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
      this.cargado = true;
      console.log("✅ Modelo CLIP cargado correctamente");
      return true;
    } catch (error) {
      console.error("❌ Error cargando modelo CLIP:", error);
      this.cargado = false;
      return false;
    } finally {
      this.inicializacionEnCurso = false;
    }
  }

  async analizarImagen(imagePath: string): Promise<ClipAnalysisResult> {
    if (!this.cargado) throw new Error("Modelo CLIP no cargado");

    const inicio = Date.now();

    try {
      // ✅ CARGAR IMAGEN CON OPTIMIZACIÓN
      const image = await RawImage.read(imagePath);
      const resultado = await this.classifier(image, this.categorias);
      
      const duracion = (Date.now() - inicio) / 1000;
      
      // Procesamiento equivalente al Python
      const puntuaciones: Record<string, number> = {};
      resultado.forEach((item: any) => {
        puntuaciones[item.label] = item.score;
      });

      console.log('🔍 RESULTADOS DETALLADOS CLIP:');
      Object.entries(puntuaciones).forEach(([categoria, puntuacion]) => {
        console.log(`   ${categoria}: ${(puntuacion * 100).toFixed(2)}%`);
      });

      // ✅ LÓGICA IDÉNTICA AL PYTHON - UMBRALES BAJOS
      const esApto = this.calcularEsAptoPythonStyle(puntuaciones);
      const puntuacionRiesgo = this.calcularPuntuacionRiesgoPythonStyle(puntuaciones);
      const contenidoDetectado = this.obtenerContenidoDetectadoPythonStyle(puntuaciones);

      console.log(`📊 DECISIÓN FINAL: ${esApto ? '✅ APTO' : '❌ NO APTO'}`);
      console.log(`📈 Puntuación riesgo máximo: ${(puntuacionRiesgo * 100).toFixed(2)}%`);
      console.log(`🎯 Contenido detectado:`, contenidoDetectado);

      const resultadoFinal: ClipAnalysisResult = {
        es_apto: esApto,
        puntuacion_riesgo: puntuacionRiesgo,
        tiempo_procesamiento: Math.round(duracion * 100) / 100,
        analizado_en: new Date().toISOString(),
        servidor: "clip-integrado-ts",
        origen_imagen: "local",
        modelo_utilizado: "CLIP-base-patch32",
        detectados: contenidoDetectado
      };

      // Agregar razones de rechazo si no es apto
      if (!esApto) {
        resultadoFinal.razones_rechazo = this.obtenerRazonesRechazoPythonStyle(puntuaciones);
      }

      return resultadoFinal;

    } catch (error) {
      console.error("❌ Error en análisis CLIP:", error);
      throw error;
    }
  }

  // ✅ LÓGICA IDÉNTICA AL PYTHON - UMBRAL BAJO 0.2, DECISIÓN BINARIA SIMPLE
  private calcularEsAptoPythonStyle(puntuaciones: Record<string, number>): boolean {
    const categoriasPeligrosas = [
      "violence", "blood", "weapon", "gun", "knife",
      "nudity", "sexual content", "drugs"
    ];
    
    let contenidoPeligroso = [];
    let maxRiesgo = 0.0;

    // ✅ ANALIZAR SOLO RESULTADOS RELEVANTES (umbral 0.2 como en Python)
    categoriasPeligrosas.forEach(categoria => {
      const probabilidad = puntuaciones[categoria] || 0;
      
      if (probabilidad > 0.2) { // ✅ UMBRAL IDÉNTICO AL PYTHON
        if (probabilidad > maxRiesgo) {
          maxRiesgo = probabilidad;
        }
        
        contenidoPeligroso.push({
          concepto: categoria,
          probabilidad: probabilidad
        });
      }
    });

    // ✅ DECISIÓN BINARIA SIMPLE IDÉNTICA AL PYTHON
    // es_apto = len(contenido_peligroso) == 0 or max_riesgo < 0.4
    const esApto = contenidoPeligroso.length === 0 || maxRiesgo < 0.4;

    console.log(`🔍 Análisis Python-style: ${contenidoPeligroso.length} categorías peligrosas, max riesgo: ${(maxRiesgo * 100).toFixed(2)}%`);

    return esApto;
  }

  private calcularPuntuacionRiesgoPythonStyle(puntuaciones: Record<string, number>): number {
    const categoriasPeligrosas = [
      "violence", "blood", "weapon", "gun", "knife",
      "nudity", "sexual content", "drugs"
    ];
    
    let maxRiesgo = 0.0;
    
    categoriasPeligrosas.forEach(categoria => {
      const probabilidad = puntuaciones[categoria] || 0;
      if (probabilidad > maxRiesgo) {
        maxRiesgo = probabilidad;
      }
    });
    
    return maxRiesgo;
  }

  private obtenerContenidoDetectadoPythonStyle(puntuaciones: Record<string, number>): any[] {
    const categoriasPeligrosas = [
      "violence", "blood", "weapon", "gun", "knife",
      "nudity", "sexual content", "drugs"
    ];
    
    const detectados: any[] = [];
    
    categoriasPeligrosas.forEach(categoria => {
      const probabilidad = puntuaciones[categoria] || 0;
      
      if (probabilidad > 0.2) { // ✅ Mismo umbral que Python
        detectados.push({
          concepto: categoria,
          probabilidad: probabilidad
        });
      }
    });
    
    return detectados;
  }

  private obtenerRazonesRechazoPythonStyle(puntuaciones: Record<string, number>): string[] {
    const razones: string[] = [];
    const categoriasPeligrosas = [
      "violence", "blood", "weapon", "gun", "knife",
      "nudity", "sexual content", "drugs"
    ];
    
    categoriasPeligrosas.forEach(categoria => {
      const probabilidad = puntuaciones[categoria] || 0;
      
      if (probabilidad > 0.2) {
        const nivel = probabilidad >= 0.4 ? 'ALTO RIESGO' : 'RIESGO MODERADO';
        razones.push(`${categoria} (${Math.round(probabilidad * 100)}% - ${nivel})`);
      }
    });
    
    return razones;
  }

  // Métodos de estado
  estaListo(): boolean {
    return this.cargado;
  }

  estaInicializando(): boolean {
    return this.inicializacionEnCurso;
  }

  obtenerEstado(): ClipHealthStatus {
    return {
      status: this.cargado ? 'ready' : (this.inicializacionEnCurso ? 'initializing' : 'error'),
      modelos_listos: this.cargado,
      inicializacion_en_curso: this.inicializacionEnCurso,
      timestamp: Date.now(),
      service: "clip-integrado-ts",
      modelo: "CLIP-base-patch32"
    };
  }
}

export const clipAnalyzerService = new ClipAnalyzerService();