import { useState, useEffect, useRef } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { useToastContext } from '@/contexts/ToastContext';
import { 
  ArrowLeft, Monitor, Cpu, CheckCircle, XCircle, AlertCircle, Terminal, RefreshCw,
  Eye, Camera, RotateCw, Trash2, Bug, BugOff, Play, Activity, MemoryStick, FileText, MoreVertical
} from 'lucide-react';

interface Host {
  id: string;
  agentId: string;
  hostname: string;
  ipAddress: string;
  grpcPort: number;
  displays: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
    isPrimary: boolean;
    assignedDashboard?: {
      dashboardId: string;
      url: string;
      refreshInterval?: number;
      lastNavigation?: string;
      isResponsive?: boolean;
    } | null;
    isActive?: boolean;
  }>;
  systemInfo: {
    platform: string;
    arch: string;
    nodeVersion: string;
    electronVersion: string;
    totalMemoryGB: number;
    cpuCores: number;
    cpuModel: string;
    systemUptimeSeconds?: number;
    processUptimeSeconds?: number;
    systemUptimeFormatted?: string;
    processUptimeFormatted?: string;
  };
  metrics?: {
    cpu?: {
      usage: number;
      count: number;
    };
    memory?: {
      total: number;
      used: number;
      free: number;
      usagePercent: number;
    };
    uptime?: number;
    timestamp?: string;
  };
  version: string;
  status: 'online' | 'offline';
  lastSeen: string;
  createdAt?: string;
  updatedAt?: string;
}


