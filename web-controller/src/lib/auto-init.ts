/**
 * Auto-inicialização dos serviços core via API call
 * Este arquivo só será executado no server-side via API routes
 */

// Função para auto-inicializar os serviços (apenas server-side)
export async function autoInitializeServices() {
  console.log('🚀 Iniciando auto-inicialização dos serviços...');
  
  try {
    const services = [];
    
    // 1. Inicializar Discovery Service
    try {
      const discoveryService = require('./discovery-singleton').discoveryService;
      await discoveryService.initialize();
      console.log('✅ Discovery Service auto-inicializado com sucesso');
      services.push('Discovery Service');
    } catch (error) {
      console.warn('⚠️ Discovery Service não disponível:', error.message);
    }
    
    // 2. Inicializar gRPC Client (se habilitado)
    const grpcEnabled = process.env.GRPC_ADMIN_ENABLED !== 'false' && 
                       process.env.CONTROLLER_AUTO_REGISTER !== 'false';
    
    console.log('🔍 gRPC auto-init check:', {
      GRPC_ADMIN_ENABLED: process.env.GRPC_ADMIN_ENABLED,
      CONTROLLER_AUTO_REGISTER: process.env.CONTROLLER_AUTO_REGISTER,
      grpcEnabled
    });
    
    if (grpcEnabled) {
      try {
        // Usar import dinâmico para evitar problemas de dependência
        const { grpcClientSingleton } = await import('./grpc-client-singleton');
        await grpcClientSingleton.start();
        console.log('✅ gRPC Client auto-inicializado com sucesso');
        services.push('gRPC Client');
      } catch (error) {
        console.warn('⚠️ gRPC Client não disponível:', error.message);
      }
    } else {
      console.log('ℹ️ gRPC Client desabilitado via configuração');
    }
    
    // 3. Verificar outros serviços (fallback)
    try {
      const grpcClientService = require('./server/grpc-client-service').grpcClientService;
      console.log('✅ gRPC Client Service (legacy) instanciado');
      services.push('gRPC Client Service (legacy)');
    } catch (error) {
      console.log('ℹ️ gRPC Client Service (legacy) não disponível');
    }
    
    const message = services.length > 0 
      ? `Services initialized: ${services.join(', ')}`
      : 'No services were initialized';
      
    return { success: true, message, services };
  } catch (error) {
    console.error('❌ Erro na auto-inicialização dos services:', error);
    throw error;
  }
}