// Implementação do Protocolo de Sincronização Bidirecional
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { compressData, decompressData, CompressedPayload, CompressionOptions, DEFAULT_COMPRESSION_OPTIONS } from '../utils/compression';

export interface SyncMessage {
  id: string;
  type: MessageType;
  timestamp: string;
  source: {
    controllerId: string;
    siteId: string;
    version: string;
  };
  target?: {
    controllerId?: string;
    siteId?: string;
  };
  payload: any;
  checksum: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  ttl?: number;
  sequenceNumber?: number;
  orderingKey?: string;
  vectorClock?: Record<string, number>;
  compression?: {
    enabled: boolean;
    algorithm: 'gzip';
    originalSize: number;
    compressedSize: number;
    ratio: number;
  };
}

export enum MessageType {
  HEARTBEAT = 'heartbeat',
  COMMAND = 'command',
  STATUS = 'status',
  CONFIG = 'config',
  DASHBOARD = 'dashboard',
  METRICS = 'metrics',
  ACK = 'acknowledgment',
  ERROR = 'error'
}

export interface HandshakeRequest {
  controllerId: string;
  siteId: string;
  version: string;
  capabilities: string[];
  lastSync?: string;
}

export interface HandshakeResponse {
  accepted: boolean;
  serverTime: string;
  syncRequired: boolean;
  syncType: 'full' | 'incremental';
  config: any;
}

export interface AckPayload {
  messageId: string;
  status: 'success' | 'error' | 'partial';
  timestamp: string;
  error?: string;
  details?: {
    processed: number;
    failed: number;
    errors: string[];
    queued?: boolean;
    reason?: string;
  };
}

export interface SyncMetrics {
  messagesPerMinute: number;
  averageLatency: number;
  successRate: number;
  errorRate: number;
  retryRate: number;
  queueSize: number;
  lastSync: string;
  bandwidth: {
    sent: number;
    received: number;
  };
}

export class SyncProtocol {
  private metrics: Map<string, SyncMetrics> = new Map();
  private messageLog: Map<string, SyncMessage> = new Map();
  private sequenceNumbers: Map<string, number> = new Map();
  private vectorClocks: Map<string, Record<string, number>> = new Map();
  private pendingMessages: Map<string, SyncMessage[]> = new Map();
  private readonly MAX_LOG_SIZE = 10000;
  private compressionOptions: CompressionOptions = DEFAULT_COMPRESSION_OPTIONS;

