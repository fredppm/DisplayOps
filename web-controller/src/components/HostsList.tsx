import React, { useState } from 'react';
import { MiniPC } from '@/types/types';
import { Monitor, Wifi, WifiOff, Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface HostsListProps {
  hosts: MiniPC[];
  isDiscovering: boolean;
}

export const HostsList: React.FC<HostsListProps> = ({ hosts, isDiscovering }) => {
  const [selectedHost, setSelectedHost] = useState<string | null>(null);

  const getStatusColor = (host: MiniPC): string => {
    if (!host.status.online) return 'status-offline';
    if (host.status.lastError) return 'status-warning';
    return 'status-online';
  };

  const getStatusText = (host: MiniPC): string => {
    if (!host.status.online) return 'Offline';
    if (host.status.lastError) return 'Warning';
    return 'Online';
  };

  const formatLastSeen = (lastHeartbeat: Date | string | undefined): string => {
    if (!lastHeartbeat) return 'Never';
    
    try {
      const date = typeof lastHeartbeat === 'string' ? new Date(lastHeartbeat) : lastHeartbeat;
      if (isNaN(date.getTime())) return 'Never';
      return formatDistanceToNow(date);
    } catch {
      return 'Never';
    }
  };

  const handleRefreshHost = async (host: MiniPC) => {
    try {

      
      const response = await fetch(`http://${host.ipAddress}:${host.port}/health`);
      if (response.ok) {

      } else {

      }
    } catch (error) {

    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Host Agents</h2>
          <p className="text-gray-600 mt-1">
            Discovered mini PCs running the Office TV host agent
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {isDiscovering && (
            <div className="flex items-center text-yellow-600">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Discovering hosts...</span>
            </div>
          )}
          
          <div className="text-sm text-gray-500">
            {hosts.length} {hosts.length === 1 ? 'host' : 'hosts'} found
          </div>
        </div>
      </div>

      {/* Hosts Grid */}
      {hosts.length === 0 ? (
        <div className="card text-center py-12">
          <div className="flex flex-col items-center">
            <Wifi className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hosts discovered yet
            </h3>
            <p className="text-gray-500 mb-4">
              Make sure host agents are running and mDNS is enabled on your network
            </p>
            {isDiscovering && (
              <div className="flex items-center text-yellow-600">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                <span className="text-sm">Still searching...</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hosts.map((host) => (
            <div
              key={host.id}
              className={`card hover:shadow-md transition-shadow cursor-pointer ${
                selectedHost === host.id ? 'ring-2 ring-primary-500' : ''
              }`}
              onClick={() => setSelectedHost(selectedHost === host.id ? null : host.id)}
            >
              {/* Host Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <Monitor className="w-8 h-8 text-primary-600 mr-3" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {host.name}
                    </h3>
                    <p className="text-sm text-gray-500">{host.hostname}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className={getStatusColor(host)}>
                    {getStatusText(host)}
                  </span>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRefreshHost(host);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Refresh host status"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Connection Info */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  {host.status.online ? (
                    <Wifi className="w-4 h-4 mr-2 text-green-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 mr-2 text-red-500" />
                  )}
                  <span>{host.ipAddress}:{host.port}</span>
                </div>
                
                <div className="flex items-center text-sm text-gray-600">
                  <Activity className="w-4 h-4 mr-2" />
                  <span>Version {host.version}</span>
                </div>
              </div>

              {/* System Metrics */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">CPU</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {host.status.cpuUsage.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Memory</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {host.status.memoryUsage.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* TV Displays */}
              <div className="mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                  TV Displays ({host.tvs.length})
                </div>
                <div className="flex space-x-2">
                  {host.tvs.map((tvId) => (
                    <div
                      key={tvId}
                      className="flex-1 bg-gray-100 rounded px-2 py-1 text-xs text-center"
                    >
                      {tvId.replace('display-', 'TV ')}
                    </div>
                  ))}
                </div>
              </div>

              {/* Last Seen */}
              <div className="text-xs text-gray-500">
                Last seen {formatLastSeen(host.lastHeartbeat)} ago
              </div>

              {/* Error Display */}
              {host.status.lastError && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-start">
                    <AlertCircle className="w-4 h-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-700">
                      {host.status.lastError}
                    </div>
                  </div>
                </div>
              )}

              {/* Expanded Details */}
              {selectedHost === host.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">
                        mDNS Service
                      </div>
                      <div className="text-sm text-gray-900">
                        {host.mdnsService?.instanceName || 'N/A'}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">
                        Browser Processes
                      </div>
                      <div className="text-sm text-gray-900">
                        {host.status.browserProcesses} active
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">
                        Last Discovered
                      </div>
                      <div className="text-sm text-gray-900">
                        {formatLastSeen(host.lastDiscovered)} ago
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
