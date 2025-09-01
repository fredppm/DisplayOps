import React, { useState, useEffect } from 'react';
import { Dashboard } from '@/types/shared-types';
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
      console.error('Error fetching dashboards:', error);
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
      console.error('Error creating dashboard:', error);
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
      console.error('Error updating dashboard:', error);
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
      console.error('Error deleting dashboard:', error);
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
    addNotification('info', 'Editing Dashboard', `Started editing ${dashboard.name}`);
  };

  const cancelEditingDashboard = () => {
    setEditingDashboard(null);
    setEditForm(null);
    addNotification('info', 'Edit Cancelled', 'Dashboard editing cancelled');
  };

  const saveDashboardChanges = async () => {
    if (!editForm || !editingDashboard) return;

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

    try {
      await updateDashboard(editingDashboard, {
        name: editForm.name,
        url: editForm.url,
        description: editForm.description || '',
        refreshInterval: editForm.refreshInterval,
        requiresAuth: editForm.requiresAuth,
        category: editForm.category
      });
      
      setEditingDashboard(null);
      setEditForm(null);
    } catch (error) {
      // Error handling is done in updateDashboard function
    }
  };

  const handleDeleteDashboard = async (dashboard: Dashboard) => {
    if (!confirm(`Are you sure you want to delete "${dashboard.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDashboard(dashboard.id);
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

  const addNewDashboard = async () => {
    const newDashboardData = {
      name: 'New Dashboard',
      url: 'https://example.com',
      description: 'New dashboard description',
      refreshInterval: 300,
      requiresAuth: false,
      category: 'Custom'
    };

    try {
      const newDashboard = await createDashboard(newDashboardData);
      startEditingDashboard(newDashboard);
    } catch (error) {
      // Error handling is done in createDashboard function
    }
  };


  return (
    <div className="space-y-6">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-lg shadow-lg p-4 border-l-4 bg-white ${
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
                    <h4 className="text-sm font-medium text-gray-900">
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard Management</h2>
          <p className="text-gray-600 mt-1">
            Configure and deploy dashboards to display devices
          </p>
        </div>
        
        <button
          onClick={addNewDashboard}
          className="btn-primary flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Dashboard
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Dashboards List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Available Dashboards</h3>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-2 text-gray-600">Loading dashboards...</span>
            </div>
          ) : dashboards.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg">No dashboards configured</p>
              <p className="text-sm">Click "Add Dashboard" to create your first dashboard</p>
            </div>
          ) : (
            dashboards.map((dashboard) => (
            <div
              key={dashboard.id}
              className={`card hover:shadow-md transition-shadow ${
                editingDashboard === dashboard.id ? 'ring-2 ring-blue-500' :
                selectedDashboard === dashboard.id ? 'ring-2 ring-primary-500' : ''
              } ${editingDashboard === dashboard.id ? '' : 'cursor-pointer'}`}
              onClick={editingDashboard === dashboard.id ? undefined : () => setSelectedDashboard(
                selectedDashboard === dashboard.id ? null : dashboard.id
              )}
            >
              {editingDashboard === dashboard.id && editForm ? (
                // Edit Mode
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-medium text-blue-900">Editing Dashboard</h4>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={saveDashboardChanges}
                        className="btn-primary flex items-center text-sm px-3 py-1"
                      >
                        <Save className="w-4 h-4 mr-1" />
                        Save
                      </button>
                      <button
                        onClick={cancelEditingDashboard}
                        className="btn-secondary flex items-center text-sm px-3 py-1"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Cancel
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, name: e.target.value } : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Dashboard name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                      <input
                        type="url"
                        value={editForm.url}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, url: e.target.value } : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="https://example.com/dashboard"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, description: e.target.value } : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        rows={2}
                        placeholder="Dashboard description"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Refresh Interval (sec)</label>
                        <input
                          type="number"
                          value={editForm.refreshInterval}
                          onChange={(e) => setEditForm(prev => prev ? { ...prev, refreshInterval: parseInt(e.target.value) || 300 } : null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          min="30"
                          max="3600"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select
                          value={editForm.category || ''}
                          onChange={(e) => setEditForm(prev => prev ? { ...prev, category: e.target.value } : null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="">No category</option>
                          <option value="Monitoring">Monitoring</option>
                          <option value="Business Intelligence">Business Intelligence</option>
                          <option value="Analytics">Analytics</option>
                          <option value="Custom">Custom</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`requires-auth-${dashboard.id}`}
                        checked={editForm.requiresAuth}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, requiresAuth: e.target.checked } : null)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`requires-auth-${dashboard.id}`} className="ml-2 block text-sm text-gray-900">
                        Requires Authentication
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-gray-900">
                      {dashboard.name}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {dashboard.description}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditingDashboard(dashboard);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit dashboard"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDashboard(dashboard);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete dashboard"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {dashboard.requiresAuth && (
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(dashboard.url, '_blank');
                      }}
                      className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                      title="Open dashboard"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {editingDashboard !== dashboard.id && (
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center space-x-4">
                    <span>Refresh: {dashboard.refreshInterval}s</span>
                    {dashboard.category && (
                      <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                        {dashboard.category}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Expanded Details */}
              {selectedDashboard === dashboard.id && editingDashboard !== dashboard.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">URL</span>
                      <div className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                        {dashboard.url}
                      </div>
                    </div>
                    {dashboard.category && (
                      <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wide">Category</span>
                        <div className="text-sm text-gray-900">
                          {dashboard.category}
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Authentication</span>
                      <div className="text-sm text-gray-900">
                        {dashboard.requiresAuth ? 'Required' : 'Not required'}
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
    </div>
  );
};
