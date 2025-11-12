import e from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

export interface GoogleProfile extends passport.Profile {
  _originalPath?: string; // ✅ Ruta original desde el estado
}

// Configurar estrategia Google OAuth SOLO si las variables existen
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL) {
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email'],
      passReqToCallback: true // ✅ Permitir acceso al request
    },
    (req: any, accessToken, refreshToken, profile, done) => {
      console.log('🔐 PERFIL COMPLETO DE GOOGLE:');
      console.log('- ID:', profile.id);
      console.log('- Display Name:', profile.displayName);
      console.log('- Emails:', profile.emails?.[0]?.value);
      
      // ✅ Obtener el estado (ruta original) si existe
      const originalPath = req.query.state || '/';
      console.log('📍 Ruta original desde estado:', originalPath);
      
      // ✅ Adjuntar la ruta original al perfil
      const profileWithState = {
        ...profile,
        _originalPath: originalPath
      };
      
      return done(null, profileWithState);
    }
  ));
} else {
  console.warn('⚠️  Google OAuth no configurado. Las rutas /auth/google no funcionarán.');
}

// Serialización simple
passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

export default passport;