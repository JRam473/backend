//modelos/administrador.ts
export interface Administrador {
  id: string;
  usuario: string;
  email: string;
  contraseña?: string;
  proveedor: 'local' | 'google';
  id_proveedor?: string;
  avatar_url?: string;
  rol: 'admin' | 'super_admin';
  verificado: boolean;
  creado_en: Date;
  actualizado_en: Date;
  ultimo_login?: Date;
}

export interface PayloadJWT {
  id: string;
  email: string;
  rol: string;
  tipo: 'admin';
}

export interface LoginRequest {
  email: string;
  contraseña: string;
}