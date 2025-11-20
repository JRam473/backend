// backend/src/services/moderacionService.ts - VERSIÓN COMPLETAMENTE CORREGIDA
import { AnalizadorTexto } from '../utils/analizadorTexto.js';
import { pool } from '../utils/baseDeDatos.js';
import { ResultadoModeracion, AnalisisTexto } from '../types/moderacion.js';

export class ModeracionService {
  private analizadorTexto: AnalizadorTexto;

  constructor() {
    this.analizadorTexto = new AnalizadorTexto();
  }

  /**
   * Moderación en tiempo real solo para texto - COMPATIBLE CON exactOptionalPropertyTypes
   */
  async moderarContenidoEnTiempoReal(data: {
    texto?: string;
    ipUsuario: string;
    hashNavegador: string;
  }): Promise<ResultadoModeracion> {
    
    console.log('🛡️ Iniciando moderación en tiempo real (solo texto)...');

    // Solo analizar texto
    let analisisTexto: AnalisisTexto | undefined;

    if (data.texto) {
      // ✅ CORREGIDO: Agregar await aquí
      analisisTexto = await this.analizadorTexto.analizarTexto(data.texto);
    }

    // Evaluar resultado general
    const esAprobado = this.evaluarAprobacionGeneral(analisisTexto);
    const motivoRechazo = this.generarMotivoRechazo(analisisTexto);
    const puntuacionGeneral = this.calcularPuntuacionGeneral(analisisTexto);

    // Log de moderación para contenido rechazado
    if (!esAprobado) {
      await this.registrarLogModeracion({
        tipoContenido: 'texto',
        contenidoTexto: data.texto,
        resultadoModeracion: { analisisTexto },
        accion: 'rechazado',
        motivo: motivoRechazo,
        ipUsuario: data.ipUsuario,
        hashNavegador: data.hashNavegador
      });
    }

    console.log(`🎯 Resultado moderación: ${esAprobado ? '✅ APROBADO' : '❌ RECHAZADO'}`);

    // ✅ CORREGIDO: Crear objeto compatible con exactOptionalPropertyTypes
    const resultado: ResultadoModeracion = {
      esAprobado,
      puntuacionGeneral,
      // ✅ Usar undefined solo cuando la propiedad esté presente
      ...(esAprobado ? {} : { motivoRechazo }),
      detalles: {
        ...(analisisTexto ? { texto: analisisTexto } : {})
      }
    };

    return resultado;
  }

  /**
   * ✅ CORREGIDO: Método específico para validar solo texto
   */
  async validarSoloTexto(texto: string, ipUsuario: string, hashNavegador: string): Promise<{
    esAprobado: boolean;
    motivoRechazo?: string;
    puntuacionGeneral: number;
    detalles?: {
      texto?: AnalisisTexto;
    };
  }> {
    console.log('🔍 Validando solo texto...');

    // ✅ CORREGIDO: Agregar await aquí
    const analisisTexto = await this.analizadorTexto.analizarTexto(texto);
    const esAprobado = this.evaluarAprobacionGeneral(analisisTexto);
    const motivoRechazo = this.generarMotivoRechazo(analisisTexto);
    const puntuacionGeneral = this.calcularPuntuacionGeneral(analisisTexto);

    // Log de moderación para contenido rechazado
    if (!esAprobado) {
      await this.registrarLogModeracion({
        tipoContenido: 'texto',
        contenidoTexto: texto,
        resultadoModeracion: { analisisTexto },
        accion: 'rechazado',
        motivo: motivoRechazo,
        ipUsuario,
        hashNavegador
      });
    }

    // ✅ CORREGIDO: Retorno compatible con exactOptionalPropertyTypes
    return {
      esAprobado,
      puntuacionGeneral,
      // ✅ Usar undefined solo cuando la propiedad esté presente
      ...(esAprobado ? {} : { motivoRechazo }),
      detalles: {
        ...(analisisTexto ? { texto: analisisTexto } : {})
      }
    };
  }

