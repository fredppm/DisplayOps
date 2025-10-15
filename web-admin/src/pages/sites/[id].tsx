import { useState, useEffect, useRef } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  MapPin, 
  Clock, 
  Monitor, 
  AlertTriangle,
  CheckCircle,
  XCircle 
} from 'lucide-react';
import Layout from '@/components/Layout';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import TimezoneCombobox, { TimezoneOption, TIMEZONE_OPTIONS } from '@/components/forms/TimezoneCombobox';
import { Site } from '@/types/multi-site-types';
import { useToastContext } from '@/contexts/ToastContext';
import { useToastStore } from '@/stores/toastStore';



const SiteDetailsPage: NextPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const toast = useToastContext();
  const { addPendingToast } = useToastStore();
  
  const [site, setSite] = useState<Site | null>(null);
  const [hosts, setHosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const hasInitializedRef = useRef(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    timezone: 'America/New_York'
  });

  useEffect(() => {
    if (id && typeof id === 'string' && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchSiteData();
    }
  }, [id]);

  useEffect(() => {
    if (site) {
      setFormData({
        name: site.name,
        location: site.location,
        timezone: site.timezone
      });
    }
  }, [site]);

  const fetchSiteData = async () => {
    if (!id || typeof id !== 'string') return;
    
    try {
      setLoading(true);
      
      // Fetch site and hosts data in parallel
      const [siteResponse, hostsResponse] = await Promise.all([
        fetch(`/api/sites/${id}`),
        fetch('/api/hosts')
      ]);
      
      const siteData = await siteResponse.json();
      const hostsData = await hostsResponse.json();
      
      if (siteData.success) {
        setSite(siteData.data);
      } else {
        setError(siteData.error || 'Site not found');
      }
      
      if (hostsData.success) {
        setHosts(hostsData.data || []);
      }
    } catch (err: any) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const siteHosts = hosts.filter(host => 
    site?.hosts.includes(host.id)
  );

  // Helper function to get timezone display label
  const getTimezoneLabel = (timezoneValue: string): string => {
    const timezoneOption = TIMEZONE_OPTIONS.find(option => option.value === timezoneValue);
    return timezoneOption ? timezoneOption.label : timezoneValue;
  };

  const handleSave = async () => {
    if (!site) return;
    
    setIsSaving(true);
    
    try {
      const response = await fetch(`/api/sites/${site.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSite(data.data);
        setIsEditing(false);
        toast.success('Site atualizado com sucesso!');
      } else {
        toast.error('Erro ao salvar alterações', data.error);
      }
    } catch (err: any) {
      toast.error('Erro de rede', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = () => {
    if (!site) return;
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!site) return;
    
    setShowDeleteModal(false);
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/sites/${site.id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Adiciona toast pendente no Zustand
        addPendingToast({
          type: 'success',
          message: 'Site excluído com sucesso!'
        });
        
        // Navega para listagem (sem query params)
        router.push('/sites');
      } else {
        toast.error('Erro ao excluir site', data.error);
      }
    } catch (err: any) {
      toast.error('Erro de rede', err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-8">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center mb-2">
                    <div className="mr-4 h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded"></div>
                    <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-64"></div>
                  </div>
                </div>
                <div className="ml-6 flex space-x-3">
                  <div className="h-9 bg-gray-200 dark:bg-gray-600 rounded w-20"></div>
                  <div className="h-9 bg-gray-200 dark:bg-gray-600 rounded w-24"></div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                  <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-48 mb-4"></div>
                  <div className="space-y-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                  <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-32 mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !site) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center">
              <XCircle className="h-6 w-6 text-red-500 mr-2" />
              <h3 className="text-lg font-medium text-red-800 dark:text-red-300">
                {error || 'Site not found'}
              </h3>
            </div>
            <p className="mt-2 text-red-700 dark:text-red-400">
              {error || 'The requested site could not be found.'}
            </p>
            <div className="mt-4">
              <Link
                href="/sites"
                className="inline-flex items-center px-4 py-2 bg-red-100 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-700 text-red-700 dark:text-red-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sites
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
        isOpen={showDeleteModal}
        title="Delete Site"
        message={`Are you sure you want to delete the site "${site.name}"? This action cannot be undone.`}
        confirmText="Delete Site"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteModal(false)}
      />
      
      <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center mb-2">
                <Link
                  href="/sites"
                  className="mr-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                >
                  <ArrowLeft className="h-6 w-6" />
                </Link>
                <h1 className="text-2xl font-bold leading-7 text-gray-900 dark:text-gray-100 sm:truncate sm:text-3xl sm:tracking-tight">
                  {isEditing ? 'Edit Site' : site.name}
                </h1>
              </div>
            </div>
            <div className="ml-6 flex flex-shrink-0 space-x-3">
              {!isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    className="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-500"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setFormData({
                        name: site.name,
                        location: site.location,
                        timezone: site.timezone
                      });
                    }}
                    className="inline-flex items-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Toast notifications will handle success/error messages */}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Site Information */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Informações do Site
                </h3>
                
                <form className="space-y-6">
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Site Name
                      </label>
                      {isEditing ? (
                        <div className="relative">
                          <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="block w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder="Enter site name"
                            required
                          />
                        </div>
                      ) : (
                        <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-400">{site.name}</p>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <MapPin className="h-4 w-4 inline mr-2" />
                        Location
                      </label>
                      {isEditing ? (
                        <div className="relative">
                          <input
                            type="text"
                            id="location"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            className="block w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder="City, State/Country"
                            required
                          />
                        </div>
                      ) : (
                        <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-400">{site.location}</p>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Clock className="h-4 w-4 inline mr-2" />
                        Timezone
                      </label>
                      {isEditing ? (
                        <TimezoneCombobox
                          value={formData.timezone}
                          onChange={(timezone) => setFormData({ ...formData, timezone })}
                          disabled={isSaving}
                          placeholder="Select timezone..."
                        />
                      ) : (
                        <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-400">{getTimezoneLabel(site.timezone)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* Hosts */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 mb-4">
                  <Monitor className="h-5 w-5 inline mr-2" />
                  Associated Hosts ({siteHosts.length})
                </h3>
                
                {siteHosts.length === 0 ? (
                  <div className="text-center py-6">
                    <Monitor className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No hosts</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      This site has no associated host agents.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {siteHosts.map((host) => (
                      <div key={host.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{host.name}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{host.ipAddress}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{host.displays?.length || 0} displays</p>
                          </div>
                          <div className="flex items-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              host.status === 'online' 
                                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                            }`}>
                              {host.status === 'online' ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 mb-4">
                General Information
              </h3>
              
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      site.status === 'online' 
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                        : site.status === 'offline'
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                        : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                    }`}>
                      {site.status === 'online' ? 'Online' : 
                       site.status === 'offline' ? 'Offline' : 'Erro'}
                    </span>
                  </dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Site ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-mono">{site.id}</dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created At</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                    {new Date(site.createdAt).toLocaleDateString('pt-BR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                    {new Date(site.updatedAt).toLocaleDateString('pt-BR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
      </Layout>
    </>
  );
};

export default SiteDetailsPage;