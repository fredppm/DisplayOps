import React, { useState, useEffect } from 'react';
import { Dashboard } from '@/types/shared-types';
import { createContextLogger } from '@/utils/logger';
import { 
  Plus, 
  ExternalLink, 
  AlertCircle,
  CheckCircle,
  X,
  Edit3,
  Trash2,
  Save,
  XCircle
} from 'lucide-react';

interface DashboardManagerProps {}

const dashboardManagerLogger = createContextLogger('dashboard-manager');

export const DashboardManager: React.FC<DashboardManagerProps> = () => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDashboard, setSelectedDashboard] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp: Date;
  }>>([]);

  // Dashboard editing states
  const [editingDashboard, setEditingDashboard] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Dashboard | null>(null);
  
  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string>('');

  // Helper function to add notifications
  const addNotification = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    const notification = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title,
      message,
      timestamp: new Date()
    };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]); // Keep only 5 most recent
    
    // Auto-remove after 8 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 8000);
  };

  // Helper function to remove notification
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // API functions
  const fetchDashboards = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboards');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch dashboards');
      }
      
      setDashboards(result.data);
    } catch (error: any) {
      dashboardManagerLogger.error('Error fetching dashboards', { error: error instanceof Error ? error.message : String(error) });
      addNotification('error', 'Load Error', error.message || 'Failed to load dashboards');
    } finally {
      setLoading(false);
    }
  };

  const createDashboard = async (dashboardData: Omit<Dashboard, 'id'>) => {
    try {
      const response = await fetch('/api/dashboards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dashboardData),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create dashboard');
      }
      
      setDashboards(prev => [...prev, result.data]);
      addNotification('success', 'Dashboard Created', `${result.data.name} has been created`);
      return result.data;
    } catch (error: any) {
      dashboardManagerLogger.error('Error creating dashboard', { error: error instanceof Error ? error.message : String(error) });
      addNotification('error', 'Creation Error', error.message || 'Failed to create dashboard');
      throw error;
    }
  };

  const updateDashboard = async (id: string, dashboardData: Omit<Dashboard, 'id'>) => {
    try {
      const response = await fetch(`/api/dashboards/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dashboardData),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update dashboard');
      }
      
      setDashboards(prev => prev.map(d => d.id === id ? result.data : d));
      addNotification('success', 'Dashboard Updated', `${result.data.name} has been updated`);
      return result.data;
    } catch (error: any) {
      dashboardManagerLogger.error('Error updating dashboard', { error: error instanceof Error ? error.message : String(error) });
      addNotification('error', 'Update Error', error.message || 'Failed to update dashboard');
      throw error;
    }
  };

  const deleteDashboard = async (id: string) => {
    try {
      const response = await fetch(`/api/dashboards/${id}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete dashboard');
      }
      
      setDashboards(prev => prev.filter(d => d.id !== id));
      addNotification('success', 'Dashboard Deleted', `${result.data.name} has been removed`);
      return result.data;
    } catch (error: any) {
      dashboardManagerLogger.error('Error deleting dashboard', { error: error instanceof Error ? error.message : String(error) });
      addNotification('error', 'Deletion Error', error.message || 'Failed to delete dashboard');
      throw error;
    }
  };

  // Load dashboards on component mount
  useEffect(() => {
    fetchDashboards();
  }, []);


  // Dashboard management functions
  const startEditingDashboard = (dashboard: Dashboard) => {
    setEditingDashboard(dashboard.id);
    setEditForm({ ...dashboard });
    setShowEditModal(true);
  };

  const cancelEditingDashboard = () => {
    setEditingDashboard(null);
    setEditForm(null);
    setShowEditModal(false);
  };

  const saveDashboardChanges = async () => {
    if (!editForm) return;

    // Validate required fields
    if (!editForm.name.trim()) {
      addNotification('error', 'Validation Error', 'Dashboard name is required');
      return;
    }

    if (!editForm.url.trim()) {
      addNotification('error', 'Validation Error', 'Dashboard URL is required');
      return;
    }

    // Validate URL format
    try {
      new URL(editForm.url);
    } catch {
      addNotification('error', 'Validation Error', 'Invalid URL format');
      return;
    }

    const dashboardData = {
      name: editForm.name,
      url: editForm.url,
      description: editForm.description || '',
      refreshInterval: editForm.refreshInterval,
      requiresAuth: editForm.requiresAuth,
      category: editForm.category
    };

    try {
      if (editingDashboard) {
        // Editando dashboard existente
        await updateDashboard(editingDashboard, dashboardData);
      } else {
        // Criando novo dashboard
        await createDashboard(dashboardData);
      }
      
      setEditingDashboard(null);
      setEditForm(null);
      setShowEditModal(false);
    } catch (error) {
      // Error handling is done in create/updateDashboard functions
    }
  };

  const confirmDeleteDashboard = (dashboardId: string) => {
    setShowDeleteConfirm(dashboardId);
  };

  const handleDeleteDashboard = async (dashboardId: string) => {
    try {
      await deleteDashboard(dashboardId);
      setShowDeleteConfirm('');
    } catch (error) {
      // Error handling is done in deleteDashboard function
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

  const addNewDashboard = () => {
    setEditingDashboard(null); // Indica que é criação, não edição
    setEditForm({
      id: '', // Será definido pelo servidor
      name: 'New Dashboard',
      url: 'https://example.com',
      description: 'New dashboard description',
      refreshInterval: 300,
      requiresAuth: false,
      category: 'Custom'
    });
    setShowEditModal(true);
  };


  return (
    <div className="space-y-6">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-lg shadow-lg p-4 border-l-4 bg-white dark:bg-gray-800 ${
                notification.type === 'success' ? 'border-green-500' :
                notification.type === 'error' ? 'border-red-500' :
                notification.type === 'warning' ? 'border-yellow-500' :
                'border-blue-500'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className={`mt-0.5 ${
                    notification.type === 'success' ? 'text-green-500' :
                    notification.type === 'error' ? 'text-red-500' :
                    notification.type === 'warning' ? 'text-yellow-500' :
                    'text-blue-500'
                  }`}>
                    {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
                    {notification.type === 'error' && <AlertCircle className="w-5 h-5" />}
                    {notification.type === 'warning' && <AlertCircle className="w-5 h-5" />}
                    {notification.type === 'info' && <AlertCircle className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {notification.title}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {notification.message}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="text-gray-400 hover:text-gray-600 ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dashboard Management Card */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Dashboard Management
              </h2>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Configure and deploy dashboards to display devices
              </div>
            </div>
            
            <div className="ml-6 flex items-center space-x-3">
              <button
                onClick={addNewDashboard}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={loading}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Dashboards List */}
        <div className="divide-y divide-gray-200 dark:divide-gray-600">
          {loading ? (
            // Loading skeletons - show 3 placeholder items
            Array.from({ length: 3 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="px-6 py-6 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <div className="h-5 bg-gray-300 rounded w-48"></div>
                      <div className="h-4 w-4 bg-gray-200 rounded"></div>
                    </div>
                    <div className="mt-1 space-y-1">
                      <div className="h-3 bg-gray-200 rounded w-64"></div>
                      <div className="flex items-center space-x-4">
                        <div className="h-3 bg-gray-200 rounded w-20"></div>
                        <div className="h-3 bg-gray-200 rounded w-16"></div>
                      </div>
                    </div>
                  </div>
                  <div className="ml-6 flex items-center space-x-2">
                    <div className="h-6 bg-gray-200 rounded w-12"></div>
                    <div className="h-6 bg-gray-200 rounded w-14"></div>
                  </div>
                </div>
              </div>
            ))
          ) : dashboards.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <div className="w-12 h-12 text-gray-400 mx-auto mb-4">
                <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No dashboards configured yet</h3>
              <p className="text-gray-600">
                Use the &quot;Add Dashboard&quot; button above to create your first dashboard
              </p>
            </div>
          ) : (
            dashboards.map((dashboard) => (
            <div
              key={dashboard.id} 
              className={`px-6 py-6 ${
                selectedDashboard === dashboard.id ? 'bg-gray-50 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              } cursor-pointer transition-colors`}
              onClick={() => setSelectedDashboard(
                selectedDashboard === dashboard.id ? null : dashboard.id
              )}
            >
              {/* View Mode */}
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {dashboard.name}
                      </h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(dashboard.url, '_blank');
                        }}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Description with statistics */}
                    <div className="flex items-center text-gray-400 dark:text-gray-500">
                      {dashboard.description && (
                        <span className="truncate max-w-xs">
                          {dashboard.description}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Refresh: {dashboard.refreshInterval}s
                      </span>
                      
                      {dashboard.category && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                          {dashboard.category}
                        </span>
                      )}
                      
                      {dashboard.requiresAuth && (
                        <span className="flex items-center text-yellow-600 dark:text-yellow-400">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          Requires Auth
                        </span>
                      )}
                      
                    </div>
                  </div>
                  
                  {/* Dashboard Actions - Smaller buttons */}
                  <div className="ml-6 flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditingDashboard(dashboard);
                      }}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <Edit3 className="w-3 h-3 mr-1" />
                      Edit
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmDeleteDashboard(dashboard.id);
                      }}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded hover:bg-red-100 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              {/* Expanded Details */}
              {selectedDashboard === dashboard.id && (
                <div className="mt-4">
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">URL</span>
                      <div className="text-sm text-gray-400 font-mono">
                        {dashboard.url}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Dashboard Modal */}
      {showEditModal && editForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{margin: 0, top: 0}}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editingDashboard ? 'Edit Dashboard' : 'Add New Dashboard'}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev!, name: e.target.value }))}
                  className="w-full p-2 border rounded"
                  placeholder="Dashboard name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL *</label>
                <input
                  type="url"
                  value={editForm.url}
                  onChange={(e) => setEditForm(prev => ({ ...prev!, url: e.target.value }))}
                  className="w-full p-2 border rounded font-mono"
                  placeholder="https://example.com/dashboard"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev!, description: e.target.value }))}
                  className="w-full p-2 border rounded"
                  placeholder="Dashboard description"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Refresh Interval (seconds)</label>
                  <input
                    type="number"
                    min="30"
                    max="3600"
                    value={editForm.refreshInterval}
                    onChange={(e) => setEditForm(prev => ({ ...prev!, refreshInterval: parseInt(e.target.value) || 300 }))}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm(prev => ({ ...prev!, category: e.target.value }))}
                    className="w-full p-2 border rounded"
                  >
                    <option value="Custom">Custom</option>
                    <option value="Analytics">Analytics</option>
                    <option value="Monitoring">Monitoring</option>
                    <option value="Business">Business</option>
                    <option value="Development">Development</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center p-2 border dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                  <input
                    type="checkbox"
                    checked={editForm.requiresAuth}
                    onChange={(e) => setEditForm(prev => ({ ...prev!, requiresAuth: e.target.checked }))}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2 text-yellow-600" />
                      Requires Authentication
                    </div>
                    <div className="text-xs text-gray-600">Dashboard needs login credentials to display properly</div>
                  </div>
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                <button 
                  onClick={cancelEditingDashboard}
                  className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded flex items-center transition-colors"
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  Cancel
                </button>
                <button 
                  onClick={saveDashboardChanges}
                  disabled={!editForm.name || !editForm.url || !isValidUrl(editForm.url)}
                  className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-3 h-3 mr-1" />
                  {editingDashboard ? 'Save Dashboard' : 'Create Dashboard'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{margin: 0, top: 0}}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-red-600">⚠️ Delete Dashboard</h3>
            
            <p className="text-gray-700 mb-4">
              Are you sure you want to delete <strong>{dashboards.find(d => d.id === showDeleteConfirm)?.name}</strong>?
            </p>
            
            <p className="text-sm text-gray-600 mb-6">
              This action cannot be undone.
            </p>
            
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowDeleteConfirm('')}
                className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded flex items-center transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteDashboard(showDeleteConfirm)}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded flex items-center transition-colors"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