  /**
   * ✅ CORREGIDO: Generar motivos de rechazo más específicos
   */
  private generarMotivoRechazo(texto: AnalisisTexto | undefined): string {
    const motivos: string[] = [];

    if (texto && !texto.esAprobado) {
      // ✅ CORREGIDO: Usar propiedades que existen en AnalisisTexto
      if (texto.palabrasOfensivas && texto.palabrasOfensivas.length > 0) {
        motivos.push(`Lenguaje inapropiado detectado (${texto.palabrasOfensivas.length} palabras ofensivas)`);
      }
      
      // ✅ CORREGIDO: Verificar spam usando el análisis de detalles
      if (texto.detalles?.intencion === 'spam') {
        motivos.push('Contenido comercial o spam detectado');
      }
      
      // ✅ CORREGIDO: Verificar URLs usando el análisis de detalles
      if (texto.detalles?.tienePatronesSpam) {
        motivos.push('Enlaces o URLs no permitidos');
      }
      
      // ✅ CORREGIDO: Verificar coherencia usando el análisis de calidad
      if (!texto.detalles?.calidadTexto?.tieneSentido) {
        motivos.push('Texto poco coherente o muy corto');
      }
      
      // Si no hay motivos específicos, usar la razón general
      if (motivos.length === 0 && texto.razon) {
        motivos.push(texto.razon);
      }
    }

    return motivos.join('; ') || 'Contenido no aprobado por los filtros automáticos';
  }

  /**
   * ✅ CORREGIDO: Obtener análisis detallado para logs
   */
  obtenerAnalisisDetallado(analisisTexto: AnalisisTexto | undefined): {
    palabrasOfensivas: string[];
    problemas: string[];
    puntuacion: number;
  } {
    const palabrasOfensivas = analisisTexto?.palabrasOfensivas || [];
    const problemas: string[] = [];

    if (analisisTexto && !analisisTexto.esAprobado) {
      // ✅ CORREGIDO: Usar propiedades que existen
      if (analisisTexto.detalles?.intencion === 'spam') {
        problemas.push('spam');
      }
      if (analisisTexto.detalles?.tienePatronesSpam) {
        problemas.push('urls');
      }
      if (!analisisTexto.detalles?.calidadTexto?.tieneSentido) {
        problemas.push('incoherente');
      }
      if (palabrasOfensivas.length > 0) {
        problemas.push('lenguaje_ofensivo');
      }
    }

    return {
      palabrasOfensivas,
      problemas,
      puntuacion: analisisTexto?.puntuacion || 1.0
    };
  }

  private evaluarAprobacionGeneral(texto: AnalisisTexto | undefined): boolean {
    // ✅ REGLAS PARA TEXTO SOLAMENTE

    // 1. Cualquier contenido de texto no aprobado = RECHAZADO
    if (texto && !texto.esAprobado) {
      console.log('❌ Rechazado: Texto no aprobado');
      return false;
    }

    // 2. Puntuaciones bajas en texto = RECHAZADO
    if (texto && texto.puntuacion < 0.7) {
      console.log('❌ Rechazado: Puntuación de texto muy baja');
      return false;
    }

    console.log('✅ Aprobado: Texto cumple las reglas');
    return true;
  }

  private calcularPuntuacionGeneral(texto: AnalisisTexto | undefined): number {
    return texto ? texto.puntuacion : 1.0;
  }

