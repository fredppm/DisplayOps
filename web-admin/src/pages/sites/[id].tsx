import { useState, useEffect } from 'react';
import { NextPage, GetServerSideProps } from 'next';
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
import TimezoneCombobox from '@/components/forms/TimezoneCombobox';
import { Site } from '@/types/multi-site-types';
import { getSites, getControllers } from '@/lib/api-server';
import { useToastContext } from '@/contexts/ToastContext';
import { useToastStore } from '@/stores/toastStore';

interface SiteDetailsPageProps {
  site: Site | null;
  controllers: any[];
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  site: Site;
  orphanedHosts: string[];
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ 
  isOpen, 
  site, 
  orphanedHosts, 
  onConfirm, 
  onCancel, 
  isDeleting 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center mb-4">
          <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Confirm Deletion</h3>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-3">
            Are you sure you want to delete the site <strong>{site.name}</strong>?
          </p>
          
          {orphanedHosts.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">
                    Hosts that will become orphaned:
                  </h4>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p className="mb-2">{orphanedHosts.length} host(s) will be disassociated:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {orphanedHosts.map((hostName, index) => (
                        <li key={index}>{hostName}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <p className="text-sm text-gray-600">
            This action cannot be undone.
          </p>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 flex items-center"
          >
            {isDeleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Site
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const SiteDetailsPage: NextPage<SiteDetailsPageProps> = ({ site: initialSite, controllers }) => {
  const router = useRouter();
  const toast = useToastContext();
  const { addPendingToast } = useToastStore();
  const [site, setSite] = useState<Site | null>(initialSite);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [orphanedHosts, setOrphanedHosts] = useState<string[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: site?.name || '',
    location: site?.location || '',
    timezone: site?.timezone || 'America/New_York'
  });

  useEffect(() => {
    if (site) {
      setFormData({
        name: site.name,
        location: site.location,
        timezone: site.timezone
      });
    }
  }, [site]);

  const siteControllers = controllers.filter(controller => 
    site?.controllers.includes(controller.id)
  );

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

  const handleDeleteClick = async () => {
    if (!site) return;
    
    // Check for orphaned hosts
    try {
      const response = await fetch(`/api/sites/${site.id}/orphaned-hosts`);
      const data = await response.json();
      
      if (data.success) {
        setOrphanedHosts(data.hosts || []);
        setShowDeleteModal(true);
      } else {
        toast.error('Erro ao verificar hosts associados');
      }
    } catch (err: any) {
      toast.error('Erro de rede', err.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!site) return;
    
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
        setShowDeleteModal(false);
      }
    } catch (err: any) {
      toast.error('Erro de rede', err.message);
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!site) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Site not found - silently redirect or show minimal message */}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="border-b border-gray-200 pb-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center mb-2">
                <Link
                  href="/sites"
                  className="mr-4 text-gray-400 hover:text-gray-600"
                >
                  <ArrowLeft className="h-6 w-6" />
                </Link>
                <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
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
                    className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
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
                    className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
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
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Informações do Site
                </h3>
                
                <form className="space-y-6">
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                        Site Name
                      </label>
                      {isEditing ? (
                        <div className="relative">
                          <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="block w-full px-4 py-3 text-sm border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            placeholder="Enter site name"
                            required
                          />
                        </div>
                      ) : (
                        <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <p className="text-sm font-medium text-gray-900">{site.name}</p>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
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
                            className="block w-full px-4 py-3 text-sm border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            placeholder="City, State/Country"
                            required
                          />
                        </div>
                      ) : (
                        <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <p className="text-sm font-medium text-gray-900">{site.location}</p>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
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
                        <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <p className="text-sm font-medium text-gray-900">{site.timezone}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* Controllers */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  <Monitor className="h-5 w-5 inline mr-2" />
                  Associated Controllers ({siteControllers.length})
                </h3>
                
                {siteControllers.length === 0 ? (
                  <div className="text-center py-6">
                    <Monitor className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No controllers</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      This site has no associated controllers.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {siteControllers.map((controller) => (
                      <div key={controller.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">{controller.name}</h4>
                            <p className="text-sm text-gray-500">{controller.localNetwork}</p>
                            <p className="text-xs text-gray-400">Version {controller.version}</p>
                          </div>
                          <div className="flex items-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              controller.status === 'online' 
                                ? 'bg-green-100 text-green-800'
                                : controller.status === 'offline'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {controller.status === 'online' ? 'Online' : 
                               controller.status === 'offline' ? 'Offline' : 'Erro'}
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
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                General Information
              </h3>
              
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      site.status === 'online' 
                        ? 'bg-green-100 text-green-800'
                        : site.status === 'offline'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {site.status === 'online' ? 'Online' : 
                       site.status === 'offline' ? 'Offline' : 'Erro'}
                    </span>
                  </dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-500">Site ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">{site.id}</dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created At</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(site.createdAt).toLocaleDateString('pt-BR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900">
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

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        site={site}
        orphanedHosts={orphanedHosts}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteModal(false)}
        isDeleting={isDeleting}
      />
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  try {
    const siteId = params?.id as string;
    
    if (!siteId) {
      return {
        notFound: true,
      };
    }
    
    const [sitesData, controllersData] = await Promise.all([
      getSites(),
      getControllers()
    ]);
    
    const site = sitesData.sites.find(s => s.id === siteId);
    
    if (!site) {
      return {
        notFound: true,
      };
    }
    
    return {
      props: {
        site,
        controllers: controllersData.controllers,
      },
    };
  } catch (error) {
    console.error('Error fetching site:', error);
    
    return {
      props: {
        site: null,
        controllers: [],
      },
    };
  }
};

export default SiteDetailsPage;