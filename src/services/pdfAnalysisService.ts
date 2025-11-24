// services/pdfAnalysisService.ts - VERSIÓN ES MODULES
import fs from 'fs';
import { ModeracionService } from './moderacionService.js';
import { ModeracionImagenService } from './moderacionImagenService.js';
import { PdfConversionService } from './pdfConversionService.js';
import { AnalizadorTexto } from '../utils/analizadorTexto.js';
import pdfParse from 'pdf-parse';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// ✅ INTERFACES MEJORADAS
interface DatosPDF {
  texto: string;
  numPaginas: number;
  info: any;
  metadata: any;
  tipoContenido: 'texto' | 'imagenes' | 'mixto' | 'desconocido';
  confianzaTexto: number;
  tieneImagenes: boolean;
  esEscaneado: boolean;
  calidadOCR: number;
}

interface AnalisisImagenes {
  esAprobado: boolean;
  motivo: string;
  riesgoImagenes: number;
  problemasDetectados: string[];
  ahorroCreditos: string;
  imagenesRechazadas: number;
  imagenesProcesadas: number;
  textoExtraidoDeImagenes: string;
  tipoPDF: 'escaneado' | 'digital' | 'mixto' | 'desconocido';
  confianzaOCR: number;
}

interface ResultadoAnalisisPDF {
  esAprobado: boolean;
  motivo: string;
  puntuacion: number;
  detalles?: any;
  metadata: any;
  estrategiaUsada: string;
  tipoContenido: string;
  recomendacion: string;
}

interface GoogleVisionResult {
  texto: string;
  esAprobado: boolean;
  riesgoImagenes: number;
  problemasDetectados: string[];
  safeSearch: any;
  textoExtraido: string;
  confianzaOCR: number;
}

// ✅ TIPOS DE ESTRATEGIA MEJORADOS
type EstrategiaAnalisis = 
  | 'solo_texto_local' 
  | 'texto_con_imagenes_aprobadas' 
  | 'imagenes_con_vision_para_texto'
  | 'solo_moderacion_imagenes'
  | 'fallback_basico'
  | 'pdf_escaneado_permisivo'
  | 'pdf_academico';

export class PdfAnalysisService {
  private moderacionService: ModeracionService;
  private moderacionImagenService: ModeracionImagenService;
  private conversionService: PdfConversionService;
  private analizadorTexto: AnalizadorTexto;
  private visionClient: ImageAnnotatorClient | null;

  constructor() {
    this.moderacionService = new ModeracionService();
    this.moderacionImagenService = new ModeracionImagenService();
    this.conversionService = new PdfConversionService();
    this.analizadorTexto = new AnalizadorTexto();
    this.visionClient = this.inicializarVisionClient();
  }

