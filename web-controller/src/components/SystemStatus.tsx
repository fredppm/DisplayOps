import React, { useState, useEffect } from 'react';
import { MiniPC, HealthCheckResponse } from '@/types/types';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Monitor, 
  Wifi, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Server
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SystemStatusProps {
  hosts: MiniPC[];
}

interface HostHealthData {
  [hostId: string]: HealthCheckResponse | null;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({ hosts }) => {
  const [healthData, setHealthData] = useState<HostHealthData>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchHealthData = async () => {
    setIsRefreshing(true);
    const healthResults: HostHealthData = {};

    for (const host of hosts) {
      if (!host.status.online) {
        healthResults[host.id] = null;
        continue;
      }

      try {
        const response = await fetch(`http://${host.ipAddress}:${host.port}/api/status`);
        
        if (response.ok) {
          const result = await response.json();
          healthResults[host.id] = result.data;
        } else {
          healthResults[host.id] = null;
        }
      } catch (error) {
        console.error(`Error fetching health data for ${host.id}:`, error);
        healthResults[host.id] = null;
      }
    }

    setHealthData(healthResults);
    setLastUpdate(new Date());
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (hosts.length > 0) {
      fetchHealthData();
      
      // Set up periodic refresh
      const interval = setInterval(fetchHealthData, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [hosts]);

  const getOverallSystemHealth = () => {
    const onlineHosts = hosts.filter(h => h.status.online).length;
    const totalHosts = hosts.length;
    const healthyHosts = Object.values(healthData).filter(h => h !== null).length;
    
    return {
      totalHosts,
      onlineHosts,
      healthyHosts,
      offlineHosts: totalHosts - onlineHosts,
      healthPercentage: totalHosts > 0 ? (healthyHosts / totalHosts) * 100 : 0
    };
  };

  const systemHealth = getOverallSystemHealth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Status</h2>
          <p className="text-gray-600 mt-1">
            Real-time monitoring of all host agents and TV displays
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            Last updated {formatDistanceToNow(lastUpdate)} ago
          </div>
          <button
            onClick={fetchHealthData}
            disabled={isRefreshing}
            className={`btn-secondary ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Activity className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card text-center">
          <div className="flex items-center justify-center mb-3">
            <Server className="w-8 h-8 text-primary-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{systemHealth.totalHosts}</div>
          <div className="text-sm text-gray-600">Total Hosts</div>
        </div>

        <div className="card text-center">
          <div className="flex items-center justify-center mb-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-green-600">{systemHealth.onlineHosts}</div>
          <div className="text-sm text-gray-600">Online</div>
        </div>

        <div className="card text-center">
          <div className="flex items-center justify-center mb-3">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-600">{systemHealth.offlineHosts}</div>
          <div className="text-sm text-gray-600">Offline</div>
        </div>

        <div className="card text-center">
          <div className="flex items-center justify-center mb-3">
            <Activity className="w-8 h-8 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {systemHealth.healthPercentage.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600">Health Score</div>
        </div>
      </div>

      {/* Detailed Host Status */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Host Details</h3>
        
        {hosts.length === 0 ? (
          <div className="card text-center py-8">
            <Server className="w-8 h-8 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No hosts available</p>
          </div>
        ) : (
          hosts.map((host) => {
            const health = healthData[host.id];
            
            return (
              <div key={host.id} className="card">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center">
                    <Monitor className="w-8 h-8 text-primary-600 mr-4" />
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">{host.name}</h4>
                      <p className="text-sm text-gray-600">{host.hostname} • {host.ipAddress}:{host.port}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className={host.status.online ? 'status-online' : 'status-offline'}>
                      {host.status.online ? 'Online' : 'Offline'}
                    </span>
                    <span className="text-sm text-gray-500">v{host.version}</span>
                  </div>
                </div>

                {/* System Metrics */}
                {health && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* CPU Usage */}
                    <div className="flex items-center">
                      <Cpu className="w-5 h-5 text-blue-500 mr-3" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">CPU Usage</span>
                          <span className="text-sm text-gray-600">
                            {health.hostStatus.cpuUsage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              health.hostStatus.cpuUsage > 80 ? 'bg-red-500' :
                              health.hostStatus.cpuUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(health.hostStatus.cpuUsage, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Memory Usage */}
                    <div className="flex items-center">
                      <HardDrive className="w-5 h-5 text-purple-500 mr-3" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">Memory Usage</span>
                          <span className="text-sm text-gray-600">
                            {health.hostStatus.memoryUsage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              health.hostStatus.memoryUsage > 80 ? 'bg-red-500' :
                              health.hostStatus.memoryUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(health.hostStatus.memoryUsage, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Browser Processes */}
                    <div className="flex items-center">
                      <Wifi className="w-5 h-5 text-green-500 mr-3" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-700">Browser Processes</div>
                        <div className="text-lg font-semibold text-gray-900">
                          {health.hostStatus.browserProcesses}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TV Status */}
                <div className="border-t border-gray-200 pt-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-3">TV Displays</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {host.tvs.map((tvId, index) => {
                      const tvStatus = health?.tvStatuses?.[index];
                      
                      return (
                        <div key={tvId} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">
                              {tvId.replace('display-', 'TV ')}
                            </span>
                            <span className={
                              tvStatus?.active 
                                ? 'status-online' 
                                : 'status-offline'
                            }>
                              {tvStatus?.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          
                          {tvStatus && (
                            <div className="space-y-1 text-sm text-gray-600">
                              {tvStatus.currentUrl && (
                                <div className="truncate">
                                  URL: {tvStatus.currentUrl}
                                </div>
                              )}
                              <div className="flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                Last refresh: {formatDistanceToNow(new Date(tvStatus.lastRefresh))} ago
                              </div>
                              {tvStatus.errorCount > 0 && (
                                <div className="text-red-600">
                                  {tvStatus.errorCount} error(s)
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* System Info */}
                {health && (
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Uptime</span>
                        <div className="font-medium">
                          {Math.floor(health.systemInfo.uptime / 3600)}h {Math.floor((health.systemInfo.uptime % 3600) / 60)}m
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Platform</span>
                        <div className="font-medium">{health.systemInfo.platform}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Node.js</span>
                        <div className="font-medium">{health.systemInfo.nodeVersion}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Agent</span>
                        <div className="font-medium">v{health.systemInfo.agentVersion}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Status */}
                {host.status.lastError && (
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <AlertTriangle className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-red-800">Last Error</div>
                          <div className="text-sm text-red-700 mt-1">{host.status.lastError}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
