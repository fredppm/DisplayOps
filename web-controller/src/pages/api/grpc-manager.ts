import { GrpcHostManager, HostInfo } from '../../lib/grpc-host-manager';

// Global gRPC host manager instance
let globalGrpcManager: GrpcHostManager | null = null;

export function getGrpcHostManager(): GrpcHostManager {
  if (!globalGrpcManager) {
    globalGrpcManager = new GrpcHostManager();
    
    // Setup global event handlers
    globalGrpcManager.on('host_connected', (hostInfo: HostInfo) => {
      console.log(`gRPC: Host ${hostInfo.id} (${hostInfo.name}) connected`);
    });

    globalGrpcManager.on('host_disconnected', (hostInfo: HostInfo) => {
      console.log(`gRPC: Host ${hostInfo.id} (${hostInfo.name}) disconnected`);
    });

    globalGrpcManager.on('host_event', ({ hostId, event }: { hostId: string, event: any }) => {
      console.log(`gRPC: Event from ${hostId}:`, event.type);
    });

    globalGrpcManager.on('display_state_changed', ({ hostId, displayId, status }: { hostId: string, displayId: string, status: any }) => {
      console.log(`gRPC: Display ${displayId} on ${hostId} state changed`);
    });

    globalGrpcManager.on('host_status_changed', ({ hostId, status }: { hostId: string, status: any }) => {
      console.log(`gRPC: Host ${hostId} status changed - CPU: ${status.cpuUsage}%, Memory: ${status.memoryUsage}%`);
    });

    globalGrpcManager.on('command_executed', ({ hostId, command, response }: { hostId: string, command: any, response: any }) => {
      console.log(`gRPC: Command ${command.type} executed on ${hostId} - Success: ${response.success}`);
    });

    globalGrpcManager.on('command_failed', ({ hostId, command, error }: { hostId: string, command: any, error: any }) => {
      console.error(`gRPC: Command ${command.type} failed on ${hostId}:`, error.message);
    });
  }

  return globalGrpcManager;
}

export function destroyGrpcHostManager(): void {
  if (globalGrpcManager) {
    globalGrpcManager.destroy();
    globalGrpcManager = null;
  }
}

// Initialize on module load
if (typeof window === 'undefined') {
  // Only initialize on server side
  getGrpcHostManager();
}