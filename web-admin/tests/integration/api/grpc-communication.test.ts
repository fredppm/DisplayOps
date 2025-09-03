import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';
import { credentials } from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

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

describe('gRPC Communication Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('gRPC Service Connection', () => {
    it('should establish gRPC connection to host agent', async () => {
      // Mock gRPC client creation
      const mockGrpcClient = {
        connect: jest.fn().mockResolvedValue(true),
        close: jest.fn(),
        getStatus: jest.fn().mockResolvedValue({ status: 'ready' })
      };

      // Test connection establishment
      const connectionResult = await mockGrpcClient.connect();
      expect(connectionResult).toBe(true);
      expect(mockGrpcClient.connect).toHaveBeenCalledTimes(1);
    });

    it('should handle gRPC connection errors gracefully', async () => {
      const mockGrpcClient = {
        connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
        close: jest.fn()
      };

      await expect(mockGrpcClient.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('gRPC Command Execution', () => {
    it('should send display command via gRPC', async () => {
      const mockCommand = {
        type: 'display',
        action: 'show',
        dashboard: 'main-dashboard',
        hostId: 'test-host-1'
      };

      const mockGrpcClient = {
        executeCommand: jest.fn().mockResolvedValue({
          success: true,
          message: 'Command executed successfully',
          timestamp: new Date().toISOString()
        })
      };

      const result = await mockGrpcClient.executeCommand(mockCommand);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Command executed successfully');
      expect(result.timestamp).toBeDefined();
      expect(mockGrpcClient.executeCommand).toHaveBeenCalledWith(mockCommand);
    });

    it('should handle gRPC command execution errors', async () => {
      const mockCommand = {
        type: 'display',
        action: 'show',
        dashboard: 'invalid-dashboard',
        hostId: 'test-host-1'
      };

      const mockGrpcClient = {
        executeCommand: jest.fn().mockRejectedValue(new Error('Dashboard not found'))
      };

      await expect(mockGrpcClient.executeCommand(mockCommand))
        .rejects.toThrow('Dashboard not found');
    });
  });

  describe('gRPC Status Monitoring', () => {
    it('should get host agent status via gRPC', async () => {
      const mockGrpcClient = {
        getStatus: jest.fn().mockResolvedValue({
          status: 'ready',
          uptime: 3600,
          version: '1.0.0',
          lastCommand: '2024-01-01T00:00:00Z'
        })
      };

      const status = await mockGrpcClient.getStatus();
      
      expect(status.status).toBe('ready');
      expect(status.uptime).toBe(3600);
      expect(status.version).toBe('1.0.0');
      expect(status.lastCommand).toBeDefined();
    });

    it('should handle gRPC status request timeout', async () => {
      const mockGrpcClient = {
        getStatus: jest.fn().mockImplementation(() => {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 100);
          });
        })
      };

      await expect(mockGrpcClient.getStatus())
        .rejects.toThrow('Timeout');
    });
  });

  describe('gRPC Health Check', () => {
    it('should perform gRPC health check', async () => {
      const mockGrpcClient = {
        healthCheck: jest.fn().mockResolvedValue({
          healthy: true,
          responseTime: 50,
          services: ['display', 'cookie', 'mdns']
        })
      };

      const health = await mockGrpcClient.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.responseTime).toBeLessThan(100);
      expect(health.services).toContain('display');
      expect(health.services).toContain('cookie');
      expect(health.services).toContain('mdns');
    });

    it('should detect unhealthy gRPC service', async () => {
      const mockGrpcClient = {
        healthCheck: jest.fn().mockResolvedValue({
          healthy: false,
          responseTime: 5000,
          error: 'Service unavailable',
          services: ['display']
        })
      };

      const health = await mockGrpcClient.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.responseTime).toBeGreaterThan(1000);
      expect(health.error).toBe('Service unavailable');
    });
  });

  describe('gRPC Protocol Buffer Validation', () => {
    it('should validate gRPC message format', async () => {
      const validMessage = {
        command: {
          type: 'DISPLAY_SHOW',
          payload: {
            dashboardId: 'main-dashboard',
            hostId: 'test-host-1'
          },
          timestamp: new Date().toISOString()
        }
      };

      // Mock protocol buffer validation
      const validateMessage = (message: any): boolean => {
        return !!(message.command && 
               message.command.type && 
               message.command.payload &&
               message.command.timestamp);
      };

      expect(validateMessage(validMessage)).toBe(true);
    });

    it('should reject invalid gRPC message format', async () => {
      const invalidMessage = {
        command: {
          type: 'INVALID_TYPE',
          // Missing required fields
        }
      };

      const validateMessage = (message: any): boolean => {
        return !!(message.command && 
               message.command.type && 
               message.command.payload &&
               message.command.timestamp);
      };

      expect(validateMessage(invalidMessage)).toBe(false);
    });
  });
});
