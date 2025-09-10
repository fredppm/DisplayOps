import { performanceCollector } from './performance-metrics';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownMinutes: number;
  notificationChannels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  currentValue: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface AlertHistory {
  alerts: Alert[];
  totalCount: number;
  unacknowledgedCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private lastChecked: Map<string, number> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeDefaultRules();
    this.startMonitoring();
  }

  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'cpu-high',
        name: 'High CPU Usage',
        description: 'CPU usage is above 80%',
        metric: 'system.cpuUsage',
        condition: 'greater_than',
        threshold: 80,
        severity: 'high',
        enabled: true,
        cooldownMinutes: 5,
        notificationChannels: ['email', 'dashboard'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'cpu-critical',
        name: 'Critical CPU Usage',
        description: 'CPU usage is above 95%',
        metric: 'system.cpuUsage',
        condition: 'greater_than',
        threshold: 95,
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 2,
        notificationChannels: ['email', 'dashboard', 'sms'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'memory-high',
        name: 'High Memory Usage',
        description: 'Memory usage is above 85%',
        metric: 'system.memoryUsage',
        condition: 'greater_than',
        threshold: 85,
        severity: 'high',
        enabled: true,
        cooldownMinutes: 5,
        notificationChannels: ['email', 'dashboard'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'memory-critical',
        name: 'Critical Memory Usage',
        description: 'Memory usage is above 95%',
        metric: 'system.memoryUsage',
        condition: 'greater_than',
        threshold: 95,
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 1,
        notificationChannels: ['email', 'dashboard', 'sms'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'response-time-high',
        name: 'High API Response Time',
        description: 'Average API response time is above 2000ms',
        metric: 'api.averageResponseTime',
        condition: 'greater_than',
        threshold: 2000,
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 10,
        notificationChannels: ['dashboard'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'error-rate-high',
        name: 'High Error Rate',
        description: 'API error rate is above 5%',
        metric: 'api.errorRate',
        condition: 'greater_than',
        threshold: 5,
        severity: 'high',
        enabled: true,
        cooldownMinutes: 5,
        notificationChannels: ['email', 'dashboard'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'error-rate-critical',
        name: 'Critical Error Rate',
        description: 'API error rate is above 15%',
        metric: 'api.errorRate',
        condition: 'greater_than',
        threshold: 15,
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 2,
        notificationChannels: ['email', 'dashboard', 'sms'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }

  private startMonitoring(): void {
    // Check every 30 seconds
    this.checkInterval = setInterval(() => {
      this.checkAlerts();
    }, 30000);
  }

  private checkAlerts(): void {
    const summary = performanceCollector.getSummary();
    
    this.rules.forEach((rule, ruleId) => {
      if (!rule.enabled) return;

      // Check cooldown
      const lastCheck = this.lastChecked.get(ruleId);
      const now = Date.now();
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      
      if (lastCheck && (now - lastCheck) < cooldownMs) {
        return;
      }

      const currentValue = this.getMetricValue(rule.metric, summary);
      if (currentValue === null) return;

      const shouldAlert = this.evaluateCondition(
        currentValue, 
        rule.condition, 
        rule.threshold
      );

      if (shouldAlert) {
        this.triggerAlert(rule, currentValue);
        this.lastChecked.set(ruleId, now);
      } else {
        // Check if we should resolve an existing alert
        this.resolveAlert(ruleId);
      }
    });
  }

  private getMetricValue(metric: string, summary: any): number | null {
    const parts = metric.split('.');
    let value = summary;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }
    
    return typeof value === 'number' ? value : null;
  }

  private evaluateCondition(
    value: number, 
    condition: string, 
    threshold: number
  ): boolean {
    switch (condition) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return Math.abs(value - threshold) < 0.01;
      default:
        return false;
    }
  }

  private triggerAlert(rule: AlertRule, currentValue: number): void {
    const alertId = `${rule.id}-${Date.now()}`;
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      message: `${rule.description}. Current value: ${currentValue.toFixed(2)}${this.getMetricUnit(rule.metric)}`,
      severity: rule.severity,
      metric: rule.metric,
      currentValue,
      threshold: rule.threshold,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      resolved: false
    };

    this.activeAlerts.set(rule.id, alert);
    this.alertHistory.unshift(alert);

    // Keep only last 1000 alerts in history
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(0, 1000);
    }

    // Trigger notifications
    this.sendNotifications(alert, rule.notificationChannels);

    console.log(`🚨 ALERT TRIGGERED: ${rule.name} - ${alert.message}`);
  }

  private resolveAlert(ruleId: string): void {
    const activeAlert = this.activeAlerts.get(ruleId);
    if (activeAlert && !activeAlert.resolved) {
      activeAlert.resolved = true;
      activeAlert.resolvedAt = new Date().toISOString();
      
      // Find in history and update
      const historyIndex = this.alertHistory.findIndex(a => a.id === activeAlert.id);
      if (historyIndex >= 0) {
        this.alertHistory[historyIndex] = activeAlert;
      }

      this.activeAlerts.delete(ruleId);
      console.log(`✅ ALERT RESOLVED: ${activeAlert.ruleName}`);
    }
  }

  private getMetricUnit(metric: string): string {
    if (metric.includes('Usage') || metric.includes('Rate')) return '%';
    if (metric.includes('ResponseTime') || metric.includes('Time')) return 'ms';
    if (metric.includes('Memory')) return '%';
    if (metric.includes('Cpu')) return '%';
    return '';
  }

  private sendNotifications(alert: Alert, channels: string[]): void {
    // In a real implementation, this would integrate with actual notification services
    channels.forEach(channel => {
      switch (channel) {
        case 'email':
          // Would send email notification
          console.log(`📧 Email notification sent for: ${alert.ruleName}`);
          break;
        case 'sms':
          // Would send SMS notification
          console.log(`📱 SMS notification sent for: ${alert.ruleName}`);
          break;
        case 'dashboard':
          // Dashboard notifications are handled via API
          console.log(`📊 Dashboard notification for: ${alert.ruleName}`);
          break;
        default:
          console.log(`🔔 Notification via ${channel} for: ${alert.ruleName}`);
      }
    });
  }

  // Public API methods
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  getRule(id: string): AlertRule | undefined {
    return this.rules.get(id);
  }

  createRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): AlertRule {
    const id = `custom-${Date.now()}`;
    const newRule: AlertRule = {
      ...rule,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.rules.set(id, newRule);
    return newRule;
  }

  updateRule(id: string, updates: Partial<AlertRule>): AlertRule | null {
    const existing = this.rules.get(id);
    if (!existing) return null;

    const updated: AlertRule = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID changes
      createdAt: existing.createdAt, // Preserve creation date
      updatedAt: new Date().toISOString()
    };

    this.rules.set(id, updated);
    return updated;
  }

  deleteRule(id: string): boolean {
    const result = this.rules.delete(id);
    if (result) {
      // Also resolve any active alerts for this rule
      this.resolveAlert(id);
    }
    return result;
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(limit: number = 50): AlertHistory {
    const recent = this.alertHistory.slice(0, limit);
    const unacknowledgedCount = recent.filter(a => !a.acknowledged).length;
    const criticalCount = recent.filter(a => a.severity === 'critical').length;
    const highCount = recent.filter(a => a.severity === 'high').length;
    const mediumCount = recent.filter(a => a.severity === 'medium').length;
    const lowCount = recent.filter(a => a.severity === 'low').length;

    return {
      alerts: recent,
      totalCount: this.alertHistory.length,
      unacknowledgedCount,
      criticalCount,
      highCount,
      mediumCount,
      lowCount
    };
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    // Find in history
    const alertIndex = this.alertHistory.findIndex(a => a.id === alertId);
    if (alertIndex >= 0) {
      this.alertHistory[alertIndex].acknowledged = true;
      this.alertHistory[alertIndex].acknowledgedBy = acknowledgedBy;
      this.alertHistory[alertIndex].acknowledgedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  getAlertStats(): {
    totalRules: number;
    activeRules: number;
    activeAlerts: number;
    criticalAlerts: number;
    recentAlerts24h: number;
  } {
    const activeRules = Array.from(this.rules.values()).filter(r => r.enabled).length;
    const activeAlerts = this.activeAlerts.size;
    const criticalAlerts = Array.from(this.activeAlerts.values())
      .filter(a => a.severity === 'critical').length;
    
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAlerts24h = this.alertHistory.filter(a => 
      new Date(a.timestamp) > yesterday
    ).length;

    return {
      totalRules: this.rules.size,
      activeRules,
      activeAlerts,
      criticalAlerts,
      recentAlerts24h
    };
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

// Singleton instance
export const alertManager = new AlertManager();

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('SIGINT', () => {
    alertManager.stopMonitoring();
  });
  process.on('SIGTERM', () => {
    alertManager.stopMonitoring();
  });
}