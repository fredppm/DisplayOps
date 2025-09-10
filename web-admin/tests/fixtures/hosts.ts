import { MiniPC } from '@/types/shared-types';

export const mockHosts: MiniPC[] = [
  {
    id: 'host-1',
    name: 'test-host-1',
    hostname: 'test-host-1',
    ipAddress: '192.168.1.100',
    port: 8082,
    metrics: {
      online: true,
      cpuUsage: 25.5,
      memoryUsage: 45.2,
      browserProcesses: 3,
    },
    lastHeartbeat: new Date('2024-01-01T00:00:00Z'),
    lastDiscovered: new Date('2024-01-01T00:00:00Z'),
    version: '1.0.0',
    displays: ['display-1'],
  },
  {
    id: 'host-2',
    name: 'test-host-2',
    hostname: 'test-host-2',
    ipAddress: '192.168.1.101',
    port: 8082,
    metrics: {
      online: false,
      cpuUsage: 0,
      memoryUsage: 0,
      browserProcesses: 0,
    },
    lastHeartbeat: new Date('2024-01-01T00:00:00Z'),
    lastDiscovered: new Date('2024-01-01T00:00:00Z'),
    version: '1.0.0',
    displays: [],
  },
  {
    id: 'host-3',
    name: 'test-host-3',
    hostname: 'test-host-3',
    ipAddress: '192.168.1.102',
    port: 8082,
    metrics: {
      online: true,
      cpuUsage: 15.8,
      memoryUsage: 32.1,
      browserProcesses: 2,
    },
    lastHeartbeat: new Date('2024-01-01T00:00:00Z'),
    lastDiscovered: new Date('2024-01-01T00:00:00Z'),
    version: '1.0.0',
    displays: ['display-2', 'display-3'],
  },
];

export const mockDiscoveryStatus = {
  isConnected: true,
  lastUpdate: new Date('2024-01-01T00:00:00Z'),
  connectionError: null,
  reconnectAttempts: 0,
};

export const mockDashboards = [
  {
    id: 'dashboard-1',
    name: 'Test Dashboard 1',
    url: 'https://dashboard1.example.com',
    description: 'Test dashboard for testing',
    requiresAuth: false,
  },
  {
    id: 'dashboard-2',
    name: 'Test Dashboard 2',
    url: 'https://dashboard2.example.com',
    description: 'Another test dashboard',
    requiresAuth: true,
  },
];
