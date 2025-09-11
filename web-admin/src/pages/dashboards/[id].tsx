import { useState, useEffect, useRef } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  Monitor, 
  CheckCircle,
  XCircle,
  Globe,
  AlertCircle,
  AlertTriangle
} from 'lucide-react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Dashboard } from '@/types/shared-types';
import { useToastContext } from '@/contexts/ToastContext';
import { useToastStore } from '@/stores/toastStore';

const DashboardDetailsPage: NextPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const toast = useToastContext();
  const { addPendingToast } = useToastStore();
  
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
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
    url: '',
    description: '',
    refreshInterval: 300,
    category: 'Custom',
    requiresAuth: false
  });

  useEffect(() => {
    if (id && typeof id === 'string' && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchDashboard();
    }
  }, [id]);

  const fetchDashboard = async () => {
    if (!id || typeof id !== 'string') return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboards/${id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Dashboard not found');
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch dashboard');
      }
      
      const dashboardData = result.data;
      setDashboard(dashboardData);
      
      // Set form data
      setFormData({
        name: dashboardData.name || '',
        url: dashboardData.url || '',
        description: dashboardData.description || '',
        refreshInterval: dashboardData.refreshInterval || 300,
        category: dashboardData.category || 'Custom',
        requiresAuth: dashboardData.requiresAuth || false
      });
      
    } catch (err: any) {
      console.error('Error fetching dashboard:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.url.trim()) {
      toast.error('Dashboard name and URL are required');
      return;
    }

    if (!isValidUrl(formData.url)) {
      toast.error('Please enter a valid URL starting with http:// or https://');
      return;
    }
    
    try {
      setIsSaving(true);
      
      const response = await fetch(`/api/dashboards/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update dashboard');
      }
      
      // Update local state
      setDashboard(result.data);
      setIsEditing(false);
      
      // Add pending toast that will show on dashboards page
      addPendingToast({
        type: 'success',
        message: `${formData.name} has been updated successfully`
      });
      
      // Navigate back to dashboards list
      router.push('/dashboards');
      
    } catch (err: any) {
      console.error('Error updating dashboard:', err);
      toast.error(err.message || 'Failed to update dashboard');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      
      const response = await fetch(`/api/dashboards/${id}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete dashboard');
      }
      
      // Add pending toast that will show on dashboards page
      addPendingToast({
        type: 'success',
        message: `${dashboard?.name} has been deleted successfully`
      });
      
      // Navigate back to dashboards list
      router.push('/dashboards');
      
    } catch (err: any) {
      console.error('Error deleting dashboard:', err);
      toast.error(err.message || 'Failed to delete dashboard');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Simple URL validation function
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch {
      return false;
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetForm = () => {
    if (dashboard) {
      setFormData({
        name: dashboard.name || '',
        url: dashboard.url || '',
        description: dashboard.description || '',
        refreshInterval: dashboard.refreshInterval || 300,
        category: dashboard.category || 'Custom',
        requiresAuth: dashboard.requiresAuth || false
      });
    }
    setIsEditing(false);
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Loading Skeleton */}
            <div className="animate-pulse">
              <div className="flex items-center mb-6">
                <div className="w-6 h-6 bg-gray-200 rounded mr-3"></div>
                <div className="h-8 bg-gray-200 rounded w-48"></div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <div className="flex items-center">
                <XCircle className="h-6 w-6 text-red-500 mr-2" />
                <h3 className="text-lg font-medium text-red-800 dark:text-red-300">Error Loading Dashboard</h3>
              </div>
              <p className="mt-2 text-red-700 dark:text-red-400">{error}</p>
              <div className="mt-4">
                <Link
                  href="/dashboards"
                  className="inline-flex items-center px-4 py-2 bg-red-100 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-700 text-red-700 dark:text-red-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboards
                </Link>
              </div>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!dashboard) {
    return null;
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <div className="flex items-center mb-6">
            <Link
              href="/dashboards"
              className="flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboards
            </Link>
          </div>

          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center">
                  <Monitor className="w-8 h-8 text-gray-400 mr-3" />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {dashboard.name}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Dashboard Configuration
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-3">
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Edit Dashboard
                  </button>
                )}
                
                <button
                  onClick={() => setShowDeleteModal(true)}
                  disabled={isDeleting}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            {isEditing ? (
              /* Edit Form */
              <form onSubmit={handleSave} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dashboard Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                    placeholder="Enter dashboard name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dashboard URL *
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="url"
                      value={formData.url}
                      onChange={(e) => handleInputChange('url', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="https://example.com/dashboard"
                    />
                  </div>
                  {formData.url && !isValidUrl(formData.url) && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      Please enter a valid URL starting with http:// or https://
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                    placeholder="Optional description"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Refresh Interval (seconds)
                    </label>
                    <select
                      value={formData.refreshInterval}
                      onChange={(e) => handleInputChange('refreshInterval', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                    >
                      <option value={60}>1 minute</option>
                      <option value={300}>5 minutes</option>
                      <option value={600}>10 minutes</option>
                      <option value={1800}>30 minutes</option>
                      <option value={3600}>1 hour</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                    >
                      <option value="Custom">Custom</option>
                      <option value="Analytics">Analytics</option>
                      <option value="Monitoring">Monitoring</option>
                      <option value="Business">Business</option>
                      <option value="Marketing">Marketing</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="requiresAuth"
                    checked={formData.requiresAuth}
                    onChange={(e) => handleInputChange('requiresAuth', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                  />
                  <label htmlFor="requiresAuth" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Requires Authentication (cookies)
                  </label>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!formData.name || !formData.url || !isValidUrl(formData.url) || isSaving}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              /* View Mode */
              <div className="p-6 space-y-6">
                <div className="space-y-6 max-w-2xl">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Dashboard Name
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">{dashboard.name}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Dashboard URL
                    </label>
                    <a 
                      href={dashboard.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 break-all"
                    >
                      {dashboard.url}
                    </a>
                  </div>

                  {dashboard.description && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Description
                      </label>
                      <p className="text-gray-900 dark:text-gray-100">{dashboard.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Category
                      </label>
                      <p className="text-gray-900 dark:text-gray-100">{dashboard.category}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Refresh Interval
                      </label>
                      <p className="text-gray-900 dark:text-gray-100">
                        {(dashboard.refreshInterval || 300) >= 3600 
                          ? `${(dashboard.refreshInterval || 300) / 3600} hour${(dashboard.refreshInterval || 300) > 3600 ? 's' : ''}` 
                          : (dashboard.refreshInterval || 300) >= 60 
                          ? `${(dashboard.refreshInterval || 300) / 60} minute${(dashboard.refreshInterval || 300) > 60 ? 's' : ''}` 
                          : `${dashboard.refreshInterval || 300} second${(dashboard.refreshInterval || 300) !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Authentication Required
                    </label>
                    <div className="flex items-center">
                      {dashboard.requiresAuth ? (
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-400 mr-2" />
                      )}
                      <p className="text-gray-900 dark:text-gray-100">
                        {dashboard.requiresAuth ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dashboard Preview */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                    Dashboard Preview
                  </label>
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    <iframe
                      src={dashboard.url}
                      className="w-full h-96"
                      title="Dashboard Preview"
                      sandbox="allow-same-origin allow-scripts"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Delete Confirmation Modal */}
          <ConfirmDialog
            isOpen={showDeleteModal}
            title="Delete Dashboard"
            message={`Are you sure you want to delete "${dashboard.name}"? This action cannot be undone.`}
            confirmText="Delete Dashboard"
            cancelText="Cancel"
            variant="danger"
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteModal(false)}
          />
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default DashboardDetailsPage;