  private async registrarLogModeracion(log: {
    tipoContenido: string;
    contenidoTexto?: string | undefined;
    resultadoModeracion: any;
    accion: string;
    motivo: string;
    ipUsuario: string;
    hashNavegador: string;
  }): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO logs_moderacion 
         (tipo_contenido, contenido_texto, resultado_moderacion, accion, motivo, ip_usuario, hash_navegador)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          log.tipoContenido,
          log.contenidoTexto?.substring(0, 500),
          JSON.stringify(log.resultadoModeracion),
          log.accion,
          log.motivo,
          log.ipUsuario,
          log.hashNavegador
        ]
      );
      console.log('✅ Log de moderación registrado correctamente');
    } catch (error) {
      console.error('❌ Error registrando log de moderación:', error);
    }
  }

  /**
   * ✅ NUEVO: Obtener logs de moderación recientes
   */
  async obtenerLogsRecientes(hashNavegador?: string, limite: number = 10): Promise<any[]> {
    try {
      let query = `
        SELECT motivo, accion, tipo_contenido, creado_en, resultado_moderacion
        FROM logs_moderacion 
        WHERE accion = 'rechazado'
      `;
      let params: any[] = [];
      
      if (hashNavegador) {
        query += ' AND hash_navegador = $1';
        params.push(hashNavegador);
      }
      
      query += ' ORDER BY creado_en DESC LIMIT $' + (params.length + 1);
      params.push(limite);

      const result = await pool.query(query, params);
      
      return result.rows.map(row => ({
        motivo: row.motivo,
        accion: row.accion,
        tipoContenido: row.tipo_contenido,
        fecha: row.creado_en,
        detalles: row.resultado_moderacion ? JSON.parse(row.resultado_moderacion) : null
      }));
    } catch (error) {
      console.error('❌ Error obteniendo logs de moderación:', error);
      return [];
    }
  }

  /**
   * Método específico para moderar solo texto (alias para compatibilidad)
   */
  async moderarTexto(texto: string, ipUsuario: string, hashNavegador: string): Promise<ResultadoModeracion> {
    return this.moderarContenidoEnTiempoReal({
      texto,
      ipUsuario,
      hashNavegador
    });
  }

  /**
   * ✅ CORREGIDO: Método para generar sugerencias basadas en el tipo de problema
   */
  generarSugerencias(tipoProblema: string, analisisTexto?: AnalisisTexto): string[] {
    const sugerencias: string[] = [];
    
    if (tipoProblema === 'texto') {
      sugerencias.push('Evita lenguaje ofensivo, insultos o palabras vulgares');
      sugerencias.push('No incluyas contenido comercial, promociones o spam');
      sugerencias.push('Asegúrate de que el texto sea coherente y tenga sentido');
      sugerencias.push('No incluyas enlaces, emails o números de teléfono');
      sugerencias.push('Usa un lenguaje respetuoso y apropiado para la comunidad');
      
      // Sugerencias específicas basadas en el análisis
      if (analisisTexto?.palabrasOfensivas && analisisTexto.palabrasOfensivas.length > 0) {
        sugerencias.push(`Reemplaza palabras como: ${analisisTexto.palabrasOfensivas.slice(0, 3).join(', ')}`);
      }
      
      // ✅ CORREGIDO: Usar propiedades que existen
      if (analisisTexto?.detalles?.intencion === 'spam') {
        sugerencias.push('Elimina referencias comerciales o promocionales');
      }
    } else {
      sugerencias.push('Revisa el contenido antes de publicarlo');
      sugerencias.push('Asegúrate de que cumpla con las políticas de la comunidad');
    }
    
    return sugerencias;
  }

  /**
   * ✅ CORREGIDO: Método para analizar y clasificar el tipo de problema
   */
  analizarTipoProblema(analisisTexto: AnalisisTexto | undefined): string {
    if (!analisisTexto || analisisTexto.esAprobado) {
      return 'ninguno';
    }

    if (analisisTexto.palabrasOfensivas && analisisTexto.palabrasOfensivas.length > 0) {
      return 'lenguaje_ofensivo';
    }

    // ✅ CORREGIDO: Usar propiedades que existen
    if (analisisTexto.detalles?.intencion === 'spam') {
      return 'spam';
    }

    if (analisisTexto.detalles?.tienePatronesSpam) {
      return 'informacion_contacto';
    }

    if (!analisisTexto.detalles?.calidadTexto?.tieneSentido) {
      return 'texto_incoherente';
    }

    return 'general';
  }
}