import { useState, useEffect, useRef } from 'react';
import { NextPage } from 'next';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { Server, Network, Clock, AlertCircle, CheckCircle, XCircle, Plus, Wifi, WifiOff } from 'lucide-react';
import { useToastContext } from '@/contexts/ToastContext';
import { usePendingToasts } from '@/hooks/usePendingToasts';

interface Controller {
  id: string;
  name: string;
  localNetwork: string;
  mdnsService: string;
  controllerUrl: string;
  status: 'online' | 'offline' | 'error';
  lastSync: string;
  version: string;
}

// Removido ControllersPageProps - não precisamos mais de props SSR

const ControllersPage: NextPage = () => {
  const toast = useToastContext();
  usePendingToasts(); // Hook para consumir toasts do Zustand
  
  const [controllers, setControllers] = useState<Controller[]>([]);
  const [loading, setLoading] = useState(true); // Inicia como loading
  const [error, setError] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);

  // Fetch controllers on component mount (CSR) - com proteção contra duplas chamadas
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchControllers();
    }
  }, []);

  const fetchControllers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/controllers');
      const data = await response.json();
      
      if (data.success) {
        setControllers(data.data || []);
      } else {
        setError(data.error || 'Failed to fetch controllers');
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'offline':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const formatLastSync = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Real - Fora do skeleton */}
          <div className="pb-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center mb-2">
                  <h1 className="text-2xl font-bold leading-7 text-gray-900 dark:text-gray-100 sm:truncate sm:text-3xl sm:tracking-tight">
                    Controllers Management
                  </h1>
                  <span className="ml-3 inline-flex items-center rounded-full bg-gray-50 dark:bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-400 dark:text-gray-500 ring-1 ring-inset ring-gray-200 dark:ring-gray-600">
                    Loading...
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                  Monitor and manage your DisplayOps controllers.
                </p>
              </div>
              <div className="ml-6 flex flex-shrink-0">
                <span className="inline-flex items-center rounded-md bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                  Controllers automatically register themselves
                </span>
              </div>
            </div>
          </div>

          {/* Stats Skeleton */}
          <div className="mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="animate-pulse flex items-center space-x-8">
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-16"></div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20"></div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-18"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Controllers Grid Skeleton */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="relative rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-6 py-5 shadow-sm"
              >
                <div className="animate-pulse">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="h-5 w-5 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-24"></div>
                    </div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded-full w-16"></div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-20"></div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-16"></div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-12"></div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between">
                      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-16"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-16"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center">
              <XCircle className="h-6 w-6 text-red-500 mr-2" />
              <h3 className="text-lg font-medium text-red-800 dark:text-red-300">Error Loading Controllers</h3>
            </div>
            <p className="mt-2 text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={fetchControllers}
              className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-700 text-red-700 dark:text-red-100 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Container with proper padding */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header with Actions */}
        <div className="pb-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center mb-2">
                <h1 className="text-2xl font-bold leading-7 text-gray-900 dark:text-gray-100 sm:truncate sm:text-3xl sm:tracking-tight">
                  Controllers Management
                </h1>
                <span className="ml-3 inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/20 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-600/20 dark:ring-blue-400/20">
                  {controllers.length} {controllers.length === 1 ? 'controller' : 'controllers'}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                Monitor and manage your DisplayOps controllers.
              </p>
            </div>
            <div className="ml-6 flex flex-shrink-0">
              <span className="inline-flex items-center rounded-md bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                Controllers automatically register themselves
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats - Compact */}
        <div className="mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-8">
                <div className="flex items-center space-x-2">
                  <Server className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total: <span className="font-semibold text-gray-900 dark:text-gray-100">{controllers.length}</span></span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Online: <span className="font-semibold text-green-700 dark:text-green-400">{controllers.filter(c => c.status === 'online').length}</span></span>
                </div>
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Offline: <span className="font-semibold text-red-700 dark:text-red-400">{controllers.filter(c => c.status === 'offline').length}</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controllers List */}
        <div>
          {controllers.length === 0 ? (
            <div className="text-center bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg py-12">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                <Server className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">No Controllers Found</h3>
              <div className="mt-2 text-sm max-w-sm mx-auto text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-2">
                  Controllers automatically register themselves.
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-xs">
                  Make sure your DisplayOps controllers are running.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {controllers.map((controller) => (
                <div
                  key={controller.id}
                  className="relative rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-6 py-5 shadow-sm hover:shadow-md dark:hover:shadow-xl transition-shadow focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-gray-900"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        {getStatusIcon(controller.status)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/controllers/${controller.id}`} className="focus:outline-none">
                          <span className="absolute inset-0" aria-hidden="true" />
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{controller.name}</p>
                        </Link>
                      </div>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                      controller.status === 'online'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 ring-green-600/20 dark:ring-green-400/20'
                        : controller.status === 'offline'
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 ring-red-600/20 dark:ring-red-400/20'
                        : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 ring-yellow-600/20 dark:ring-yellow-400/20'
                    }`}>
                      {controller.status === 'online' ? 'Online' : controller.status === 'offline' ? 'Offline' : 'Error'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Network className="mr-1.5 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                      <span className="truncate">{controller.localNetwork}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Wifi className="mr-1.5 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                      <span className="truncate font-mono text-xs">{controller.mdnsService}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Clock className="mr-1.5 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                      <span className="truncate">Last sync: {formatLastSync(controller.lastSync)}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                      <span>Version {controller.version}</span>
                      <span>ID: {controller.id.substring(0, 8)}...</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

// Removido getServerSideProps - agora é CSR puro

export default ControllersPage;