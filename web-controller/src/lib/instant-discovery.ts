import axios from 'axios';
import { MiniPC, HostStatus } from '@/types/types';

/**
 * Instant discovery for development
 * Tries to find localhost host immediately
 */
export class InstantDiscovery {
  
  public static async findLocalhost(): Promise<MiniPC | null> {
    try {
      console.log('🚀 Instant discovery: Checking localhost...');
      
      // Quick check for localhost:8080
      const healthResponse = await axios.get('http://localhost:8080/health', {
        timeout: 1000 // Very fast
      });

      if (healthResponse.data?.success) {
        console.log('✅ Found localhost host instantly!');
        
        // Get detailed info
        const statusResponse = await axios.get('http://localhost:8080/api/status', {
          timeout: 1000
        });

        const hostStatus: HostStatus = {
          online: true,
          cpuUsage: statusResponse.data?.data?.hostStatus?.cpuUsage || 0,
          memoryUsage: statusResponse.data?.data?.hostStatus?.memoryUsage || 0,
          browserProcesses: statusResponse.data?.data?.hostStatus?.browserProcesses || 0
        };

        const host: MiniPC = {
          id: 'agent-127-0-0-1-8080', // Same ID pattern as WindowsDiscoveryService
          name: 'Office TV Host',
          hostname: '127.0.0.1',
          ipAddress: '127.0.0.1',
          port: 8080,
          status: hostStatus,
          lastHeartbeat: new Date(),
          lastDiscovered: new Date(),
          version: healthResponse.data?.data?.version || '1.0.0',
          tvs: ['display-1', 'display-2']
        };

        return host;
      }
    } catch (error) {
      console.log('⚡ Instant discovery: No localhost host found');
    }

    return null;
  }
}
