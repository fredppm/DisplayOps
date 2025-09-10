import { useState, useEffect, useRef } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Trash2, 
  Server, 
  Network,
  Wifi,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Building2
} from 'lucide-react';
import Layout from '@/components/Layout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Controller } from '@/types/multi-site-types';
import { useToastContext } from '@/contexts/ToastContext';
import { usePendingToasts } from '@/hooks/usePendingToasts';
import { useToastStore } from '@/stores/toastStore';

const ControllerDetailsPage: NextPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const toast = useToastContext();
  const { addPendingToast } = useToastStore();
  usePendingToasts();
  
  const [controller, setController] = useState<Controller | null>(null);
  const [loading, setLoading] = useState(true);  
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (id && typeof id === 'string' && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchController();
    }
  }, [id]);

  const fetchController = async () => {
    if (!id || typeof id !== 'string') return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/controllers/${id}`);
      const data = await response.json();
      
      if (data.success) {
        setController(data.data);
      } else {
        setError(data.error || 'Failed to fetch controller');
      }
    } catch (err: any) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = () => {
    if (!controller) return;
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!controller) return;
    
    setShowDeleteConfirm(false);
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/controllers/${controller.id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        addPendingToast({
          type: 'success',
          message: 'Controller unregistered successfully!'
        });
        router.push('/controllers');
      } else {
        toast.error(data.error || 'Error unregistering controller');
      }
    } catch (err: any) {
      toast.error('Network error: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'offline':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-400" />;
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
          <div className="animate-pulse">
            {/* Header Skeleton */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-8">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center mb-2">
                    <div className="mr-4 h-6 w-6 bg-gray-200 rounded"></div>
                    <div className="h-8 bg-gray-200 rounded w-64"></div>
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-96"></div>
                </div>
                <div className="ml-6 flex space-x-3">
                  <div className="h-9 bg-gray-200 rounded w-20"></div>
                  <div className="h-9 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
            </div>

            {/* Content Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white shadow rounded-lg p-6">
                  <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
                  <div className="space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-1">
                <div className="bg-white shadow rounded-lg p-6">
                  <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !controller) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center">
              <XCircle className="h-6 w-6 text-red-500 mr-2" />
              <h3 className="text-lg font-medium text-red-800">
                {error || 'Controller not found'}
              </h3>
            </div>
            <p className="mt-2 text-red-700">
              {error || 'The requested controller could not be found.'}
            </p>
            <div className="mt-4">
              <Link
                href="/controllers"
                className="inline-flex items-center px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Controllers
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Unregister Controller"
        message="Are you sure you want to unregister this controller? This will remove it from the system, but it can reconnect automatically if still online."
        confirmText="Unregister"
        cancelText="Cancel"
        variant="warning"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center mb-2">
                <Link
                  href="/controllers"
                  className="mr-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                >
                  <ArrowLeft className="h-6 w-6" />
                </Link>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold leading-7 text-gray-900 dark:text-gray-100 sm:truncate sm:text-3xl sm:tracking-tight">
                    {controller.name}
                  </h1>
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
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <strong className="text-blue-600">Auto-registered controller</strong> • Version: {controller.version} • Last sync: {formatLastSync(controller.lastSync)}
              </p>
            </div>
            <div className="ml-6 flex flex-shrink-0 space-x-3">
              <button
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="inline-flex items-center rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Unregistering...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Unregister
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Controller Information */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Controller Information
                </h3>
                
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Controller Name
                    </label>
                    <div className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2">
                      {controller.name}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Building2 className="h-4 w-4 inline mr-2" />
                      Associated Site
                    </label>
                    <div className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2">
                      {controller.siteId || 'No site assigned'}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Network className="h-4 w-4 inline mr-2" />
                      Local Network
                    </label>
                    <div className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 font-mono">
                      {controller.localNetwork}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Wifi className="h-4 w-4 inline mr-2" />
                      mDNS Service
                    </label>
                    <div className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 font-mono">
                      {controller.mdnsService}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Server className="h-4 w-4 inline mr-2" />
                      Controller Access URL
                    </label>
                    <div className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2">
                      <a 
                        href={controller.controllerUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                      >
                        {controller.controllerUrl}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">

            {/* Auto Registration Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">🔄 Auto Registration</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                This controller was <strong>automatically registered</strong> when it connected to the network and established communication with the admin panel.
              </p>
              <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
                <li>• Controllers register themselves automatically when online</li>
                <li>• Status updates in real-time via network communication</li>
                <li>• No manual configuration required</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      </Layout>
    </>
  );
};

export default ControllerDetailsPage;