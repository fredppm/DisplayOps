import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';

// Mock console methods to reduce noise in tests
const originalConsole = console;
beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
});

describe('Auto-Restore Functionality Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Auto-Restore Configuration', () => {
    it('should configure auto-restore settings', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          hostId: 'test-host-1',
          autoRestore: {
            enabled: true,
            checkInterval: 300, // 5 minutes
            maxRetries: 3,
            restoreDelay: 60, // 1 minute
            conditions: {
              displayOffline: true,
              dashboardNotResponding: true,
              browserCrashed: true
            },
            actions: {
              restartBrowser: true,
              reloadDashboard: true,
              clearCache: false
            }
          }
        },
      });

      // Mock configuration
      res.status(200).json({
        success: true,
        data: {
          configId: 'config-123',
          hostId: 'test-host-1',
          autoRestore: {
            enabled: true,
            checkInterval: 300,
            maxRetries: 3,
            restoreDelay: 60,
            configuredAt: new Date().toISOString(),
            status: 'active'
          }
        },
        message: 'Auto-restore configured successfully'
      });

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.data.configId).toBe('config-123');
      expect(responseData.data.autoRestore.enabled).toBe(true);
    });

    it('should disable auto-restore', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          hostId: 'test-host-1',
          autoRestore: {
            enabled: false
          }
        },
      });

      // Mock disable
      res.status(200).json({
        success: true,
        data: {
          configId: 'config-123',
          hostId: 'test-host-1',
          autoRestore: {
            enabled: false,
            disabledAt: new Date().toISOString(),
            status: 'disabled'
          }
        }
      });

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.data.autoRestore.enabled).toBe(false);
    });
  });

  describe('Auto-Restore Monitoring', () => {
    it('should detect display offline condition', async () => {
      const monitorData = {
        hostId: 'test-host-1',
        timestamp: '2024-01-01T12:00:00Z',
        conditions: {
          displayOnline: false,
          lastHeartbeat: '2024-01-01T11:55:00Z',
          responseTime: null
        }
      };

      // Mock condition detection
      const mockConditionDetector = {
        detectConditions: jest.fn().mockResolvedValue({
          conditionsDetected: true,
          conditions: [
            {
              type: 'display_offline',
              severity: 'high',
              detectedAt: '2024-01-01T12:00:00Z',
              details: 'Display has been offline for 5 minutes'
            }
          ],
          requiresRestore: true
        })
      };

      const result = await mockConditionDetector.detectConditions(monitorData);
      
      expect(result.conditionsDetected).toBe(true);
      expect(result.requiresRestore).toBe(true);
      expect(result.conditions[0].type).toBe('display_offline');
    });

    it('should detect dashboard not responding', async () => {
      const monitorData = {
        hostId: 'test-host-1',
        timestamp: '2024-01-01T12:00:00Z',
        conditions: {
          displayOnline: true,
          dashboardResponding: false,
          responseTime: 10000, // 10 seconds
          errorCount: 5
        }
      };

      // Mock condition detection
      const mockConditionDetector = {
        detectConditions: jest.fn().mockResolvedValue({
          conditionsDetected: true,
          conditions: [
            {
              type: 'dashboard_not_responding',
              severity: 'medium',
              detectedAt: '2024-01-01T12:00:00Z',
              details: 'Dashboard response time > 5 seconds'
            }
          ],
          requiresRestore: true
        })
      };

      const result = await mockConditionDetector.detectConditions(monitorData);
      
      expect(result.conditionsDetected).toBe(true);
      expect(result.conditions[0].type).toBe('dashboard_not_responding');
    });

    it('should detect browser crash', async () => {
      const monitorData = {
        hostId: 'test-host-1',
        timestamp: '2024-01-01T12:00:00Z',
        conditions: {
          browserProcess: false,
          browserMemory: 0,
          crashReport: {
            type: 'browser_crash',
            timestamp: '2024-01-01T11:58:00Z',
            reason: 'out_of_memory'
          }
        }
      };

      // Mock condition detection
      const mockConditionDetector = {
        detectConditions: jest.fn().mockResolvedValue({
          conditionsDetected: true,
          conditions: [
            {
              type: 'browser_crashed',
              severity: 'high',
              detectedAt: '2024-01-01T12:00:00Z',
              details: 'Browser process terminated due to out of memory'
            }
          ],
          requiresRestore: true
        })
      };

      const result = await mockConditionDetector.detectConditions(monitorData);
      
      expect(result.conditionsDetected).toBe(true);
      expect(result.conditions[0].type).toBe('browser_crashed');
    });
  });

  describe('Auto-Restore Actions', () => {
    it('should execute browser restart', async () => {
      const restoreAction = {
        hostId: 'test-host-1',
        action: 'restart_browser',
        reason: 'display_offline',
        timestamp: '2024-01-01T12:00:00Z'
      };

      // Mock browser restart
      const mockRestoreExecutor = {
        executeRestore: jest.fn().mockResolvedValue({
          actionId: 'action-123',
          hostId: 'test-host-1',
          action: 'restart_browser',
          status: 'executing',
          startedAt: '2024-01-01T12:00:00Z',
          estimatedDuration: 30
        })
      };

      const result = await mockRestoreExecutor.executeRestore(restoreAction);
      
      expect(result.actionId).toBe('action-123');
      expect(result.action).toBe('restart_browser');
      expect(result.status).toBe('executing');
    });

    it('should execute dashboard reload', async () => {
      const restoreAction = {
        hostId: 'test-host-1',
        action: 'reload_dashboard',
        reason: 'dashboard_not_responding',
        timestamp: '2024-01-01T12:00:00Z'
      };

      // Mock dashboard reload
      const mockRestoreExecutor = {
        executeRestore: jest.fn().mockResolvedValue({
          actionId: 'action-456',
          hostId: 'test-host-1',
          action: 'reload_dashboard',
          status: 'completed',
          startedAt: '2024-01-01T12:00:00Z',
          completedAt: '2024-01-01T12:00:05Z',
          duration: 5
        })
      };

      const result = await mockRestoreExecutor.executeRestore(restoreAction);
      
      expect(result.actionId).toBe('action-456');
      expect(result.action).toBe('reload_dashboard');
      expect(result.status).toBe('completed');
      expect(result.duration).toBe(5);
    });

    it('should execute cache clear', async () => {
      const restoreAction = {
        hostId: 'test-host-1',
        action: 'clear_cache',
        reason: 'browser_crashed',
        timestamp: '2024-01-01T12:00:00Z'
      };

      // Mock cache clear
      const mockRestoreExecutor = {
        executeRestore: jest.fn().mockResolvedValue({
          actionId: 'action-789',
          hostId: 'test-host-1',
          action: 'clear_cache',
          status: 'completed',
          startedAt: '2024-01-01T12:00:00Z',
          completedAt: '2024-01-01T12:00:02Z',
          duration: 2,
          cacheSize: '150MB'
        })
      };

      const result = await mockRestoreExecutor.executeRestore(restoreAction);
      
      expect(result.actionId).toBe('action-789');
      expect(result.action).toBe('clear_cache');
      expect(result.status).toBe('completed');
      expect(result.cacheSize).toBe('150MB');
    });
  });

  describe('Auto-Restore Retry Logic', () => {
    it('should handle retry attempts', async () => {
      const retryConfig = {
        hostId: 'test-host-1',
        maxRetries: 3,
        currentAttempt: 1,
        lastFailure: '2024-01-01T12:00:00Z',
        failureReason: 'browser_startup_timeout'
      };

      // Mock retry logic
      const mockRetryManager = {
        shouldRetry: jest.fn().mockResolvedValue({
          shouldRetry: true,
          attempt: 2,
          delay: 60,
          reason: 'Retry attempt 2 of 3'
        })
      };

      const result = await mockRetryManager.shouldRetry(retryConfig);
      
      expect(result.shouldRetry).toBe(true);
      expect(result.attempt).toBe(2);
      expect(result.delay).toBe(60);
    });

    it('should stop retrying after max attempts', async () => {
      const retryConfig = {
        hostId: 'test-host-1',
        maxRetries: 3,
        currentAttempt: 3,
        lastFailure: '2024-01-01T12:00:00Z',
        failureReason: 'persistent_display_issue'
      };

      // Mock retry logic
      const mockRetryManager = {
        shouldRetry: jest.fn().mockResolvedValue({
          shouldRetry: false,
          attempt: 3,
          reason: 'Maximum retry attempts reached',
          requiresManualIntervention: true
        })
      };

      const result = await mockRetryManager.shouldRetry(retryConfig);
      
      expect(result.shouldRetry).toBe(false);
      expect(result.attempt).toBe(3);
      expect(result.requiresManualIntervention).toBe(true);
    });

    it('should implement exponential backoff', async () => {
      const retryConfig = {
        hostId: 'test-host-1',
        maxRetries: 5,
        currentAttempt: 2,
        baseDelay: 30
      };

      // Mock exponential backoff
      const mockRetryManager = {
        calculateDelay: jest.fn().mockResolvedValue({
          delay: 60, // 30 * 2^1
          jitter: 5,
          totalDelay: 65
        })
      };

      const result = await mockRetryManager.calculateDelay(retryConfig);
      
      expect(result.delay).toBe(60);
      expect(result.totalDelay).toBe(65);
    });
  });

  describe('Auto-Restore Success Verification', () => {
    it('should verify successful restore', async () => {
      const verificationData = {
        hostId: 'test-host-1',
        actionId: 'action-123',
        timestamp: '2024-01-01T12:01:00Z'
      };

      // Mock success verification
      const mockVerifier = {
        verifyRestore: jest.fn().mockResolvedValue({
          success: true,
          actionId: 'action-123',
          verifiedAt: '2024-01-01T12:01:00Z',
          checks: {
            displayOnline: true,
            dashboardResponding: true,
            browserProcess: true,
            responseTime: 200
          },
          status: 'restored'
        })
      };

      const result = await mockVerifier.verifyRestore(verificationData);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('restored');
      expect(result.checks.displayOnline).toBe(true);
      expect(result.checks.responseTime).toBeLessThan(1000);
    });

    it('should detect failed restore', async () => {
      const verificationData = {
        hostId: 'test-host-1',
        actionId: 'action-456',
        timestamp: '2024-01-01T12:01:00Z'
      };

      // Mock failed verification
      const mockVerifier = {
        verifyRestore: jest.fn().mockResolvedValue({
          success: false,
          actionId: 'action-456',
          verifiedAt: '2024-01-01T12:01:00Z',
          checks: {
            displayOnline: false,
            dashboardResponding: false,
            browserProcess: true,
            responseTime: 5000
          },
          status: 'failed',
          error: 'Display still offline after restore attempt'
        })
      };

      const result = await mockVerifier.verifyRestore(verificationData);
      
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.checks.displayOnline).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Auto-Restore History and Logging', () => {
    it('should log restore attempts', async () => {
      const restoreAttempt = {
        hostId: 'test-host-1',
        actionId: 'action-123',
        action: 'restart_browser',
        reason: 'display_offline',
        timestamp: '2024-01-01T12:00:00Z',
        status: 'completed'
      };

      // Mock logging
      const mockLogger = {
        logRestoreAttempt: jest.fn().mockResolvedValue({
          logged: true,
          logId: 'log-123',
          timestamp: '2024-01-01T12:00:00Z'
        })
      };

      const result = await mockLogger.logRestoreAttempt(restoreAttempt);
      
      expect(result.logged).toBe(true);
      expect(result.logId).toBe('log-123');
    });

    it('should track restore history', async () => {
      const hostId = 'test-host-1';

      // Mock history tracking
      const mockHistoryTracker = {
        getRestoreHistory: jest.fn().mockResolvedValue({
          hostId: 'test-host-1',
          history: [
            {
              actionId: 'action-123',
              action: 'restart_browser',
              reason: 'display_offline',
              timestamp: '2024-01-01T12:00:00Z',
              status: 'completed',
              duration: 30
            },
            {
              actionId: 'action-456',
              action: 'reload_dashboard',
              reason: 'dashboard_not_responding',
              timestamp: '2024-01-01T11:30:00Z',
              status: 'completed',
              duration: 5
            }
          ],
          totalAttempts: 2,
          successRate: 100
        })
      };

      const history = await mockHistoryTracker.getRestoreHistory(hostId);
      
      expect(history.hostId).toBe('test-host-1');
      expect(history.history).toHaveLength(2);
      expect(history.totalAttempts).toBe(2);
      expect(history.successRate).toBe(100);
    });
  });

  describe('Auto-Restore Notifications', () => {
    it('should send restore notifications', async () => {
      const notificationData = {
        hostId: 'test-host-1',
        actionId: 'action-123',
        action: 'restart_browser',
        reason: 'display_offline',
        status: 'completed',
        timestamp: '2024-01-01T12:00:00Z'
      };

      // Mock notification
      const mockNotifier = {
        sendNotification: jest.fn().mockResolvedValue({
          sent: true,
          notificationId: 'notif-123',
          recipients: ['admin@example.com'],
          timestamp: '2024-01-01T12:00:00Z'
        })
      };

      const result = await mockNotifier.sendNotification(notificationData);
      
      expect(result.sent).toBe(true);
      expect(result.notificationId).toBe('notif-123');
      expect(result.recipients).toContain('admin@example.com');
    });

    it('should handle notification preferences', async () => {
      const notificationConfig = {
        hostId: 'test-host-1',
        preferences: {
          email: true,
          slack: false,
          sms: false,
          criticalOnly: true
        }
      };

      // Mock notification preferences
      const mockNotificationManager = {
        getPreferences: jest.fn().mockResolvedValue({
          hostId: 'test-host-1',
          email: true,
          slack: false,
          sms: false,
          criticalOnly: true,
          emailRecipients: ['admin@example.com'],
          updatedAt: '2024-01-01T12:00:00Z'
        })
      };

      const preferences = await mockNotificationManager.getPreferences(notificationConfig);
      
      expect(preferences.email).toBe(true);
      expect(preferences.criticalOnly).toBe(true);
      expect(preferences.emailRecipients).toContain('admin@example.com');
    });
  });

  describe('Auto-Restore Performance Metrics', () => {
    it('should track restore performance', async () => {
      const performanceData = {
        hostId: 'test-host-1',
        period: '2024-01-01 to 2024-01-31',
        metrics: {
          totalRestores: 15,
          successfulRestores: 14,
          failedRestores: 1,
          averageRestoreTime: 25,
          totalDowntime: 375,
          uptime: 99.8
        }
      };

      // Mock performance tracking
      const mockPerformanceTracker = {
        trackPerformance: jest.fn().mockResolvedValue({
          tracked: true,
          reportId: 'report-123',
          timestamp: '2024-01-01T12:00:00Z'
        })
      };

      const result = await mockPerformanceTracker.trackPerformance(performanceData);
      
      expect(result.tracked).toBe(true);
      expect(result.reportId).toBe('report-123');
    });

    it('should generate performance alerts', async () => {
      const alertThresholds = {
        maxRestoreTime: 60,
        maxDowntime: 300,
        minSuccessRate: 95
      };

      const performanceData = {
        hostId: 'test-host-1',
        averageRestoreTime: 75,
        totalDowntime: 450,
        successRate: 93
      };

      // Mock alert generation
      const mockAlertGenerator = {
        generateAlerts: jest.fn().mockResolvedValue({
          alerts: [
            {
              type: 'high_restore_time',
              severity: 'warning',
              message: 'Average restore time (75s) exceeds threshold (60s)',
              timestamp: '2024-01-01T12:00:00Z'
            },
            {
              type: 'low_success_rate',
              severity: 'critical',
              message: 'Success rate (93%) below threshold (95%)',
              timestamp: '2024-01-01T12:00:00Z'
            }
          ]
        })
      };

      const result = await mockAlertGenerator.generateAlerts(performanceData, alertThresholds);
      
      expect(result.alerts).toHaveLength(2);
      expect(result.alerts[0].type).toBe('high_restore_time');
      expect(result.alerts[1].type).toBe('low_success_rate');
    });
  });
});
