// Sistema de Resolução de Conflitos para Sincronização Multi-Site
import { logger } from '../utils/logger';

export interface ConflictRecord {
  id: string;
  timestamp: string;
  path: string;
  conflictType: ConflictType;
  sources: ConflictSource[];
  resolution: ConflictResolution;
  resolvedBy: string;
  resolvedAt?: string;
  metadata?: any;
}

export enum ConflictType {
  DATA_MISMATCH = 'data_mismatch',        // Dados diferentes para o mesmo objeto
  VERSION_CONFLICT = 'version_conflict',   // Versões conflitantes
  TIMESTAMP_CONFLICT = 'timestamp_conflict', // Timestamps ambíguos
  DELETE_CONFLICT = 'delete_conflict',     // Objeto deletado em um lado, modificado no outro
  CREATE_CONFLICT = 'create_conflict',     // Mesmo objeto criado em locais diferentes
  PERMISSION_CONFLICT = 'permission_conflict' // Conflitos de permissão/autorização
}

export enum ConflictResolution {
  WEB_ADMIN_WINS = 'web_admin_wins',      // Web-admin tem precedência
  CONTROLLER_WINS = 'controller_wins',     // Controller local tem precedência
  MERGE = 'merge',                        // Merge inteligente dos dados
  MANUAL = 'manual',                      // Resolução manual necessária
  LAST_WRITER_WINS = 'last_writer_wins',  // Última modificação ganha
  VERSIONED = 'versioned'                 // Manter ambas as versões
}

export interface ConflictSource {
  origin: 'web-admin' | 'controller';
  controllerId?: string;
  siteId?: string;
  data: any;
  version: number;
  timestamp: string;
  checksum?: string;
}

export interface ConflictResolutionPolicy {
  path: string;
  conflictType: ConflictType;
  defaultResolution: ConflictResolution;
  conditions?: Array<{
    condition: string;
    resolution: ConflictResolution;
  }>;
  mergeFn?: (sources: ConflictSource[]) => any;
  validateFn?: (data: any) => boolean;
}

export class ConflictResolver {
  private policies: Map<string, ConflictResolutionPolicy[]> = new Map();
  private conflictLog: ConflictRecord[] = [];
  private readonly MAX_LOG_SIZE = 1000;

  constructor() {
    this.initializeDefaultPolicies();
  }

  /**
   * Inicializa políticas padrão de resolução de conflitos
   */
  private initializeDefaultPolicies(): void {
    // Configurações do Controller - Controller sempre ganha (autonomia local)
    this.addPolicy({
      path: 'controller.config.*',
      conflictType: ConflictType.DATA_MISMATCH,
      defaultResolution: ConflictResolution.CONTROLLER_WINS
    });

    // Dashboards - Web-Admin sempre ganha (gestão centralizada)
    this.addPolicy({
      path: 'dashboards.*',
      conflictType: ConflictType.DATA_MISMATCH,
      defaultResolution: ConflictResolution.WEB_ADMIN_WINS
    });

    // Sites - Web-Admin sempre ganha
    this.addPolicy({
      path: 'sites.*',
      conflictType: ConflictType.DATA_MISMATCH,
      defaultResolution: ConflictResolution.WEB_ADMIN_WINS
    });

    // Host status - Last writer wins (dados dinâmicos)
    this.addPolicy({
      path: 'hosts.*.status',
      conflictType: ConflictType.DATA_MISMATCH,
      defaultResolution: ConflictResolution.LAST_WRITER_WINS
    });

    // Métricas - Merge inteligente
    this.addPolicy({
      path: 'metrics.*',
      conflictType: ConflictType.DATA_MISMATCH,
      defaultResolution: ConflictResolution.MERGE,
      mergeFn: this.mergeMetrics.bind(this)
    });

    // Conflitos de versão - Last writer wins por padrão
    this.addPolicy({
      path: '*',
      conflictType: ConflictType.VERSION_CONFLICT,
      defaultResolution: ConflictResolution.LAST_WRITER_WINS
    });

    // Conflitos de timestamp - Last writer wins
    this.addPolicy({
      path: '*',
      conflictType: ConflictType.TIMESTAMP_CONFLICT,
      defaultResolution: ConflictResolution.LAST_WRITER_WINS
    });

    // Conflitos de delete - Manual por segurança
    this.addPolicy({
      path: '*',
      conflictType: ConflictType.DELETE_CONFLICT,
      defaultResolution: ConflictResolution.MANUAL
    });
  }

