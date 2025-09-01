/**
 * Auto-inicialização dos serviços core via API call
 * Este arquivo só será executado no server-side via API routes
 */

// Função para auto-inicializar os serviços (apenas server-side)
export async function autoInitializeServices() {
  console.log('🚀 Iniciando auto-inicialização dos serviços...');
  
  try {
    // Importar os services apenas no server-side usando require
    const discoveryService = require('./discovery-singleton').discoveryService;
    const grpcClientService = require('./server/grpc-client-service').grpcClientService;
    
    // Inicializar gRPC service (garante que singleton seja criado)
    console.log('✅ gRPC Client Service instanciado');
    
    // Inicializar discovery service automaticamente
    await discoveryService.initialize();
    console.log('✅ Discovery Service auto-inicializado com sucesso');
    
    return { success: true, message: 'Services initialized successfully' };
  } catch (error) {
    console.error('❌ Erro na auto-inicialização dos services:', error);
    throw error;
  }
}