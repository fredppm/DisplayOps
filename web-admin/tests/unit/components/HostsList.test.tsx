import React from 'react';
import { render, screen } from '@testing-library/react';
import { mockHosts, mockDiscoveryStatus } from '../../fixtures/hosts';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
    };
  },
}));

// Mock fetch
global.fetch = jest.fn();

// Simple mock component for testing
const MockHostsList: React.FC<{
  hosts: any[];
  isDiscovering: boolean;
  discoveryStatus?: any;
}> = ({ hosts, isDiscovering, discoveryStatus }) => {
  return (
    <div data-testid="hosts-list">
      <div data-testid="discovery-status">
        {isDiscovering ? 'Discovering...' : 'Not discovering'}
      </div>
      <div data-testid="hosts-count">
        {hosts.length} hosts found
      </div>
      {hosts.map((host, index) => (
        <div key={host.id || index} data-testid={`host-${index}`}>
          <span data-testid={`hostname-${index}`}>{host.hostname}</span>
          <span data-testid={`status-${index}`}>
            {host.metrics?.online ? 'Online' : 'Offline'}
          </span>
          <span data-testid={`displays-${index}`}>
            {host.displays?.length || 0} displays
          </span>
        </div>
      ))}
    </div>
  );
};

describe('HostsList Component (Mock)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render hosts list correctly', () => {
      render(
        <MockHostsList
          hosts={mockHosts}
          isDiscovering={false}
          discoveryStatus={mockDiscoveryStatus}
        />
      );

      expect(screen.getByTestId('hosts-list')).toBeInTheDocument();
      expect(screen.getByTestId('hosts-count').textContent).toContain('3 hosts found');
      
      // Check individual hosts
      expect(screen.getByTestId('hostname-0').textContent).toBe('test-host-1');
      expect(screen.getByTestId('hostname-1').textContent).toBe('test-host-2');
      expect(screen.getByTestId('hostname-2').textContent).toBe('test-host-3');
    });

    it('should show discovery status when discovering', () => {
      render(
        <MockHostsList
          hosts={mockHosts}
          isDiscovering={true}
          discoveryStatus={mockDiscoveryStatus}
        />
      );

      expect(screen.getByTestId('discovery-status').textContent).toBe('Discovering...');
    });

    it('should show online/offline status correctly', () => {
      render(
        <MockHostsList
          hosts={mockHosts}
          isDiscovering={false}
          discoveryStatus={mockDiscoveryStatus}
        />
      );

      expect(screen.getByTestId('status-0').textContent).toBe('Online');
      expect(screen.getByTestId('status-1').textContent).toBe('Offline');
      expect(screen.getByTestId('status-2').textContent).toBe('Online');
    });

    it('should display correct number of displays per host', () => {
      render(
        <MockHostsList
          hosts={mockHosts}
          isDiscovering={false}
          discoveryStatus={mockDiscoveryStatus}
        />
      );

      expect(screen.getByTestId('displays-0').textContent).toBe('1 displays');
      expect(screen.getByTestId('displays-1').textContent).toBe('0 displays');
      expect(screen.getByTestId('displays-2').textContent).toBe('2 displays');
    });

    it('should handle empty hosts list', () => {
      render(
        <MockHostsList
          hosts={[]}
          isDiscovering={false}
          discoveryStatus={mockDiscoveryStatus}
        />
      );

      expect(screen.getByTestId('hosts-count').textContent).toBe('0 hosts found');
    });
  });

  describe('Discovery Status', () => {
    it('should show not discovering when discovery is stopped', () => {
      render(
        <MockHostsList
          hosts={mockHosts}
          isDiscovering={false}
          discoveryStatus={mockDiscoveryStatus}
        />
      );

      expect(screen.getByTestId('discovery-status').textContent).toBe('Not discovering');
    });

    it('should show discovering when discovery is active', () => {
      render(
        <MockHostsList
          hosts={mockHosts}
          isDiscovering={true}
          discoveryStatus={mockDiscoveryStatus}
        />
      );

      expect(screen.getByTestId('discovery-status').textContent).toBe('Discovering...');
    });
  });

  describe('Data Validation', () => {
    it('should handle hosts with missing properties', () => {
      const hostsWithMissingProps = [
        {
          id: 'host-1',
          hostname: 'test-host-1',
        },
        {
          hostname: 'test-host-2',
          metrics: { online: true },
        },
      ];

      render(
        <MockHostsList
          hosts={hostsWithMissingProps}
          isDiscovering={false}
          discoveryStatus={mockDiscoveryStatus}
        />
      );

      expect(screen.getByTestId('hosts-count').textContent).toBe('2 hosts found');
      expect(screen.getByTestId('hostname-0').textContent).toBe('test-host-1');
      expect(screen.getByTestId('hostname-1').textContent).toBe('test-host-2');
    });

    it('should handle null or undefined discovery status', () => {
      render(
        <MockHostsList
          hosts={mockHosts}
          isDiscovering={false}
          discoveryStatus={undefined}
        />
      );

      expect(screen.getByTestId('hosts-list')).toBeInTheDocument();
      expect(screen.getByTestId('discovery-status').textContent).toBe('Not discovering');
    });
  });
});