  /**
   * Adiciona uma nova política de resolução
   */
  public addPolicy(policy: ConflictResolutionPolicy): void {
    const key = `${policy.path}:${policy.conflictType}`;
    
    if (!this.policies.has(policy.path)) {
      this.policies.set(policy.path, []);
    }
    
    this.policies.get(policy.path)!.push(policy);
    
    logger.debug('Conflict resolution policy added', {
      path: policy.path,
      type: policy.conflictType,
      resolution: policy.defaultResolution
    });
  }

  /**
   * Detecta conflitos entre duas versões de dados
   */
  public detectConflicts(
    path: string,
    webAdminData: ConflictSource,
    controllerData: ConflictSource
  ): ConflictRecord[] {
    const conflicts: ConflictRecord[] = [];

    // Verificar conflito de versão
    if (webAdminData.version !== controllerData.version) {
      conflicts.push(this.createConflictRecord(
        path,
        ConflictType.VERSION_CONFLICT,
        [webAdminData, controllerData]
      ));
    }

    // Verificar conflito de dados
    if (webAdminData.checksum && controllerData.checksum) {
      if (webAdminData.checksum !== controllerData.checksum) {
        conflicts.push(this.createConflictRecord(
          path,
          ConflictType.DATA_MISMATCH,
          [webAdminData, controllerData]
        ));
      }
    } else {
      // Comparação profunda se não houver checksum
      if (JSON.stringify(webAdminData.data) !== JSON.stringify(controllerData.data)) {
        conflicts.push(this.createConflictRecord(
          path,
          ConflictType.DATA_MISMATCH,
          [webAdminData, controllerData]
        ));
      }
    }

    // Verificar conflito de timestamp (ambiguidade)
    const timeDiff = Math.abs(
      new Date(webAdminData.timestamp).getTime() - 
      new Date(controllerData.timestamp).getTime()
    );
    
    // Se os timestamps são muito próximos (< 1 segundo) mas os dados são diferentes
    if (timeDiff < 1000 && conflicts.some(c => c.conflictType === ConflictType.DATA_MISMATCH)) {
      conflicts.push(this.createConflictRecord(
        path,
        ConflictType.TIMESTAMP_CONFLICT,
        [webAdminData, controllerData]
      ));
    }

    return conflicts;
  }

  /**
   * Resolve um conflito usando as políticas configuradas
   */
  public resolveConflict(conflict: ConflictRecord): {
    resolved: boolean;
    data: any;
    resolution: ConflictResolution;
    error?: string;
  } {
    try {
      // Encontrar política aplicável
      const policy = this.findApplicablePolicy(conflict.path, conflict.conflictType);
      
      if (!policy) {
        return {
          resolved: false,
          data: null,
          resolution: ConflictResolution.MANUAL,
          error: 'No applicable policy found'
        };
      }

      // Aplicar resolução baseada na política
      const resolution = this.determineResolution(policy, conflict);
      const resolvedData = this.applyResolution(resolution, conflict.sources, policy);

      // Validar resultado se houver função de validação
      if (policy.validateFn && !policy.validateFn(resolvedData)) {
        return {
          resolved: false,
          data: null,
          resolution: ConflictResolution.MANUAL,
          error: 'Resolved data failed validation'
        };
      }

      // Marcar conflito como resolvido
      conflict.resolution = resolution;
      conflict.resolvedBy = 'system';
      conflict.resolvedAt = new Date().toISOString();

      logger.info('Conflict resolved', {
        conflictId: conflict.id,
        path: conflict.path,
        type: conflict.conflictType,
        resolution: resolution
      });

      return {
        resolved: true,
        data: resolvedData,
        resolution: resolution
      };

    } catch (error: any) {
      logger.error('Failed to resolve conflict', {
        conflictId: conflict.id,
        error: error.message
      });

      return {
        resolved: false,
        data: null,
        resolution: ConflictResolution.MANUAL,
        error: error.message
      };
    }
  }

