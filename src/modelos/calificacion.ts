//modelos/calificacion.ts
export interface Calificacion {
  id: string;
  lugar_id: string;
  calificacion: number;
  comentario?: string;
  ip_usuario: string;
  hash_navegador: string;
  creado_en: Date;
  actualizado_en: Date;
}

export interface CalificacionRequest {
  lugarId: string;
  calificacion: number;
  comentario?: string;
}

export interface CalificacionResponse {
  calificacion: Calificacion;
  lugar_nombre?: string;
}