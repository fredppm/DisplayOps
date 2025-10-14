import { useState, useEffect, useRef } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { useToastContext } from '@/contexts/ToastContext';
import { 
  ArrowLeft, Monitor, Cpu, CheckCircle, XCircle, AlertCircle, Terminal, RefreshCw,
  Eye, Camera, RotateCw, Trash2, Bug, BugOff, Play, Settings, Activity, MemoryStick, FileText
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
  }>;
  systemInfo: {
    platform: string;
    arch: string;
    nodeVersion: string;
    electronVersion: string;
    totalMemoryGB: number;
    cpuCores: number;
    cpuModel: string;
    uptime: number;
  };
  metrics?: {
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    memoryUsedGB: number;
    memoryTotalGB: number;
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

  useEffect(() => {
    if (id) {
      fetchHost();
      fetchDashboards();
      setupSSE();
    }

    // Cleanup SSE on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
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
        
        // Only update if event is for this host
        if (eventData.host && eventData.host.id === id) {
          switch (eventData.type) {
            case 'host_updated':
              setHost(eventData.host);
              break;
            case 'host_disconnected':
              if (host) {
                setHost({ ...host, status: 'offline' });
              }
              break;
          }
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      console.warn('SSE connection error for host detail, will reconnect automatically');
    };

    eventSourceRef.current = eventSource;
  };

  const fetchHost = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/hosts');
      const data = await response.json();
      
      if (data.success) {
        const foundHost = data.data.find((h: Host) => h.id === id);
        if (foundHost) {
          setHost(foundHost);
        } else {
          setError('Host not found');
        }
      } else {
        setError(data.error || 'Failed to fetch host');
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
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
            const statusMsg = healthData.online ? 'Host online e saudável' : 'Host com problemas';
            const cpuMsg = `CPU: ${healthData.cpu_usage_percent?.toFixed(1) || 'N/A'}%`;
            const memMsg = `Memória: ${healthData.memory_usage_percent?.toFixed(1) || 'N/A'}%`;
            toast.success('Health Check Completo', `${statusMsg} - ${cpuMsg}, ${memMsg}`);
            console.log('[Health Check] Full result:', healthData);
            break;
          case 'IDENTIFY_DISPLAYS':
            toast.success('Displays Identificados', 'Os números dos displays estão sendo mostrados por 5 segundos no host');
            break;
          case 'OPEN_DASHBOARD':
            toast.success('Dashboard Aberto', 'O dashboard foi aberto no display selecionado');
            break;
          case 'REFRESH_DASHBOARD':
            toast.success('Dashboard Atualizado', 'O dashboard foi recarregado com sucesso');
            break;
          case 'RESTART_DASHBOARD':
            toast.success('Dashboard Reiniciado', 'O dashboard foi reiniciado com sucesso');
            break;
          case 'REMOVE_DASHBOARD':
            toast.success('Dashboard Removido', 'O dashboard foi fechado e removido do display');
            break;
          case 'TAKE_SCREENSHOT':
            toast.success('Screenshot Capturado', 'A captura de tela foi tirada com sucesso');
            break;
          case 'DEBUG_ENABLE':
            setDebugEnabled(true);
            toast.success('Debug Ativado', 'O modo debug foi ativado com sucesso');
            break;
          case 'DEBUG_DISABLE':
            setDebugEnabled(false);
            toast.success('Debug Desativado', 'O modo debug foi desativado com sucesso');
            break;
          case 'SET_COOKIES':
          case 'SYNC_COOKIES':
            toast.success('Cookies Sincronizados', 'Os cookies foram sincronizados com sucesso no host');
            break;
          case 'VALIDATE_URL':
            toast.success('URL Validada', 'A URL foi validada com sucesso');
            break;
          default:
            // Fallback para comandos não mapeados - tenta humanizar o nome
            const humanCommand = commandType
              .split('_')
              .map(word => word.charAt(0) + word.slice(1).toLowerCase())
              .join(' ');
            toast.success('Comando Executado', `${humanCommand} foi executado com sucesso`);
        }
      } else {
        toast.error('Erro ao Executar Comando', data.error || 'Falha ao executar comando');
      }
    } catch (err: any) {
      console.error('Command error:', err);
      toast.error('Erro de Rede', 'Não foi possível conectar ao host: ' + err.message);
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

  const formatUptime = (uptimeSeconds: number): string => {
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
    
    return parts.join(' ');
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
            <div className="flex items-center space-x-3">
              <div className="flex flex-col items-end text-xs text-gray-500 dark:text-gray-400">
                <span>Updated</span>
                <span className={`font-medium ${
                  isHostStale(host.lastSeen) 
                    ? 'text-orange-600 dark:text-orange-400' 
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {getTimeSinceLastSeen(host.lastSeen)}
                </span>
              </div>
              <button
                onClick={fetchHost}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Offline Warning Banner */}
        {isHostStale(host.lastSeen) && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-400 p-4 rounded-md">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-orange-400 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Host disconnected or not responding
                </h3>
                <div className="mt-2 text-sm text-orange-700 dark:text-orange-300">
                  <p>
                    This host hasn't sent a heartbeat in over 2 minutes. 
                    The displayed data (uptime, metrics, etc.) was last updated {getTimeSinceLastSeen(host.lastSeen)} and may be outdated.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Real-time Metrics */}
        {host.metrics && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* CPU Usage */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">CPU Usage</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                    {host.metrics.cpuUsagePercent.toFixed(1)}%
                  </p>
                </div>
                <div className={`p-3 rounded-full ${
                  host.metrics.cpuUsagePercent > 80 ? 'bg-red-100 dark:bg-red-900/20' :
                  host.metrics.cpuUsagePercent > 60 ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                  'bg-green-100 dark:bg-green-900/20'
                }`}>
                  <Activity className={`h-6 w-6 ${
                    host.metrics.cpuUsagePercent > 80 ? 'text-red-600 dark:text-red-400' :
                    host.metrics.cpuUsagePercent > 60 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-green-600 dark:text-green-400'
                  }`} />
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    host.metrics.cpuUsagePercent > 80 ? 'bg-red-600' :
                    host.metrics.cpuUsagePercent > 60 ? 'bg-yellow-600' :
                    'bg-green-600'
                  }`}
                  style={{ width: `${Math.min(host.metrics.cpuUsagePercent, 100)}%` }}
                />
              </div>
            </div>

            {/* Memory Usage */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Memory Usage</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                    {host.metrics.memoryUsagePercent.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {host.metrics.memoryUsedGB.toFixed(1)}GB / {host.metrics.memoryTotalGB.toFixed(1)}GB
                  </p>
                </div>
                <div className={`p-3 rounded-full ${
                  host.metrics.memoryUsagePercent > 80 ? 'bg-red-100 dark:bg-red-900/20' :
                  host.metrics.memoryUsagePercent > 60 ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                  'bg-purple-100 dark:bg-purple-900/20'
                }`}>
                  <MemoryStick className={`h-6 w-6 ${
                    host.metrics.memoryUsagePercent > 80 ? 'text-red-600 dark:text-red-400' :
                    host.metrics.memoryUsagePercent > 60 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-purple-600 dark:text-purple-400'
                  }`} />
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    host.metrics.memoryUsagePercent > 80 ? 'bg-red-600' :
                    host.metrics.memoryUsagePercent > 60 ? 'bg-yellow-600' :
                    'bg-purple-600'
                  }`}
                  style={{ width: `${Math.min(host.metrics.memoryUsagePercent, 100)}%` }}
                />
              </div>
            </div>

            {/* Status Card */}
            <div className={`bg-white dark:bg-gray-800 shadow rounded-lg p-4 border-l-4 ${
              host.status === 'online' ? 'border-green-500' : 'border-red-500'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                    {host.status === 'online' ? 'Online' : 'Offline'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    System: {formatUptime(host.systemInfo.uptime)}
                  </p>
                  <div className="mt-1">
                    <p className={`text-xs font-medium ${
                      isHostStale(host.lastSeen) 
                        ? 'text-orange-600 dark:text-orange-400' 
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      Last seen {getTimeSinceLastSeen(host.lastSeen)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(host.lastSeen).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className={`p-3 rounded-full ${
                  host.status === 'online' 
                    ? 'bg-green-100 dark:bg-green-900/20' 
                    : 'bg-gray-100 dark:bg-gray-900/20'
                }`}>
                  {host.status === 'online' ? (
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Displays Card */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Displays</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                    {host.displays?.length || 0}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {host.displays?.filter(d => d.isPrimary).length || 0} primary
                  </p>
                </div>
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/20">
                  <Monitor className="h-6 w-6 text-blue-600 dark:text-blue-400" />
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

        {/* Global Host Commands */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <Terminal className="h-5 w-5 mr-2" />
            Global Host Commands
          </h3>
           <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
             <button
               onClick={() => sendCommand('HEALTH_CHECK')}
               disabled={sendingCommand || host.status === 'offline'}
               className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
             >
               <Settings className="h-4 w-4 mr-2" />
               Health Check
             </button>
             <button
               onClick={() => sendCommand('IDENTIFY_DISPLAYS')}
               disabled={sendingCommand || host.status === 'offline'}
               className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
             >
               <Eye className="h-4 w-4 mr-2" />
               Identify Displays
             </button>
             <button
               onClick={toggleDebug}
               disabled={sendingCommand || host.status === 'offline'}
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
          {host.status === 'offline' && (
            <p className="mt-3 text-sm text-yellow-600 dark:text-yellow-400 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              Commands are disabled while the host is offline
            </p>
          )}
        </div>

        {/* Displays with Per-Display Controls */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <Monitor className="h-5 w-5 mr-2" />
            Displays & Dashboard Controls ({host.displays?.length || 0})
          </h3>
          {host.displays && host.displays.length > 0 ? (
            <div className="space-y-4">
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
                    </div>
                  </div>
                  
                  {/* Dashboard Controls for this display */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    <button
                      onClick={() => handleOpenDashboard(display.id)}
                      disabled={sendingCommand || host.status === 'offline'}
                      className="inline-flex items-center justify-center px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md text-sm font-medium text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Open
                    </button>
                    <button
                      onClick={() => sendCommand('REFRESH_DASHBOARD', { 
                        targetDisplay: display.id 
                      })}
                      disabled={sendingCommand || host.status === 'offline'}
                      className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Refresh
                    </button>
                    <button
                      onClick={() => sendCommand('RESTART_DASHBOARD', { 
                        targetDisplay: display.id 
                      })}
                      disabled={sendingCommand || host.status === 'offline'}
                      className="inline-flex items-center justify-center px-3 py-2 border border-yellow-300 dark:border-yellow-600 rounded-md text-sm font-medium text-yellow-700 dark:text-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <RotateCw className="h-4 w-4 mr-1" />
                      Restart
                    </button>
                    <button
                      onClick={() => sendCommand('REMOVE_DASHBOARD', { 
                        targetDisplay: display.id 
                      })}
                      disabled={sendingCommand || host.status === 'offline'}
                      className="inline-flex items-center justify-center px-3 py-2 border border-red-300 dark:border-red-600 rounded-md text-sm font-medium text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </button>
                    <button
                      onClick={() => sendCommand('TAKE_SCREENSHOT', { 
                        targetDisplay: display.id,
                        format: 'png'
                      })}
                      disabled={sendingCommand || host.status === 'offline'}
                      className="inline-flex items-center justify-center px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-md text-sm font-medium text-purple-700 dark:text-purple-200 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Camera className="h-4 w-4 mr-1" />
                      Screenshot
                    </button>
                    </div>
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

        {/* Command Logs - Future: Pull from host via gRPC */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Command Logs</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Logs are stored locally on the host and will be available via gRPC in a future update.
            </p>
          </div>
        </div>
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
    </Layout>
  );
};

export default HostDetailPage;