  /**
   * Resolve múltiplos conflitos em lote
   */
  public resolveBatchConflicts(conflicts: ConflictRecord[]): {
    resolved: ConflictRecord[];
    unresolved: ConflictRecord[];
    errors: string[];
  } {
    const resolved: ConflictRecord[] = [];
    const unresolved: ConflictRecord[] = [];
    const errors: string[] = [];

    for (const conflict of conflicts) {
      const result = this.resolveConflict(conflict);
      
      if (result.resolved) {
        resolved.push(conflict);
      } else {
        unresolved.push(conflict);
        if (result.error) {
          errors.push(`${conflict.id}: ${result.error}`);
        }
      }
    }

    logger.info('Batch conflict resolution completed', {
      total: conflicts.length,
      resolved: resolved.length,
      unresolved: unresolved.length,
      errors: errors.length
    });

    return { resolved, unresolved, errors };
  }

  /**
   * Cria um registro de conflito
   */
  private createConflictRecord(
    path: string,
    conflictType: ConflictType,
    sources: ConflictSource[]
  ): ConflictRecord {
    const record: ConflictRecord = {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      path,
      conflictType,
      sources,
      resolution: ConflictResolution.MANUAL, // Padrão até ser resolvido
      resolvedBy: 'system'
    };

    this.logConflict(record);
    return record;
  }

  /**
   * Encontra política aplicável para um conflito
   */
  private findApplicablePolicy(path: string, conflictType: ConflictType): ConflictResolutionPolicy | null {
    // Tentar match exato primeiro
    const exactPolicies = this.policies.get(path);
    if (exactPolicies) {
      const policy = exactPolicies.find(p => p.conflictType === conflictType);
      if (policy) return policy;
    }

    // Tentar match com wildcards
    for (const [policyPath, policies] of this.policies.entries()) {
      if (this.matchPath(policyPath, path)) {
        const policy = policies.find(p => p.conflictType === conflictType);
        if (policy) return policy;
      }
    }

    // Política genérica como último recurso
    const genericPolicies = this.policies.get('*');
    if (genericPolicies) {
      return genericPolicies.find(p => p.conflictType === conflictType) || null;
    }

    return null;
  }

