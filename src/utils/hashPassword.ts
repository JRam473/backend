import bcrypt from 'bcrypt';

export const hashContraseña = async (contraseña: string): Promise<string> => {
  const saltRounds = 12;
  return await bcrypt.hash(contraseña, saltRounds);
};

export const compararContraseña = async (contraseña: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(contraseña, hash);
};