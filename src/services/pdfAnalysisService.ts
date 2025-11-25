// services/pdfAnalysisService.ts - VERSIÓN CON API KEY DE GOOGLE VISION
import fs from 'fs';
import { ModeracionService } from './moderacionService.js';
import { ModeracionImagenService } from './moderacionImagenService.js';
import { PdfConversionService } from './pdfConversionService.js';
import { AnalizadorTexto } from '../utils/analizadorTexto.js';
import pdfParse from 'pdf-parse';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// ✅ CONFIGURACIÓN DE GOOGLE VISION
const GOOGLE_VISION_API_KEY = 'AIzaSyCXsxUbG2Sy-X1wWgYwnhHikf9LHJRTA9U';
const GOOGLE_CLOUD_PROJECT = 'iconic-being-454318-n1';

// ✅ INTERFACES
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

// ✅ TIPOS DE ESTRATEGIA - VERSIÓN ESTRICTA
type EstrategiaAnalisis = 
  | 'solo_texto_local' 
  | 'texto_con_imagenes_aprobadas' 
  | 'imagenes_con_vision_para_texto'
  | 'solo_moderacion_imagenes'
  | 'fallback_rechazado';

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
   * ✅ CORREGIDO: INICIALIZAR CLIENTE GOOGLE VISION CON API KEY ESPECÍFICA
   */
  private inicializarVisionClient(): ImageAnnotatorClient | null {
    try {
      console.log('🔧 Configurando Google Vision con API Key específica...');
      
      // ✅ USAR LA API KEY DIRECTAMENTE
      if (GOOGLE_VISION_API_KEY) {
        console.log('✅ API Key de Google Vision encontrada');
        return new ImageAnnotatorClient({
          key: GOOGLE_VISION_API_KEY,
          projectId: GOOGLE_CLOUD_PROJECT
        });
      }
      
      console.warn('⚠️ No se encontró API Key de Google Vision');
      return null;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Error inicializando Google Vision:', errorMessage);
      return null;
    }
  }

  /**
   * ✅ NUEVO: VERIFICAR CONEXIÓN CON GOOGLE VISION
   */
  async verificarConexionVision(): Promise<{ disponible: boolean; error?: string }> {
    if (!this.visionClient) {
      return { disponible: false, error: 'Cliente de Vision no inicializado' };
    }

    try {
      // Intentar una operación simple para verificar la conexión
      const [result] = await this.visionClient.safeSearchDetection({
        image: { content: Buffer.from('test') }
      });
      
      return { disponible: true };
    } catch (error: any) {
      console.error('❌ Error verificando conexión con Google Vision:', error);
      return { 
        disponible: false, 
        error: error.message || 'Error de conexión con Google Vision API' 
      };
    }
  }

  /**
   * ✅ MEJORADO: ANÁLISIS DE IMÁGENES CON GOOGLE VISION PARA TEXTO
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

      // ✅ VERIFICAR SI GOOGLE VISION ESTÁ DISPONIBLE
      const visionDisponible = this.visionClient !== null;
      
      if (necesitaVision && !visionDisponible) {
        console.warn('⚠️ Google Vision no disponible, usando solo moderación CLIP');
        // Cambiar estrategia a solo moderación si Vision no está disponible
      }

      for (let i = 0; i < imagenes.length; i++) {
        const rutaImagen = imagenes[i];
        
        if (!rutaImagen || !fs.existsSync(rutaImagen)) {
          problemas.push(`Página ${i + 1}: Imagen no disponible`);
          imagenesRechazadas++;
          continue;
        }

        try {
          // ✅ PRIMERO: Moderación de imagen con CLIP
          const resultadoModeracion = await this.moderacionImagenService.moderarImagen(
            rutaImagen, 
            ipUsuario, 
            hashNavegador
          );

          // ✅ SI LA IMAGEN ES RECHAZADA, NO PROCESAR MÁS
          if (!resultadoModeracion.esAprobado) {
            imagenesRechazadas++;
            creditosAhorrados++;
            problemas.push(`Página ${i + 1}: ${resultadoModeracion.motivoRechazo}`);
            riesgoTotal += resultadoModeracion.puntuacionRiesgo;
            continue;
          }

          // ✅ SI LA IMAGEN ES APROBADA, EXTRAER TEXTO CON GOOGLE VISION (SI ESTÁ DISPONIBLE)
          if (necesitaVision && !soloModeracion && visionDisponible) {
            try {
              const resultadoVision = await this.analizarConGoogleVision(rutaImagen);
              
              if (resultadoVision.textoExtraido) {
                textoCombinado += `--- Página ${i + 1} ---\n${resultadoVision.textoExtraido}\n\n`;
                confianzaOCRTotal += resultadoVision.confianzaOCR || 0.5;
              }
              
              // ✅ ANÁLISIS DE SEGURIDAD CON VISION
              if (!resultadoVision.esAprobado) {
                imagenesRechazadas++;
                problemas.push(`Página ${i + 1}: ${resultadoVision.problemasDetectados.join(', ')}`);
                riesgoTotal += Math.max(
                  resultadoModeracion.puntuacionRiesgo,
                  resultadoVision.riesgoImagenes
                );
                continue;
              }
              
              riesgoTotal += Math.max(
                resultadoModeracion.puntuacionRiesgo,
                resultadoVision.riesgoImagenes
              );
              
            } catch (visionError: unknown) {
              const errorMessage = visionError instanceof Error ? visionError.message : 'Error desconocido';
              console.warn(`⚠️ Google Vision falló para página ${i + 1}:`, errorMessage);
              
              // ✅ SI VISION FALLA, USAR PERSPECTIVE PARA EL TEXTO EXISTENTE (SI HAY)
              if (textoCombinado.length > 0) {
                console.log(`🔄 Usando Perspective como fallback para texto extraído...`);
                // El texto ya extraído se analizará más adelante con Perspective
              }
              
              riesgoTotal += resultadoModeracion.puntuacionRiesgo;
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
          
          problemas.push(`Página ${i + 1}: Error en análisis - rechazado`);
          riesgoTotal += 0.7;
          imagenesRechazadas++;
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

      const riesgoPromedio = imagenesProcesadas > 0 ? riesgoTotal / imagenesProcesadas : 1.0;
      
      // ✅ CRITERIOS ESTRICTOS PARA APROBACIÓN
      const esAprobado = imagenesRechazadas === 0 && problemas.length === 0;
      const porcentajeAhorro = imagenes.length > 0 ? (creditosAhorrados / imagenes.length) * 100 : 0;
      
      let motivo = `Imágenes aprobadas (${tipoPDF})`;
      if (!esAprobado) {
        motivo = `Rechazado: ${imagenesRechazadas} imágenes con problemas`;
        if (problemas.length > 0) {
          motivo += ` - ${problemas.slice(0, 3).join('; ')}`;
        }
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
        aprobado: esAprobado,
        visionUtilizado: visionDisponible && necesitaVision
      });

      return {
        esAprobado,
        motivo,
        riesgoImagenes: riesgoPromedio,
        problemasDetectados: problemas.slice(0, 10),
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
      
      return {
        esAprobado: false,
        motivo: 'Error en análisis de imágenes - rechazado',
        riesgoImagenes: 0.9,
        problemasDetectados: ['Error fatal en procesamiento de imágenes'],
        ahorroCreditos: '100%',
        imagenesRechazadas: 0,
        imagenesProcesadas: 0,
        textoExtraidoDeImagenes: '',
        tipoPDF: 'desconocido',
        confianzaOCR: 0
      };
    }
  }

  /**
   * ✅ NUEVO: USAR PERSPECTIVE API COMO FALLBACK PARA TEXTO
   */
  private async analizarTextoConPerspectiveFallback(texto: string, contexto: string = 'pdf'): Promise<{
    esAprobado: boolean;
    puntuacion: number;
    razon: string;
    detalles: any;
    metodo: string;
  }> {
    try {
      console.log(`🧠 Analizando texto con Perspective API (${contexto})...`);
      
      const resultado = await this.analizadorTexto.analizarTexto(texto, 'pdf');
      
      return {
        esAprobado: resultado.esAprobado,
        puntuacion: resultado.puntuacion,
        razon: resultado.razon,
        detalles: resultado.detalles,
        metodo: 'perspective-api'
      };

    } catch (error) {
      console.error('❌ Error en Perspective API:', error);
      
      // ✅ FALLBACK: Si Perspective falla, usar análisis básico local
      return this.analisisBasicoLocal(texto, contexto);
    }
  }

  /**
   * ✅ NUEVO: ANÁLISIS BÁSICO LOCAL COMO ÚLTIMO FALLBACK
   */
  private async analisisBasicoLocal(texto: string, contexto: string): Promise<{
    esAprobado: boolean;
    puntuacion: number;
    razon: string;
    detalles: any;
    metodo: string;
  }> {
    console.log(`🔍 Usando análisis básico local (${contexto})...`);
    
    // Análisis básico de palabras ofensivas
    const palabrasOfensivas = [
      'puta', 'puto', 'mierda', 'cabron', 'imbecil', 'estupido', 'maricon',
      'verga', 'polla', 'coño', 'chocha', 'fuck', 'shit', 'bitch', 'asshole',
      'joder', 'carajo', 'hostia', 'cojones', 'malparido', 'hijueputa'
    ];

    const textoLimpio = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const palabrasEncontradas = palabrasOfensivas.filter(palabra => 
      textoLimpio.includes(palabra)
    );

    const esAprobado = palabrasEncontradas.length === 0;
    const puntuacion = esAprobado ? 0.8 : 0.2;
    const razon = esAprobado ? 
      'Contenido aprobado (análisis básico)' : 
      `Lenguaje inapropiado detectado: ${palabrasEncontradas.slice(0, 3).join(', ')}`;

    return {
      esAprobado,
      puntuacion,
      razon,
      detalles: {
        palabrasOfensivas: palabrasEncontradas,
        metodo: 'fallback-local',
        contexto
      },
      metodo: 'fallback-local'
    };
  }

  /**
   * ✅ MEJORADO: LÓGICA PRINCIPAL CON FALLBACKS INTELIGENTES
   */
  async analizarTextoPDF(
    rutaArchivo: string, 
    ipUsuario: string, 
    hashNavegador: string
  ): Promise<ResultadoAnalisisPDF> {
    try {
      console.log('🧠 Iniciando análisis inteligente de PDF...');

      const datosPDF = await this.analizarEstructuraPDF(rutaArchivo);
      const decision = this.determinarEstrategia(datosPDF);
      
      // ✅ VERIFICAR DISPONIBILIDAD DE GOOGLE VISION
      const visionDisponible = this.visionClient !== null;
      
      console.log('🎯 Estrategia seleccionada:', {
        estrategia: decision.estrategia,
        razon: decision.razon,
        tipoContenido: datosPDF.tipoContenido,
        confianzaTexto: datosPDF.confianzaTexto,
        tieneImagenes: datosPDF.tieneImagenes,
        visionDisponible: visionDisponible
      });

      let analisisImagenes: AnalisisImagenes = {
        esAprobado: false,
        motivo: 'Análisis de imágenes requerido',
        riesgoImagenes: 0.9,
        problemasDetectados: ['No se procesaron imágenes'],
        ahorroCreditos: '0%',
        imagenesRechazadas: 0,
        imagenesProcesadas: 0,
        textoExtraidoDeImagenes: '',
        tipoPDF: 'desconocido',
        confianzaOCR: 0
      };

      let textoParaAnalizar = datosPDF.texto;
      let esAprobado = false;
      let motivo = 'No se pudo analizar el contenido';
      let puntuacion = 0.1;
      let recomendacion = 'El PDF no pudo ser analizado correctamente';
      let metodoAnalisisTexto = 'ninguno';

      switch (decision.estrategia) {
        case 'solo_texto_local':
          console.log('💰 EJECUTANDO: Análisis de texto con Perspective API');
          textoParaAnalizar = this.limitarTexto(datosPDF.texto, 10000);
          const resultadoTexto = await this.analizarTextoConPerspectiveFallback(textoParaAnalizar, 'texto_local');
          
          esAprobado = resultadoTexto.esAprobado;
          puntuacion = resultadoTexto.puntuacion;
          motivo = resultadoTexto.razon;
          metodoAnalisisTexto = resultadoTexto.metodo;
          recomendacion = esAprobado ? 
            'PDF de texto aprobado' : 
            'Contenido de texto no aprobado';
          break;

        case 'texto_con_imagenes_aprobadas':
          console.log('🔄 EJECUTANDO: Texto + imágenes con Vision + Perspective');
          textoParaAnalizar = this.limitarTexto(datosPDF.texto, 5000);
          analisisImagenes = await this.analizarImagenesConTexto(
            rutaArchivo, 
            ipUsuario, 
            hashNavegador,
            decision.estrategia
          );
          
          // ✅ COMBINAR TEXTO ORIGINAL CON TEXTO EXTRAÍDO DE IMÁGENES
          if (analisisImagenes.textoExtraidoDeImagenes) {
            textoParaAnalizar += '\n\n--- TEXTO DE IMÁGENES ---\n' + 
              analisisImagenes.textoExtraidoDeImagenes;
          }
          
          const resultadoCombinado = await this.analizarTextoConPerspectiveFallback(
            this.limitarTexto(textoParaAnalizar, 10000),
            'combinado'
          );
          
          esAprobado = resultadoCombinado.esAprobado && analisisImagenes.esAprobado;
          puntuacion = Math.max(resultadoCombinado.puntuacion, analisisImagenes.riesgoImagenes);
          metodoAnalisisTexto = resultadoCombinado.metodo;
          motivo = esAprobado ? 
            'PDF aprobado (contenido mixto verificado)' : 
            `Rechazado: problemas en ${!resultadoCombinado.esAprobado ? 'texto' : 'imágenes'}`;
          recomendacion = 'Documento mixto - requiere verificación completa';
          break;

        case 'imagenes_con_vision_para_texto':
          console.log('🔍 EJECUTANDO: Imágenes con Google Vision + Perspective');
          analisisImagenes = await this.analizarImagenesConTexto(
            rutaArchivo, 
            ipUsuario, 
            hashNavegador,
            decision.estrategia
          );
          
          if (analisisImagenes.textoExtraidoDeImagenes) {
            textoParaAnalizar = analisisImagenes.textoExtraidoDeImagenes;
            const resultadoVisionTexto = await this.analizarTextoConPerspectiveFallback(
              this.limitarTexto(textoParaAnalizar, 10000),
              'vision_texto'
            );
            
            esAprobado = resultadoVisionTexto.esAprobado && analisisImagenes.esAprobado;
            puntuacion = Math.max(resultadoVisionTexto.puntuacion, analisisImagenes.riesgoImagenes);
            metodoAnalisisTexto = resultadoVisionTexto.metodo;
            motivo = esAprobado ? 
              'PDF escaneado aprobado' : 
              `Rechazado: problemas en ${!resultadoVisionTexto.esAprobado ? 'texto extraído' : 'imágenes'}`;
          } else {
            esAprobado = analisisImagenes.esAprobado;
            puntuacion = analisisImagenes.riesgoImagenes;
            motivo = analisisImagenes.motivo;
            metodoAnalisisTexto = 'solo_imagenes';
          }
          recomendacion = 'Documento escaneado - requiere extracción y verificación de texto';
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
          metodoAnalisisTexto = 'solo_imagenes';
          recomendacion = 'Documento basado en imágenes - verificación visual completa';
          break;

        case 'fallback_rechazado':
          console.log('❌ EJECUTANDO: Fallback - rechazado por seguridad');
          esAprobado = false;
          puntuacion = 0.1;
          motivo = 'Contenido no analizable - rechazado por seguridad';
          metodoAnalisisTexto = 'fallback';
          recomendacion = 'El PDF no contiene contenido analizable o tiene formato no soportado';
          break;
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
          metodoAnalisisTexto,
          visionDisponible
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
          usoGoogleVision: decision.necesitaGoogleVision && visionDisponible,
          ahorroCreditos: analisisImagenes.ahorroCreditos,
          imagenesRechazadas: analisisImagenes.imagenesRechazadas,
          imagenesProcesadas: analisisImagenes.imagenesProcesadas,
          confianzaOCR: analisisImagenes.confianzaOCR,
          metodoAnalisisTexto,
          visionDisponible
        },
        estrategiaUsada: decision.estrategia,
        tipoContenido: datosPDF.tipoContenido,
        recomendacion
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Error en análisis inteligente:', errorMessage);
      
      return {
        esAprobado: false,
        motivo: 'Error en análisis - rechazado por seguridad',
        puntuacion: 0.1,
        metadata: {
          error: errorMessage,
          estrategia: 'fallback_error'
        },
        estrategiaUsada: 'error_rechazado',
        tipoContenido: 'desconocido',
        recomendacion: 'Error en el análisis automático - verificar manualmente'
      };
    }
  }

  /**
   * ✅ ANALIZAR ESTRUCTURA DEL PDF (MÉTODO FALTANTE)
   */
  private async analizarEstructuraPDF(rutaArchivo: string): Promise<DatosPDF> {
    try {
      const dataBuffer = fs.readFileSync(rutaArchivo);
      const pdfData = await pdfParse(dataBuffer);
      
      const texto = pdfData.text || '';
      const numPaginas = pdfData.numpages || 1;
      const info = pdfData.info || {};
      const metadata = pdfData.metadata || {};
      
      // Determinar tipo de contenido
      const tieneTextoValido = texto.length > 50;
      const tieneImagenes = pdfData.text.length < pdfData.numpages * 100; // Heurística simple
      const confianzaTexto = tieneTextoValido ? 0.9 : 0.1;
      const esEscaneado = !tieneTextoValido && tieneImagenes;
      const calidadOCR = tieneTextoValido ? 0.8 : 0.2;
      
      let tipoContenido: 'texto' | 'imagenes' | 'mixto' | 'desconocido' = 'desconocido';
      
      if (tieneTextoValido && !tieneImagenes) {
        tipoContenido = 'texto';
      } else if (!tieneTextoValido && tieneImagenes) {
        tipoContenido = 'imagenes';
      } else if (tieneTextoValido && tieneImagenes) {
        tipoContenido = 'mixto';
      }
      
      return {
        texto,
        numPaginas,
        info,
        metadata,
        tipoContenido,
        confianzaTexto,
        tieneImagenes,
        esEscaneado,
        calidadOCR
      };
      
    } catch (error) {
      console.error('❌ Error analizando estructura PDF:', error);
      return {
        texto: '',
        numPaginas: 1,
        info: {},
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
   * ✅ DETERMINAR ESTRATEGIA DE ANÁLISIS (MÉTODO FALTANTE)
   */
  private determinarEstrategia(datosPDF: DatosPDF): {
    estrategia: EstrategiaAnalisis;
    razon: string;
    necesitaGoogleVision: boolean;
  } {
    const { tipoContenido, confianzaTexto, tieneImagenes, esEscaneado } = datosPDF;
    
    if (tipoContenido === 'texto' && confianzaTexto > 0.7) {
      return {
        estrategia: 'solo_texto_local',
        razon: 'PDF con texto extraíble de alta calidad',
        necesitaGoogleVision: false
      };
    }
    
    if (tipoContenido === 'mixto' && confianzaTexto > 0.3) {
      return {
        estrategia: 'texto_con_imagenes_aprobadas',
        razon: 'PDF mixto con texto e imágenes',
        necesitaGoogleVision: true
      };
    }
    
    if (esEscaneado || (tipoContenido === 'imagenes' && tieneImagenes)) {
      return {
        estrategia: 'imagenes_con_vision_para_texto',
        razon: 'PDF escaneado o basado en imágenes',
        necesitaGoogleVision: true
      };
    }
    
    if (tieneImagenes) {
      return {
        estrategia: 'solo_moderacion_imagenes',
        razon: 'PDF con imágenes pero sin texto extraíble',
        necesitaGoogleVision: false
      };
    }
    
    return {
      estrategia: 'fallback_rechazado',
      razon: 'Contenido no analizable',
      necesitaGoogleVision: false
    };
  }

  /**
   * ✅ CONVERTIR PDF A IMÁGENES
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
   * ✅ ANALIZAR CON GOOGLE VISION
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
   * ✅ PROCESAR RESULTADO DE VISION
   */
  private procesarResultadoVision(textoExtraido: string, safeSearch: any): GoogleVisionResult {
    // Lógica estricta de moderación para Vision
    const problemas: string[] = [];
    let esAprobado = true;
    let riesgoImagenes = 0.1;

    if (safeSearch) {
      if (safeSearch.adult === 'VERY_LIKELY' || safeSearch.adult === 'LIKELY') {
        problemas.push('Contenido adulto');
        esAprobado = false;
        riesgoImagenes = 0.9;
      }
      if (safeSearch.violence === 'VERY_LIKELY' || safeSearch.violence === 'LIKELY') {
        problemas.push('Contenido violento');
        esAprobado = false;
        riesgoImagenes = Math.max(riesgoImagenes, 0.8);
      }
      if (safeSearch.racy === 'VERY_LIKELY' || safeSearch.racy === 'LIKELY') {
        problemas.push('Contenido sugerente');
        esAprobado = false;
        riesgoImagenes = Math.max(riesgoImagenes, 0.7);
      }
    }

    return {
      texto: textoExtraido,
      esAprobado,
      riesgoImagenes,
      problemasDetectados: problemas,
      safeSearch,
      textoExtraido,
      confianzaOCR: textoExtraido.length > 0 ? 0.8 : 0.1
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
   * Validación estricta de PDF
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
      
      if (stats.size > 10 * 1024 * 1024) { // ✅ 10MB máximo
        return {
          valido: false,
          error: 'El PDF es demasiado grande (máximo 10MB)',
          tamano: stats.size,
          recomendacion: 'Reduzca el tamaño del PDF'
        };
      }

      if (stats.size === 0) {
        return {
          valido: false,
          error: 'El PDF está vacío',
          tamano: 0,
          recomendacion: 'El archivo no contiene datos'
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
        recomendacion: 'PDF válido - listo para análisis estricto'
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