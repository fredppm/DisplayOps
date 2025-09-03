import { useState, useEffect, useRef } from 'react';
import { NextPage } from 'next';
import { Plus, MapPin, Clock, Users, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { Site } from '@/types/multi-site-types';
import { useToastContext } from '@/contexts/ToastContext';
import { usePendingToasts } from '@/hooks/usePendingToasts';

// Removido SitesPageProps - não precisamos mais de props SSR

const SitesPage: NextPage = () => {
  const toast = useToastContext();
  usePendingToasts(); // Hook para consumir toasts do Zustand
  
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true); // Inicia como loading
  const [error, setError] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);

  // Fetch sites on component mount (CSR) - com proteção contra duplas chamadas
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchSites();
    }
  }, []);

  const fetchSites = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sites');
      const data = await response.json();
      
      console.log('API Response:', data); // Debug: ver o que a API está retornando
      
      if (data.success) {
        console.log('Sites data:', data.data); // Debug: ver os sites
        setSites(data.data || []);
      } else {
        setError(data.error || 'Failed to fetch sites');
      }
    } catch (err: any) {
      console.error('Fetch error:', err); // Debug: ver erros
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
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'offline':
        return 'Offline';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-50 text-green-700 ring-green-600/20';
      case 'offline':
        return 'bg-gray-50 text-gray-700 ring-gray-600/20';
      case 'error':
        return 'bg-red-50 text-red-700 ring-red-600/20';
      default:
        return 'bg-gray-50 text-gray-700 ring-gray-600/20';
    }
  };

  const formatTimezone = (timezone: string) => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
      return formatter.format(now);
    } catch {
      return timezone;
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
                  <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                    Sites Management
                  </h1>
                  <span className="ml-3 inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-400 ring-1 ring-inset ring-gray-200">
                    Loading...
                  </span>
                </div>
                <p className="text-sm text-gray-500 max-w-2xl">
                  Manage all your DisplayOps sites and their controllers. Monitor status, configure settings, and deploy dashboards across your network.
                </p>
              </div>
              <div className="ml-6 flex flex-shrink-0">
                <Link
                  href="/sites/new"
                  className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
                >
                  <Plus className="-ml-0.5 mr-1.5 h-4 w-4" />
                  Add Site
                </Link>
              </div>
            </div>
          </div>

          {/* Stats Skeleton */}
          <div className="mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4">
              <div className="animate-pulse flex items-center space-x-8">
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-18"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Sites Grid Skeleton */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm"
              >
                <div className="animate-pulse">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="h-5 w-5 bg-gray-200 rounded-full"></div>
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-20"></div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-12"></div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="flex justify-between">
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <XCircle className="h-6 w-6 text-red-500 mr-2" />
            <h3 className="text-lg font-medium text-red-800">Error Loading Sites</h3>
          </div>
          <p className="mt-2 text-red-700">{error}</p>
          <button
            onClick={fetchSites}
            className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
          >
            Try Again
          </button>
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
                <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                  Sites Management
                </h1>
                <span className="ml-3 inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  {sites.length} {sites.length === 1 ? 'site' : 'sites'}
                </span>
              </div>
              <p className="text-sm text-gray-500 max-w-2xl">
                Manage all your DisplayOps sites and their controllers. Monitor status, configure settings, and deploy dashboards across your network.
              </p>
            </div>
            <div className="ml-6 flex flex-shrink-0">
              <Link
                href="/sites/new"
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
              >
                <Plus className="-ml-0.5 mr-1.5 h-4 w-4" />
                Add Site
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Stats - Compact */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-8">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Total: <span className="font-semibold text-gray-900">{sites.length}</span></span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-600">Online: <span className="font-semibold text-green-700">{sites.filter(site => site.status === 'online').length}</span></span>
                </div>
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Offline: <span className="font-semibold text-gray-700">{sites.filter(site => site.status === 'offline').length}</span></span>
                </div>
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-gray-600">Error: <span className="font-semibold text-red-700">{sites.filter(site => site.status === 'error').length}</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sites List */}
        <div>
          {sites.length === 0 ? (
            <div className="text-center bg-white shadow-sm ring-1 ring-gray-200 rounded-lg py-12">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <MapPin className="h-6 w-6 text-gray-600" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-gray-900">No Sites</h3>
              <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
                Get started by creating your first site to manage DisplayOps controllers.
              </p>
              <div className="mt-6">
                <Link
                  href="/sites/new"
                  className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <Plus className="-ml-0.5 mr-1.5 h-4 w-4" />
                  Create Site
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sites.map((site) => {
                return (
                  <div
                    key={site.id}
                    className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:shadow-md transition-shadow focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {getStatusIcon(site.status)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link href={`/sites/${site.id}`} className="focus:outline-none">
                            <span className="absolute inset-0" aria-hidden="true" />
                            <p className="text-sm font-medium text-gray-900 truncate">{site.name}</p>
                          </Link>
                        </div>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusColor(site.status)}`}>
                        {getStatusLabel(site.status)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-500">
                        <MapPin className="mr-1.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <span className="truncate">{site.location}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="mr-1.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <span className="truncate">{formatTimezone(site.timezone)}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Users className="mr-1.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <span>{site.controllers.length} controller{site.controllers.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="flex justify-between text-xs text-gray-400">
                        <div>Created {new Date(site.createdAt).toLocaleDateString()}</div>
                        <div>Updated {new Date(site.updatedAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

// Removido getServerSideProps - agora é CSR puro

export default SitesPage;