const HostDetailPage: NextPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const toast = useToastContext();
  
  const [host, setHost] = useState<Host | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingCommand, setSendingCommand] = useState(false);
  const [showOpenDashboardModal, setShowOpenDashboardModal] = useState(false);
  const [selectedDisplayId, setSelectedDisplayId] = useState<string | null>(null);
  const [selectedDashboard, setSelectedDashboard] = useState<string | null>(null);
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [screenshotData, setScreenshotData] = useState<{ url: string; displayId: string; } | null>(null);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    if (id) {
      fetchHost();
      fetchDashboards();
      setupSSE();
      
      // Polling every 30 seconds to ensure status is up-to-date
      // This catches hosts that die without sending a final heartbeat
      // Silent mode = no loading state, no error messages
      const pollInterval = setInterval(() => {
        fetchHost(true);
      }, 30000);

      // Cleanup on unmount
      return () => {
        clearInterval(pollInterval);
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      };
    }
  }, [id]);

  const eventSourceRef = useRef<EventSource | null>(null);

  const setupSSE = () => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Setup Server-Sent Events for real-time updates
    const eventSource = new EventSource('/api/hosts/events');
    
    eventSource.onmessage = (event) => {
      try {
        const eventData = JSON.parse(event.data);
        console.log('🔔 [SSE] Event received:', {
          type: eventData.type,
          hostId: eventData.host?.id,
          currentId: id,
          match: eventData.host?.id === id,
          displays: eventData.host?.displays?.length
        });
        
        // Only update if event is for this host
        if (eventData.host && eventData.host.id === id) {
          console.log('✅ [SSE] Event matches! Updating state');
          switch (eventData.type) {
            case 'host_updated':
              setHost(eventData.host);
              console.log('✅ [SSE] Host state updated with', eventData.host.displays?.length, 'displays');
              break;
            case 'host_disconnected':
              if (host) {
                setHost({ ...host, status: 'offline' });
              }
              break;
          }
        } else {
          console.log('⏭️ [SSE] Event for different host, ignoring');
        }
      } catch (err) {
        console.error('❌ [SSE] Error parsing:', err);
      }
    };

    eventSource.onerror = () => {
      console.warn('SSE connection error for host detail, will reconnect automatically');
    };

    eventSourceRef.current = eventSource;
  };

  const fetchHost = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await fetch('/api/hosts');
      const data = await response.json();
      
      if (data.success) {
        const foundHost = data.data.find((h: Host) => h.id === id);
        if (foundHost) {
          setHost(foundHost);
        } else {
          if (!silent) {
            setError('Host not found');
          }
        }
      } else {
        if (!silent) {
          setError(data.error || 'Failed to fetch host');
        }
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      if (!silent) {
        setError('Network error: ' + err.message);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };


  const fetchDashboards = async () => {
    try {
      const response = await fetch('/api/dashboards');
      const data = await response.json();
      
      if (data.success) {
        setDashboards(data.data || []);
      } else {
        console.error('Failed to fetch dashboards:', data.error);
      }
    } catch (err: any) {
      console.error('Dashboards fetch error:', err);
    }
  };

  const fetchLogs = async () => {
    if (!host) return;
    
    try {
      setLogsLoading(true);
      const response = await fetch(`/api/hosts/${host.id}/logs?limit=100&level=ALL`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setLogs(data.data.logs || []);
        setShowLogs(true);
        toast.success('Logs loaded successfully');
      } else {
        toast.error('Failed to load logs');
      }
    } catch (err: any) {
      console.error('Logs fetch error:', err);
      toast.error('Network error loading logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const sendCommand = async (commandType: string, payload?: any) => {
    if (!host) return;
    
    try {
      setSendingCommand(true);
      console.log(`[Command] Sending ${commandType} to host ${host.id}`, payload);
      
      const response = await fetch(`/api/hosts/${host.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: commandType,
          payload,
          targetDisplay: payload?.targetDisplay
        })
      });
      
      const data = await response.json();
      console.log(`[Command] Response for ${commandType}:`, data);
      
      if (data.success) {
        // Custom success messages for each command type
        switch (commandType) {
          case 'HEALTH_CHECK':
            const healthData = data.result;
            const statusMsg = healthData.online ? 'Host online and healthy' : 'Host has issues';
            const cpuMsg = `CPU: ${healthData.cpu_usage_percent?.toFixed(1) || 'N/A'}%`;
            const memMsg = `Memory: ${healthData.memory_usage_percent?.toFixed(1) || 'N/A'}%`;
            toast.success('Health Check Complete', `${statusMsg} - ${cpuMsg}, ${memMsg}`);
            console.log('[Health Check] Full result:', healthData);
            break;
          case 'IDENTIFY_DISPLAYS':
            toast.success('Displays Identified', 'Display numbers are being shown on the host for 5 seconds');
            break;
          case 'OPEN_DASHBOARD':
            toast.success('Dashboard Opened', 'Dashboard has been opened on the selected display');
            break;
          case 'REFRESH_DASHBOARD':
            toast.success('Dashboard Refreshed', 'Dashboard has been successfully reloaded');
            break;
          case 'RESTART_DASHBOARD':
            toast.success('Dashboard Restarted', 'Dashboard has been successfully restarted');
            break;
          case 'REMOVE_DASHBOARD':
            toast.success('Dashboard Removed', 'Dashboard has been closed and removed from the display');
            break;
          case 'TAKE_SCREENSHOT':
            console.log('[Screenshot] Full response:', data);
            const screenshotResult = data.result.screenshot_result;
            console.log('[Screenshot] Screenshot result:', screenshotResult);
            
            if (screenshotResult && screenshotResult.image_data) {
              console.log('[Screenshot] Image data type:', typeof screenshotResult.image_data);
              console.log('[Screenshot] Image data length:', screenshotResult.image_data.length);
              
              // Image data is already base64 encoded from the backend
              const imageUrl = `data:image/${screenshotResult.format || 'png'};base64,${screenshotResult.image_data}`;
              
              setScreenshotData({
                url: imageUrl,
                displayId: screenshotResult.display_id
              });
              setShowScreenshotModal(true);
              toast.success('Screenshot Captured', 'Screenshot has been taken successfully');
            } else {
              console.error('[Screenshot] No image data - result:', screenshotResult);
              toast.warning('Screenshot Captured', 'Screenshot taken but no image data available');
            }
            break;
          case 'DEBUG_ENABLE':
            setDebugEnabled(true);
            toast.success('Debug Enabled', 'Debug mode has been successfully enabled');
            break;
          case 'DEBUG_DISABLE':
            setDebugEnabled(false);
            toast.success('Debug Disabled', 'Debug mode has been successfully disabled');
            break;
          case 'SET_COOKIES':
          case 'SYNC_COOKIES':
            toast.success('Cookies Synced', 'Cookies have been successfully synced to the host');
            break;
          case 'VALIDATE_URL':
            toast.success('URL Validated', 'URL has been successfully validated');
            break;
          default:
            // Fallback for unmapped commands - try to humanize the name
            const humanCommand = commandType
              .split('_')
              .map(word => word.charAt(0) + word.slice(1).toLowerCase())
              .join(' ');
            toast.success('Command Executed', `${humanCommand} was executed successfully`);
        }
      } else {
        toast.error('Command Execution Error', data.error || 'Failed to execute command');
      }
    } catch (err: any) {
      console.error('Command error:', err);
      toast.error('Network Error', 'Could not connect to host: ' + err.message);
    } finally {
      setSendingCommand(false);
    }
  };

  const toggleDebug = async () => {
    const commandType = debugEnabled ? 'DEBUG_DISABLE' : 'DEBUG_ENABLE';
    await sendCommand(commandType);
  };

  const handleOpenDashboard = (displayId: string) => {
    setSelectedDisplayId(displayId);
    setShowOpenDashboardModal(true);
  };

  const handleConfirmOpenDashboard = async () => {
    if (!selectedDisplayId || !selectedDashboard) return;
    
    const dashboard = dashboards.find(d => d.id === selectedDashboard);
    if (!dashboard) return;
    
    await sendCommand('OPEN_DASHBOARD', {
      targetDisplay: selectedDisplayId,
      dashboardId: dashboard.id,
      url: dashboard.url,
      fullscreen: true,
      refreshInterval: 300000 // 5 minutes default
    });
    
    // Reset and close modal
    setShowOpenDashboardModal(false);
    setSelectedDashboard(null);
    setSelectedDisplayId(null);
  };

  const getTimeSinceLastSeen = (lastSeen: string): string => {
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMinutes = Math.floor(diffMs / 1000 / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const isHostStale = (lastSeen: string): boolean => {
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMinutes = diffMs / 1000 / 60;
    return diffMinutes >= 2; // Stale if not seen in last 2 minutes
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !host) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-4">
          <Link href="/hosts" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-500">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Hosts
          </Link>
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-2 text-sm text-red-700">{error || 'Host not found'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Link href="/hosts" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-500 mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Hosts
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {host.hostname}
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Agent ID: {host.agentId}
              </p>
            </div>
            <button
              onClick={() => fetchHost()}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Real-time Metrics */}
        {host.metrics && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* CPU Usage */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 border-l-4 border-blue-500 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    CPU Usage
                    {isHostStale(host.lastSeen) && (
                      <span className="ml-1 text-xs text-orange-600 dark:text-orange-400">(last known)</span>
                    )}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                    {host.metrics?.cpu?.usage?.toFixed(1) || 0}%
                  </p>
                </div>
                <div className={`p-3 rounded-full ${
                  (host.metrics?.cpu?.usage || 0) > 80 ? 'bg-red-100 dark:bg-red-900/20' :
                  (host.metrics?.cpu?.usage || 0) > 60 ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                  'bg-blue-100 dark:bg-blue-900/20'
                }`}>
                  <Activity className={`h-6 w-6 ${
                    (host.metrics?.cpu?.usage || 0) > 80 ? 'text-red-600 dark:text-red-400' :
                    (host.metrics?.cpu?.usage || 0) > 60 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-blue-600 dark:text-blue-400'
                  }`} />
                </div>
              </div>
              {/* Progress bar aligned to bottom */}
              <div className="mt-auto w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="h-2 rounded-full bg-blue-600 dark:bg-blue-500"
                  style={{ width: `${Math.min(host.metrics?.cpu?.usage || 0, 100)}%` }}
                />
              </div>
            </div>

            {/* Memory Usage */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 border-l-4 border-purple-500 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Memory Usage
                    {isHostStale(host.lastSeen) && (
                      <span className="ml-1 text-xs text-orange-600 dark:text-orange-400">(last known)</span>
                    )}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                    {host.metrics?.memory?.usagePercent?.toFixed(1) || 0}%
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {((host.metrics?.memory?.used || 0) / 1024 / 1024 / 1024).toFixed(1)}GB / {((host.metrics?.memory?.total || 0) / 1024 / 1024 / 1024).toFixed(1)}GB
                  </p>
                </div>
                <div className={`p-3 rounded-full ${
                  (host.metrics?.memory?.usagePercent || 0) > 80 ? 'bg-red-100 dark:bg-red-900/20' :
                  (host.metrics?.memory?.usagePercent || 0) > 60 ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                  'bg-purple-100 dark:bg-purple-900/20'
                }`}>
                  <MemoryStick className={`h-6 w-6 ${
                    (host.metrics?.memory?.usagePercent || 0) > 80 ? 'text-red-600 dark:text-red-400' :
                    (host.metrics?.memory?.usagePercent || 0) > 60 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-purple-600 dark:text-purple-400'
                  }`} />
                </div>
              </div>
              {/* Progress bar aligned to bottom */}
              <div className="mt-auto w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="h-2 rounded-full bg-purple-600 dark:bg-purple-500"
                  style={{ width: `${Math.min(host.metrics?.memory?.usagePercent || 0, 100)}%` }}
                />
              </div>
            </div>

            {/* Status Card */}
            <div className={`bg-white dark:bg-gray-800 shadow rounded-lg p-4 border-l-4 flex flex-col ${
              host.status === 'online' 
                ? 'border-green-500' 
                : 'border-red-500 animate-pulse'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
                  <p className={`mt-1 text-2xl font-semibold ${
                    host.status === 'online'
                      ? 'text-gray-900 dark:text-white'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {host.status === 'online' ? 'Online' : 'Offline'}
                  </p>
                  
                  {/* Show uptime when online, last seen when offline */}
                  {host.status === 'online' ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Uptime: {host.systemInfo.processUptimeFormatted || 'Unknown'}
                    </p>
                  ) : (
                    <div className="mt-1">
                      <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                        {getTimeSinceLastSeen(host.lastSeen)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(host.lastSeen).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
                <div className={`p-3 rounded-full ${
                  host.status === 'online' 
                    ? 'bg-green-100 dark:bg-green-900/20' 
                    : 'bg-red-100 dark:bg-red-900/20'
                }`}>
                  {host.status === 'online' ? (
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Displays Card */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 border-l-4 border-cyan-500 flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Displays</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                    {host.displays?.length || 0}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-cyan-100 dark:bg-cyan-900/20">
                  <Monitor className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Network Info */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Network Information</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">IP Address</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{host.ipAddress}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">gRPC Port</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{host.grpcPort}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Version</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{host.version}</dd>
              </div>
            </dl>
          </div>

          {/* System Info */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
              <Cpu className="h-5 w-5 mr-2" />
              System Information
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Platform</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {host.systemInfo.platform} ({host.systemInfo.arch})
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">CPU</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {host.systemInfo.cpuModel} ({host.systemInfo.cpuCores} cores)
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Memory</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{host.systemInfo.totalMemoryGB}GB RAM</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Runtime</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  Node {host.systemInfo.nodeVersion} • Electron {host.systemInfo.electronVersion}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Global Host Commands - Only show when online */}
        {host.status === 'online' && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
              <Terminal className="h-5 w-5 mr-2" />
              Global Host Commands
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={() => sendCommand('IDENTIFY_DISPLAYS', {
                  duration: 5,
                  fontSize: 200,
                  backgroundColor: 'rgba(0, 180, 255, 0.95)'
                })}
                disabled={sendingCommand}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Eye className="h-4 w-4 mr-2" />
                Identify Displays
              </button>
              <button
                onClick={toggleDebug}
                disabled={sendingCommand}
                className={`inline-flex items-center justify-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  debugEnabled
                    ? 'border-green-300 dark:border-green-600 text-green-700 dark:text-green-200 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {debugEnabled ? (
                  <>
                    <BugOff className="h-4 w-4 mr-2" />
                    Disable Debug
                  </>
                ) : (
                  <>
                    <Bug className="h-4 w-4 mr-2" />
                    Enable Debug
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Displays with Per-Display Controls */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <Monitor className="h-5 w-5 mr-2" />
            Displays & Dashboard Controls ({host.displays?.length || 0})
          </h3>
          {host.displays && host.displays.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {host.displays.map((display) => (
                <div
                  key={display.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-base font-medium text-gray-900 dark:text-white flex items-center">
                      {display.name}
                    {display.isPrimary && (
                          <span className="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        Primary
                      </span>
                    )}
                      </h4>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 font-mono">
                        {display.width} × {display.height} • ID: {display.id}
                      </p>
                      {/* Show active dashboard if any */}
                      {display.assignedDashboard && (
                        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                          <p className="text-xs font-medium text-green-800 dark:text-green-200 flex items-center">
                            <Play className="h-3 w-3 mr-1" />
                            Active Dashboard
                          </p>
                          <p className="text-xs text-green-700 dark:text-green-300 mt-1 break-all">
                            {display.assignedDashboard.url}
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Refresh: {Math.round((display.assignedDashboard.refreshInterval || 0) / 1000 / 60)} min
                            {display.assignedDashboard.isResponsive !== undefined && (
                              <span className={`ml-2 ${display.assignedDashboard.isResponsive ? 'text-green-600' : 'text-red-600'}`}>
                                • {display.assignedDashboard.isResponsive ? 'Responsive' : 'Unresponsive'}
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Dashboard Controls for this display - Only show when online */}
                  {host.status === 'online' && (
                  <div className="flex items-center gap-2">
                    {/* Primary Action: Open/Change Dashboard */}
                    <button
                      onClick={() => handleOpenDashboard(display.id)}
                      disabled={sendingCommand}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-blue-300 dark:border-blue-600 rounded-md text-sm font-medium text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {display.assignedDashboard ? 'Change Dashboard' : 'Open Dashboard'}
                    </button>

                    {/* Screenshot - Only if has dashboard */}
                    {display.assignedDashboard && (
                      <button
                        onClick={() => sendCommand('TAKE_SCREENSHOT', { 
                          targetDisplay: display.id,
                          format: 'png'
                        })}
                        disabled={sendingCommand}
                        className="inline-flex items-center justify-center px-4 py-2 border border-purple-300 dark:border-purple-600 rounded-md text-sm font-medium text-purple-700 dark:text-purple-200 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Take Screenshot"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                    )}

                    {/* More Actions Dropdown - Only if has dashboard */}
                    {display.assignedDashboard && (
                      <div className="relative">
                        <button
                          onClick={() => setOpenDropdownId(openDropdownId === display.id ? null : display.id)}
                          disabled={sendingCommand}
                          className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="More actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {openDropdownId === display.id && (
                          <>
                            {/* Backdrop to close dropdown */}
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setOpenDropdownId(null)}
                            ></div>
                            
                            {/* Dropdown content */}
                            <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-20">
                              <div className="py-1" role="menu">
                                <button
                                  onClick={() => {
                                    sendCommand('REFRESH_DASHBOARD', { targetDisplay: display.id });
                                    setOpenDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                                  role="menuitem"
                                >
                                  <RefreshCw className="h-4 w-4 mr-3" />
                                  Refresh Dashboard
                                </button>
                                <button
                                  onClick={() => {
                                    sendCommand('RESTART_DASHBOARD', { targetDisplay: display.id });
                                    setOpenDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-yellow-700 dark:text-yellow-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                                  role="menuitem"
                                >
                                  <RotateCw className="h-4 w-4 mr-3" />
                                  Restart Dashboard
                                </button>
                                <button
                                  onClick={() => {
                                    sendCommand('REMOVE_DASHBOARD', { targetDisplay: display.id });
                                    setOpenDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-700 dark:text-red-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                                  role="menuitem"
                                >
                                  <Trash2 className="h-4 w-4 mr-3" />
                                  Remove Dashboard
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Monitor className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No displays configured</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                This host has no displays attached or configured.
              </p>
            </div>
          )}
        </div>

        {/* Logs - Only show when online */}
        {host.status === 'online' && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Host Logs
              </h3>
              {!showLogs && (
                <button
                  onClick={fetchLogs}
                  disabled={logsLoading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {logsLoading ? (
                    <>
                      <div className="animate-spin h-4 w-4 mr-2 border-2 border-gray-700 dark:border-gray-200 border-t-transparent rounded-full" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Load Logs
                    </>
                  )}
                </button>
              )}
              {showLogs && (
                <button
                  onClick={fetchLogs}
                  disabled={logsLoading}
                  className="inline-flex items-center px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${logsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              )}
            </div>
            
            {logsLoading ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center space-x-3">
                  <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full" />
                  <div className="text-left">
                    <p className="text-base font-medium text-gray-900 dark:text-white">Loading logs...</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Fetching from host agent</p>
                  </div>
                </div>
              </div>
            ) : !showLogs ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" />
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  Click "Load Logs" to view recent logs from this host
                </p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No logs available
                </p>
              </div>
            ) : (
              <div className="bg-gray-900 dark:bg-black rounded-lg p-4 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
                {logs.map((log, index) => {
                  const timestamp = new Date(log.timestamp.seconds * 1000);
                  const timeStr = timestamp.toLocaleTimeString('en-US', { hour12: false });
                  
                  // Color coding based on log level
                  let levelColor = 'text-gray-300'; // DEFAULT/INFO
                  let bgColor = '';
                  
                  if (log.level === 'ERROR') {
                    levelColor = 'text-red-400';
                    bgColor = 'bg-red-950/20';
                  } else if (log.level === 'WARN') {
                    levelColor = 'text-yellow-400';
                    bgColor = 'bg-yellow-950/20';
                  } else if (log.level === 'DEBUG') {
                    levelColor = 'text-blue-400';
                  }
                  
                  return (
                    <div 
                      key={log.id || index} 
                      className={`py-1 px-2 ${bgColor} hover:bg-gray-800/50 transition-colors rounded`}
                    >
                      <span className="text-gray-500 dark:text-gray-600">{timeStr}</span>
                      <span className={`ml-2 font-semibold ${levelColor}`}>[{log.level}]</span>
                      <span className="ml-2 text-purple-400 dark:text-purple-300">[{log.category}]</span>
                      <span className="ml-2 text-gray-200 dark:text-gray-300">{log.message}</span>
                      {log.details && log.details !== '[]' && (
                        <div className="ml-12 mt-1 text-gray-400 dark:text-gray-500 text-xs opacity-75">
                          {log.details}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Open Dashboard Modal */}
      {showOpenDashboardModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              aria-hidden="true"
              onClick={() => setShowOpenDashboardModal(false)}
            ></div>

            {/* Center modal */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                    Open Dashboard
          </h3>
            <button
                    onClick={() => setShowOpenDashboardModal(false)}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
                    <XCircle className="h-6 w-6" />
            </button>
                </div>

                <div className="space-y-4">
                  {/* Dashboard Selector */}
                  <div>
                    <label htmlFor="dashboard-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Select Dashboard *
                    </label>
                    <select
                      id="dashboard-select"
                      value={selectedDashboard || ''}
                      onChange={(e) => setSelectedDashboard(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      required
                    >
                      <option value="">-- Select a dashboard --</option>
                      {dashboards.map((dashboard) => (
                        <option key={dashboard.id} value={dashboard.id}>
                          {dashboard.name}
                        </option>
                      ))}
                    </select>
                    {selectedDashboard && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 break-all">
                        <strong>URL:</strong> {dashboards.find(d => d.id === selectedDashboard)?.url}
                      </p>
                    )}
                    {dashboards.length === 0 && (
                      <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400">
                        No dashboards available. Create one first in the <Link href="/dashboards" className="underline">Dashboards page</Link>.
                      </p>
                    )}
                  </div>

                  {/* Display Info */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Display:</strong> {host?.displays.find(d => d.id === selectedDisplayId)?.name || 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
                  type="button"
                  onClick={() => setShowOpenDashboardModal(false)}
                  className="inline-flex justify-center w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
            </button>
            <button
                  type="button"
                  onClick={handleConfirmOpenDashboard}
                  disabled={!selectedDashboard || sendingCommand}
                  className="inline-flex justify-center w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingCommand ? 'Opening...' : 'Open Dashboard'}
            </button>
          </div>
            </div>
        </div>
      </div>
      )}

      {/* Screenshot Modal */}
      {showScreenshotModal && screenshotData && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="screenshot-modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              aria-hidden="true"
              onClick={() => setShowScreenshotModal(false)}
            ></div>

            {/* Center modal */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="screenshot-modal-title">
                    Screenshot - Display {screenshotData.displayId}
                  </h3>
                  <button
                    onClick={() => setShowScreenshotModal(false)}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XCircle className="h-6 w-6" />
                  </button>
                </div>

                {/* Screenshot Image */}
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 overflow-auto max-h-[70vh]">
                  <img 
                    src={screenshotData.url} 
                    alt={`Screenshot of display ${screenshotData.displayId}`}
                    className="max-w-full h-auto mx-auto"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowScreenshotModal(false)}
                  className="inline-flex justify-center w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Close
                </button>
                <a
                  href={screenshotData.url}
                  download={`screenshot-${screenshotData.displayId}-${Date.now()}.png`}
                  className="inline-flex justify-center items-center w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Download
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default HostDetailPage;

