const http = require('http');

// Configuração da API
const API_HOST = 'localhost';
const API_PORT = 8080; // Porta padrão do host agent

// Função para fazer uma requisição
function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// Função para fazer múltiplas requisições
async function testApiRequests() {
  console.log('🧪 Testando API Requests...');
  console.log(`📍 API: http://${API_HOST}:${API_PORT}`);
  
  try {
    // Teste 1: Status da API
    console.log('\n📡 Teste 1: Status da API');
    const status = await makeRequest('/api/status');
    console.log(`✅ Status: ${status.statusCode}`);
    
    // Teste 2: Múltiplas requisições para incrementar o contador
    console.log('\n📡 Teste 2: Múltiplas requisições');
    for (let i = 1; i <= 5; i++) {
      const response = await makeRequest('/api/status');
      console.log(`   Requisição ${i}: ${response.statusCode}`);
      await new Promise(resolve => setTimeout(resolve, 200)); // Aguarda 200ms entre requisições
    }
    
    // Teste 3: Verificar se o contador foi incrementado
    console.log('\n📊 Verificando contador...');
    console.log('   Abra o Debug Monitor (Ctrl+Shift+D) e vá para a tab Metrics');
    console.log('   O valor de "API Requests/min" deve ter aumentado!');
    
  } catch (error) {
    console.error('❌ Erro ao testar API:', error.message);
    console.log('\n💡 Possíveis soluções:');
    console.log('   1. Verifique se o host agent está rodando');
    console.log('   2. Verifique se a porta 3001 está correta');
    console.log('   3. Verifique se não há firewall bloqueando');
  }
}

// Executar o teste
testApiRequests();
