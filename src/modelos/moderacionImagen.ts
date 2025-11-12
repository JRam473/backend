export interface AnalisisViolencia {
  es_violento: boolean;
  probabilidad_violencia: number;
  probabilidad_no_violencia: number;
  umbral: number;
  error?: string;
}

export interface AnalisisArmas {
  armas_detectadas: boolean;
  confianza: number;
  nota?: string;
  error?: string;
  
}

export interface AnalisisImagenResultado {
  es_apto: boolean;
  analisis_violencia: AnalisisViolencia;
  analisis_armas: AnalisisArmas;
  puntuacion_riesgo: number;
  error?: string;
}

// ✅ Tipo principal para el resultado de moderación
export interface ResultadoModeracionImagen {
  esAprobado: boolean;
  motivoRechazo?: string;
  puntuacionRiesgo: number;
  detalles?: AnalisisImagenResultado; // ✅ undefined permitido explícitamente
}

export interface LogModeracionImagen {
  id: string;
  ruta_imagen: string;
  ip_usuario: string;
  hash_navegador: string;
  resultado_analisis: AnalisisImagenResultado | null;
  es_aprobado: boolean;
  error?: string;
  creado_en: Date;
}