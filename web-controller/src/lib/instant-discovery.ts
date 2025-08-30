import axios from 'axios';
import { MiniPC, HostStatus } from '@/types/shared-types';

/**
 * Instant discovery for development
 * Tries to find localhost host immediately
 */
export class InstantDiscovery {
  
  public static async findLocalhost(): Promise<MiniPC | null> {
    try {
      console.log('🚀 Instant discovery: Checking localhost...');
      
      // Quick status check
      const response = await axios.get('http://localhost:8080/api/status', {
        timeout: 2000
      });

      if (response.data && response.data.success) {
        console.log('✅ Found localhost host instantly!');
        
        const hostStatus: HostStatus = {
          online: true,
          cpuUsage: response.data.data?.hostStatus?.cpuUsage || 0,
          memoryUsage: response.data.data?.hostStatus?.memoryUsage || 0,
          browserProcesses: response.data.data?.hostStatus?.browserProcesses || 0
        };

        const host: MiniPC = {
          id: 'agent-127-0-0-1-8080',
          name: 'Office Display Host',
          hostname: '127.0.0.1',
          ipAddress: '127.0.0.1',
          port: 8080,
          status: hostStatus,
          lastHeartbeat: new Date(),
          lastDiscovered: new Date(),
          version: response.data.data?.version || '1.0.0',
          tvs: [], // Legacy property
          displays: ['display-1', 'display-2'] // Will be updated by discovery service dynamically
        };

        return host;
      }
    } catch (error) {
      console.log('⚡ Instant discovery: No localhost host found');
    }

    return null;
  }
}
