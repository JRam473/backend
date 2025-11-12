//utils/jwt.ts
import jwt from 'jsonwebtoken';

export interface PayloadJWT {
  id: string;
  email: string;
  rol: string;
  tipo: 'admin';
}

// Función auxiliar para validar el payload
function isValidPayload(payload: any): payload is PayloadJWT {
  return (
    typeof payload === 'object' &&
    typeof payload.id === 'string' &&
    typeof payload.email === 'string' &&
    typeof payload.rol === 'string' &&
    payload.tipo === 'admin'
  );
}

export function generarToken(payload: PayloadJWT): string {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET no está definido en las variables de entorno');
  }

  // Conversión explícita para evitar problemas de tipos
  const token = jwt.sign(
    { ...payload } as object, 
    secret, 
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '60m' 
    } as jwt.SignOptions
  );

  return token;
}

export function verificarToken(token: string): PayloadJWT {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET no está definido en las variables de entorno');
  }

  try {
    const decoded = jwt.verify(token, secret);
    
    if (!isValidPayload(decoded)) {
      throw new Error('Estructura del token inválida');
    }
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Token JWT inválido');
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expirado');
    } else if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Error desconocido verificando token');
    }
  }
}