  /**
   * Gera um ID único para a mensagem
   */
  generateMessageId(): string {
    return `msg_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Calcula checksum MD5 do payload (considera se está comprimido)
   */
  calculateChecksum(payload: any, isCompressed = false): string {
    if (isCompressed && Buffer.isBuffer(payload)) {
      // Para dados comprimidos, usar o buffer diretamente
      return crypto.createHash('md5').update(payload).digest('hex');
    } else {
      // Para dados não comprimidos, serializar como JSON
      const payloadStr = JSON.stringify(payload);
      return crypto.createHash('md5').update(payloadStr).digest('hex');
    }
  }

  /**
   * Valida o checksum de uma mensagem
   */
  validateChecksum(message: SyncMessage): boolean {
    const isCompressed = message.compression?.enabled || false;
    const calculatedChecksum = this.calculateChecksum(message.payload, isCompressed);
    return calculatedChecksum === message.checksum;
  }

  /**
   * Cria uma mensagem de sincronização
   */
  async createMessage(
    type: MessageType,
    payload: any,
    source: { controllerId: string; siteId: string; version: string },
    options: {
      target?: { controllerId?: string; siteId?: string };
      priority?: 'low' | 'normal' | 'high' | 'critical';
      ttl?: number;
      orderingKey?: string;
      compression?: Partial<CompressionOptions>;
    } = {}
  ): Promise<SyncMessage> {
    const sourceId = source.controllerId;
    
    // Gerar próximo número de sequência
    const currentSeq = this.sequenceNumbers.get(sourceId) || 0;
    const sequenceNumber = currentSeq + 1;
    this.sequenceNumbers.set(sourceId, sequenceNumber);
    
    // Atualizar vector clock
    const vectorClock = this.getVectorClock(sourceId);
    vectorClock[sourceId] = sequenceNumber;
    this.vectorClocks.set(sourceId, vectorClock);

    // Aplicar compressão se habilitada
    const compressionOptions = { ...this.compressionOptions, ...options.compression };
    const compressedPayload = await compressData(payload, compressionOptions);
    
    let finalPayload = compressedPayload.data;
    let compressionInfo = undefined;

    if (compressedPayload.compressed) {
      compressionInfo = {
        enabled: true,
        algorithm: 'gzip' as const,
        originalSize: compressedPayload.originalSize,
        compressedSize: compressedPayload.compressedSize,
        ratio: compressedPayload.compressionRatio
      };
      
      logger.debug('Message compressed', {
        messageType: type,
        originalSize: compressedPayload.originalSize,
        compressedSize: compressedPayload.compressedSize,
        ratio: compressedPayload.compressionRatio,
        spaceSaved: compressedPayload.originalSize - compressedPayload.compressedSize
      });
    }

    const message: SyncMessage = {
      id: this.generateMessageId(),
      type,
      timestamp: new Date().toISOString(),
      source,
      target: options.target,
      payload: finalPayload,
      checksum: this.calculateChecksum(finalPayload, compressedPayload.compressed),
      priority: options.priority || 'normal',
      ttl: options.ttl,
      sequenceNumber,
      orderingKey: options.orderingKey || `${sourceId}:${type}`,
      vectorClock: { ...vectorClock },
      compression: compressionInfo
    };

    // Log da mensagem
    this.logMessage(message);

    return message;
  }

  /**
   * Processa uma mensagem recebida
   */
  async processMessage(message: SyncMessage): Promise<AckPayload> {
    const startTime = Date.now();
    const { controllerId } = message.source;

    try {
      // Validar checksum
      if (!this.validateChecksum(message)) {
        throw new Error('Invalid checksum');
      }

      // Descomprimir dados se necessário
      if (message.compression?.enabled) {
        try {
          const compressedPayload: CompressedPayload = {
            compressed: true,
            data: message.payload,
            originalSize: message.compression.originalSize,
            compressedSize: message.compression.compressedSize,
            compressionRatio: message.compression.ratio
          };
          
          message.payload = await decompressData(compressedPayload);
          
          logger.debug('Message decompressed', {
            messageId: message.id,
            originalSize: message.compression.originalSize,
            compressedSize: message.compression.compressedSize,
            ratio: message.compression.ratio
          });
        } catch (error: any) {
          throw new Error(`Failed to decompress message: ${error.message}`);
        }
      }

      // Verificar TTL
      if (message.ttl && this.isMessageExpired(message)) {
        throw new Error('Message expired');
      }

      // Verificar ordenação da mensagem
      if (!this.isMessageInOrder(message)) {
        // Adicionar à fila de pendentes se fora de ordem
        this.addToPendingMessages(message);
        
        logger.warn('Message out of order, added to pending queue', {
          messageId: message.id,
          controllerId,
          sequenceNumber: message.sequenceNumber,
          expected: (this.sequenceNumbers.get(controllerId) || 0) + 1
        });

        return {
          messageId: message.id,
          status: 'partial',
          timestamp: new Date().toISOString(),
          details: {
            processed: 0,
            failed: 0,
            errors: [],
            queued: true,
            reason: 'out_of_order'
          }
        };
      }

      // Log da mensagem recebida
      this.logMessage(message);

      // Processar mensagem
      const result = await this.processMessageInternal(message);

      // Atualizar número de sequência se disponível
      if (message.sequenceNumber) {
        this.sequenceNumbers.set(controllerId, message.sequenceNumber);
      }

      // Processar mensagens pendentes que agora podem estar em ordem
      this.processPendingMessages(controllerId);

      // Atualizar métricas
      this.updateMetrics(controllerId, startTime, true);

      // Criar ACK de sucesso
      return {
        messageId: message.id,
        status: 'success',
        timestamp: new Date().toISOString(),
        details: result
      };

    } catch (error: any) {
      // Atualizar métricas
      this.updateMetrics(message.source.controllerId, startTime, false);

      logger.error('Error processing sync message', {
        messageId: message.id,
        type: message.type,
        error: error.message
      });

      // Criar ACK de erro
      return {
        messageId: message.id,
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Processa mensagem baseado no tipo (método interno)
   */
  private async processMessageInternal(message: SyncMessage): Promise<any> {
    switch (message.type) {
      case MessageType.HEARTBEAT:
        return this.processHeartbeat(message);
      
      case MessageType.STATUS:
        return this.processStatus(message);
      
      case MessageType.CONFIG:
        return this.processConfig(message);
      
      case MessageType.METRICS:
        return this.processMetrics(message);
      
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Processa heartbeat do controller
   */
  private processHeartbeat(message: SyncMessage): any {
    const { controllerId } = message.source;
    const heartbeatData = message.payload;

    logger.debug('Heartbeat received', {
      controllerId,
      status: heartbeatData.status,
      uptime: heartbeatData.uptime
    });

    // Atualizar status do controller
    this.updateControllerStatus(controllerId, heartbeatData);

    return {
      acknowledged: true,
      serverTime: new Date().toISOString(),
      commands: this.getPendingCommands(controllerId)
    };
  }

  /**
   * Processa status do controller
   */
  private processStatus(message: SyncMessage): any {
    const { controllerId } = message.source;
    const statusData = message.payload;

    logger.info('Status update received', {
      controllerId,
      hostAgents: statusData.hostAgents?.total || 0
    });

    // Salvar status
    this.updateControllerStatus(controllerId, statusData);

    return {
      processed: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Processa mudanças de configuração
   */
  private processConfig(message: SyncMessage): any {
    const { controllerId } = message.source;
    const configData = message.payload;

    logger.info('Config update received', {
      controllerId,
      configType: configData.configType,
      changesCount: Object.keys(configData.changes || {}).length
    });

    // Aplicar mudanças de configuração
    this.applyConfigChanges(controllerId, configData);

    return {
      applied: true,
      timestamp: new Date().toISOString(),
      requiresRestart: configData.requiresRestart || false
    };
  }

  /**
   * Processa métricas do controller
   */
  private processMetrics(message: SyncMessage): any {
    const { controllerId } = message.source;
    const metricsData = message.payload;

    // Salvar métricas
    this.updateControllerMetrics(controllerId, metricsData);

    return {
      stored: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Verifica se a mensagem expirou
   */
  private isMessageExpired(message: SyncMessage): boolean {
    if (!message.ttl) return false;
    
    const messageTime = new Date(message.timestamp).getTime();
    const now = Date.now();
    const ttlMs = message.ttl * 1000;
    
    return (now - messageTime) > ttlMs;
  }

  /**
   * Log da mensagem
   */
  private logMessage(message: SyncMessage): void {
    this.messageLog.set(message.id, message);

    // Limpar log se muito grande
    if (this.messageLog.size > this.MAX_LOG_SIZE) {
      const oldestKey = this.messageLog.keys().next().value as string;
      this.messageLog.delete(oldestKey);
    }
  }

  /**
   * Atualiza métricas de sincronização
   */
  private updateMetrics(controllerId: string, startTime: number, success: boolean): void {
    const latency = Date.now() - startTime;
    let metrics = this.metrics.get(controllerId);

    if (!metrics) {
      metrics = {
        messagesPerMinute: 0,
        averageLatency: 0,
        successRate: 100,
        errorRate: 0,
        retryRate: 0,
        queueSize: 0,
        lastSync: new Date().toISOString(),
        bandwidth: { sent: 0, received: 0 }
      };
      this.metrics.set(controllerId, metrics);
    }

    // Atualizar métricas
    metrics.averageLatency = (metrics.averageLatency + latency) / 2;
    metrics.lastSync = new Date().toISOString();
    
    if (success) {
      metrics.successRate = Math.min(100, metrics.successRate + 0.1);
      metrics.errorRate = Math.max(0, metrics.errorRate - 0.1);
    } else {
      metrics.successRate = Math.max(0, metrics.successRate - 0.5);
      metrics.errorRate = Math.min(100, metrics.errorRate + 0.5);
    }
  }

  /**
   * Atualiza status do controller
   */
  private updateControllerStatus(controllerId: string, statusData: any): void {
    // Esta função seria integrada com o sistema de gerenciamento de controllers
    logger.debug('Updating controller status', { controllerId, status: statusData });
  }

  /**
   * Obtém comandos pendentes para o controller
   */
  private getPendingCommands(controllerId: string): any[] {
    // Esta função retornaria comandos pendentes do banco de dados
    return [];
  }

  /**
   * Aplica mudanças de configuração
   */
  private applyConfigChanges(controllerId: string, configData: any): void {
    logger.info('Applying config changes', { 
      controllerId, 
      configType: configData.configType 
    });
  }

  /**
   * Atualiza métricas do controller
   */
  private updateControllerMetrics(controllerId: string, metricsData: any): void {
    logger.debug('Updating controller metrics', { controllerId });
  }

  /**
   * Obtém vector clock para um controller
   */
  private getVectorClock(controllerId: string): Record<string, number> {
    if (!this.vectorClocks.has(controllerId)) {
      this.vectorClocks.set(controllerId, {});
    }
    return this.vectorClocks.get(controllerId)!;
  }

  /**
   * Verifica se uma mensagem está em ordem
   */
  isMessageInOrder(message: SyncMessage): boolean {
    const { controllerId } = message.source;
    const expectedSeq = (this.sequenceNumbers.get(controllerId) || 0) + 1;
    
    return !message.sequenceNumber || message.sequenceNumber === expectedSeq;
  }

  /**
   * Ordena mensagens por timestamp e número de sequência
   */
  sortMessagesByTimestamp(messages: SyncMessage[]): SyncMessage[] {
    return messages.sort((a, b) => {
      // Primeiro por timestamp
      const timeCompare = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      if (timeCompare !== 0) return timeCompare;
      
      // Depois por número de sequência (se disponível)
      if (a.sequenceNumber && b.sequenceNumber) {
        return a.sequenceNumber - b.sequenceNumber;
      }
      
      // Por último, por ID da mensagem para garantir ordem determinística
      return a.id.localeCompare(b.id);
    });
  }

  /**
   * Compara vector clocks para determinar ordenação causal
   */
  compareVectorClocks(clockA?: Record<string, number>, clockB?: Record<string, number>): 'before' | 'after' | 'concurrent' {
    if (!clockA || !clockB) return 'concurrent';
    
    const allKeys = new Set([...Object.keys(clockA), ...Object.keys(clockB)]);
    let hasLess = false;
    let hasGreater = false;
    
    for (const key of allKeys) {
      const valueA = clockA[key] || 0;
      const valueB = clockB[key] || 0;
      
      if (valueA < valueB) hasLess = true;
      if (valueA > valueB) hasGreater = true;
    }
    
    if (hasLess && !hasGreater) return 'before';
    if (!hasLess && hasGreater) return 'after';
    return 'concurrent';
  }

  /**
   * Processa mensagens pendentes em ordem
   */
  processPendingMessages(controllerId: string): void {
    const pending = this.pendingMessages.get(controllerId);
    if (!pending || pending.length === 0) return;
    
    // Ordenar mensagens pendentes
    const sorted = this.sortMessagesByTimestamp(pending);
    const processed: SyncMessage[] = [];
    
    for (const message of sorted) {
      if (this.isMessageInOrder(message)) {
        // Processar mensagem
        try {
          this.processMessageInternal(message);
          processed.push(message);
          
          // Atualizar número de sequência
          if (message.sequenceNumber) {
            this.sequenceNumbers.set(controllerId, message.sequenceNumber);
          }
          
          logger.debug('Processed pending message', {
            messageId: message.id,
            controllerId,
            sequenceNumber: message.sequenceNumber
          });
        } catch (error: any) {
          logger.error('Failed to process pending message', {
            messageId: message.id,
            error: error.message
          });
        }
      } else {
        break; // Parar se encontrar mensagem fora de ordem
      }
    }
    
    // Remover mensagens processadas
    if (processed.length > 0) {
      const remaining = sorted.filter(msg => !processed.includes(msg));
      this.pendingMessages.set(controllerId, remaining);
    }
  }

  /**
   * Adiciona mensagem à fila de pendentes
   */
  private addToPendingMessages(message: SyncMessage): void {
    const { controllerId } = message.source;
    
    if (!this.pendingMessages.has(controllerId)) {
      this.pendingMessages.set(controllerId, []);
    }
    
    this.pendingMessages.get(controllerId)!.push(message);
    
    logger.debug('Message added to pending queue', {
      messageId: message.id,
      controllerId,
      queueSize: this.pendingMessages.get(controllerId)!.length
    });
  }

  /**
   * Obtém métricas de sincronização
   */
  getSyncMetrics(controllerId: string): SyncMetrics | null {
    return this.metrics.get(controllerId) || null;
  }

  /**
   * Obtém todas as métricas
   */
  getAllMetrics(): Map<string, SyncMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Limpa métricas antigas
   */
  cleanupOldMetrics(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = new Date(Date.now() - maxAgeMs);
    
    for (const [controllerId, metrics] of this.metrics.entries()) {
      const lastSyncTime = new Date(metrics.lastSync);
      if (lastSyncTime < cutoff) {
        this.metrics.delete(controllerId);
        logger.info('Cleaned up old metrics', { controllerId });
      }
    }
  }

  /**
   * Obtém estatísticas de ordenação de mensagens
   */
  getOrderingStats(): {
    controllers: Record<string, {
      sequenceNumber: number;
      pendingMessages: number;
      vectorClockSize: number;
    }>;
    totalPendingMessages: number;
  } {
    const controllers: Record<string, any> = {};
    let totalPendingMessages = 0;

    // Estatísticas por controller
    for (const [controllerId, sequenceNumber] of this.sequenceNumbers.entries()) {
      const pendingCount = this.pendingMessages.get(controllerId)?.length || 0;
      const vectorClock = this.vectorClocks.get(controllerId) || {};
      
      controllers[controllerId] = {
        sequenceNumber,
        pendingMessages: pendingCount,
        vectorClockSize: Object.keys(vectorClock).length
      };
      
      totalPendingMessages += pendingCount;
    }

    return {
      controllers,
      totalPendingMessages
    };
  }

  /**
   * Configura opções de compressão
   */
  setCompressionOptions(options: Partial<CompressionOptions>): void {
    this.compressionOptions = { ...this.compressionOptions, ...options };
    
    logger.info('Compression options updated', {
      enabled: this.compressionOptions.enabled,
      minimumSize: this.compressionOptions.minimumSize,
      level: this.compressionOptions.level
    });
  }

  /**
   * Obtém opções de compressão atuais
   */
  getCompressionOptions(): CompressionOptions {
    return { ...this.compressionOptions };
  }

  /**
   * Obtém estatísticas de compressão
   */
  getCompressionStats(): {
    enabled: boolean;
    messagesCompressed: number;
    totalBytesSaved: number;
    averageCompressionRatio: number;
  } {
    let messagesCompressed = 0;
    let totalBytesSaved = 0;
    let totalCompressionRatio = 0;

    for (const message of this.messageLog.values()) {
      if (message.compression?.enabled) {
        messagesCompressed++;
        totalBytesSaved += (message.compression.originalSize - message.compression.compressedSize);
        totalCompressionRatio += message.compression.ratio;
      }
    }

    return {
      enabled: this.compressionOptions.enabled,
      messagesCompressed,
      totalBytesSaved,
      averageCompressionRatio: messagesCompressed > 0 ? totalCompressionRatio / messagesCompressed : 0
    };
  }
}

// Singleton instance
export const syncProtocol = new SyncProtocol();