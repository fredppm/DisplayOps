import { useState, useEffect } from 'react';
import { NextPage, GetServerSideProps } from 'next';
import { Plus, MapPin, Clock, Users, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { Site } from '@/types/multi-site-types';
import { getSites } from '@/lib/api-server';

interface SitesPageProps {
  initialSites: Site[];
}

const SitesPage: NextPage<SitesPageProps> = ({ initialSites }) => {
  const [sites, setSites] = useState<Site[]>(initialSites);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only fetch if no initial data (for refresh functionality)
  useEffect(() => {
    // Initial data is provided by SSR, no need to fetch immediately
  }, []);

  const fetchSites = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sites');
      const data = await response.json();
      
      if (data.success) {
        setSites(data.data || []);
      } else {
        setError(data.error || 'Failed to fetch sites');
      }
    } catch (err: any) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSiteStatus = (site: Site) => {
    // Use deterministic status based on site ID to avoid hydration mismatches
    // In a real implementation, this would check controller connectivity
    const hash = site.id.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const isHealthy = Math.abs(hash) % 10 > 3; // Deterministic "random"
    return isHealthy ? 'healthy' : 'warning';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
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
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <div className="h-6 bg-gray-300 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-300 rounded w-2/3"></div>
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
        <div className="border-b border-gray-200 pb-6 mb-8">
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
            <div className="ml-6 flex flex-shrink-0 space-x-3">
              <button
                type="button"
                onClick={fetchSites}
                className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
              >
                <svg className="-ml-0.5 mr-1.5 h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
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

        {/* Stats Overview */}
        <div className="mb-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Sites */}
            <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow ring-1 ring-black ring-opacity-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500">
                    <MapPin className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Sites</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">{sites.length}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            {/* Healthy Sites */}
            <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow ring-1 ring-black ring-opacity-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-500">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Healthy Sites</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {sites.filter(site => getSiteStatus(site) === 'healthy').length}
                      </div>
                      <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                        {sites.length > 0 && (
                          <>
                            {Math.round((sites.filter(site => getSiteStatus(site) === 'healthy').length / sites.length) * 100)}%
                          </>
                        )}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            {/* Warning Sites */}
            <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow ring-1 ring-black ring-opacity-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-yellow-500">
                    <AlertCircle className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Warning Sites</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {sites.filter(site => getSiteStatus(site) === 'warning').length}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            {/* Total Controllers */}
            <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow ring-1 ring-black ring-opacity-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-500">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Controllers</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {sites.reduce((total, site) => total + site.controllers.length, 0)}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sites Section */}
        <div>
          <div className="sm:flex sm:items-center mb-6">
            <div className="sm:flex-auto">
              <h2 className="text-lg font-medium text-gray-900">Sites</h2>
              <p className="mt-1 text-sm text-gray-500">A list of all sites in your organization including their location, status, and controllers.</p>
            </div>
          </div>

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
                const status = getSiteStatus(site);
                return (
                  <div
                    key={site.id}
                    className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:shadow-md transition-shadow focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {getStatusIcon(status)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link href={`/sites/${site.id}`} className="focus:outline-none">
                            <span className="absolute inset-0" aria-hidden="true" />
                            <p className="text-sm font-medium text-gray-900 truncate">{site.name}</p>
                          </Link>
                        </div>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                        status === 'healthy' 
                          ? 'bg-green-50 text-green-700 ring-green-600/20'
                          : status === 'warning'
                          ? 'bg-yellow-50 text-yellow-800 ring-yellow-600/20'
                          : 'bg-red-50 text-red-700 ring-red-600/20'
                      }`}>
                        {status === 'healthy' ? 'Healthy' : status === 'warning' ? 'Warning' : 'Error'}
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
                        <span>Created {new Date(site.createdAt).toLocaleDateString()}</span>
                        <span>Updated {new Date(site.updatedAt).toLocaleDateString()}</span>
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

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    const sitesData = await getSites();
    
    return {
      props: {
        initialSites: sitesData.sites,
      },
    };
  } catch (error) {
    console.error('Error fetching sites:', error);
    
    return {
      props: {
        initialSites: [],
      },
    };
  }
};

export default SitesPage;