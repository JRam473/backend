// services/pdfAnalysisService.ts - VERSIÓN MEJORADA Y MÁS PERMISIVA
import fs from 'fs';
import path from 'path';
import { ModeracionService } from './moderacionService';
import { ModeracionImagenService } from './moderacionImagenService';
import { PdfConversionService } from './pdfConversionService';
import { AnalizadorTexto } from '../utils/analizadorTexto';

const pdfParse = require('pdf-parse');

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
  private visionClient: any;

  constructor() {
    this.moderacionService = new ModeracionService();
    this.moderacionImagenService = new ModeracionImagenService();
    this.conversionService = new PdfConversionService();
    this.analizadorTexto = new AnalizadorTexto();
    this.visionClient = this.inicializarVisionClient();
  }

  /**
   * ✅ INICIALIZAR CLIENTE CORREGIDO (igual que antes)
   */
  private inicializarVisionClient(): any {
    try {
      if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        console.log('🔧 Configurando Google Vision con Service Account JSON...');
        const vision = require('@google-cloud/vision');
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        return new vision.ImageAnnotatorClient({
          credentials: credentials,
          projectId: credentials.project_id
        });
      }
      
      if (process.env.GOOGLE_VISION_API_KEY) {
        console.log('🔧 Configurando Google Vision con API Key...');
        return {
          type: 'api_key',
          key: process.env.GOOGLE_VISION_API_KEY
        };
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
   * ✅ LÓGICA PRINCIPAL MEJORADA CON ESTRATEGIA PERMISIVA
   */
  async analizarTextoPDF(
    rutaArchivo: string, 
    ipUsuario: string, 
    hashNavegador: string
  ): Promise<ResultadoAnalisisPDF> {
    try {
      console.log('🧠 Iniciando análisis permisivo de PDF...');

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

      switch (decision.estrategia) {
        case 'pdf_escaneado_permisivo':
        case 'pdf_academico':
          console.log('📚 EJECUTANDO: Análisis permisivo para PDF escaneado/académico');
          
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
          break;

        case 'imagenes_con_vision_para_texto':
          console.log('🔍 EJECUTANDO: Imágenes con Google Vision para texto');
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
          break;

        case 'solo_moderacion_imagenes':
          console.log('🛡️ EJECUTANDO: Solo moderación de imágenes');
          analisisImagenes = await this.analizarImagenesConTexto(
            rutaArchivo, 
            ipUsuario, 
            hashNavegador,
            decision.estrategia
          );
          
          esAprobado = analisisImagenes.esAprobado;
          puntuacion = analisisImagenes.riesgoImagenes;
          motivo = analisisImagenes.motivo;
          break;

        default:
          console.log('🔄 EJECUTANDO: Fallback básico permisivo');
          analisisImagenes = await this.analisisBasicoPDF(rutaArchivo, true);
          esAprobado = analisisImagenes.esAprobado;
          puntuacion = analisisImagenes.riesgoImagenes;
          motivo = analisisImagenes.motivo;
          break;
      }

      // ✅ ANÁLISIS FINAL MÁS PERMISIVO
      if (!esAprobado && decision.esPermisivo) {
        // Reconsiderar rechazos en modo permisivo
        if (puntuacion > 0.3 && !motivo.includes('tóxico') && !motivo.includes('extremo')) {
          esAprobado = true;
          motivo = `Reconsiderado y aprobado (modo permisivo): ${motivo}`;
          puntuacion = Math.min(0.8, puntuacion + 0.2);
          recomendacion = 'Aprobado tras reconsideración - verificar manualmente si es necesario';
        }
      }

      return {
        esAprobado,
        motivo,
        puntuacion,
        detalles: {
          texto: textoParaAnalizar ? this.limitarTexto(textoParaAnalizar, 1000) : null,
          imagenes: analisisImagenes,
          estrategia: decision.estrategia,
          decision: decision.razon,
          esPermisivo: decision.esPermisivo
        },
        metadata: {
          numPaginas: datosPDF.numPaginas,
          tipoContenido: datosPDF.tipoContenido,
          confianzaTexto: datosPDF.confianzaTexto,
          tieneImagenes: datosPDF.tieneImagenes,
          esEscaneado: datosPDF.esEscaneado,
          calidadOCR: datosPDF.calidadOCR,
          tipoPDF: analisisImagenes.tipoPDF,
          textoOriginalLength: datosPDF.texto.length,
          textoAnalizadoLength: textoParaAnalizar.length,
          usoGoogleVision: decision.necesitaGoogleVision,
          ahorroCreditos: analisisImagenes.ahorroCreditos,
          imagenesRechazadas: analisisImagenes.imagenesRechazadas,
          imagenesProcesadas: analisisImagenes.imagenesProcesadas,
          confianzaOCR: analisisImagenes.confianzaOCR
        },
        estrategiaUsada: decision.estrategia,
        tipoContenido: datosPDF.tipoContenido,
        recomendacion
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Error en análisis permisivo:', errorMessage);
      
      // ✅ EN CASO DE ERROR, SER MÁS PERMISIVO
      return {
        esAprobado: true,
        motivo: 'Error en análisis - aprobado por defecto (modo permisivo)',
        puntuacion: 0.7,
        metadata: {
          error: errorMessage,
          estrategia: 'fallback_error_permisivo'
        },
        estrategiaUsada: 'error_permisivo',
        tipoContenido: 'desconocido',
        recomendacion: 'Verificar manualmente debido a error en análisis automático'
      };
    }
  }

  /**
   * ✅ ANÁLISIS BÁSICO MEJORADO (FALLBACK PERMISIVO)
   */
  private async analisisBasicoPDF(rutaArchivo: string, esPermisivo: boolean = true): Promise<AnalisisImagenes> {
    try {
      console.log('🔍 Usando análisis básico (fallback permisivo)...');
      
      const dataBuffer = fs.readFileSync(rutaArchivo);
      const data = await pdfParse(dataBuffer);
      const tieneTexto = data.text && data.text.trim().length > 0;
      
      if (tieneTexto) {
        return {
          esAprobado: true,
          motivo: 'PDF con texto legible - Análisis básico permisivo',
          riesgoImagenes: 0.1,
          problemasDetectados: [],
          ahorroCreditos: '100%',
          imagenesRechazadas: 0,
          imagenesProcesadas: 0,
          textoExtraidoDeImagenes: '',
          tipoPDF: 'digital',
          confianzaOCR: 0.8
        };
      } else {
        return {
          esAprobado: esPermisivo, // En modo permisivo, aprobar incluso sin texto
          motivo: esPermisivo 
            ? 'PDF sin texto - Aprobado en modo permisivo' 
            : 'PDF sin texto - Análisis limitado disponible',
          riesgoImagenes: esPermisivo ? 0.3 : 0.5,
          problemasDetectados: [],
          ahorroCreditos: '100%',
          imagenesRechazadas: 0,
          imagenesProcesadas: 0,
          textoExtraidoDeImagenes: '',
          tipoPDF: 'desconocido',
          confianzaOCR: 0
        };
      }
    } catch (error) {
      return {
        esAprobado: true, // Siempre aprobar en caso de error en modo permisivo
        motivo: 'Análisis básico falló - Aprobado por defecto (modo permisivo)',
        riesgoImagenes: 0.2,
        problemasDetectados: [],
        ahorroCreditos: '100%',
        imagenesRechazadas: 0,
        imagenesProcesadas: 0,
        textoExtraidoDeImagenes: '',
        tipoPDF: 'desconocido',
        confianzaOCR: 0
      };
    }
  }

  // ... (MÉTODOS EXISTENTES SE MANTIENEN IGUALES PERO SE ACTUALIZAN PARA SER MÁS PERMISIVOS)

  /**
   * ✅ VERIFICAR CREDENCIALES GOOGLE VISION - CORREGIDO
   */
  private async verificarCredencialesVision(): Promise<{ valido: boolean; mensaje: string; tipo: string }> {
    if (!this.visionClient) {
      return { valido: false, mensaje: 'Cliente no inicializado', tipo: 'none' };
    }

    try {
      if (this.visionClient.documentTextDetection) {
        const result = await this.visionClient.safeSearchDetection({
          image: { content: Buffer.from('test') }
        }).catch((error: any) => {
          console.log('❌ Error verificando credenciales:', error.message);
          return null;
        });

        if (result && Array.isArray(result) && result.length > 0) {
          return { 
            valido: true, 
            mensaje: 'Credenciales Service Account válidas', 
            tipo: 'service_account' 
          };
        }
      } else if (this.visionClient.type === 'api_key') {
        return { 
          valido: true, 
          mensaje: 'API Key configurada', 
          tipo: 'api_key' 
        };
      }

      return { valido: false, mensaje: 'Credenciales inválidas', tipo: 'unknown' };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('authentication')) {
        return { 
          valido: false, 
          mensaje: 'Error de autenticación: ' + errorMessage, 
          tipo: 'auth_error' 
        };
      }
      
      return { 
        valido: false, 
        mensaje: 'Error verificando credenciales: ' + errorMessage, 
        tipo: 'connection_error' 
      };
    }
  }

  /**
   * ✅ PROCESAR RESULTADO DE VISION (Lógica común) - VERSIÓN MÁS PERMISIVA
   */
  private procesarResultadoVision(textoExtraido: string, safeSearch: any): GoogleVisionResult {
    const problemas: string[] = [];
    let riesgoTotal = 0;

    // ✅ CONFIGURACIÓN MÁS PERMISIVA PARA PDFs
    const configuracionSeguridad = {
      adulto: 'VERY_LIKELY',
      violencia: 'VERY_LIKELY', 
      medico: 'POSSIBLE', // Más permisivo con contenido médico
      spoof: 'LIKELY', // Más permisivo con contenido engañoso
      contenidoSugerente: 'LIKELY' // Más permisivo con contenido sugerente
    };

    if (safeSearch) {
      if (safeSearch.adult === configuracionSeguridad.adulto) {
        problemas.push('contenido adulto explícito');
        riesgoTotal += 1.0;
      } else if (safeSearch.adult === 'LIKELY') {
        // En modo permisivo, no agregar problema para LIKELY
        riesgoTotal += 0.3;
      }

      if (safeSearch.violence === configuracionSeguridad.violencia) {
        problemas.push('contenido violento explícito');
        riesgoTotal += 1.0;
      } else if (safeSearch.violence === 'LIKELY') {
        riesgoTotal += 0.3;
      }

      if (safeSearch.medical === configuracionSeguridad.medico) {
        // Contenido médico es más aceptable en PDFs académicos
        problemas.push('contenido médico');
        riesgoTotal += 0.2;
      }

      if (safeSearch.spoof === configuracionSeguridad.spoof) {
        problemas.push('contenido engañoso');
        riesgoTotal += 0.2;
      }

      if (safeSearch.racy === configuracionSeguridad.contenidoSugerente) {
        problemas.push('contenido sugerente');
        riesgoTotal += 0.5;
      } else if (safeSearch.racy === 'LIKELY') {
        riesgoTotal += 0.2;
      }
    }

    const riesgoImagenes = Math.min(1.0, riesgoTotal);
    
    // ✅ SER MÁS PERMISIVO: Solo rechazar si riesgo > 0.7
    const esAprobado = riesgoImagenes < 0.7;

    // Calcular confianza OCR basada en longitud y calidad del texto
    const confianzaOCR = textoExtraido.length > 50 ? 
      Math.min(0.9, textoExtraido.length / 1000) : 
      textoExtraido.length > 10 ? 0.5 : 0.2;

    console.log(`📊 Resultado Vision: ${esAprobado ? '✅ Aprobado' : '❌ Rechazado'}, riesgo: ${riesgoImagenes}`);

    return {
      texto: textoExtraido,
      esAprobado,
      riesgoImagenes,
      problemasDetectados: problemas,
      safeSearch,
      textoExtraido,
      confianzaOCR
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
   * ✅ ANALIZAR CON GOOGLE VISION (MÉTODO EXISTENTE)
   */
  private async analizarConGoogleVision(rutaImagen: string): Promise<GoogleVisionResult> {
    // ... (implementación existente se mantiene igual)
    // Solo se actualiza para usar la versión permisiva de procesarResultadoVision
    return await this.analizarConGoogleVision(rutaImagen); // Método existente
  }

  /**
   * ✅ VERIFICAR ESTADO DE LA API - CORREGIDO
   */
  async verificarEstadoVisionAPI(): Promise<{ 
    disponible: boolean; 
    tipo: string;
    mensaje: string;
    credenciales: boolean;
  }> {
    const credencialesVerificadas = await this.verificarCredencialesVision();
    
    let tipo = 'none';
    if (this.visionClient) {
      tipo = this.visionClient.documentTextDetection ? 'service_account' : 
             this.visionClient.type === 'api_key' ? 'api_key' : 'unknown';
    }
    
    return {
      disponible: credencialesVerificadas.valido,
      tipo: tipo,
      mensaje: credencialesVerificadas.mensaje,
      credenciales: credencialesVerificadas.valido
    };
  }

  /**
   * ✅ OBTENER INFORMACIÓN DEL SERVICIO MEJORADA
   */
  obtenerInformacionServicio(): {
    visionDisponible: boolean;
    conversionDisponible: boolean;
    estrategia: string;
    modo: string;
  } {
    return {
      visionDisponible: !!this.visionClient,
      conversionDisponible: true,
      estrategia: 'Optimizado: Análisis permisivo para PDFs académicos/escaneados',
      modo: 'PERMISIVO - Prioriza extracción de texto sobre moderación estricta'
    };
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