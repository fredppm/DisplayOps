import { useEffect, useState } from 'react';

interface HostMetrics {
  agentId: string;
  timestamp: string;
  cpu: {
    usage: number;
    cores: number;
    model: string;
  };
  memory: {
    usagePercent: number;
    usedGB: number;
    totalGB: number;
    freeGB: number;
  };
  displays: {
    total: number;
    active: number;
    states: Array<{
      id: string;
      name: string;
      isActive: boolean;
      hasUrl: boolean;
    }>;
  };
  browser: {
    processes: number;
  };
}

interface HostMetricsStreamProps {
  agentId?: string; // If provided, only show this host's metrics
  className?: string;
}

export function HostMetricsStream({ agentId, className = '' }: HostMetricsStreamProps) {
  const [metrics, setMetrics] = useState<Record<string, HostMetrics>>({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to SSE stream
    const eventSource = new EventSource('/api/hosts/events');

    eventSource.onopen = () => {
      console.log('✅ Connected to metrics stream');
      setIsConnected(true);
    };

    eventSource.onerror = () => {
      console.log('❌ Disconnected from metrics stream');
      setIsConnected(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle different event types
        switch (data.type) {
          case 'host_metrics':
            if (data.host) {
              setMetrics(prev => ({
                ...prev,
                [data.host.agentId]: {
                  ...data.host.metrics,
                  agentId: data.host.agentId,
                  timestamp: data.host.timestamp
                }
              }));
            }
            break;

          case 'host_disconnected':
            if (data.host) {
              setMetrics(prev => {
                const newMetrics = { ...prev };
                delete newMetrics[data.host.agentId];
                return newMetrics;
              });
            }
            break;

          case 'connected':
            console.log('SSE connection established');
            break;
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Filter metrics if agentId is provided
  const displayMetrics = agentId 
    ? { [agentId]: metrics[agentId] } 
    : metrics;

  return (
    <div className={`host-metrics-stream ${className}`}>
      {/* Connection Status */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm text-gray-600">
          {isConnected ? 'Live Metrics' : 'Disconnected'}
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.values(displayMetrics).filter(Boolean).map((hostMetrics) => (
          <div 
            key={hostMetrics.agentId}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
          >
            {/* Host Header */}
            <div className="mb-3">
              <h3 className="font-semibold text-gray-900 truncate">
                {hostMetrics.agentId}
              </h3>
              <p className="text-xs text-gray-500">
                {new Date(hostMetrics.timestamp).toLocaleTimeString()}
              </p>
            </div>

            {/* CPU */}
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600">CPU</span>
                <span className="text-sm font-medium text-gray-900">
                  {hostMetrics.cpu.usage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    hostMetrics.cpu.usage > 80 ? 'bg-red-500' :
                    hostMetrics.cpu.usage > 60 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(hostMetrics.cpu.usage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {hostMetrics.cpu.cores} cores • {hostMetrics.cpu.model}
              </p>
            </div>

            {/* Memory */}
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600">Memory</span>
                <span className="text-sm font-medium text-gray-900">
                  {hostMetrics.memory.usagePercent.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    hostMetrics.memory.usagePercent > 80 ? 'bg-red-500' :
                    hostMetrics.memory.usagePercent > 60 ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(hostMetrics.memory.usagePercent, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {hostMetrics.memory.usedGB.toFixed(1)} GB / {hostMetrics.memory.totalGB.toFixed(1)} GB
              </p>
            </div>

            {/* Displays */}
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600">Displays</span>
                <span className="text-sm font-medium text-gray-900">
                  {hostMetrics.displays.active} / {hostMetrics.displays.total}
                </span>
              </div>
              <div className="flex gap-1">
                {hostMetrics.displays.states.map((display) => (
                  <div
                    key={display.id}
                    className={`w-3 h-3 rounded-full ${
                      display.isActive && display.hasUrl ? 'bg-green-500' :
                      display.isActive ? 'bg-yellow-500' :
                      'bg-gray-300'
                    }`}
                    title={`${display.name}: ${
                      display.isActive && display.hasUrl ? 'Active with content' :
                      display.isActive ? 'Active but empty' :
                      'Inactive'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Browser Processes */}
            <div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Browser Processes</span>
                <span className="text-sm font-medium text-gray-900">
                  {hostMetrics.browser.processes}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {Object.keys(displayMetrics).length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">
            {isConnected ? 'Waiting for host metrics...' : 'Not connected'}
          </p>
        </div>
      )}
    </div>
  );
}


