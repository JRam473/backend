// backend/src/types/moderacion.ts - VERSIÓN COMPATIBLE CON exactOptionalPropertyTypes
export interface AnalisisTexto {
  esAprobado: boolean;
  puntuacion: number;
  palabrasOfensivas: string[];
  razon: string;
  detalles: {
    metodo: string;
    intencion: string;
    calidadTexto: {
      tieneSentido: boolean;
      porcentajePalabrasValidas: number;
      razon: string;
      confianza?: number;
    };
    longitud: number;
    tienePatronesSpam?: boolean;
    estructuraTexto?: {
      esSinSentido: boolean;
      razon: string;
      confianza: number;
    };
  };
  // ✅ PROPIEDADES OPCIONALES CORRECTAMENTE DEFINIDAS
  tieneSpam?: boolean;
  tieneUrls?: boolean;
  tieneContacto?: boolean;
  esCohorente?: boolean;
  longitud?: number;
  cantidadPalabras?: number;
}

export interface ResultadoModeracion {
  esAprobado: boolean;
  
  puntuacionGeneral: number;
  motivoRechazo?: string; // ✅ CORREGIDO: Sin | undefined
  detalles: {
    texto?: AnalisisTexto; // ✅ CORREGIDO: Sin | undefined
  };
}