  /**
   * Verifica se um path corresponde ao padrão da política
   */
  private matchPath(policyPath: string, actualPath: string): boolean {
    if (policyPath === '*') return true;
    
    const policyParts = policyPath.split('.');
    const actualParts = actualPath.split('.');
    
    if (policyParts.length !== actualParts.length) return false;
    
    for (let i = 0; i < policyParts.length; i++) {
      if (policyParts[i] !== '*' && policyParts[i] !== actualParts[i]) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Determina a resolução baseada na política e condições
   */
  private determineResolution(
    policy: ConflictResolutionPolicy,
    conflict: ConflictRecord
  ): ConflictResolution {
    // Verificar condições específicas
    if (policy.conditions) {
      for (const condition of policy.conditions) {
        if (this.evaluateCondition(condition.condition, conflict)) {
          return condition.resolution;
        }
      }
    }

    return policy.defaultResolution;
  }

  /**
   * Avalia uma condição para resolução
   */
  private evaluateCondition(condition: string, conflict: ConflictRecord): boolean {
    // Implementação simples de condições
    switch (condition) {
      case 'is_critical_path':
        return conflict.path.includes('critical') || conflict.path.includes('config');
      
      case 'has_recent_timestamp':
        const latestTimestamp = Math.max(
          ...conflict.sources.map(s => new Date(s.timestamp).getTime())
        );
        const now = Date.now();
        return (now - latestTimestamp) < 60000; // Menos de 1 minuto
      
      case 'single_source':
        return conflict.sources.length === 1;
      
      default:
        return false;
    }
  }

  /**
   * Aplica a resolução escolhida
   */
  private applyResolution(
    resolution: ConflictResolution,
    sources: ConflictSource[],
    policy?: ConflictResolutionPolicy
  ): any {
    switch (resolution) {
      case ConflictResolution.WEB_ADMIN_WINS:
        const webAdminSource = sources.find(s => s.origin === 'web-admin');
        return webAdminSource?.data || sources[0]?.data;
      
      case ConflictResolution.CONTROLLER_WINS:
        const controllerSource = sources.find(s => s.origin === 'controller');
        return controllerSource?.data || sources[0]?.data;
      
      case ConflictResolution.LAST_WRITER_WINS:
        const sortedSources = [...sources].sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        return sortedSources[0]?.data;
      
      case ConflictResolution.MERGE:
        if (policy?.mergeFn) {
          return policy.mergeFn(sources);
        }
        return this.defaultMerge(sources);
      
      case ConflictResolution.VERSIONED:
        return {
          versions: sources.map(s => ({
            origin: s.origin,
            data: s.data,
            version: s.version,
            timestamp: s.timestamp
          }))
        };
      
      default:
        // MANUAL - retornar dados como estão para revisão manual
        return {
          conflictSources: sources,
          requiresManualResolution: true
        };
    }
  }

  /**
   * Merge padrão para dados
   */
  private defaultMerge(sources: ConflictSource[]): any {
    if (sources.length === 0) return {};
    
    const result = { ...sources[0].data };
    
    for (let i = 1; i < sources.length; i++) {
      const source = sources[i];
      
      // Merge simples - propriedades mais recentes ganham
      if (source.data && typeof source.data === 'object') {
        Object.assign(result, source.data);
      }
    }
    
    return result;
  }

  /**
   * Merge específico para métricas
   */
  private mergeMetrics(sources: ConflictSource[]): any {
    if (sources.length === 0) return {};
    
    const merged: any = {
      sources: sources.length,
      mergedAt: new Date().toISOString(),
      data: {}
    };
    
    // Para métricas, fazer soma/média conforme apropriado
    sources.forEach(source => {
      if (source.data && typeof source.data === 'object') {
        Object.entries(source.data).forEach(([key, value]) => {
          if (typeof value === 'number') {
            if (!merged.data[key]) {
              merged.data[key] = { sum: 0, count: 0, average: 0 };
            }
            merged.data[key].sum += value;
            merged.data[key].count += 1;
            merged.data[key].average = merged.data[key].sum / merged.data[key].count;
          } else {
            // Para valores não numéricos, usar o mais recente
            merged.data[key] = value;
          }
        });
      }
    });
    
    return merged;
  }

  /**
   * Registra um conflito no log
   */
  private logConflict(record: ConflictRecord): void {
    this.conflictLog.push(record);
    
    // Limitar tamanho do log
    if (this.conflictLog.length > this.MAX_LOG_SIZE) {
      this.conflictLog.shift();
    }
    
    logger.warn('Conflict detected', {
      conflictId: record.id,
      path: record.path,
      type: record.conflictType,
      sourcesCount: record.sources.length
    });
  }

  /**
   * Obtém histórico de conflitos
   */
  public getConflictHistory(limit?: number): ConflictRecord[] {
    const history = [...this.conflictLog].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Obtém estatísticas de conflitos
   */
  public getConflictStats(): {
    total: number;
    byType: Record<ConflictType, number>;
    byResolution: Record<ConflictResolution, number>;
    recentConflicts: number;
  } {
    const total = this.conflictLog.length;
    const byType = {} as Record<ConflictType, number>;
    const byResolution = {} as Record<ConflictResolution, number>;
    
    // Conflitos recentes (últimas 24 horas)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentConflicts = this.conflictLog.filter(
      c => new Date(c.timestamp).getTime() > dayAgo
    ).length;
    
    // Contar por tipo e resolução
    this.conflictLog.forEach(record => {
      byType[record.conflictType] = (byType[record.conflictType] || 0) + 1;
      byResolution[record.resolution] = (byResolution[record.resolution] || 0) + 1;
    });
    
    return {
      total,
      byType,
      byResolution,
      recentConflicts
    };
  }
}

// Singleton instance
export const conflictResolver = new ConflictResolver();