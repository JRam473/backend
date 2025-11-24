// backend/src/utils/analizadorTexto.ts - VERSIÓN SIMPLIFICADA SOLO PERSPECTIVE
import { AnalisisTexto } from '../types/moderacion.js';
import axios from 'axios';

// Configuración de Perspective API
const PERSPECTIVE_API_URL = 'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze';

// Tipos para Perspective API
interface PerspectiveAttributeScores {
  summaryScore: {
    value: number;
    type: string;
  };
}

interface PerspectiveResponse {
  attributeScores: {
    [key: string]: PerspectiveAttributeScores;
  };
  languages: string[];
  detectedLanguages: string[];
}

interface DetallesAnalisisMejorado {
  metodo: string;
  intencion: string;
  calidadTexto?: {
    tieneSentido: boolean;
    porcentajePalabrasValidas: number;
    razon: string;
    confianza?: number;
  };
  longitud: number;
  tienePatronesSpam?: boolean;
  perspectiveScores?: { [key: string]: number };
  cacheUsado?: boolean;
  contexto?: string;
}

export class AnalizadorTexto {
  private cache: Map<string, { resultado: AnalisisTexto; timestamp: number }> = new Map();
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos
  private readonly MAX_CACHE_SIZE = 100;

  /**
   * ANALIZAR TEXTO CON PERSPECTIVE API - VERSIÓN SIMPLIFICADA
   */
  private async analizarConPerspective(texto: string): Promise<{ [key: string]: number }> {
    // Para textos muy cortos o simples, aprobar automáticamente
    if (texto.length < 3 || this.esTextoMuySimple(texto)) {
      console.log('🔍 Texto muy simple, aprobado automáticamente');
      return this.crearPerspectiveResponseDefault();
    }

    if (!process.env.PERSPECTIVE_API_KEY) {
      console.error('❌ PERSPECTIVE_API_KEY no configurada en .env');
      throw new Error('API key de Perspective no configurada');
    }

    console.log('🔗 Enviando a Google Perspective API...');
    
    try {
      const response = await axios.post<PerspectiveResponse>(
        PERSPECTIVE_API_URL,
        {
          comment: { 
            text: texto,
            type: 'PLAIN_TEXT'
          },
          requestedAttributes: {
            TOXICITY: {},
            SEVERE_TOXICITY: {},
            IDENTITY_ATTACK: {},
            INSULT: {},
            PROFANITY: {},
            THREAT: {}
          },
          languages: ['es', 'en'],
          doNotStore: true
        },
        {
          params: {
            key: process.env.PERSPECTIVE_API_KEY
          },
          timeout: 10000
        }
      );

      console.log('✅ Respuesta Perspective API recibida');

      // Extraer scores de la respuesta
      const scores: { [key: string]: number } = {};
      if (response.data.attributeScores) {
        Object.keys(response.data.attributeScores).forEach(attribute => {
          const scoreValue = response.data.attributeScores[attribute]?.summaryScore?.value;
          if (scoreValue !== undefined) {
            scores[attribute] = scoreValue;
          }
        });
      }

      return scores;

    } catch (error: any) {
      console.error('❌ Error en Perspective API:', {
        status: error.response?.status,
        message: error.response?.data?.error?.message || error.message
      });
      
      // Si hay error, usar fallback
      console.log('📊 Usando fallback local por error de API');
      return this.crearPerspectiveResponseDefault();
    }
  }

  /**
   * CALCULAR PUNTUACIÓN BASADA EN PERSPECTIVE
   */
  private calcularPuntuacionPerspective(scores: { [key: string]: number }): number {
    const toxicidad = scores.TOXICITY || 0;
    const severidad = scores.SEVERE_TOXICITY || 0;
    const insulto = scores.INSULT || 0;
    const ataqueIdentidad = scores.IDENTITY_ATTACK || 0;
    const amenaza = scores.THREAT || 0;
    const lenguajeProfano = scores.PROFANITY || 0;

    // Tomar el score más alto de las categorías problemáticas
    const maxScore = Math.max(toxicidad, severidad, insulto, ataqueIdentidad, amenaza, lenguajeProfano);
    
    // Convertir a puntuación inversa (más alto = más peligroso = menor puntuación)
    return Math.max(0.1, 1.0 - maxScore);
  }

  /**
   * GENERAR RAZÓN BASADA EN PERSPECTIVE - VERSIÓN SIMPLIFICADA
   */
  private generarRazonPerspective(scores: { [key: string]: number }): string {
    const categoriasActivas = Object.entries(scores)
      .filter(([category, score]) => (score || 0) > 0.7)
      .map(([category]) => this.traducirCategoria(category));

    if (categoriasActivas.length === 0) {
      return 'Contenido aprobado';
    }

    return `Contenido no aprobado: ${categoriasActivas.join(', ')}`;
  }

