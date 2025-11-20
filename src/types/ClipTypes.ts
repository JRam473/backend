// types/ClipTypes.ts - VERSIÓN ACTUALIZADA
export interface CategoryScore {
  nombre: string;
  puntuacion: number;
}

// ✅ NUEVA INTERFAZ PARA CONTENIDO DETECTADO
export interface ContenidoDetectado {
  concepto: string;
  probabilidad: number;
}

export interface ClipAnalysisResult {
  es_apto: boolean;
  puntuacion_riesgo: number;
  tiempo_procesamiento: number;
  analizado_en: string;
  servidor: string;
  origen_imagen: string;
  modelo_utilizado: string;
  detalles_analisis?: Record<string, CategoryScore>;
  categorias_detectadas?: string[];
  razones_rechazo?: string[];
  // ✅ AGREGAR ESTA PROPIEDAD OPCIONAL
  detectados?: ContenidoDetectado[];
  error?: string;
}

export interface ClipHealthStatus {
  status: 'ready' | 'initializing' | 'error';
  modelos_listos: boolean;
  inicializacion_en_curso: boolean;
  timestamp: number;
  service: string;
  modelo: string;
}