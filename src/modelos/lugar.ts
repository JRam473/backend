//modelos/lugar.ts
export interface Lugar {
  id: string;
  nombre: string;
  descripcion?: string;
  ubicacion: string;
  categoria: string;
  puntuacion_promedio: number;
  total_calificaciones: number;
  foto_principal_url?: string;
  creado_en: Date;
  pdf_url?: string;
  actualizado_en: Date;
}

export interface LugarConEstadisticas extends Lugar {
  total_experiencias: number;
}

export interface LugarDetallado extends Lugar {
  fotos: FotoLugar[];
  experiencias: any[];
}

export interface FotoLugar {
  id: string;
  lugar_id: string;
  url_foto: string;
  ruta_almacenamiento: string;
  es_principal: boolean;
  descripcion?: string;
  orden: number;
  ancho_imagen?: number;
  alto_imagen?: number;
  tamaño_archivo?: number;
  tipo_archivo?: string;
  creado_en: Date;
  actualizado_en: Date;
}

export interface LugarRequest {
  nombre: string;
  descripcion?: string;
  ubicacion: string;
  categoria: string;
  foto_principal_url?: string;
  pdf_url?: string;
}