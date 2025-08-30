// WebSocket Message Types for Office TV Management System
// Phase 1: Migration from SSE + HTTP to WebSocket

import { MiniPC, ApiCommand, ApiResponse } from './types';

// Base WebSocket Message Interface
export interface WebSocketMessage {
  id?: string; // Optional message ID for tracking
  type: string;
  data?: any;
  timestamp: Date;
}

// Client to Server Messages (UI → Backend)
export interface ClientToServerMessage extends WebSocketMessage {
  type: 
    | 'subscribe_host_events'
    | 'unsubscribe_host_events'
    | 'deploy_dashboard'
    | 'refresh_display'
    | 'set_cookies'
    | 'validate_url'
    | 'health_check'
    | 'ping';
}

// Server to Client Messages (Backend → UI)
export interface ServerToClientMessage extends WebSocketMessage {
  type: 
    | 'hosts_discovered'
    | 'hosts_update'
    | 'display_state_changed'
    | 'command_result'
    | 'command_error'
    | 'heartbeat'
    | 'connection_status'
    | 'pong';
}

// Specific Message Types

// === Client to Server ===

export interface SubscribeHostEventsMessage extends ClientToServerMessage {
  type: 'subscribe_host_events';
  data: {
    hostIds?: string[]; // If empty, subscribe to all hosts
  };
}

export interface DeployDashboardMessage extends ClientToServerMessage {
  type: 'deploy_dashboard';
  data: {
    hostId: string;
    displayId: string;
    dashboardId: string;
    dashboard: {
      url: string;
      refreshInterval?: number;
      fullscreen?: boolean;
    };
  };
}

export interface RefreshDisplayMessage extends ClientToServerMessage {
  type: 'refresh_display';
  data: {
    hostId: string;
    displayId: string;
  };
}

export interface SetCookiesMessage extends ClientToServerMessage {
  type: 'set_cookies';
  data: {
    hostId: string;
    cookies: Array<{
      name: string;
      value: string;
      domain: string;
      path: string;
      expires?: number;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'Strict' | 'Lax' | 'None';
    }>;
  };
}

export interface ValidateUrlMessage extends ClientToServerMessage {
  type: 'validate_url';
  data: {
    hostId: string;
    url: string;
    timeout?: number;
  };
}

export interface HealthCheckMessage extends ClientToServerMessage {
  type: 'health_check';
  data: {
    hostId: string;
  };
}

export interface PingMessage extends ClientToServerMessage {
  type: 'ping';
  data?: {
    clientId?: string;
  };
}

// === Server to Client ===

export interface HostsDiscoveredMessage extends ServerToClientMessage {
  type: 'hosts_discovered';
  data: {
    hosts: MiniPC[];
    changeType: 'initial_load' | 'discovery_refresh';
  };
}

export interface HostsUpdateMessage extends ServerToClientMessage {
  type: 'hosts_update';
  data: {
    hosts: MiniPC[];
    changeType: 'host_added' | 'host_updated' | 'host_removed' | 'update' | 'initial_load' | 'discovery_refresh';
    changedHost?: MiniPC;
  };
}

export interface DisplayStateChangedMessage extends ServerToClientMessage {
  type: 'display_state_changed';
  data: {
    hostId: string;
    displayId: string;
    state: {
      isActive: boolean;
      currentUrl?: string;
      assignedDashboard?: {
        dashboardId: string;
        url: string;
      };
      lastRefresh?: Date;
      isResponsive?: boolean;
      errorCount?: number;
      lastError?: string;
    };
  };
}

export interface CommandResultMessage extends ServerToClientMessage {
  type: 'command_result';
  data: {
    commandId?: string;
    originalMessage: ClientToServerMessage;
    success: boolean;
    result?: any;
    error?: string;
    hostId: string;
    executionTime?: number;
  };
}

export interface CommandErrorMessage extends ServerToClientMessage {
  type: 'command_error';
  data: {
    commandId?: string;
    originalMessage: ClientToServerMessage;
    error: string;
    hostId?: string;
    errorCode?: string;
  };
}

export interface HeartbeatMessage extends ServerToClientMessage {
  type: 'heartbeat';
  data: {
    serverTime: Date;
    connectedClients?: number;
    activeHosts?: number;
  };
}

export interface ConnectionStatusMessage extends ServerToClientMessage {
  type: 'connection_status';
  data: {
    status: 'connected' | 'disconnected' | 'reconnecting' | 'error';
    clientId?: string;
    message?: string;
  };
}

export interface PongMessage extends ServerToClientMessage {
  type: 'pong';
  data: {
    clientId?: string;
    serverTime: Date;
  };
}

// Message Type Guards
export function isClientToServerMessage(message: any): message is ClientToServerMessage {
  return message && typeof message.type === 'string' && 
    ['subscribe_host_events', 'unsubscribe_host_events', 'deploy_dashboard', 
     'refresh_display', 'set_cookies', 'validate_url', 'health_check', 'ping']
    .includes(message.type);
}

export function isServerToClientMessage(message: any): message is ServerToClientMessage {
  return message && typeof message.type === 'string' && 
    ['hosts_discovered', 'hosts_update', 'display_state_changed', 'command_result', 
     'command_error', 'heartbeat', 'connection_status', 'pong']
    .includes(message.type);
}

// WebSocket Event Types for React hooks
export type WebSocketEventHandler<T extends WebSocketMessage = WebSocketMessage> = (message: T) => void;

export interface WebSocketConnectionStatus {
  connected: boolean;
  connecting: boolean;
  reconnecting: boolean;
  error?: string;
  lastConnected?: Date;
  reconnectAttempts: number;
}

// Legacy Compatibility - these will be removed after migration
export interface LegacyHostDiscoveryUpdate {
  success: boolean;
  data: MiniPC[];
  timestamp: Date;
  changeType?: string;
  changedHost?: MiniPC;
}