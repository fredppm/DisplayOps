import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { EventEmitter } from 'events';

// Load protobuf definition
const PROTO_PATH = join(process.cwd(), '..', 'shared', 'proto', 'host-agent.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const officetv = protoDescriptor.officetv;

export interface GrpcClientConfig {
  host: string;
  port: number;
  timeout?: number; // in milliseconds
}

export interface CommandRequest {
  command_id: string;
  type: string;
  payload: any;
}

export interface CommandResponse {
  command_id: string;
  success: boolean;
  error?: string;
  execution_time_ms: number;
  result?: any;
}

export interface HostEvent {
  event_id: string;
  type: string;
  timestamp: any;
  payload: any;
}

export class GrpcHostClient extends EventEmitter {
  private client: any;
  private config: GrpcClientConfig;
  private isConnected: boolean = false;
  private eventStream: any = null;
  private commandStream: any = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // Start with 1 second

  constructor(config: GrpcClientConfig) {
    super();
    this.config = config;
    this.setupClient();
  }

  private setupClient(): void {
    const address = `${this.config.host}:${this.config.port}`;
    this.client = new officetv.HostAgent(
      address,
      grpc.credentials.createInsecure()
    );
  }

  // Single command execution
  public async executeCommand(request: CommandRequest): Promise<CommandResponse> {
    return new Promise((resolve, reject) => {
      const timeout = this.config.timeout || 10000;
      
      const grpcRequest = this.convertToGrpcRequest(request);
      
      this.client.ExecuteCommand(grpcRequest, { 
        deadline: Date.now() + timeout 
      }, (error: any, response: any) => {
        if (error) {
          reject(new Error(`gRPC command failed: ${error.message}`));
          return;
        }

        resolve(this.convertFromGrpcResponse(response));
      });
    });
  }

  // Health check
  public async healthCheck(): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = this.config.timeout || 5000;
      
      this.client.HealthCheck({}, { 
        deadline: Date.now() + timeout 
      }, (error: any, response: any) => {
        if (error) {
          reject(new Error(`gRPC health check failed: ${error.message}`));
          return;
        }

        resolve(response);
      });
    });
  }

  // Start listening to events from host
  public startEventStream(): void {
    if (this.eventStream) {
      console.log('Event stream already active');
      return;
    }

    try {
      this.eventStream = this.client.StreamEvents({});
      
      this.eventStream.on('data', (event: any) => {
        const hostEvent = this.convertFromGrpcEvent(event);
        this.emit('event', hostEvent);
      });

      this.eventStream.on('end', () => {
        console.log('gRPC event stream ended');
        this.eventStream = null;
        this.handleDisconnection();
      });

      this.eventStream.on('error', (error: any) => {
        console.error('gRPC event stream error:', error);
        this.eventStream = null;
        this.handleDisconnection();
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
      
    } catch (error) {
      console.error('Failed to start event stream:', error);
      this.handleDisconnection();
    }
  }

  // Start bidirectional command stream
  public startCommandStream(): void {
    if (this.commandStream) {
      console.log('Command stream already active');
      return;
    }

    try {
      this.commandStream = this.client.StreamCommands();
      
      this.commandStream.on('data', (response: any) => {
        const commandResponse = this.convertFromGrpcResponse(response);
        this.emit('command_response', commandResponse);
      });

      this.commandStream.on('end', () => {
        console.log('gRPC command stream ended');
        this.commandStream = null;
      });

      this.commandStream.on('error', (error: any) => {
        console.error('gRPC command stream error:', error);
        this.commandStream = null;
      });

    } catch (error) {
      console.error('Failed to start command stream:', error);
    }
  }

  // Send command via stream
  public sendStreamCommand(request: CommandRequest): void {
    if (!this.commandStream) {
      throw new Error('Command stream not active');
    }

    const grpcRequest = this.convertToGrpcRequest(request);
    this.commandStream.write(grpcRequest);
  }

  // Connection management
  public connect(): void {
    this.startEventStream();
    this.startCommandStream();
  }

  public disconnect(): void {
    this.isConnected = false;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventStream) {
      this.eventStream.cancel();
      this.eventStream = null;
    }

    if (this.commandStream) {
      this.commandStream.end();
      this.commandStream = null;
    }

    this.emit('disconnected');
  }

  // Handle disconnection and reconnection
  private handleDisconnection(): void {
    if (!this.isConnected) {
      return; // Already handling disconnection
    }

    this.isConnected = false;
    this.emit('disconnected');

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
      
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.setupClient(); // Create new client
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('max_reconnect_attempts');
    }
  }

  // Utility methods for converting between formats
  private convertToGrpcRequest(request: CommandRequest): any {
    const grpcRequest: any = {
      command_id: request.command_id,
      type: this.mapCommandType(request.type),
      timestamp: { seconds: Math.floor(Date.now() / 1000), nanos: 0 }
    };

    // Map payload to specific command fields
    switch (request.type) {
      case 'deploy_dashboard':
        grpcRequest.open_dashboard = {
          display_id: request.payload.displayId,
          dashboard_id: request.payload.dashboardId || 'default',
          url: request.payload.url,
          fullscreen: request.payload.fullscreen !== false,
          refresh_interval_ms: request.payload.refreshInterval || 0
        };
        break;
        
      case 'refresh_display':
        grpcRequest.refresh_display = {
          display_id: request.payload.displayId
        };
        break;
        
      case 'set_cookies':
        grpcRequest.set_cookies = {
          cookies: request.payload.cookies.map((cookie: any) => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            expires: cookie.expires ? Math.floor(cookie.expires.getTime() / 1000) : 0,
            http_only: cookie.httpOnly || false,
            secure: cookie.secure || false,
            same_site: cookie.sameSite || 'Lax'
          })),
          domain: request.payload.domain
        };
        break;
        
      case 'validate_url':
        grpcRequest.validate_url = {
          url: request.payload.url,
          timeout_ms: request.payload.timeoutMs || 5000
        };
        break;
        
      case 'identify_displays':
        grpcRequest.identify_displays = {
          duration_seconds: request.payload.duration || 5,
          pattern: request.payload.pattern || 'highlight',
          font_size: request.payload.fontSize || 48,
          background_color: request.payload.backgroundColor || '#000000'
        };
        break;
        
      case 'take_screenshot':
        grpcRequest.take_screenshot = {
          display_id: request.payload.displayId,
          format: request.payload.format || 'png',
          quality: request.payload.quality || 90
        };
        break;
        
      case 'update_agent':
        grpcRequest.update_agent = {
          version: request.payload.version || 'latest',
          update_url: request.payload.updateUrl || '',
          force_update: request.payload.forceUpdate || false,
          restart_after_update: request.payload.restartAfterUpdate || false
        };
        break;
        
      case 'restart_browser':
        grpcRequest.restart_browser = {
          display_ids: request.payload.displayIds || [],
          force_kill: request.payload.forceKill || false,
          delay_seconds: request.payload.delaySeconds || 0
        };
        break;
    }

    return grpcRequest;
  }

  private convertFromGrpcResponse(response: any): CommandResponse {
    const result: CommandResponse = {
      command_id: response.command_id,
      success: response.success,
      error: response.error,
      execution_time_ms: response.execution_time_ms
    };

    // Extract specific result based on the response type
    if (response.open_dashboard_result) {
      result.result = {
        displayId: response.open_dashboard_result.display_id,
        loadedUrl: response.open_dashboard_result.loaded_url,
        isResponsive: response.open_dashboard_result.is_responsive
      };
    } else if (response.refresh_display_result) {
      result.result = {
        displayId: response.refresh_display_result.display_id,
        currentUrl: response.refresh_display_result.current_url,
        refreshTime: new Date(response.refresh_display_result.refresh_time.seconds * 1000)
      };
    } else if (response.set_cookies_result) {
      result.result = {
        cookiesSet: response.set_cookies_result.cookies_set,
        failedCookies: response.set_cookies_result.failed_cookies
      };
    } else if (response.validate_url_result) {
      result.result = {
        isValid: response.validate_url_result.is_valid,
        responseTimeMs: response.validate_url_result.response_time_ms,
        statusCode: response.validate_url_result.status_code,
        error: response.validate_url_result.error
      };
    } else if (response.identify_displays_result) {
      result.result = {
        identifiedDisplays: response.identify_displays_result.identified_displays
      };
    } else if (response.screenshot_result) {
      result.result = {
        displayId: response.screenshot_result.display_id,
        imageData: response.screenshot_result.image_data,
        format: response.screenshot_result.format,
        width: response.screenshot_result.width,
        height: response.screenshot_result.height
      };
    } else if (response.health_check_result) {
      result.result = {
        hostMetrics: this.convertGrpcHostMetrics(response.health_check_result.host_status),
        displayStatuses: response.health_check_result.display_statuses?.map((ds: any) => 
          this.convertGrpcDisplayStatus(ds)
        ) || [],
        systemInfo: response.health_check_result.system_info
      };
    } else if (response.update_agent_result) {
      result.result = {
        currentVersion: response.update_agent_result.current_version,
        targetVersion: response.update_agent_result.target_version,
        updateAvailable: response.update_agent_result.update_available,
        updateStarted: response.update_agent_result.update_started,
        updateProgress: response.update_agent_result.update_progress,
        errorMessage: response.update_agent_result.error_message
      };
    } else if (response.restart_browser_result) {
      result.result = {
        restartedDisplays: response.restart_browser_result.restarted_displays,
        failedDisplays: response.restart_browser_result.failed_displays,
        processesKilled: response.restart_browser_result.processes_killed,
        processesStarted: response.restart_browser_result.processes_started
      };
    }

    return result;
  }

  private convertFromGrpcEvent(event: any): HostEvent {
    const hostEvent: HostEvent = {
      event_id: event.event_id,
      type: event.type,
      timestamp: new Date(event.timestamp.seconds * 1000),
      payload: {}
    };

    // Extract specific payload based on event type
    if (event.display_state_changed) {
      hostEvent.payload = {
        displayId: event.display_state_changed.display_id,
        status: this.convertGrpcDisplayStatus(event.display_state_changed.status)
      };
    } else if (event.host_status_changed) {
      hostEvent.payload = {
        status: this.convertGrpcHostMetrics(event.host_status_changed.status)
      };
    } else if (event.error_event) {
      hostEvent.payload = {
        component: event.error_event.component,
        errorMessage: event.error_event.error_message,
        errorCode: event.error_event.error_code,
        displayId: event.error_event.display_id
      };
    } else if (event.heartbeat) {
      hostEvent.payload = {
        hostMetrics: this.convertGrpcHostMetrics(event.heartbeat.host_status),
        displayStatuses: event.heartbeat.display_statuses?.map((ds: any) => 
          this.convertGrpcDisplayStatus(ds)
        ) || []
      };
    }

    return hostEvent;
  }

  private convertGrpcHostMetrics(grpcMetrics: any): any {
    return {
      online: grpcMetrics.online,
      cpuUsage: grpcMetrics.cpu_usage_percent, // Updated field name
      memoryUsage: grpcMetrics.memory_usage_percent, // Updated field name
      memoryUsedBytes: grpcMetrics.memory_used_bytes,
      memoryTotalBytes: grpcMetrics.memory_total_bytes,
      browserProcesses: grpcMetrics.browser_processes,
      lastError: grpcMetrics.last_error,
      lastUpdate: new Date(grpcMetrics.last_update.seconds * 1000),
      debugEnabled: grpcMetrics.debug_enabled || false,
      systemMetrics: grpcMetrics.system_metrics ? {
        loadAverage1m: grpcMetrics.system_metrics.load_average_1m,
        loadAverage5m: grpcMetrics.system_metrics.load_average_5m,
        loadAverage15m: grpcMetrics.system_metrics.load_average_15m,
        uptimeSeconds: grpcMetrics.system_metrics.uptime_seconds,
        cpuCores: grpcMetrics.system_metrics.cpu_cores,
        cpuModel: grpcMetrics.system_metrics.cpu_model,
        diskUsagePercent: grpcMetrics.system_metrics.disk_usage_percent,
        diskFreeBytes: grpcMetrics.system_metrics.disk_free_bytes,
        diskTotalBytes: grpcMetrics.system_metrics.disk_total_bytes,
        networkConnections: grpcMetrics.system_metrics.network_connections
      } : null
    };
  }

  private convertGrpcDisplayStatus(grpcStatus: any): any {
    return {
      id: grpcStatus.display_id,
      active: grpcStatus.active,
      currentUrl: grpcStatus.current_url,
      lastRefresh: new Date(grpcStatus.last_refresh.seconds * 1000),
      isResponsive: grpcStatus.is_responsive,
      errorCount: grpcStatus.error_count,
      lastError: grpcStatus.last_error,
      assignedDashboard: grpcStatus.assigned_dashboard ? {
        dashboardId: grpcStatus.assigned_dashboard.dashboard_id,
        url: grpcStatus.assigned_dashboard.url,
        refreshInterval: grpcStatus.assigned_dashboard.refresh_interval_ms
      } : undefined
    };
  }

  private mapCommandType(type: string): string {
    const typeMap: { [key: string]: string } = {
      'deploy_dashboard': 'OPEN_DASHBOARD',
      'refresh_display': 'REFRESH_DISPLAY',
      'set_cookies': 'SET_COOKIES',
      'validate_url': 'VALIDATE_URL',
      'health_check': 'HEALTH_CHECK',
      'identify_displays': 'IDENTIFY_DISPLAYS',
      'take_screenshot': 'TAKE_SCREENSHOT'
    };
    
    return typeMap[type] || 'HEALTH_CHECK';
  }

  // Status getters
  public get connected(): boolean {
    return this.isConnected;
  }

  public get reconnectAttemptsCount(): number {
    return this.reconnectAttempts;
  }
}