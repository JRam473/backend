const axios = require('axios');

async function testAuth() {
  try {
    console.log('🔍 Probando endpoints de autenticación...');

    // 1. Primero probar si el servidor responde
    try {
      const healthCheck = await axios.get('http://localhost:4000', { timeout: 3000 });
      console.log('✅ Servidor activo');
    } catch (healthError) {
      console.log('❌ Servidor no responde - ¿Está ejecutándose?');
      console.log('Ejecuta: npm run dev en el backend');
      return;
    }

    // 2. Probar registro
    console.log('\n📝 Probando registro...');
    try {
      const registerResponse = await axios.post('http://localhost:4000/api/auth/register', {
        email: 'test@example.com',
        password: 'password123',
        username: 'testuser'
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('✅ Registro exitoso:', registerResponse.data);
    } catch (registerError) {
      console.log('❌ Error en registro:');
      if (registerError.response) {
        console.log('Status:', registerError.response.status);
        console.log('Mensaje:', registerError.response.data?.message);
      } else {
        console.log('Error:', registerError.message);
      }
    }

    // 3. Probar login
    console.log('\n🔐 Probando login...');
    try {
      const loginResponse = await axios.post('http://localhost:4000/api/auth/login', {
        email: 'test@example.com',
        password: 'password123'
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('✅ Login exitoso:', loginResponse.data);
    } catch (loginError) {
      console.log('❌ Error en login:');
      if (loginError.response) {
        console.log('Status:', loginError.response.status);
        console.log('Mensaje:', loginError.response.data?.message);
        console.log('Datos:', loginError.response.data);
      } else {
        console.log('Error:', loginError.message);
      }
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

testAuth();