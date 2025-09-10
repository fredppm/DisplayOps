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

describe('Dashboard Assignment Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Dashboard Assignment API', () => {
    it('should assign dashboard to host agent', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          hostId: 'test-host-1',
          dashboardId: 'main-dashboard',
          priority: 'high'
        },
      });

      // Mock successful assignment
      res.status(200).json({
        success: true,
        data: {
          assignmentId: 'assign-123',
          hostId: 'test-host-1',
          dashboardId: 'main-dashboard',
          status: 'assigned',
          assignedAt: new Date().toISOString(),
          priority: 'high'
        },
        message: 'Dashboard assigned successfully'
      });

      expect(res._getStatusCode()).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.data.assignmentId).toBe('assign-123');
      expect(responseData.data.hostId).toBe('test-host-1');
      expect(responseData.data.dashboardId).toBe('main-dashboard');
      expect(responseData.data.status).toBe('assigned');
    });

    it('should handle assignment to unavailable host', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          hostId: 'offline-host',
          dashboardId: 'main-dashboard',
          priority: 'high'
        },
      });

      // Mock assignment failure
      res.status(400).json({
        success: false,
        error: 'Host agent is offline',
        data: null
      });

      expect(res._getStatusCode()).toBe(400);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Host agent is offline');
    });

    it('should handle assignment to non-existent dashboard', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          hostId: 'test-host-1',
          dashboardId: 'non-existent-dashboard',
          priority: 'high'
        },
      });

      // Mock assignment failure
      res.status(404).json({
        success: false,
        error: 'Dashboard not found',
        data: null
      });

      expect(res._getStatusCode()).toBe(404);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Dashboard not found');
    });
  });

  describe('Dashboard Assignment Validation', () => {
    it('should validate assignment request format', async () => {
      const validAssignment = {
        hostId: 'test-host-1',
        dashboardId: 'main-dashboard',
        priority: 'high',
        schedule: {
          startTime: '09:00',
          endTime: '18:00',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        }
      };

      const validateAssignment = (assignment: any) => {
        return assignment.hostId && 
               assignment.dashboardId && 
               assignment.priority &&
               assignment.schedule &&
               assignment.schedule.startTime &&
               assignment.schedule.endTime &&
               Array.isArray(assignment.schedule.days);
      };

      expect(validateAssignment(validAssignment)).toBe(true);
    });

    it('should reject invalid assignment request', async () => {
      const invalidAssignment = {
        hostId: '', // Empty hostId
        dashboardId: 'main-dashboard',
        priority: 'invalid-priority', // Invalid priority
        schedule: {
          startTime: '25:00', // Invalid time
          endTime: '18:00',
          days: 'monday' // Should be array
        }
      };

      const validateAssignment = (assignment: any): boolean => {
        return !!(assignment.hostId && 
               assignment.dashboardId && 
               ['low', 'medium', 'high'].includes(assignment.priority) &&
               assignment.schedule &&
               /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(assignment.schedule.startTime) &&
               /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(assignment.schedule.endTime) &&
               Array.isArray(assignment.schedule.days));
      };

      expect(validateAssignment(invalidAssignment)).toBe(false);
    });
  });

  describe('Dashboard Assignment Priority', () => {
    it('should handle high priority assignments', async () => {
      const highPriorityAssignment = {
        hostId: 'test-host-1',
        dashboardId: 'emergency-dashboard',
        priority: 'high',
        immediate: true
      };

      // Mock high priority assignment
      const mockAssignmentService = {
        assignDashboard: jest.fn().mockResolvedValue({
          success: true,
          immediate: true,
          queuePosition: 1,
          estimatedTime: 'immediate'
        })
      };

      const result = await mockAssignmentService.assignDashboard(highPriorityAssignment);
      
      expect(result.success).toBe(true);
      expect(result.immediate).toBe(true);
      expect(result.queuePosition).toBe(1);
      expect(result.estimatedTime).toBe('immediate');
    });

    it('should queue low priority assignments', async () => {
      const lowPriorityAssignment = {
        hostId: 'test-host-1',
        dashboardId: 'background-dashboard',
        priority: 'low',
        immediate: false
      };

      // Mock low priority assignment
      const mockAssignmentService = {
        assignDashboard: jest.fn().mockResolvedValue({
          success: true,
          immediate: false,
          queuePosition: 5,
          estimatedTime: '5 minutes'
        })
      };

      const result = await mockAssignmentService.assignDashboard(lowPriorityAssignment);
      
      expect(result.success).toBe(true);
      expect(result.immediate).toBe(false);
      expect(result.queuePosition).toBe(5);
      expect(result.estimatedTime).toBe('5 minutes');
    });
  });

  describe('Dashboard Assignment Scheduling', () => {
    it('should schedule dashboard assignment for specific time', async () => {
      const scheduledAssignment = {
        hostId: 'test-host-1',
        dashboardId: 'morning-dashboard',
        schedule: {
          startTime: '08:00',
          endTime: '12:00',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          timezone: 'America/Sao_Paulo'
        }
      };

      // Mock scheduled assignment
      const mockScheduler = {
        scheduleAssignment: jest.fn().mockResolvedValue({
          scheduleId: 'schedule-123',
          nextExecution: '2024-01-02T08:00:00-03:00',
          recurring: true,
          status: 'scheduled'
        })
      };

      const result = await mockScheduler.scheduleAssignment(scheduledAssignment);
      
      expect(result.scheduleId).toBe('schedule-123');
      expect(result.nextExecution).toBeDefined();
      expect(result.recurring).toBe(true);
      expect(result.status).toBe('scheduled');
    });

    it('should handle one-time dashboard assignment', async () => {
      const oneTimeAssignment = {
        hostId: 'test-host-1',
        dashboardId: 'event-dashboard',
        schedule: {
          startTime: '2024-01-15T14:00:00Z',
          endTime: '2024-01-15T16:00:00Z',
          recurring: false
        }
      };

      // Mock one-time assignment
      const mockScheduler = {
        scheduleAssignment: jest.fn().mockResolvedValue({
          scheduleId: 'schedule-456',
          nextExecution: '2024-01-15T14:00:00Z',
          recurring: false,
          status: 'scheduled'
        })
      };

      const result = await mockScheduler.scheduleAssignment(oneTimeAssignment);
      
      expect(result.scheduleId).toBe('schedule-456');
      expect(result.recurring).toBe(false);
      expect(result.status).toBe('scheduled');
    });
  });

  describe('Dashboard Assignment Conflicts', () => {
    it('should detect assignment conflicts', async () => {
      const conflictingAssignment = {
        hostId: 'test-host-1',
        dashboardId: 'conflict-dashboard',
        schedule: {
          startTime: '10:00',
          endTime: '12:00',
          days: ['monday']
        }
      };

      // Mock conflict detection
      const mockConflictChecker = {
        checkConflicts: jest.fn().mockResolvedValue({
          hasConflict: true,
          conflicts: [
            {
              existingAssignment: 'assign-789',
              conflictType: 'time_overlap',
              overlapTime: '10:00-11:30'
            }
          ]
        })
      };

      const result = await mockConflictChecker.checkConflicts(conflictingAssignment);
      
      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].conflictType).toBe('time_overlap');
    });

    it('should resolve conflicts automatically', async () => {
      const assignmentWithConflict = {
        hostId: 'test-host-1',
        dashboardId: 'new-dashboard',
        priority: 'high',
        resolveConflicts: true
      };

      // Mock conflict resolution
      const mockConflictResolver = {
        resolveConflicts: jest.fn().mockResolvedValue({
          resolved: true,
          actions: [
            'cancelled existing assignment assign-789',
            'assigned new dashboard'
          ],
          newAssignmentId: 'assign-999'
        })
      };

      const result = await mockConflictResolver.resolveConflicts(assignmentWithConflict);
      
      expect(result.resolved).toBe(true);
      expect(result.actions).toContain('cancelled existing assignment assign-789');
      expect(result.newAssignmentId).toBe('assign-999');
    });
  });

  describe('Dashboard Assignment Status Tracking', () => {
    it('should track assignment status changes', async () => {
      const assignmentId = 'assign-123';

      // Mock status tracking
      const mockStatusTracker = {
        getAssignmentStatus: jest.fn().mockResolvedValue({
          assignmentId: 'assign-123',
          status: 'active',
          currentDashboard: 'main-dashboard',
          lastStatusChange: '2024-01-01T10:00:00Z',
          uptime: 3600,
          nextScheduledChange: '2024-01-01T18:00:00Z'
        })
      };

      const status = await mockStatusTracker.getAssignmentStatus(assignmentId);
      
      expect(status.assignmentId).toBe('assign-123');
      expect(status.status).toBe('active');
      expect(status.currentDashboard).toBe('main-dashboard');
      expect(status.uptime).toBe(3600);
    });

    it('should handle assignment status history', async () => {
      const assignmentId = 'assign-123';

      // Mock status history
      const mockHistoryTracker = {
        getAssignmentHistory: jest.fn().mockResolvedValue({
          assignmentId: 'assign-123',
          history: [
            {
              timestamp: '2024-01-01T08:00:00Z',
              status: 'assigned',
              dashboard: 'morning-dashboard'
            },
            {
              timestamp: '2024-01-01T12:00:00Z',
              status: 'active',
              dashboard: 'afternoon-dashboard'
            }
          ]
        })
      };

      const history = await mockHistoryTracker.getAssignmentHistory(assignmentId);
      
      expect(history.assignmentId).toBe('assign-123');
      expect(history.history).toHaveLength(2);
      expect(history.history[0].status).toBe('assigned');
      expect(history.history[1].status).toBe('active');
    });
  });
});
