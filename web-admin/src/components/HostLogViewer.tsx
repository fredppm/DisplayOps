import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  category: string;
  message: string;
  details?: string;
}

interface HostLogViewerProps {
  agentId?: string; // If provided, only show this host's logs
  maxLogs?: number; // Maximum number of logs to keep in view
  autoScroll?: boolean; // Auto-scroll to bottom
  levelFilter?: string[]; // Filter by log levels (e.g., ['ERROR', 'WARN'])
  className?: string;
}

export function HostLogViewer({ 
  agentId, 
  maxLogs = 200, 
  autoScroll = true,
  levelFilter,
  className = '' 
}: HostLogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && !isPaused && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, isPaused]);

  useEffect(() => {
    // Connect to Socket.IO
    const newSocket = io({
      path: '/api/websocket',
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to log stream');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from log stream');
      setIsConnected(false);
    });

    // Listen for new logs
    newSocket.on('host:logs', (data: { agentId: string; logs: LogEntry[]; timestamp: string }) => {
      // Filter by agentId if specified
      if (agentId && data.agentId !== agentId) {
        return;
      }

      setLogs(prevLogs => {
        const newLogs = [...prevLogs, ...data.logs];
        // Keep only last N logs
        return newLogs.slice(-maxLogs);
      });
    });

    // Listen for host status changes
    newSocket.on('host:status', (data: { agentId: string; status: string }) => {
      if (data.status === 'offline' && (!agentId || data.agentId === agentId)) {
        // Optionally clear logs or add disconnection log
        setLogs(prev => [...prev, {
          id: `disconnect_${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'WARN',
          category: 'system',
          message: `Host ${data.agentId} disconnected`,
          details: undefined
        }]);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [agentId, maxLogs]);

  const clearLogs = () => {
    setLogs([]);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  // Filter logs by level
  const filteredLogs = levelFilter 
    ? logs.filter(log => levelFilter.includes(log.level))
    : logs;

  // Color mapping for log levels
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-red-600 bg-red-50';
      case 'WARN': return 'text-yellow-600 bg-yellow-50';
      case 'INFO': return 'text-blue-600 bg-blue-50';
      case 'DEBUG': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'bg-red-500 text-white';
      case 'WARN': return 'bg-yellow-500 text-white';
      case 'INFO': return 'bg-blue-500 text-white';
      case 'DEBUG': return 'bg-gray-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className={`host-log-viewer flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm font-medium text-gray-700">
            {isConnected ? 'Live Logs' : 'Disconnected'}
          </span>
          <span className="text-xs text-gray-500">
            ({filteredLogs.length} logs)
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={togglePause}
            className={`px-3 py-1 text-xs font-medium rounded ${
              isPaused 
                ? 'bg-green-500 text-white hover:bg-green-600' 
                : 'bg-yellow-500 text-white hover:bg-yellow-600'
            }`}
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            onClick={clearLogs}
            className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Logs Container */}
      <div className="flex-1 overflow-y-auto bg-gray-900 p-2 font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No logs yet. Waiting for activity...</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`flex gap-2 p-2 mb-1 rounded ${getLevelColor(log.level)}`}
            >
              {/* Timestamp */}
              <span className="text-gray-500 shrink-0">
                {(() => {
                  const date = new Date(log.timestamp);
                  const time = date.toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });
                  const ms = date.getMilliseconds().toString().padStart(3, '0');
                  return `${time}.${ms}`;
                })()}
              </span>

              {/* Level Badge */}
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${getLevelBadgeColor(log.level)}`}>
                {log.level}
              </span>

              {/* Category */}
              <span className="text-gray-600 shrink-0 min-w-[80px]">
                [{log.category}]
              </span>

              {/* Message */}
              <span className="flex-1 break-all">
                {log.message}
              </span>

              {/* Details (if any) */}
              {log.details && (
                <details className="text-gray-500 text-[10px] cursor-pointer">
                  <summary className="hover:text-gray-700">📋</summary>
                  <pre className="mt-1 p-2 bg-gray-800 text-gray-300 rounded overflow-x-auto">
                    {log.details}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Footer Stats */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
        <div className="flex gap-4">
          <span>📝 Total: {filteredLogs.length}</span>
          <span>🔴 Errors: {filteredLogs.filter(l => l.level === 'ERROR').length}</span>
          <span>⚠️ Warnings: {filteredLogs.filter(l => l.level === 'WARN').length}</span>
          <span>ℹ️ Info: {filteredLogs.filter(l => l.level === 'INFO').length}</span>
        </div>
        {isPaused && (
          <span className="text-yellow-600 font-medium">⏸ PAUSED</span>
        )}
      </div>
    </div>
  );
}

