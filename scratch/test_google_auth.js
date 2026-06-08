const https = require('https');

const url = 'https://ikoqkklyznnciwgauyvr.supabase.co/auth/v1/authorize?provider=google';

https.get(url, (res) => {
  if (res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
    const redirectUrl = res.headers.location || '';
    if (redirectUrl.includes('accounts.google.com')) {
      console.log('\n==================================================================');
      console.log('✅ ¡CONFIGURACIÓN CORRECTA! El proveedor de Google está habilitado.');
      console.log('El backend de Supabase redirige exitosamente a la pantalla de Google.');
      console.log('==================================================================\n');
    } else {
      console.log('\n==================================================================');
      console.log('⚠️ ADVERTENCIA: Redirección inesperada.');
      console.log('Destino:', redirectUrl);
      console.log('==================================================================\n');
    }
  } else {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log('\n==================================================================');
      console.log('❌ ERROR: El proveedor de Google NO está habilitado todavía.');
      console.log('Respuesta del servidor:', data.trim());
      console.log('==================================================================\n');
    });
  }
}).on('error', (e) => {
  console.error('Error de conexión:', e.message);
});
