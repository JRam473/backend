// modelos/experiencia.ts
export interface Experiencia {
  id: string;
  url_foto: string;
  descripcion: string;
  nombre_usuario: string;
  creado_en: Date;
  ruta_almacenamiento: string;
  
  // ✅ ESTADO SIMPLIFICADO - Solo aprobado o rechazado (en tiempo real)
  estado: 'aprobado' | 'rechazado';
  
  // ✅ CAMPOS DE MODERACIÓN ACTUALIZADOS
  moderado: boolean;
  aprobado_automatico: boolean;
  puntuacion_moderacion: number; // Puntuación general 0-1
  
  // Campos existentes
  contador_vistas: number;
  lugar_id?: string;
  ancho_imagen?: number;
  alto_imagen?: number;
  tamaño_archivo?: number;
  tipo_archivo?: string;
  ip_usuario: string;
  hash_navegador: string;
  actualizado_en: Date;
}

export interface ExperienciaRequest {
  descripcion: string;
  nombre_usuario: string;
  lugarId?: string;
}

export interface ExperienciaConLugar extends Experiencia {
  lugar_nombre?: string;
  
  lugar_ubicacion?: string;
}

export interface EstadisticasExperiencias {
  por_estado: Array<{
    estado: string;
    cantidad: number;
    total_vistas: number;
  }>;
  total: number;
  total_vistas: number;
}

// ✅ NUEVA INTERFAZ PARA RESPUESTAS DE MODERACIÓN
export interface ResultadoModeracionExperiencia {
  esAprobado: boolean;
  motivoRechazo?: string;
  puntuacionGeneral: number;
  detalles: {
    texto?: {
      esAprobado: boolean;
      puntuacion: number;
      palabrasOfensivas: string[];
      razon: string;
    };
    imagen?: {
      esAprobado: boolean;
      puntuacion: number;
      contenidoPeligroso: boolean;
      categorias: Array<{
        clase: string;
        probabilidad: number;
      }>;
    };
  };
}