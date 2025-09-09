/**
 * Auto-inicialização dos serviços core via API call
 * Este arquivo só será executado no server-side via API routes
 * Usa apenas gRPC (não mais HTTP REST)
 */

import { createContextLogger } from '../utils/logger';

const autoInitLogger = createContextLogger('auto-init');

// Função para auto-inicializar os serviços (apenas server-side)
export async function autoInitializeServices() {
  autoInitLogger.info('Iniciando auto-inicialização dos serviços...');
  
  try {
    const services = [];
    
    // 1. Inicializar Discovery Service
    try {
      const discoveryService = require('./discovery-singleton').discoveryService;
      await discoveryService.initialize();
      autoInitLogger.info('Discovery Service auto-inicializado com sucesso');
      services.push('Discovery Service');
    } catch (error) {
      autoInitLogger.warn('Discovery Service não disponível', { error: error instanceof Error ? error.message : String(error) });
    }
    
    // 2. Inicializar gRPC Client (se habilitado)
    const grpcEnabled = process.env.GRPC_ADMIN_ENABLED !== 'false' && 
                       process.env.CONTROLLER_AUTO_REGISTER !== 'false';
    
    autoInitLogger.debug('gRPC auto-init check', {
      GRPC_ADMIN_ENABLED: process.env.GRPC_ADMIN_ENABLED,
      CONTROLLER_AUTO_REGISTER: process.env.CONTROLLER_AUTO_REGISTER,
      grpcEnabled
    });
    
    if (grpcEnabled) {
      try {
        // Usar import dinâmico para evitar problemas de dependência
        const { grpcClientSingleton } = await import('./grpc-client-singleton');
        await grpcClientSingleton.start();
        autoInitLogger.info('gRPC Client auto-inicializado com sucesso');
        services.push('gRPC Client');
      } catch (error) {
        autoInitLogger.warn('gRPC Client não disponível', { error: error instanceof Error ? error.message : String(error) });
      }
    } else {
      autoInitLogger.info('gRPC Client desabilitado via configuração');
    }
    
    const message = services.length > 0 
      ? `Services initialized: ${services.join(', ')}`
      : 'No services were initialized';
      
    return { success: true, message, services };
  } catch (error) {
    autoInitLogger.error('Erro na auto-inicialização dos services', { error });
    throw error;
  }
}