import { useState, useEffect, useRef } from 'react';
import type { NextPage } from 'next';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { useToastContext } from '@/contexts/ToastContext';
import { usePendingToasts } from '@/hooks/usePendingToasts';
import { CheckCircle, XCircle, AlertCircle, Monitor, Cpu, HardDrive, RefreshCw } from 'lucide-react';

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
}

const HostsPage: NextPage = () => {
  const toast = useToastContext();
  usePendingToasts();
  
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasInitializedRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isFetchingRef = useRef(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchHosts();
      setupSSE();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  const setupSSE = () => {
    // Setup Server-Sent Events for real-time updates
    const eventSource = new EventSource('/api/hosts/events');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'host_registered' || data.type === 'host_updated') {
          // Debounced refresh to avoid race conditions
          debouncedFetchHosts();
          if (data.type === 'host_registered') {
            toast.success(`New host registered: ${data.host?.hostname || 'Unknown'}`);
          }
        } else if (data.type === 'host_disconnected') {
          debouncedFetchHosts();
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    eventSource.onerror = () => {
      console.warn('SSE connection error, will reconnect automatically');
      // EventSource automatically reconnects
    };

    eventSourceRef.current = eventSource;
  };

  const debouncedFetchHosts = () => {
    // Clear any pending fetch
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    // Schedule new fetch with 300ms debounce
    fetchTimeoutRef.current = setTimeout(() => {
      if (!isFetchingRef.current) {
        fetchHosts();
      }
    }, 300);
  };

  const fetchHosts = async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('⏳ Fetch already in progress, skipping...');
      return;
    }

    try {
      isFetchingRef.current = true;
      setLoading(true);
      const response = await fetch('/api/hosts');
      const data = await response.json();
      
      if (data.success) {
        setHosts(data.data || []);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch hosts');
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchHosts();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'offline':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const formatLastSeen = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      
      if (diffSec < 60) return 'just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHour < 24) return `${diffHour}h ago`;
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  if (loading && hosts.length === 0) {
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

  if (error) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error loading hosts</h3>
                <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>
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
          <div className="pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center mb-2">
                  <h1 className="text-2xl font-bold leading-7 text-gray-900 dark:text-gray-100 sm:truncate sm:text-3xl sm:tracking-tight">
                    Host Management
                  </h1>
                  <span className="ml-3 inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/20 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-600/20 dark:ring-blue-400/20">
                    {hosts.length} {hosts.length === 1 ? 'host' : 'hosts'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                  Mini PCs running host-agent, connected directly to Web-Admin via gRPC
                </p>
              </div>
              <div className="ml-6 flex flex-shrink-0">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="inline-flex items-center rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`-ml-0.5 mr-1.5 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Online Hosts
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                          {hosts.filter(h => h.status === 'online').length}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-red-500 rounded-md p-3">
                    <XCircle className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Offline Hosts
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                          {hosts.filter(h => h.status === 'offline').length}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                    <Monitor className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Total Displays
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                          {hosts.reduce((sum, h) => sum + (h.displays?.length || 0), 0)}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hosts List */}
          {hosts.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <Monitor className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hosts</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                No host-agents are currently registered.
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Start a host-agent to see it appear here automatically.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md border border-gray-200 dark:border-gray-700">
              <ul role="list" className="divide-y divide-gray-200 dark:divide-gray-700">
                {hosts.map((host) => (
                  <li key={host.id}>
                    <Link
                      href={`/hosts/${host.id}`}
                      className="block hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                    >
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center min-w-0 flex-1">
                            {getStatusIcon(host.status)}
                            <div className="ml-4 flex-1">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">
                                  {host.hostname}
                                </p>
                                <div className="ml-2 flex-shrink-0 flex">
                                  <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    {host.version}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
                                <span className="truncate">Agent ID: {host.agentId}</span>
                                <span className="mx-2">•</span>
                                <span>{host.ipAddress}:{host.grpcPort}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center">
                              <Monitor className="h-4 w-4 mr-1" />
                              {host.displays?.length || 0} displays
                            </div>
                            <div className="flex items-center">
                              <Cpu className="h-4 w-4 mr-1" />
                              {host.systemInfo?.cpuCores || 0} cores
                            </div>
                            <div className="flex items-center">
                              <HardDrive className="h-4 w-4 mr-1" />
                              {host.systemInfo?.totalMemoryGB || 0}GB RAM
                            </div>
                            <div>
                              {host.systemInfo?.platform || 'Unknown'} • {host.systemInfo?.arch || 'Unknown'}
                            </div>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {formatLastSeen(host.lastSeen)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default HostsPage;
