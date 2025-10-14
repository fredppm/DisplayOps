import { useState, useEffect } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { useToastContext } from '@/contexts/ToastContext';
import { 
  ArrowLeft, Monitor, Cpu, CheckCircle, XCircle, AlertCircle, Terminal, RefreshCw,
  Eye, Camera, RotateCw, Trash2, Bug, BugOff, Play, Settings
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
  const [dashboardUrl, setDashboardUrl] = useState('https://');
  const [fullscreen, setFullscreen] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(300);

  useEffect(() => {
    if (id) {
      fetchHost();
    }
  }, [id]);

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

  const sendCommand = async (commandType: string, payload?: any) => {
    if (!host) return;
    
    try {
      setSendingCommand(true);
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
      
      if (data.success) {
        toast.success('Success', `Command "${commandType}" executed successfully`);
        // Refresh host data after command
        await fetchHost();
      } else {
        toast.error('Error', data.error || 'Failed to send command');
      }
    } catch (err: any) {
      console.error('Command error:', err);
      toast.error('Network Error', err.message);
    } finally {
      setSendingCommand(false);
    }
  };

  const handleOpenDashboard = (displayId: string) => {
    setSelectedDisplayId(displayId);
    setShowOpenDashboardModal(true);
  };

  const handleConfirmOpenDashboard = async () => {
    if (!selectedDisplayId || !dashboardUrl) return;
    
    await sendCommand('OPEN_DASHBOARD', {
      targetDisplay: selectedDisplayId,
      url: dashboardUrl,
      fullscreen: fullscreen,
      refreshInterval: refreshInterval * 1000 // Convert seconds to ms
    });
    
    // Reset and close modal
    setShowOpenDashboardModal(false);
    setDashboardUrl('https://');
    setFullscreen(true);
    setRefreshInterval(300);
    setSelectedDisplayId(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="h-4 w-4 mr-1" />
            Online
          </span>
        );
      case 'offline':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <XCircle className="h-4 w-4 mr-1" />
            Offline
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
            <AlertCircle className="h-4 w-4 mr-1" />
            Unknown
          </span>
        );
    }
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
                {getStatusBadge(host.status)}
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
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Seen</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {new Date(host.lastSeen).toLocaleString()}
                </dd>
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
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Uptime</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{Math.floor(host.systemInfo.uptime / 60)} minutes</dd>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              onClick={() => sendCommand('HEALTH_CHECK')}
              disabled={sendingCommand || host.status === 'offline'}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Settings className="h-4 w-4 mr-2" />
              Health Check
            </button>
            <button
              onClick={() => sendCommand('IDENTIFY_DISPLAYS', { duration: 5 })}
              disabled={sendingCommand || host.status === 'offline'}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Eye className="h-4 w-4 mr-2" />
              Identify Displays
            </button>
            <button
              onClick={() => sendCommand('DEBUG_ENABLE')}
              disabled={sendingCommand || host.status === 'offline'}
              className="inline-flex items-center justify-center px-4 py-2 border border-green-300 dark:border-green-600 rounded-md shadow-sm text-sm font-medium text-green-700 dark:text-green-200 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Bug className="h-4 w-4 mr-2" />
              Enable Debug
            </button>
            <button
              onClick={() => sendCommand('DEBUG_DISABLE')}
              disabled={sendingCommand || host.status === 'offline'}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <BugOff className="h-4 w-4 mr-2" />
              Disable Debug
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
                  {/* URL Input */}
                  <div>
                    <label htmlFor="dashboard-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Dashboard URL *
                    </label>
                    <input
                      type="url"
                      id="dashboard-url"
                      value={dashboardUrl}
                      onChange={(e) => setDashboardUrl(e.target.value)}
                      placeholder="https://example.com/dashboard"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>

                  {/* Fullscreen Toggle */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="fullscreen"
                      checked={fullscreen}
                      onChange={(e) => setFullscreen(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="fullscreen" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Open in fullscreen mode
                    </label>
                  </div>

                  {/* Refresh Interval */}
                  <div>
                    <label htmlFor="refresh-interval" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Auto-refresh interval (seconds)
                    </label>
                    <input
                      type="number"
                      id="refresh-interval"
                      value={refreshInterval}
                      onChange={(e) => setRefreshInterval(parseInt(e.target.value) || 0)}
                      min="0"
                      step="60"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Set to 0 to disable auto-refresh
                    </p>
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
                  disabled={!dashboardUrl || dashboardUrl === 'https://' || sendingCommand}
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

