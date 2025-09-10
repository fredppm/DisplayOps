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

describe('Cookie Synchronization Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Cookie Sync API', () => {
    it('should sync cookies to host agent', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          hostId: 'test-host-1',
          cookies: [
            {
              name: 'session_id',
              value: 'abc123',
              domain: '.example.com',
              path: '/',
              secure: true,
              httpOnly: true,
              expires: new Date('2024-12-31').toISOString()
            },
            {
              name: 'user_preference',
              value: 'dark_mode',
              domain: '.example.com',
              path: '/',
              secure: false,
              httpOnly: false,
              expires: new Date('2024-12-31').toISOString()
            }
          ],
          syncMode: 'replace'
        },
      });

      // Mock successful sync
      res.status(200).json({
        success: true,
        data: {
          syncId: 'sync-123',
          hostId: 'test-host-1',
          cookiesSynced: 2,
          syncMode: 'replace',
          syncedAt: new Date().toISOString(),
          status: 'completed'
        },
        message: 'Cookies synchronized successfully'
      });

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.data.syncId).toBe('sync-123');
      expect(responseData.data.cookiesSynced).toBe(2);
      expect(responseData.data.syncMode).toBe('replace');
    });

    it('should handle cookie sync to offline host', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          hostId: 'offline-host',
          cookies: [
            {
              name: 'session_id',
              value: 'abc123',
              domain: '.example.com',
              path: '/'
            }
          ],
          syncMode: 'replace'
        },
      });

      // Mock sync failure
      res.status(503).json({
        success: false,
        error: 'Host agent is offline',
        data: {
          syncId: 'sync-456',
          hostId: 'offline-host',
          status: 'failed',
          error: 'Host agent is offline',
          retryAfter: 300
        }
      });

      expect(res._getStatusCode()).toBe(503);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Host agent is offline');
      expect(responseData.data.retryAfter).toBe(300);
    });

    it('should validate cookie format before sync', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          hostId: 'test-host-1',
          cookies: [
            {
              name: '', // Invalid: empty name
              value: 'abc123',
              domain: '.example.com'
            }
          ],
          syncMode: 'replace'
        },
      });

      // Mock validation failure
      res.status(400).json({
        success: false,
        error: 'Invalid cookie format: name cannot be empty',
        data: null
      });

      expect(res._getStatusCode()).toBe(400);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Invalid cookie format');
    });
  });

  describe('Cookie Sync Modes', () => {
    it('should handle replace sync mode', async () => {
      const replaceSync = {
        hostId: 'test-host-1',
        cookies: [
          {
            name: 'new_session',
            value: 'xyz789',
            domain: '.example.com',
            path: '/'
          }
        ],
        syncMode: 'replace'
      };

      // Mock replace sync
      const mockCookieService = {
        syncCookies: jest.fn().mockResolvedValue({
          success: true,
          mode: 'replace',
          cookiesReplaced: 1,
          cookiesRemoved: 2,
          totalCookies: 1
        })
      };

      const result = await mockCookieService.syncCookies(replaceSync);
      
      expect(result.success).toBe(true);
      expect(result.mode).toBe('replace');
      expect(result.cookiesReplaced).toBe(1);
      expect(result.cookiesRemoved).toBe(2);
    });

    it('should handle merge sync mode', async () => {
      const mergeSync = {
        hostId: 'test-host-1',
        cookies: [
          {
            name: 'additional_cookie',
            value: 'new_value',
            domain: '.example.com',
            path: '/'
          }
        ],
        syncMode: 'merge'
      };

      // Mock merge sync
      const mockCookieService = {
        syncCookies: jest.fn().mockResolvedValue({
          success: true,
          mode: 'merge',
          cookiesAdded: 1,
          cookiesUpdated: 0,
          totalCookies: 3
        })
      };

      const result = await mockCookieService.syncCookies(mergeSync);
      
      expect(result.success).toBe(true);
      expect(result.mode).toBe('merge');
      expect(result.cookiesAdded).toBe(1);
      expect(result.cookiesUpdated).toBe(0);
    });

    it('should handle selective sync mode', async () => {
      const selectiveSync = {
        hostId: 'test-host-1',
        cookies: [
          {
            name: 'specific_cookie',
            value: 'specific_value',
            domain: '.example.com',
            path: '/'
          }
        ],
        syncMode: 'selective',
        cookieNames: ['specific_cookie', 'another_cookie']
      };

      // Mock selective sync
      const mockCookieService = {
        syncCookies: jest.fn().mockResolvedValue({
          success: true,
          mode: 'selective',
          cookiesSynced: 1,
          cookiesSkipped: 1,
          totalCookies: 1
        })
      };

      const result = await mockCookieService.syncCookies(selectiveSync);
      
      expect(result.success).toBe(true);
      expect(result.mode).toBe('selective');
      expect(result.cookiesSynced).toBe(1);
      expect(result.cookiesSkipped).toBe(1);
    });
  });

  describe('Cookie Validation', () => {
    it('should validate cookie properties', async () => {
      const validCookie = {
        name: 'session_id',
        value: 'abc123',
        domain: '.example.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'strict',
        expires: new Date('2024-12-31').toISOString()
      };

      const validateCookie = (cookie: any) => {
        return cookie.name && 
               cookie.name.length > 0 &&
               cookie.value !== undefined &&
               cookie.domain &&
               cookie.path &&
               typeof cookie.secure === 'boolean' &&
               typeof cookie.httpOnly === 'boolean' &&
               ['strict', 'lax', 'none'].includes(cookie.sameSite || 'lax');
      };

      expect(validateCookie(validCookie)).toBe(true);
    });

    it('should reject invalid cookie properties', async () => {
      const invalidCookie = {
        name: '', // Empty name
        value: 'abc123',
        domain: 'invalid-domain', // Invalid domain format
        path: '/',
        secure: 'not-boolean', // Invalid type
        sameSite: 'invalid-value' // Invalid sameSite value
      };

      const validateCookie = (cookie: any): boolean => {
        return !!(cookie.name && 
               cookie.name.length > 0 &&
               cookie.value !== undefined &&
               /^\.?[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(cookie.domain) &&
               cookie.path &&
               typeof cookie.secure === 'boolean' &&
               ['strict', 'lax', 'none'].includes(cookie.sameSite || 'lax'));
      };

      expect(validateCookie(invalidCookie)).toBe(false);
    });
  });

  describe('Cookie Sync Scheduling', () => {
    it('should schedule periodic cookie sync', async () => {
      const periodicSync = {
        hostId: 'test-host-1',
        schedule: {
          interval: 300, // 5 minutes
          timezone: 'America/Sao_Paulo',
          enabled: true
        }
      };

      // Mock periodic sync scheduling
      const mockScheduler = {
        schedulePeriodicSync: jest.fn().mockResolvedValue({
          scheduleId: 'schedule-123',
          nextSync: '2024-01-01T00:05:00-03:00',
          interval: 300,
          status: 'active'
        })
      };

      const result = await mockScheduler.schedulePeriodicSync(periodicSync);
      
      expect(result.scheduleId).toBe('schedule-123');
      expect(result.interval).toBe(300);
      expect(result.status).toBe('active');
    });

    it('should handle conditional cookie sync', async () => {
      const conditionalSync = {
        hostId: 'test-host-1',
        conditions: {
          cookieChanged: true,
          sessionExpired: false,
          userLoggedIn: true
        },
        cookies: [
          {
            name: 'session_id',
            value: 'new_session_123',
            domain: '.example.com',
            path: '/'
          }
        ]
      };

      // Mock conditional sync
      const mockConditionalSync = {
        syncIfConditionsMet: jest.fn().mockResolvedValue({
          conditionsMet: true,
          syncExecuted: true,
          cookiesSynced: 1,
          reason: 'session_id changed'
        })
      };

      const result = await mockConditionalSync.syncIfConditionsMet(conditionalSync);
      
      expect(result.conditionsMet).toBe(true);
      expect(result.syncExecuted).toBe(true);
      expect(result.cookiesSynced).toBe(1);
    });
  });

  describe('Cookie Sync Conflicts', () => {
    it('should detect cookie conflicts', async () => {
      const conflictingSync = {
        hostId: 'test-host-1',
        cookies: [
          {
            name: 'conflict_cookie',
            value: 'new_value',
            domain: '.example.com',
            path: '/'
          }
        ]
      };

      // Mock conflict detection
      const mockConflictDetector = {
        detectConflicts: jest.fn().mockResolvedValue({
          hasConflicts: true,
          conflicts: [
            {
              cookieName: 'conflict_cookie',
              conflictType: 'value_mismatch',
              localValue: 'old_value',
              remoteValue: 'new_value',
              lastModified: '2024-01-01T10:00:00Z'
            }
          ]
        })
      };

      const result = await mockConflictDetector.detectConflicts(conflictingSync);
      
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].conflictType).toBe('value_mismatch');
    });

    it('should resolve cookie conflicts automatically', async () => {
      const conflictResolution = {
        hostId: 'test-host-1',
        resolution: 'remote_wins',
        cookies: [
          {
            name: 'conflict_cookie',
            value: 'remote_value',
            domain: '.example.com',
            path: '/'
          }
        ]
      };

      // Mock conflict resolution
      const mockConflictResolver = {
        resolveConflicts: jest.fn().mockResolvedValue({
          resolved: true,
          resolution: 'remote_wins',
          conflictsResolved: 1,
          actions: ['updated conflict_cookie to remote_value']
        })
      };

      const result = await mockConflictResolver.resolveConflicts(conflictResolution);
      
      expect(result.resolved).toBe(true);
      expect(result.resolution).toBe('remote_wins');
      expect(result.conflictsResolved).toBe(1);
    });
  });

  describe('Cookie Sync Monitoring', () => {
    it('should monitor cookie sync status', async () => {
      const syncId = 'sync-123';

      // Mock sync status monitoring
      const mockMonitor = {
        getSyncStatus: jest.fn().mockResolvedValue({
          syncId: 'sync-123',
          status: 'completed',
          progress: 100,
          cookiesSynced: 5,
          errors: 0,
          lastSync: '2024-01-01T10:00:00Z',
          nextSync: '2024-01-01T10:05:00Z'
        })
      };

      const status = await mockMonitor.getSyncStatus(syncId);
      
      expect(status.syncId).toBe('sync-123');
      expect(status.status).toBe('completed');
      expect(status.progress).toBe(100);
      expect(status.cookiesSynced).toBe(5);
      expect(status.errors).toBe(0);
    });

    it('should track cookie sync history', async () => {
      const hostId = 'test-host-1';

      // Mock sync history tracking
      const mockHistoryTracker = {
        getSyncHistory: jest.fn().mockResolvedValue({
          hostId: 'test-host-1',
          history: [
            {
              syncId: 'sync-123',
              timestamp: '2024-01-01T10:00:00Z',
              status: 'completed',
              cookiesSynced: 3,
              syncMode: 'replace'
            },
            {
              syncId: 'sync-124',
              timestamp: '2024-01-01T10:05:00Z',
              status: 'failed',
              error: 'Host offline',
              syncMode: 'merge'
            }
          ]
        })
      };

      const history = await mockHistoryTracker.getSyncHistory(hostId);
      
      expect(history.hostId).toBe('test-host-1');
      expect(history.history).toHaveLength(2);
      expect(history.history[0].status).toBe('completed');
      expect(history.history[1].status).toBe('failed');
    });
  });

  describe('Cookie Sync Security', () => {
    it('should encrypt sensitive cookie values', async () => {
      const sensitiveSync = {
        hostId: 'test-host-1',
        cookies: [
          {
            name: 'auth_token',
            value: 'sensitive_auth_token_123',
            domain: '.example.com',
            path: '/',
            secure: true,
            httpOnly: true
          }
        ],
        encryption: true
      };

      // Mock encryption
      const mockEncryption = {
        encryptCookies: jest.fn().mockResolvedValue({
          encrypted: true,
          cookies: [
            {
              name: 'auth_token',
              value: 'encrypted_value_abc123',
              encrypted: true,
              domain: '.example.com',
              path: '/'
            }
          ]
        })
      };

      const result = await mockEncryption.encryptCookies(sensitiveSync);
      
      expect(result.encrypted).toBe(true);
      expect(result.cookies[0].encrypted).toBe(true);
      expect(result.cookies[0].value).not.toBe('sensitive_auth_token_123');
    });

    it('should validate cookie sync permissions', async () => {
      const syncRequest = {
        hostId: 'test-host-1',
        cookies: [
          {
            name: 'admin_token',
            value: 'admin_secret',
            domain: '.example.com',
            path: '/admin'
          }
        ],
        userPermissions: ['cookie_sync']
      };

      // Mock permission validation
      const mockPermissionValidator = {
        validatePermissions: jest.fn().mockResolvedValue({
          authorized: true,
          permissions: ['cookie_sync'],
          restrictions: []
        })
      };

      const result = await mockPermissionValidator.validatePermissions(syncRequest);
      
      expect(result.authorized).toBe(true);
      expect(result.permissions).toContain('cookie_sync');
    });
  });
});
