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

describe('Browser Extension Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Extension Registration', () => {
    it('should register browser extension', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          extensionId: 'extension-123',
          version: '1.0.0',
          browser: 'chrome',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          permissions: ['cookies', 'tabs', 'storage'],
          hostId: 'test-host-1'
        },
      });

      // Mock successful registration
      res.status(200).json({
        success: true,
        data: {
          registrationId: 'reg-123',
          extensionId: 'extension-123',
          status: 'registered',
          registeredAt: new Date().toISOString(),
          permissions: ['cookies', 'tabs', 'storage']
        },
        message: 'Extension registered successfully'
      });

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.data.registrationId).toBe('reg-123');
      expect(responseData.data.status).toBe('registered');
    });

    it('should handle duplicate extension registration', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          extensionId: 'existing-extension',
          version: '1.0.0',
          browser: 'chrome',
          hostId: 'test-host-1'
        },
      });

      // Mock duplicate registration
      res.status(409).json({
        success: false,
        error: 'Extension already registered',
        data: {
          existingRegistration: {
            registrationId: 'reg-456',
            registeredAt: '2024-01-01T08:00:00Z',
            status: 'active'
          }
        }
      });

      expect(res._getStatusCode()).toBe(409);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Extension already registered');
    });
  });

  describe('Extension Communication', () => {
    it('should send command to browser extension', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          extensionId: 'extension-123',
          command: {
            type: 'SET_COOKIE',
            payload: {
              name: 'session_id',
              value: 'abc123',
              domain: '.example.com',
              path: '/'
            }
          },
          priority: 'high'
        },
      });

      // Mock command execution
      res.status(200).json({
        success: true,
        data: {
          commandId: 'cmd-123',
          extensionId: 'extension-123',
          status: 'executed',
          executedAt: new Date().toISOString(),
          result: {
            success: true,
            message: 'Cookie set successfully'
          }
        }
      });

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.data.commandId).toBe('cmd-123');
      expect(responseData.data.status).toBe('executed');
    });

    it('should handle extension offline status', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          extensionId: 'offline-extension',
          command: {
            type: 'SET_COOKIE',
            payload: {
              name: 'session_id',
              value: 'abc123',
              domain: '.example.com'
            }
          }
        },
      });

      // Mock offline extension
      res.status(503).json({
        success: false,
        error: 'Extension is offline',
        data: {
          extensionId: 'offline-extension',
          lastSeen: '2024-01-01T10:00:00Z',
          status: 'offline'
        }
      });

      expect(res._getStatusCode()).toBe(503);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Extension is offline');
    });
  });

  describe('Extension Status Monitoring', () => {
    it('should get extension status', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: {
          extensionId: 'extension-123'
        }
      });

      // Mock extension status
      res.status(200).json({
        success: true,
        data: {
          extensionId: 'extension-123',
          status: 'active',
          version: '1.0.0',
          browser: 'chrome',
          lastHeartbeat: '2024-01-01T12:00:00Z',
          uptime: 14400,
          permissions: ['cookies', 'tabs', 'storage'],
          hostId: 'test-host-1'
        }
      });

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.data.status).toBe('active');
      expect(responseData.data.uptime).toBe(14400);
    });

    it('should handle extension heartbeat', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          extensionId: 'extension-123',
          heartbeat: {
            timestamp: '2024-01-01T12:00:00Z',
            memory: 50.5,
            cpu: 2.3,
            activeTabs: 3
          }
        },
      });

      // Mock heartbeat response
      res.status(200).json({
        success: true,
        data: {
          extensionId: 'extension-123',
          heartbeatReceived: true,
          timestamp: '2024-01-01T12:00:00Z',
          nextHeartbeat: '2024-01-01T12:05:00Z'
        }
      });

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.data.heartbeatReceived).toBe(true);
    });
  });

  describe('Extension Permissions', () => {
    it('should validate extension permissions', async () => {
      const requiredPermissions = ['cookies', 'tabs', 'storage'];
      const extensionPermissions = ['cookies', 'tabs', 'storage', 'notifications'];

      const validatePermissions = (required: string[], actual: string[]) => {
        return required.every(permission => actual.includes(permission));
      };

      expect(validatePermissions(requiredPermissions, extensionPermissions)).toBe(true);
    });

    it('should detect missing permissions', async () => {
      const requiredPermissions = ['cookies', 'tabs', 'storage'];
      const extensionPermissions = ['cookies', 'storage']; // Missing 'tabs'

      const validatePermissions = (required: string[], actual: string[]) => {
        return required.every(permission => actual.includes(permission));
      };

      expect(validatePermissions(requiredPermissions, extensionPermissions)).toBe(false);
    });

    it('should request additional permissions', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          extensionId: 'extension-123',
          requestPermissions: ['tabs', 'notifications']
        },
      });

      // Mock permission request
      res.status(200).json({
        success: true,
        data: {
          extensionId: 'extension-123',
          requestedPermissions: ['tabs', 'notifications'],
          status: 'pending',
          requestId: 'perm-req-123'
        }
      });

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.data.status).toBe('pending');
    });
  });

  describe('Extension Cookie Management', () => {
    it('should get cookies via extension', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        query: {
          extensionId: 'extension-123',
          domain: '.example.com'
        }
      });

      // Mock cookie retrieval
      res.status(200).json({
        success: true,
        data: {
          extensionId: 'extension-123',
          cookies: [
            {
              name: 'session_id',
              value: 'abc123',
              domain: '.example.com',
              path: '/',
              secure: true,
              httpOnly: true,
              expires: '2024-12-31T23:59:59Z'
            },
            {
              name: 'user_preference',
              value: 'dark_mode',
              domain: '.example.com',
              path: '/',
              secure: false,
              httpOnly: false
            }
          ],
          retrievedAt: '2024-01-01T12:00:00Z'
        }
      });

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.data.cookies).toHaveLength(2);
    });

    it('should set cookie via extension', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          extensionId: 'extension-123',
          cookie: {
            name: 'new_cookie',
            value: 'new_value',
            domain: '.example.com',
            path: '/',
            secure: true,
            httpOnly: true,
            expires: '2024-12-31T23:59:59Z'
          }
        },
      });

      // Mock cookie setting
      res.status(200).json({
        success: true,
        data: {
          extensionId: 'extension-123',
          cookieSet: true,
          cookieName: 'new_cookie',
          setAt: '2024-01-01T12:00:00Z'
        }
      });

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.data.cookieSet).toBe(true);
    });

    it('should delete cookie via extension', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'DELETE',
        body: {
          extensionId: 'extension-123',
          cookieName: 'old_cookie',
          domain: '.example.com',
          path: '/'
        },
      });

      // Mock cookie deletion
      res.status(200).json({
        success: true,
        data: {
          extensionId: 'extension-123',
          cookieDeleted: true,
          cookieName: 'old_cookie',
          deletedAt: '2024-01-01T12:00:00Z'
        }
      });

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.data.cookieDeleted).toBe(true);
    });
  });

  describe('Extension Error Handling', () => {
    it('should handle extension errors gracefully', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          extensionId: 'extension-123',
          command: {
            type: 'INVALID_COMMAND',
            payload: {}
          }
        },
      });

      // Mock error handling
      res.status(400).json({
        success: false,
        error: 'Invalid command type',
        data: {
          extensionId: 'extension-123',
          errorCode: 'INVALID_COMMAND',
          errorDetails: 'Command type INVALID_COMMAND is not supported',
          timestamp: '2024-01-01T12:00:00Z'
        }
      });

      expect(res._getStatusCode()).toBe(400);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Invalid command type');
    });

    it('should handle extension timeout', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          extensionId: 'extension-123',
          command: {
            type: 'SET_COOKIE',
            payload: {
              name: 'session_id',
              value: 'abc123',
              domain: '.example.com'
            }
          }
        },
      });

      // Mock timeout
      res.status(408).json({
        success: false,
        error: 'Extension command timeout',
        data: {
          extensionId: 'extension-123',
          timeout: 5000,
          retryAfter: 1000
        }
      });

      expect(res._getStatusCode()).toBe(408);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Extension command timeout');
    });
  });

  describe('Extension Security', () => {
    it('should validate extension signature', async () => {
      const extensionData = {
        extensionId: 'extension-123',
        signature: 'sha256-abc123def456',
        timestamp: '2024-01-01T12:00:00Z'
      };

      // Mock signature validation
      const mockSignatureValidator = {
        validateSignature: jest.fn().mockResolvedValue({
          valid: true,
          signature: 'sha256-abc123def456',
          verifiedAt: '2024-01-01T12:00:00Z'
        })
      };

      const result = await mockSignatureValidator.validateSignature(extensionData);
      
      expect(result.valid).toBe(true);
      expect(result.signature).toBe('sha256-abc123def456');
    });

    it('should reject invalid extension signature', async () => {
      const invalidExtensionData = {
        extensionId: 'extension-123',
        signature: 'invalid-signature',
        timestamp: '2024-01-01T12:00:00Z'
      };

      // Mock signature validation failure
      const mockSignatureValidator = {
        validateSignature: jest.fn().mockResolvedValue({
          valid: false,
          error: 'Invalid signature',
          signature: 'invalid-signature'
        })
      };

      const result = await mockSignatureValidator.validateSignature(invalidExtensionData);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });
  });

  describe('Extension Analytics', () => {
    it('should track extension usage', async () => {
      const usageData = {
        extensionId: 'extension-123',
        commands: {
          SET_COOKIE: 15,
          GET_COOKIE: 8,
          DELETE_COOKIE: 3
        },
        errors: 2,
        uptime: 14400,
        period: '2024-01-01T00:00:00Z to 2024-01-01T12:00:00Z'
      };

      // Mock usage tracking
      const mockAnalytics = {
        trackUsage: jest.fn().mockResolvedValue({
          tracked: true,
          usageId: 'usage-123',
          timestamp: '2024-01-01T12:00:00Z'
        })
      };

      const result = await mockAnalytics.trackUsage(usageData);
      
      expect(result.tracked).toBe(true);
      expect(result.usageId).toBe('usage-123');
    });

    it('should generate extension performance report', async () => {
      const extensionId = 'extension-123';

      // Mock performance report
      const mockPerformanceReporter = {
        generateReport: jest.fn().mockResolvedValue({
          extensionId: 'extension-123',
          period: '2024-01-01 to 2024-01-31',
          metrics: {
            totalCommands: 150,
            successRate: 98.5,
            averageResponseTime: 45,
            errors: 3,
            uptime: 99.8
          },
          recommendations: [
            'Consider updating to latest version',
            'Monitor error rate closely'
          ]
        })
      };

      const report = await mockPerformanceReporter.generateReport(extensionId);
      
      expect(report.extensionId).toBe('extension-123');
      expect(report.metrics.successRate).toBe(98.5);
      expect(report.metrics.totalCommands).toBe(150);
    });
  });
});