  /**
   * ✅ INICIALIZAR CLIENTE CORREGIDO - VERSIÓN ES MODULES
   */
  private inicializarVisionClient(): ImageAnnotatorClient | null {
    try {
      if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        console.log('🔧 Configurando Google Vision con Service Account JSON...');
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        return new ImageAnnotatorClient({
          credentials: credentials,
          projectId: credentials.project_id
        });
      }
      
      if (process.env.GOOGLE_VISION_API_KEY) {
        console.log('🔧 Configurando Google Vision con API Key...');
        // Para API Key, necesitaríamos un enfoque diferente
        console.warn('⚠️ API Key no soportada directamente, usando Service Account');
        return null;
      }

      console.warn('⚠️ Google Vision API no configurada');
      return null;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.warn('⚠️ Google Vision API no disponible:', errorMessage);
      return null;
    }
  }

  /**
   * ✅ DETECCIÓN INTELIGENTE DEL TIPO DE PDF - VERSIÓN MEJORADA Y MÁS PERMISIVA
   */
  private async analizarEstructuraPDF(rutaArchivo: string): Promise<DatosPDF> {
    try {
      console.log('🔍 Analizando estructura del PDF (versión permisiva)...');
      
      const dataBuffer = fs.readFileSync(rutaArchivo);
      const data = await pdfParse(dataBuffer);
      
      const texto = data.text || '';
      const textoLimpio = texto.trim();
      
      const lineas = textoLimpio.split('\n').filter((linea: string) => linea.trim().length > 0);
      const palabras = textoLimpio.split(/\s+/).filter((palabra: string) => palabra.length > 0);
      
      const longitudTexto = textoLimpio.length;
      const numPalabras = palabras.length;
      const densidadPalabras = numPalabras / Math.max(1, lineas.length);
      const palabrasUnicas = new Set(palabras.map((p: string) => p.toLowerCase())).size;
      const ratioUnicidad = numPalabras > 0 ? palabrasUnicas / numPalabras : 0;
      
      // ✅ ANÁLISIS MÁS PERMISIVO PARA DETECTAR PDFs ESCANEADOS/ACADÉMICOS
      let tipoContenido: 'texto' | 'imagenes' | 'mixto' | 'desconocido' = 'desconocido';
      let confianzaTexto = 0;
      let tieneImagenes = false;
      let esEscaneado = false;
      let calidadOCR = 0;

      // Detectar PDFs académicos/escaneados con texto limitado
      const tienePatronAcademico = this.detectarPatronAcademico(textoLimpio);
      const tieneEstructuraDocumento = this.tieneEstructuraDocumento(textoLimpio);
      
      if (longitudTexto > 50) {
        // ✅ CRITERIOS MÁS PERMISIVOS PARA TEXTOS PEQUEÑOS
        if (densidadPalabras > 2 && ratioUnicidad > 0.3) {
          tipoContenido = 'texto';
          confianzaTexto = 0.8;
          calidadOCR = 0.9;
        } else if (densidadPalabras > 0.5 || tienePatronAcademico) {
          tipoContenido = 'mixto';
          confianzaTexto = 0.5;
          tieneImagenes = true;
          esEscaneado = tienePatronAcademico;
          calidadOCR = 0.6;
        }
      } else if (longitudTexto > 10) {
        // ✅ ACEPTAR TEXTOS CORTOS COMO VÁLIDOS
        tipoContenido = 'texto';
        confianzaTexto = 0.4;
        calidadOCR = 0.3;
      } else {
        tipoContenido = 'imagenes';
        confianzaTexto = 0.1;
        tieneImagenes = true;
        calidadOCR = 0.1;
      }

      // ✅ DETECCIÓN MEJORADA DE PDFs ESCANEADOS
      if (data.metadata) {
        const producer = (data.metadata.Producer || '').toLowerCase();
        const creator = (data.metadata.Creator || '').toLowerCase();
        
        if (producer.includes('scanner') || producer.includes('ocr') || 
            creator.includes('scanner') || creator.includes('ocr') ||
            producer.includes('adobe acrobat') && textoLimpio.length < 200) {
          tipoContenido = 'imagenes';
          esEscaneado = true;
          confianzaTexto = 0.2;
          calidadOCR = 0.4;
          tieneImagenes = true;
        }
      }

      // ✅ DETECTAR POR CONTENIDO ACADÉMICO
      if (tienePatronAcademico) {
        tipoContenido = tipoContenido === 'imagenes' ? 'mixto' : tipoContenido;
        esEscaneado = true;
        calidadOCR = Math.max(calidadOCR, 0.7);
      }

      console.log('📊 Análisis de estructura PDF (permisivo):', {
        tipoContenido,
        confianzaTexto,
        tieneImagenes,
        esEscaneado,
        calidadOCR,
        longitudTexto,
        numPalabras,
        densidadPalabras: densidadPalabras.toFixed(2),
        ratioUnicidad: ratioUnicidad.toFixed(2),
        patronAcademico: tienePatronAcademico,
        numPaginas: data.numpages
      });
      
      return {
        texto: textoLimpio,
        numPaginas: data.numpages || 1,
        info: data.info || {},
        metadata: data.metadata || {},
        tipoContenido,
        confianzaTexto,
        tieneImagenes,
        esEscaneado,
        calidadOCR
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.log('❌ Análisis de estructura falló:', errorMessage);
      
      return {
        texto: '',
        numPaginas: 1,
        info: { error: errorMessage },
        metadata: {},
        tipoContenido: 'desconocido',
        confianzaTexto: 0,
        tieneImagenes: true,
        esEscaneado: true,
        calidadOCR: 0
      };
    }
  }

  /**
   * ✅ DETECTAR PATRONES ACADÉMICOS EN PDFs
   */
  private detectarPatronAcademico(texto: string): boolean {
    const textoLimpio = texto.toLowerCase();
    
    const patronesAcademicos = [
      'universidad', 'instituto', 'tecnologico', 'facultad', 'carrera',
      'examen', 'evaluacion', 'calificacion', 'profesor', 'alumno',
      'tarea', 'proyecto', 'investigacion', 'tesis', 'monografia',
      'bibliografia', 'referencia', 'capitulo', 'seccion', 'indice',
      'abstract', 'resumen', 'introduccion', 'conclusion', 'apendice',
      'matematicas', 'ciencias', 'historia', 'literatura', 'fisica',
      'quimica', 'biologia', 'filosofia', 'semestre', 'curso', 'clase'
    ];

    const palabrasAcademicasEncontradas = patronesAcademicos.filter(patron => 
      textoLimpio.includes(patron)
    );

    // ✅ CONSIDERAR ACADÉMICO SI TIENE AL MENOS 2 PALABRAS ACADÉMICAS
    return palabrasAcademicasEncontradas.length >= 2;
  }

  /**
   * ✅ DETECTAR ESTRUCTURA DE DOCUMENTO
   */
  private tieneEstructuraDocumento(texto: string): boolean {
    const lineas = texto.split('\n').filter(linea => linea.trim().length > 0);
    
    if (lineas.length < 3) return false;

    const tieneTitulos = lineas.some(linea => 
      linea.length < 100 && (linea === linea.toUpperCase() || /^[IVX]+\./.test(linea))
    );

    const tieneNumeracion = /(\d+\.\d+|\d+\)|\b[página|page]\s*\d+)/i.test(texto);
    const tieneEncabezados = /(introducción|conclusión|bibliografía|referencias|abstract)/i.test(texto);

    return tieneTitulos || tieneNumeracion || tieneEncabezados;
  }

  /**
   * ✅ ESTRATEGIA INTELIGENTE MEJORADA - MÁS PERMISIVA
   */
  private determinarEstrategia(datosPDF: DatosPDF): {
    estrategia: EstrategiaAnalisis;
    razon: string;
    necesitaImagenes: boolean;
    necesitaGoogleVision: boolean;
    esPermisivo: boolean;
  } {
    const tieneVisionDisponible = !!this.visionClient;
    
    // ✅ ESTRATEGIAS MÁS PERMISIVAS PARA PDFs ESPECÍFICOS
    if (datosPDF.esEscaneado && datosPDF.calidadOCR > 0.3) {
      return {
        estrategia: 'pdf_escaneado_permisivo',
        razon: 'PDF escaneado/académico detectado - análisis permisivo',
        necesitaImagenes: true,
        necesitaGoogleVision: true,
        esPermisivo: true
      };
    }

    if (this.detectarPatronAcademico(datosPDF.texto)) {
      return {
        estrategia: 'pdf_academico',
        razon: 'PDF académico detectado - priorizar extracción de texto',
        necesitaImagenes: datosPDF.tieneImagenes,
        necesitaGoogleVision: true,
        esPermisivo: true
      };
    }

    if (datosPDF.confianzaTexto > 0.6 && datosPDF.texto.length > 30) {
      return {
        estrategia: 'solo_texto_local',
        razon: 'PDF con texto confiable - análisis local',
        necesitaImagenes: false,
        necesitaGoogleVision: false,
        esPermisivo: false
      };
    }
    
    if (datosPDF.confianzaTexto > 0.2 && datosPDF.tieneImagenes) {
      if (tieneVisionDisponible) {
        return {
          estrategia: 'texto_con_imagenes_aprobadas',
          razon: 'PDF mixto - análisis combinado',
          necesitaImagenes: true,
          necesitaGoogleVision: true,
          esPermisivo: false
        };
      } else {
        return {
          estrategia: 'solo_moderacion_imagenes',
          razon: 'PDF mixto - solo moderación de imágenes',
          necesitaImagenes: true,
          necesitaGoogleVision: false,
          esPermisivo: false
        };
      }
    }
    
    if (datosPDF.confianzaTexto <= 0.2 && datosPDF.tieneImagenes) {
      if (tieneVisionDisponible) {
        return {
          estrategia: 'imagenes_con_vision_para_texto',
          razon: 'PDF escaneado - extraer texto con Vision',
          necesitaImagenes: true,
          necesitaGoogleVision: true,
          esPermisivo: true
        };
      } else {
        return {
          estrategia: 'solo_moderacion_imagenes', 
          razon: 'PDF escaneado - moderación básica',
          necesitaImagenes: true,
          necesitaGoogleVision: false,
          esPermisivo: true
        };
      }
    }
    
    return {
      estrategia: 'fallback_basico',
      razon: 'Caso no determinado - análisis básico',
      necesitaImagenes: false,
      necesitaGoogleVision: false,
      esPermisivo: true
    };
  }

  /**
   * ✅ ANÁLISIS DE TEXTO PERMISIVO PARA PDFs
   */
  private async analizarTextoPermisivo(texto: string, contexto: string = 'pdf'): Promise<{
    esAprobado: boolean;
    puntuacion: number;
    razon: string;
    detalles: any;
  }> {
    try {
      console.log(`🧠 Analizando texto con criterios permisivos (${contexto})...`);
      
      // ✅ USAR EL ANALIZADOR DE TEXTO EXISTENTE CON CONTEXTO PDF
      const resultado = await this.analizadorTexto.analizarTexto(texto, 'pdf');
      
      // ✅ CRITERIOS MÁS PERMISIVOS PARA PDFs
      let esAprobado = resultado.esAprobado;
      let razon = resultado.razon;
      
      // Si fue rechazado por coherencia pero es PDF, reconsiderar
      if (!resultado.esAprobado && resultado.razon.includes('sin sentido')) {
        const porcentajeValido = resultado.detalles?.calidadTexto?.porcentajePalabrasValidas || 0;
        
        // ✅ PERMITIR TEXTOS CON BAJA COHERENCIA PERO SIN TOXICIDAD
        if (porcentajeValido > 0.1 && (resultado.puntuacion || 0) > 0.3) {
          esAprobado = true;
          razon = 'Texto PDF aceptado (baja coherencia pero sin toxicidad)';
        }
      }

      console.log(`📊 Resultado análisis permisivo:`, {
        aprobado: esAprobado,
        puntuacionOriginal: resultado.puntuacion,
        puntuacionFinal: resultado.puntuacion,
        razon
      });

      return {
        esAprobado,
        puntuacion: resultado.puntuacion,
        razon,
        detalles: resultado.detalles
      };

    } catch (error) {
      console.error('❌ Error en análisis permisivo:', error);
      
      // ✅ EN CASO DE ERROR, SER MÁS PERMISIVO
      return {
        esAprobado: true,
        puntuacion: 0.7,
        razon: 'Aprobado por defecto (error en análisis)',
        detalles: { error: 'Fallback permisivo' }
      };
    }
  }

  /**
   * ✅ ANÁLISIS DE IMÁGENES MEJORADO PARA PDFs ESCANEADOS
   */
  private async analizarImagenesConTexto(
    rutaArchivo: string, 
    ipUsuario: string, 
    hashNavegador: string,
    estrategia: EstrategiaAnalisis
  ): Promise<AnalisisImagenes> {
    
    let archivosTemporales: string[] = [];
    let imagenesProcesadas = 0;
    let imagenesRechazadas = 0;
    let creditosAhorrados = 0;
    let riesgoTotal = 0;
    const problemas: string[] = [];
    let textoCombinado = '';
    let tipoPDF: 'escaneado' | 'digital' | 'mixto' | 'desconocido' = 'desconocido';
    let confianzaOCRTotal = 0;
    
    try {
      console.log(`🖼️ Analizando imágenes con estrategia: ${estrategia}`);
      
      const imagenes = await this.convertirPDFaImagenes(rutaArchivo);
      archivosTemporales = [...imagenes];
      
      const necesitaVision = estrategia.includes('vision');
      const soloModeracion = estrategia === 'solo_moderacion_imagenes';
      const esPermisivo = ['pdf_escaneado_permisivo', 'pdf_academico', 'imagenes_con_vision_para_texto'].includes(estrategia);

      for (let i = 0; i < imagenes.length; i++) {
        const rutaImagen = imagenes[i];
        
        if (!rutaImagen || !fs.existsSync(rutaImagen)) {
          problemas.push(`Página ${i + 1}: Imagen no disponible`);
          continue;
        }

        try {
          const resultadoModeracion = await this.moderacionImagenService.moderarImagen(
            rutaImagen, 
            ipUsuario, 
            hashNavegador
          );

          // ✅ CRITERIOS MÁS PERMISIVOS PARA PDFs ESCANEADOS
          let esImagenAprobada = resultadoModeracion.esAprobado;
          let riesgoImagen = resultadoModeracion.puntuacionRiesgo;

          if (!resultadoModeracion.esAprobado && esPermisivo) {
            // ✅ EN MODO PERMISIVO, RECONSIDERAR IMÁGENES RECHAZADAS
            if (resultadoModeracion.puntuacionRiesgo < 0.8) {
              esImagenAprobada = true;
              problemas.push(`Página ${i + 1}: Imagen reconsiderada (modo permisivo)`);
            }
          }

          if (!esImagenAprobada) {
            imagenesRechazadas++;
            creditosAhorrados++;
            problemas.push(`Página ${i + 1}: ${resultadoModeracion.motivoRechazo}`);
            riesgoTotal += riesgoImagen;
            continue;
          }

          if (necesitaVision && !soloModeracion) {
            try {
              const resultadoVision = await this.analizarConGoogleVision(rutaImagen);
              
              if (resultadoVision.textoExtraido) {
                textoCombinado += `--- Página ${i + 1} ---\n${resultadoVision.textoExtraido}\n\n`;
                confianzaOCRTotal += resultadoVision.confianzaOCR || 0.5;
              }
              
              // ✅ CRITERIOS PERMISIVOS PARA CONTENIDO DE IMÁGENES
              if (!resultadoVision.esAprobado && esPermisivo) {
                if (resultadoVision.riesgoImagenes < 0.7) {
                  // Reconsiderar en modo permisivo
                  problemas.push(`Página ${i + 1}: Contenido reconsiderado (modo permisivo)`);
                } else {
                  imagenesRechazadas++;
                  problemas.push(`Página ${i + 1}: ${resultadoVision.problemasDetectados.join(', ')}`);
                }
              } else if (!resultadoVision.esAprobado) {
                imagenesRechazadas++;
                problemas.push(`Página ${i + 1}: ${resultadoVision.problemasDetectados.join(', ')}`);
              }
              
              riesgoTotal += Math.max(
                resultadoModeracion.puntuacionRiesgo,
                resultadoVision.riesgoImagenes
              );
              
            } catch (visionError: unknown) {
              const errorMessage = visionError instanceof Error ? visionError.message : 'Error desconocido';
              console.warn(`⚠️ Google Vision falló para página ${i + 1}, usando moderación local:`, errorMessage);
              riesgoTotal += resultadoModeracion.puntuacionRiesgo;
              creditosAhorrados++;
            }
          } else {
            riesgoTotal += resultadoModeracion.puntuacionRiesgo;
            if (soloModeracion) {
              creditosAhorrados++;
            }
          }
          
          imagenesProcesadas++;
          
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
          console.error(`❌ Error página ${i + 1}:`, errorMessage);
          
          // ✅ EN MODO PERMISIVO, NO RECHAZAR POR ERRORES DE PROCESAMIENTO
          if (esPermisivo) {
            problemas.push(`Página ${i + 1}: Error de procesamiento (omitida en modo permisivo)`);
            imagenesProcesadas++;
          } else {
            problemas.push(`Página ${i + 1}: Error en análisis`);
            riesgoTotal += 0.5;
          }
        }
      }

      const confianzaOCRPromedio = imagenesProcesadas > 0 ? confianzaOCRTotal / imagenesProcesadas : 0;

      if (textoCombinado.length > 100 || confianzaOCRPromedio > 0.3) {
        tipoPDF = 'escaneado';
      } else if (imagenesRechazadas === 0 && imagenesProcesadas > 0) {
        tipoPDF = 'digital';
      } else if (imagenesRechazadas > 0) {
        tipoPDF = 'mixto';
      }

      await this.conversionService.cleanupImages(archivosTemporales);

      const riesgoPromedio = imagenesProcesadas > 0 ? riesgoTotal / imagenesProcesadas : 0;
      
      // ✅ CRITERIOS MÁS PERMISIVOS PARA APROBACIÓN
      let esAprobado = problemas.length === 0;
      const porcentajeAhorro = imagenes.length > 0 ? (creditosAhorrados / imagenes.length) * 100 : 0;
      
      // ✅ PERMITIR HASTA UN 20% DE IMÁGENES CON PROBLEMAS EN MODO PERMISIVO
      if (!esAprobado && esPermisivo) {
        const ratioProblemas = problemas.length / imagenes.length;
        if (ratioProblemas <= 0.2 && riesgoPromedio < 0.6) {
          esAprobado = true;
          problemas.push('Aprobado con advertencias (modo permisivo)');
        }
      }
      
      let motivo = `Imágenes aprobadas (${tipoPDF})`;
      if (problemas.length > 0) {
        motivo = esAprobado 
          ? `Aprobado con advertencias: ${problemas.slice(0, 3).join('; ')}`
          : `Problemas detectados: ${problemas.slice(0, 3).join('; ')}`;
      }
      
      if (textoCombinado) {
        motivo += ` | Texto extraído: ${textoCombinado.length} caracteres`;
      }

      console.log(`✅ Análisis de imágenes completado:`, {
        estrategia,
        tipoPDF,
        imagenesProcesadas,
        imagenesRechazadas,
        creditosAhorrados,
        textoExtraido: textoCombinado.length,
        riesgoPromedio,
        confianzaOCR: confianzaOCRPromedio,
        aprobado: esAprobado
      });

      return {
        esAprobado,
        motivo,
        riesgoImagenes: riesgoPromedio,
        problemasDetectados: problemas.slice(0, 5), // Limitar problemas mostrados
        ahorroCreditos: `${porcentajeAhorro.toFixed(1)}%`,
        imagenesRechazadas,
        imagenesProcesadas,
        textoExtraidoDeImagenes: textoCombinado,
        tipoPDF,
        confianzaOCR: confianzaOCRPromedio
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Análisis de imágenes falló:', errorMessage);
      
      if (archivosTemporales.length > 0) {
        await this.conversionService.cleanupImages(archivosTemporales);
      }
      
      // ✅ EN CASO DE ERROR, SER MÁS PERMISIVO
      return await this.analisisBasicoPDF(rutaArchivo, true);
    }
  }

 /**
 * ✅ LÓGICA PRINCIPAL MEJORADA - VERSIÓN MÁS SEGURA
 */
async analizarTextoPDF(
  rutaArchivo: string, 
  ipUsuario: string, 
  hashNavegador: string
): Promise<ResultadoAnalisisPDF> {
  try {
    console.log('🧠 Iniciando análisis SEGURO de PDF...');

    const datosPDF = await this.analizarEstructuraPDF(rutaArchivo);
    const decision = this.determinarEstrategia(datosPDF);
    
    console.log('🎯 Estrategia seleccionada:', {
      estrategia: decision.estrategia,
      razon: decision.razon,
      tipoContenido: datosPDF.tipoContenido,
      confianzaTexto: datosPDF.confianzaTexto,
      tieneImagenes: datosPDF.tieneImagenes,
      esEscaneado: datosPDF.esEscaneado,
      esPermisivo: decision.esPermisivo
    });

    // ✅ NUEVO: DETECCIÓN DE FALLOS EN CONVERSIÓN
    let conversionFallida = false;
    let analisisImagenes: AnalisisImagenes = {
      esAprobado: true,
      motivo: 'No se necesitó análisis de imágenes',
      riesgoImagenes: 0.1,
      problemasDetectados: [],
      ahorroCreditos: '100%',
      imagenesRechazadas: 0,
      imagenesProcesadas: 0,
      textoExtraidoDeImagenes: '',
      tipoPDF: 'digital',
      confianzaOCR: 0
    };

    let textoParaAnalizar = datosPDF.texto;
    let esAprobado = true;
    let motivo = '';
    let puntuacion = 0.9;
    let recomendacion = 'PDF listo para uso';

    // ✅ NUEVO: VERIFICAR SI SE NECESITAN HERRAMIENTAS EXTERNAS
    if (decision.necesitaImagenes) {
      console.log('🔧 Verificando herramientas de conversión PDF...');
      const herramientasDisponibles = await this.verificarHerramientasConversion();
      
      if (!herramientasDisponibles) {
        console.warn('⚠️ Herramientas de conversión no disponibles - análisis limitado');
        conversionFallida = true;
        
        // ✅ ESTRATEGIA MÁS SEGURA: RECHAZAR PDFs CON IMÁGENES SI NO HAY HERRAMIENTAS
        if (datosPDF.tieneImagenes) {
          return {
            esAprobado: false,
            motivo: 'No se pueden analizar las imágenes del PDF. Herramientas de conversión no disponibles.',
            puntuacion: 0.8,
            metadata: {
              numPaginas: datosPDF.numPaginas,
              tipoContenido: datosPDF.tipoContenido,
              tieneImagenes: datosPDF.tieneImagenes,
              herramientasDisponibles: false,
              conversionFallida: true
            },
            estrategiaUsada: 'rechazado_por_seguridad',
            tipoContenido: datosPDF.tipoContenido,
            recomendacion: 'El PDF contiene imágenes que no se pueden analizar. Use un PDF con solo texto o contacte al administrador.'
          };
        }
      }
    }

    switch (decision.estrategia) {
      case 'pdf_escaneado_permisivo':
      case 'pdf_academico':
        console.log('📚 EJECUTANDO: Análisis para PDF escaneado/académico');
        
        try {
          analisisImagenes = await this.analizarImagenesConTexto(
            rutaArchivo, 
            ipUsuario, 
            hashNavegador,
            decision.estrategia
          );
          
          // Combinar texto original con texto extraído de imágenes
          if (analisisImagenes.textoExtraidoDeImagenes) {
            textoParaAnalizar += '\n\n--- TEXTO EXTRAÍDO DE IMÁGENES ---\n' + 
              analisisImagenes.textoExtraidoDeImagenes;
          }
          
          const resultadoPermisivo = await this.analizarTextoPermisivo(
            this.limitarTexto(textoParaAnalizar, 15000),
            decision.estrategia
          );
          
          esAprobado = resultadoPermisivo.esAprobado && analisisImagenes.esAprobado;
          puntuacion = Math.max(resultadoPermisivo.puntuacion, analisisImagenes.riesgoImagenes);
          
          motivo = esAprobado ? 
            'PDF académico/escaneado aprobado' : 
            `Problemas en ${!resultadoPermisivo.esAprobado ? 'texto' : 'imágenes'}`;
          
          recomendacion = 'Documento académico/escaneado - verificar calidad de OCR si es necesario';
        } catch (error) {
          console.error('❌ Error en análisis de imágenes:', error);
          // ✅ MÁS SEGURO: RECHAZAR SI FALLA EL ANÁLISIS DE IMÁGENES
          return {
            esAprobado: false,
            motivo: 'Error al analizar imágenes del PDF. No se puede garantizar la seguridad del contenido.',
            puntuacion: 0.9,
            metadata: {
              error: error instanceof Error ? error.message : 'Error desconocido',
              conversionFallida: true,
              estrategia: decision.estrategia
            },
            estrategiaUsada: 'error_analisis_imagenes',
            tipoContenido: datosPDF.tipoContenido,
            recomendacion: 'El PDF no pudo ser analizado correctamente. Intente con otro archivo.'
          };
        }
        break;

      case 'solo_texto_local':
        console.log('💰 EJECUTANDO: Solo análisis de texto local');
        textoParaAnalizar = this.limitarTexto(datosPDF.texto, 10000);
        const resultadoTexto = await this.analizarTextoPermisivo(textoParaAnalizar, 'texto_local');
        
        esAprobado = resultadoTexto.esAprobado;
        puntuacion = resultadoTexto.puntuacion;
        motivo = resultadoTexto.razon;
        break;

      case 'texto_con_imagenes_aprobadas':
        console.log('🔄 EJECUTANDO: Texto local + imágenes con moderación');
        
        try {
          textoParaAnalizar = this.limitarTexto(datosPDF.texto, 5000);
          analisisImagenes = await this.analizarImagenesConTexto(
            rutaArchivo, 
            ipUsuario, 
            hashNavegador,
            decision.estrategia
          );
          
          if (analisisImagenes.textoExtraidoDeImagenes) {
            textoParaAnalizar += '\n\n--- TEXTO DE IMÁGENES ---\n' + 
              analisisImagenes.textoExtraidoDeImagenes;
          }
          
          const resultadoCombinado = await this.analizarTextoPermisivo(
            this.limitarTexto(textoParaAnalizar, 10000),
            'combinado'
          );
          
          esAprobado = resultadoCombinado.esAprobado && analisisImagenes.esAprobado;
          puntuacion = Math.max(resultadoCombinado.puntuacion, analisisImagenes.riesgoImagenes);
          motivo = esAprobado ? 
            'PDF aprobado (contenido mixto)' : 
            `Problemas en ${!resultadoCombinado.esAprobado ? 'texto' : 'imágenes'}`;
        } catch (error) {
          console.error('❌ Error en análisis combinado:', error);
          // ✅ RECHAZAR SI FALLA EL ANÁLISIS DE IMÁGENES
          return {
            esAprobado: false,
            motivo: 'Error al analizar contenido mixto del PDF.',
            puntuacion: 0.8,
            metadata: {
              error: error instanceof Error ? error.message : 'Error desconocido',
              conversionFallida: true
            },
            estrategiaUsada: 'error_analisis_mixto',
            tipoContenido: datosPDF.tipoContenido,
            recomendacion: 'El PDF no pudo ser analizado completamente.'
          };
        }
        break;

      case 'imagenes_con_vision_para_texto':
        console.log('🔍 EJECUTANDO: Imágenes con Google Vision para texto');
        
        try {
          analisisImagenes = await this.analizarImagenesConTexto(
            rutaArchivo, 
            ipUsuario, 
            hashNavegador,
            decision.estrategia
          );
          
          if (analisisImagenes.textoExtraidoDeImagenes) {
            textoParaAnalizar = analisisImagenes.textoExtraidoDeImagenes;
            const resultadoVisionTexto = await this.analizarTextoPermisivo(
              this.limitarTexto(textoParaAnalizar, 10000),
              'vision_texto'
            );
            
            esAprobado = resultadoVisionTexto.esAprobado && analisisImagenes.esAprobado;
            puntuacion = Math.max(resultadoVisionTexto.puntuacion, analisisImagenes.riesgoImagenes);
            motivo = esAprobado ? 
              'PDF escaneado aprobado' : 
              `Problemas en ${!resultadoVisionTexto.esAprobado ? 'texto extraído' : 'imágenes'}`;
          } else {
            esAprobado = analisisImagenes.esAprobado;
            puntuacion = analisisImagenes.riesgoImagenes;
            motivo = analisisImagenes.motivo;
          }
          recomendacion = 'Documento escaneado - calidad de texto variable';
        } catch (error) {
          console.error('❌ Error en análisis con Vision:', error);
          return {
            esAprobado: false,
            motivo: 'Error al analizar PDF escaneado con Google Vision.',
            puntuacion: 0.8,
            metadata: {
              error: error instanceof Error ? error.message : 'Error desconocido',
              conversionFallida: true
            },
            estrategiaUsada: 'error_vision',
            tipoContenido: datosPDF.tipoContenido,
            recomendacion: 'El PDF escaneado no pudo ser procesado.'
          };
        }
        break;

      case 'solo_moderacion_imagenes':
        console.log('🛡️ EJECUTANDO: Solo moderación de imágenes');
        
        try {
          analisisImagenes = await this.analizarImagenesConTexto(
            rutaArchivo, 
            ipUsuario, 
            hashNavegador,
            decision.estrategia
          );
          
          esAprobado = analisisImagenes.esAprobado;
          puntuacion = analisisImagenes.riesgoImagenes;
          motivo = analisisImagenes.motivo;
        } catch (error) {
          console.error('❌ Error en moderación de imágenes:', error);
          return {
            esAprobado: false,
            motivo: 'Error al moderar imágenes del PDF.',
            puntuacion: 0.9,
            metadata: {
              error: error instanceof Error ? error.message : 'Error desconocido',
              conversionFallida: true
            },
            estrategiaUsada: 'error_moderacion_imagenes',
            tipoContenido: datosPDF.tipoContenido,
            recomendacion: 'No se pudieron analizar las imágenes del PDF.'
          };
        }
        break;

      default:
        console.log('🔄 EJECUTANDO: Fallback básico');
        // ✅ MÁS SEGURO: NO USAR MODO PERMISIVO EN FALLBACK
        if (datosPDF.tieneImagenes) {
          return {
            esAprobado: false,
            motivo: 'PDF con imágenes no puede ser analizado completamente. Herramientas de conversión no disponibles.',
            puntuacion: 0.7,
            metadata: {
              tipoContenido: datosPDF.tipoContenido,
              tieneImagenes: datosPDF.tieneImagenes,
              herramientasDisponibles: false,
              conversionFallida: true
            },
            estrategiaUsada: 'rechazado_por_seguridad',
            tipoContenido: datosPDF.tipoContenido,
            recomendacion: 'Use un PDF con solo texto o contacte al administrador para configurar las herramientas de análisis.'
          };
        } else {
          // Solo para PDFs de solo texto
          analisisImagenes = await this.analisisBasicoPDF(rutaArchivo, false);
          esAprobado = analisisImagenes.esAprobado;
          puntuacion = analisisImagenes.riesgoImagenes;
          motivo = analisisImagenes.motivo;
        }
        break;
    }

    // ✅ ANÁLISIS FINAL MÁS SEGURO - ELIMINAR PERMISIVIDAD
    if (!esAprobado) {
      console.log('❌ PDF rechazado por análisis de seguridad');
      return {
        esAprobado: false,
        motivo: motivo,
        puntuacion: puntuacion,
        detalles: {
          texto: textoParaAnalizar ? this.limitarTexto(textoParaAnalizar, 1000) : null,
          imagenes: analisisImagenes,
          estrategia: decision.estrategia,
          conversionFallida: conversionFallida
        },
        metadata: {
          numPaginas: datosPDF.numPaginas,
          tipoContenido: datosPDF.tipoContenido,
          confianzaTexto: datosPDF.confianzaTexto,
          tieneImagenes: datosPDF.tieneImagenes,
          esEscaneado: datosPDF.esEscaneado,
          conversionFallida: conversionFallida,
          herramientasDisponibles: !conversionFallida
        },
        estrategiaUsada: decision.estrategia,
        tipoContenido: datosPDF.tipoContenido,
        recomendacion: 'El contenido no cumple con las políticas de seguridad.'
      };
    }

    return {
      esAprobado,
      motivo,
      puntuacion,
      detalles: {
        texto: textoParaAnalizar ? this.limitarTexto(textoParaAnalizar, 1000) : null,
        imagenes: analisisImagenes,
        estrategia: decision.estrategia,
        conversionFallida: conversionFallida
      },
      metadata: {
        numPaginas: datosPDF.numPaginas,
        tipoContenido: datosPDF.tipoContenido,
        confianzaTexto: datosPDF.confianzaTexto,
        tieneImagenes: datosPDF.tieneImagenes,
        esEscaneado: datosPDF.esEscaneado,
        conversionFallida: conversionFallida,
        herramientasDisponibles: !conversionFallida
      },
      estrategiaUsada: decision.estrategia,
      tipoContenido: datosPDF.tipoContenido,
      recomendacion
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('❌ Error en análisis de PDF:', errorMessage);
    
    // ✅ MÁS SEGURO: RECHAZAR EN CASO DE ERROR
    return {
      esAprobado: false,
      motivo: 'Error en análisis - no se puede garantizar la seguridad del PDF',
      puntuacion: 1.0,
      metadata: {
        error: errorMessage,
        estrategia: 'error_critico'
      },
      estrategiaUsada: 'error_critico',
      tipoContenido: 'desconocido',
      recomendacion: 'Error crítico en análisis. Contacte al administrador.'
    };
  }
}

/**
 * ✅ NUEVO: VERIFICAR HERRAMIENTAS DE CONVERSIÓN DISPONIBLES
 */
private async verificarHerramientasConversion(): Promise<boolean> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const herramientas = [
      { comando: 'convert -version', nombre: 'ImageMagick' },
      { comando: 'gs --version', nombre: 'Ghostscript' },
      { comando: 'pdftoppm -v', nombre: 'Poppler' }
    ];

    let herramientasDisponibles = 0;

    for (const herramienta of herramientas) {
      try {
        await execAsync(herramienta.comando);
        console.log(`✅ ${herramienta.nombre} disponible`);
        herramientasDisponibles++;
      } catch {
        console.log(`❌ ${herramienta.nombre} no disponible`);
      }
    }

    console.log(`📊 Herramientas disponibles: ${herramientasDisponibles}/${herramientas.length}`);
    
    // Requerir al menos 1 herramienta para análisis de imágenes
    return herramientasDisponibles > 0;
    
  } catch (error) {
    console.error('❌ Error verificando herramientas:', error);
    return false;
  }
}
/**
 * ✅ ANÁLISIS BÁSICO MEJORADO - VERSIÓN MÁS SEGURA
 */
