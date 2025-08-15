const http = require('http');

function testEndpoint() {
  const data = JSON.stringify({
    phoneNumber: '5511999999999'
  });

  const options = {
    hostname: 'localhost',
    port: 3005,
    path: '/api/test/simulate-campaign',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  console.log('🔍 Testando endpoint de simulação de campanha...');
  
  const req = http.request(options, (res) => {
    console.log(`📊 Status: ${res.statusCode}`);
    console.log(`📋 Headers:`, res.headers);

    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      try {
        const parsedData = JSON.parse(responseData);
        console.log('✅ Resposta:', parsedData);
      } catch (e) {
        console.log('📄 Resposta (text):', responseData);
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Erro na requisição:', e.message);
  });

  req.write(data);
  req.end();
}

testEndpoint();