  /**
   * DETERMINAR SI EL CONTENIDO ES APROBADO
   */
  private determinarAprobacion(scores: { [key: string]: number }): boolean {
    const categoriasActivas = Object.entries(scores)
      .filter(([category, score]) => (score || 0) > 0.7);

    return categoriasActivas.length === 0;
  }

  /**
   * DETERMINAR INTENCIÓN BASADA EN PERSPECTIVE
   */
  private determinarIntencionPerspective(scores: { [key: string]: number }): string {
    const toxicidad = scores.TOXICITY || 0;
    const severidad = scores.SEVERE_TOXICITY || 0;
    const amenaza = scores.THREAT || 0;
    const ataqueIdentidad = scores.IDENTITY_ATTACK || 0;
    const insulto = scores.INSULT || 0;
    const lenguajeProfano = scores.PROFANITY || 0;

    // Priorizar por severidad
    if (amenaza > 0.8 || severidad > 0.8 || ataqueIdentidad > 0.8) {
      return 'peligroso';
    }

    if (toxicidad > 0.7 || insulto > 0.7 || lenguajeProfano > 0.7) {
      return 'ofensivo';
    }

    if (toxicidad > 0.5) {
      return 'sospechoso';
    }

    return 'inocente';
  }

  /**
   * EXTRAER CATEGORÍAS ACTIVAS
   */
  private extraerCategoriasActivas(scores: { [key: string]: number }): string[] {
    return Object.entries(scores)
      .filter(([category, score]) => (score || 0) > 0.7)
      .map(([category]) => this.traducirCategoria(category));
  }

  /**
   * TRADUCIR CATEGORÍAS DE PERSPECTIVE AL ESPAÑOL
   */
  private traducirCategoria(categoria: string): string {
    const traducciones: Record<string, string> = {
      'TOXICITY': 'toxicidad',
      'SEVERE_TOXICITY': 'toxicidad severa',
      'IDENTITY_ATTACK': 'ataque a identidad',
      'INSULT': 'insulto',
      'PROFANITY': 'lenguaje profano',
      'THREAT': 'amenaza'
    };

    return traducciones[categoria] || categoria;
  }

  /**
   * CREAR RESPUESTA POR DEFECTO PARA PERSPECTIVE
   */
  private crearPerspectiveResponseDefault(): { [key: string]: number } {
    return {
      TOXICITY: 0,
      SEVERE_TOXICITY: 0,
      IDENTITY_ATTACK: 0,
      INSULT: 0,
      PROFANITY: 0,
      THREAT: 0
    };
  }

  /**
   * DETECTAR TEXTOS MUY SIMPLES PARA EVITAR PERSPECTIVE
   */
  private esTextoMuySimple(texto: string): boolean {
    const textoLimpio = texto.toLowerCase().trim();
    
    const textosSimples = [
      'hola', 'holaa', 'holaaa', 'hi', 'hello',
      'gracias', 'thanks', 'thank you',
      'ok', 'okay', 'vale', 'bueno',
      'si', 'no', 'yes', 'yep', 'nope',
      'jeje', 'jaja', 'haha', 'lol'
    ];

    return textosSimples.includes(textoLimpio) || 
           textoLimpio.length <= 3;
  }

  /**
   * OBTENER RESULTADO DEL CACHE
   */
  private obtenerDeCache(texto: string): AnalisisTexto | null {
    const textoHash = this.generarHash(texto);
    const cached = this.cache.get(textoHash);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION_MS) {
      const detallesConCache = {
        ...cached.resultado.detalles,
        cacheUsado: true
      } as AnalisisTexto['detalles'] & { cacheUsado?: boolean };
      
      return { 
        ...cached.resultado, 
        detalles: detallesConCache 
      };
    }
    
    if (cached) {
      this.cache.delete(textoHash);
    }
    