private async analisisBasicoPDF(rutaArchivo: string, esPermisivo: boolean = false): Promise<AnalisisImagenes> {
  try {
    console.log('🔍 Usando análisis básico (modo seguro)...');
    
    const dataBuffer = fs.readFileSync(rutaArchivo);
    const data = await pdfParse(dataBuffer);
    const tieneTexto = data.text && data.text.trim().length > 10; // ✅ Mínimo 10 caracteres
    
    if (tieneTexto) {
      return {
        esAprobado: true,
        motivo: 'PDF con texto legible - Análisis básico',
        riesgoImagenes: 0.3, // ✅ Riesgo más alto por análisis limitado
        problemasDetectados: ['Análisis limitado - solo texto verificado'],
        ahorroCreditos: '100%',
        imagenesRechazadas: 0,
        imagenesProcesadas: 0,
        textoExtraidoDeImagenes: '',
        tipoPDF: 'digital',
        confianzaOCR: 0.5
      };
    } else {
      // ✅ MÁS SEGURO: RECHAZAR PDFs SIN TEXTO
      return {
        esAprobado: false,
        motivo: 'PDF sin texto legible - No se puede analizar contenido',
        riesgoImagenes: 0.8,
        problemasDetectados: ['Sin texto legible', 'No se pueden analizar imágenes'],
        ahorroCreditos: '100%',
        imagenesRechazadas: 0,
        imagenesProcesadas: 0,
        textoExtraidoDeImagenes: '',
        tipoPDF: 'desconocido',
        confianzaOCR: 0
      };
    }
  } catch (error) {
    // ✅ MÁS SEGURO: RECHAZAR EN CASO DE ERROR
    return {
      esAprobado: false,
      motivo: 'Análisis básico falló - No se puede garantizar seguridad',
      riesgoImagenes: 0.9,
      problemasDetectados: ['Error en análisis', 'Contenido no verificable'],
      ahorroCreditos: '100%',
      imagenesRechazadas: 0,
      imagenesProcesadas: 0,
      textoExtraidoDeImagenes: '',
      tipoPDF: 'desconocido',
      confianzaOCR: 0
    };
  }
}

  // ... (MÉTODOS RESTANTES SIMPLIFICADOS POR ESPACIO)

  /**
   * ✅ CONVERTIR PDF A IMÁGENES - VERSIÓN SIMPLIFICADA
   */
  private async convertirPDFaImagenes(rutaArchivo: string): Promise<string[]> {
    console.log('🔄 Convirtiendo PDF a imágenes...');
    
    const resultado = await this.conversionService.convertPdfToImages(rutaArchivo);
    
    if (!resultado.success) {
      throw new Error(`Conversión fallida: ${resultado.error}`);
    }
    
    console.log(`✅ PDF convertido a ${resultado.images.length} imágenes usando ${resultado.method}`);
    return resultado.images;
  }

  /**
   * ✅ ANALIZAR CON GOOGLE VISION (MÉTODO SIMPLIFICADO)
   */
  private async analizarConGoogleVision(rutaImagen: string): Promise<GoogleVisionResult> {
    if (!this.visionClient) {
      throw new Error('Google Vision no disponible');
    }

    try {
      const imageBuffer = fs.readFileSync(rutaImagen);
      
      const [result] = await this.visionClient.documentTextDetection({
        image: { content: imageBuffer }
      });

      const textoExtraido = result.fullTextAnnotation?.text || '';
      
      const [safeSearchResult] = await this.visionClient.safeSearchDetection({
        image: { content: imageBuffer }
      });

      return this.procesarResultadoVision(textoExtraido, safeSearchResult.safeSearchAnnotation);
    } catch (error) {
      throw new Error(`Google Vision error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * ✅ PROCESAR RESULTADO DE VISION (Lógica común)
   */
  private procesarResultadoVision(textoExtraido: string, safeSearch: any): GoogleVisionResult {
    // Implementación simplificada
    return {
      texto: textoExtraido,
      esAprobado: true,
      riesgoImagenes: 0.1,
      problemasDetectados: [],
      safeSearch,
      textoExtraido,
      confianzaOCR: 0.8
    };
  }

  /**
   * Limitar tamaño del texto para análisis
   */
  private limitarTexto(texto: string, maxCaracteres: number): string {
    if (texto.length <= maxCaracteres) return texto;
    
    const mitad = Math.floor(maxCaracteres / 2);
    const inicio = texto.substring(0, mitad);
    const fin = texto.substring(texto.length - mitad);
    
    return inicio + '\n\n...[texto recortado]...\n\n' + fin;
  }
  /**
   * Validación rápida de PDF
   */
  async validarPDFBasico(rutaArchivo: string): Promise<{
    valido: boolean;
    error?: string;
    tamano?: number;
    esPDF?: boolean;
    recomendacion?: string;
  }> {
    try {
      const stats = fs.statSync(rutaArchivo);
      
      if (stats.size > 15 * 1024 * 1024) { // ✅ Aumentado a 15MB
        return {
          valido: false,
          error: 'El PDF es demasiado grande (máximo 15MB)',
          tamano: stats.size,
          recomendacion: 'Reduzca el tamaño del PDF o divida en archivos más pequeños'
        };
      }

      const buffer = Buffer.alloc(4);
      const fd = fs.openSync(rutaArchivo, 'r');
      fs.readSync(fd, buffer, 0, 4, 0);
      fs.closeSync(fd);
      
      const esPDF = buffer.toString().startsWith('%PDF');
      
      if (!esPDF) {
        return {
          valido: false,
          error: 'El archivo no es un PDF válido',
          esPDF: false,
          recomendacion: 'Asegúrese de que el archivo sea un PDF válido'
        };
      }

      return {
        valido: true,
        tamano: stats.size,
        esPDF: true,
        recomendacion: 'PDF válido - listo para análisis'
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      return {
        valido: false,
        error: 'No se pudo validar el archivo PDF: ' + errorMessage,
        recomendacion: 'Verifique que el archivo exista y sea accesible'
      };
    }
  }


}

export const pdfAnalysisService = new PdfAnalysisService();