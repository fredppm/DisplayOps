/**
 * Auto-inicialização dos serviços core via API call
 * Este arquivo só será executado no server-side via API routes
 * Usa WebSocket híbrido com fallback HTTP
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
    
    // 2. Inicializar Hybrid Admin Client (WebSocket + HTTP fallback)
    const adminClientEnabled = process.env.ADMIN_CLIENT_ENABLED !== 'false' && 
                              process.env.CONTROLLER_AUTO_REGISTER !== 'false';
    
    autoInitLogger.debug('Admin client auto-init check', {
      ADMIN_CLIENT_ENABLED: process.env.ADMIN_CLIENT_ENABLED,
      CONTROLLER_AUTO_REGISTER: process.env.CONTROLLER_AUTO_REGISTER,
      GRPC_ADMIN_ENABLED: process.env.GRPC_ADMIN_ENABLED, // Legacy support
      adminClientEnabled
    });
    
    if (adminClientEnabled) {
      try {
        // Usar import dinâmico para evitar problemas de dependência
        const { hybridAdminClientSingleton } = await import('./hybrid-admin-client-singleton');
        await hybridAdminClientSingleton.start();
        autoInitLogger.info('Hybrid Admin Client auto-inicializado com sucesso');
        services.push('Hybrid Admin Client');
      } catch (error) {
        autoInitLogger.error('Hybrid Admin Client falhou', { error: error instanceof Error ? error.message : String(error) });
        // Removido fallback para gRPC - usar apenas WebSocket/HTTP
      }
    } else {
      autoInitLogger.info('Admin Client desabilitado via configuração');
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