    return null;
  }

  /**
   * GUARDAR RESULTADO EN CACHE
   */
  private guardarEnCache(texto: string, resultado: AnalisisTexto): void {
    const textoHash = this.generarHash(texto);
    
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    
    this.cache.set(textoHash, {
      resultado: { ...resultado },
      timestamp: Date.now()
    });
  }

  /**
   * GENERAR HASH PARA CACHE
   */
  private generarHash(texto: string): string {
    if (texto.length <= 50) {
      return texto.toLowerCase().replace(/\s+/g, '_');
    }
    
    let hash = 0;
    for (let i = 0; i < texto.length; i++) {
      const char = texto.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private crearRespuestaError(razon: string): AnalisisTexto {
    const detalles: DetallesAnalisisMejorado = {
      metodo: 'error',
      intencion: 'sinsentido',
      longitud: 0
    };

    return {
      esAprobado: false,
      puntuacion: 0.1,
      palabrasOfensivas: [],
      razon,
      detalles: detalles as AnalisisTexto['detalles']
    };
  }

  /**
   * ✅ VERSIÓN SIMPLIFICADA: ANALIZAR TEXTO SOLO CON PERSPECTIVE
   */
  async analizarTexto(texto: string, contexto: 'pdf' | 'general' = 'general'): Promise<AnalisisTexto> {
    if (!texto?.trim()) {
      return this.crearRespuestaError('Texto vacío o muy corto');
    }

    console.log(`\n📝 Analizando texto (${contexto}): "${texto.substring(0, 50)}..."`);

    // Verificar cache primero (con contexto)
    const cacheKey = `${contexto}:${texto}`;
    const cachedResult = this.obtenerDeCache(cacheKey);
    if (cachedResult) {
      console.log('💾 Resultado obtenido de cache');
      return cachedResult;
    }

    try {
      const perspectiveResult = await this.analizarConPerspective(texto);
      
      console.log('🔍 Resultado Perspective:', {
        toxicidad: perspectiveResult.TOXICITY,
        categorias: Object.keys(perspectiveResult).filter(key => 
          (perspectiveResult[key] || 0) > 0.7
        )
      });

      // ✅ DECISIÓN SIMPLE: Solo basada en Perspective
      const esAprobado = this.determinarAprobacion(perspectiveResult);
      const puntuacion = this.calcularPuntuacionPerspective(perspectiveResult);
      const razon = this.generarRazonPerspective(perspectiveResult);
      const intencion = this.determinarIntencionPerspective(perspectiveResult);

      console.log(`📊 RESULTADO (${contexto}): Aprobado=${esAprobado}, Puntuación=${puntuacion}`);
      console.log(`🔍 Razón: ${razon}`);

      const detalles: DetallesAnalisisMejorado = {
        metodo: `google-perspective-api`,
        intencion,
        longitud: texto.length,
        perspectiveScores: perspectiveResult,
        contexto: contexto
      };

      const resultado: AnalisisTexto = {
        esAprobado,
        puntuacion,
        palabrasOfensivas: this.extraerCategoriasActivas(perspectiveResult),
        razon,
        detalles: detalles as AnalisisTexto['detalles']
      };

      // Guardar en cache con contexto
      this.guardarEnCache(cacheKey, resultado);

      return resultado;

    } catch (error: any) {
      console.error('❌ Error en análisis de texto:', error.message);
      
      // ✅ FALLBACK SIMPLE: Aprobar por defecto en caso de error
      const detalles: DetallesAnalisisMejorado = {
        metodo: 'fallback-por-error',
        intencion: 'inocente',
        longitud: texto.length
      };

      return {
        esAprobado: true, // ✅ En caso de error, aprobar por defecto
        puntuacion: 0.8,
        palabrasOfensivas: [],
        razon: 'Contenido aprobado (fallback por error técnico)',
        detalles: detalles as AnalisisTexto['detalles']
      };
    }
  }

  // Métodos de compatibilidad (mantener para evitar errores)
  limpiarTexto(texto: string): string {
    return texto;
  }

  agregarPalabrasProhibidas(_palabras: string[]): void {
    console.log('⚠️ Método no disponible en modo Perspective API');
  }

  agregarEjemplosBasura(_ejemplos: string[]): void {
    console.log('⚠️ Método no disponible en modo Perspective API');
  }

  // Métodos vacíos para eliminar conflictos
  private analizarCoherenciaTextoPDF(_texto: string): any {
    return { tieneSentido: true, porcentajeValido: 1, razon: 'Aprobado (PDF)', confianza: 1, problemas: [] };
  }

  private analizarCoherenciaTexto(_texto: string): any {
    return { tieneSentido: true, porcentajeValido: 1, razon: 'Aprobado', confianza: 1, problemas: [] };
  }

  private calcularPuntuacionCombinada(_scores: any, _coherencia: any, _contexto: any): number {
    return 0.9;
  }

  private usarFallbackConCoherencia(texto: string, _coherencia: any, contexto: 'pdf' | 'general'): AnalisisTexto {
    const detalles: DetallesAnalisisMejorado = {
      metodo: `fallback-simple-${contexto}`,
      intencion: 'inocente',
      longitud: texto.length
    };

    return {
      esAprobado: true,
      puntuacion: 0.8,
      palabrasOfensivas: [],
      razon: 'Contenido aprobado (fallback simple)',
      detalles: detalles as AnalisisTexto['detalles']
    };
  }
}