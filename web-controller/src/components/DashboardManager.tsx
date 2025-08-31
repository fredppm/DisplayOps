import React, { useState, useEffect } from 'react';
import { MiniPC, Dashboard } from '@/types/shared-types';
import { 
  Plus, 
  Monitor, 
  ExternalLink, 
  Settings, 
  Play, 
  Pause,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X,
  Loader,
  Edit3,
  Trash2,
  Save,
  XCircle
} from 'lucide-react';

interface DashboardManagerProps {
  hosts: MiniPC[];
}

export const DashboardManager: React.FC<DashboardManagerProps> = ({ hosts }) => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([
    {
      id: 'common-dashboard',
      name: 'Common Dashboard', 
      url: 'https://grafana.vtex.com/d/d7e7051f-42a2-4798-af93-cf2023dd2e28/home?orgId=1&from=now-3h&to=now&timezone=browser&var-Origin=argocd&refresh=10s',
      description: 'Common dashboard for all systems',
      refreshInterval: 300,
      requiresAuth: true,
      category: 'Monitoring'
    },
    {
      id: 'health-monitor',
      name: 'Health Monitor',
      url: 'https://healthmonitor.vtex.com/',
      description: 'Health monitor for all systems',
      refreshInterval: 600,
      requiresAuth: true,
      category: 'Business Intelligence'
    }
  ]);

  const [selectedDashboard, setSelectedDashboard] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, { hostId: string, displayId: string, dashboardId: string }>>({});
  const [realTimeAssignments, setRealTimeAssignments] = useState<Record<string, { hostId: string, displayId: string, dashboardId: string, url: string, isActive: boolean }>>({});
  
  // Loading and notification states
  const [loadingDeployments, setLoadingDeployments] = useState<Set<string>>(new Set());
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

  // 🚀 MIGRATED: Sync assignments using real-time gRPC/SSE data instead of HTTP polling
  const syncAssignmentsFromHosts = async () => {
    console.log('🔄 Syncing dashboard assignments from real-time gRPC data...');
    const newRealTimeAssignments: Record<string, { hostId: string, displayId: string, dashboardId: string, url: string, isActive: boolean }> = {};
    
    for (const host of hosts) {
      if (!host.status.online) continue;
      
      try {
        // 🚀 Use displays from real-time gRPC/SSE data (no HTTP fetch needed!)
        console.log(`📺 Processing host ${host.id} with ${host.displays?.length || 0} displays from gRPC`);
        
        if (host.displays && host.displays.length > 0) {
          // Process each display from the gRPC data
          for (const displayId of host.displays) {
            try {
              // Only need to fetch assignment info if not available in host object
              // For now, make a targeted request for just this display's assignment
              const response = await fetch(`/api/host/${host.id}/displays/${displayId}/assignment`);
              if (response.ok) {
                const result = await response.json();
                if (result.success && result.data?.assignedDashboard) {
                  const assignmentKey = `${host.id}-${displayId}`;
                  newRealTimeAssignments[assignmentKey] = {
                    hostId: host.id,
                    displayId,
                    dashboardId: result.data.assignedDashboard.dashboardId,
                    url: result.data.assignedDashboard.url,
                    isActive: result.data.isActive || false
                  };
                }
              }
            } catch (error) {
              console.debug(`Could not get assignment for display ${displayId}:`, error);
              // Continue processing other displays
            }
          }
        } else {
          console.debug(`📺 Host ${host.id}: No displays available from gRPC data yet`);
        }
      } catch (error) {
        console.error(`Error syncing assignments from host ${host.id}:`, error);
      }
    }
    
    setRealTimeAssignments(newRealTimeAssignments);
    
    // Also update the local assignments to match reality
    const syncedAssignments: Record<string, { hostId: string, displayId: string, dashboardId: string }> = {};
    Object.entries(newRealTimeAssignments).forEach(([key, assignment]) => {
      syncedAssignments[key] = {
        hostId: assignment.hostId,
        displayId: assignment.displayId,
        dashboardId: assignment.dashboardId
      };
    });
    setAssignments(syncedAssignments);
  };

  // 🚀 NEW: Auto-sync when hosts change (real-time gRPC updates)
  useEffect(() => {
    console.log('📡 Hosts updated from gRPC/SSE, auto-syncing dashboard assignments...');
    syncAssignmentsFromHosts();
  }, [hosts]); // React to real-time host changes

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

  const saveDashboardChanges = () => {
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

    // Update dashboard in the list
    setDashboards(prev => prev.map(d => 
      d.id === editingDashboard ? { ...editForm } : d
    ));

    addNotification('success', 'Dashboard Updated', `${editForm.name} has been updated successfully`);
    
    setEditingDashboard(null);
    setEditForm(null);
  };

  const deleteDashboard = (dashboard: Dashboard) => {
    // Check if dashboard is currently assigned to any display
    const isAssigned = Object.values(assignments).some(assignment => 
      assignment.dashboardId === dashboard.id
    );

    if (isAssigned) {
      addNotification('warning', 'Cannot Delete Dashboard', 
        `${dashboard.name} is currently assigned to one or more displays. Remove assignments first.`);
      return;
    }

    setDashboards(prev => prev.filter(d => d.id !== dashboard.id));
    addNotification('success', 'Dashboard Deleted', `${dashboard.name} has been removed`);
  };

  const addNewDashboard = () => {
    const newDashboard: Dashboard = {
      id: `dashboard-${Date.now()}`,
      name: 'New Dashboard',
      url: 'https://example.com',
      description: 'New dashboard description',
      refreshInterval: 300,
      requiresAuth: false,
      category: 'Custom'
    };

    setDashboards(prev => [...prev, newDashboard]);
    startEditingDashboard(newDashboard);
    addNotification('success', 'Dashboard Created', 'New dashboard created. Configure it now.');
  };

  const handleDeployDashboard = async (dashboardId: string, hostId: string, displayId: string) => {
    const dashboard = dashboards.find(d => d.id === dashboardId);
    const host = hosts.find(h => h.id === hostId);
    
    if (!dashboard || !host) {
      addNotification('error', 'Deployment Failed', 'Dashboard or host not found');
      return;
    }

    const deploymentKey = `${hostId}-${displayId}`;
    
    // Set loading state
    setLoadingDeployments(prev => new Set([...prev, deploymentKey]));

    try {

      
      // ✅ Validate URL via web-controller API
      addNotification('info', 'Validating URL', `Checking ${dashboard.name} accessibility...`);
      
      try {
        const validateResponse = await fetch(`/api/host/${host.id}/validate-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: dashboard.url,
            timeout: 10000
          })
        });

        if (validateResponse.ok) {
          const validateResult = await validateResponse.json();
          
          if (!validateResult.success) {
            addNotification('error', 'URL Validation Failed', validateResult.error || 'Unknown validation error');
            return;
          }

          const validation = validateResult.validate_url_result;
          if (!validation?.is_valid) {
            addNotification('warning', 'URL Not Reachable', 
              `The URL ${dashboard.name} is not reachable: ${validation?.error || 'Connection failed'}`);
            // Continue anyway - the user might want to deploy it
          }
        }
      } catch (error) {
        // If validation fails, log but continue - URL might still work
        console.warn(`URL validation failed for ${dashboard.name}:`, error);
        addNotification('warning', 'Validation Unavailable', 'Could not validate URL, but continuing deployment...');
      }

      // ✅ Deploy dashboard via web-controller API (which uses gRPC)
      addNotification('info', 'Deploying Dashboard', `Opening ${dashboard.name} on ${displayId.replace('display-', 'Display ')}...`);
      
      const response = await fetch(`/api/host/${host.id}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'open_dashboard',
          targetDisplay: displayId,
          payload: {
            dashboardId: dashboard.id,
            url: dashboard.url,
            monitorIndex: parseInt(displayId.replace('display-', '')) - 1,
            fullscreen: true,
            refreshInterval: dashboard.refreshInterval ? dashboard.refreshInterval * 1000 : 300000
          },
          timestamp: new Date()
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          // Update assignments
          const assignmentKey = `${hostId}-${displayId}`;
          setAssignments(prev => ({
            ...prev,
            [assignmentKey]: { hostId, displayId, dashboardId }
          }));
          
          addNotification('success', 'Dashboard Deployed Successfully', 
            `${dashboard.name} is now displaying on ${host.hostname} - ${displayId.replace('display-', 'Display ')}`);
        } else {
          addNotification('error', 'Deployment Failed', 
            result.error || 'Unknown error occurred during deployment');
        }
      } else {
        const errorData = await response.json();
        addNotification('error', 'Deployment Request Failed', errorData.error || `HTTP ${response.status}`);
      }
    } catch (error: any) {
      let errorMessage = 'Unknown error occurred';
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = `Cannot connect to web controller API`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      addNotification('error', 'Connection Error', errorMessage);

    } finally {
      // Remove loading state
      setLoadingDeployments(prev => {
        const newSet = new Set(prev);
        newSet.delete(deploymentKey);
        return newSet;
      });
    }
  };

  const handleRefreshDashboard = async (hostId: string, displayId: string) => {
    const host = hosts.find(h => h.id === hostId);
    if (!host) {
      addNotification('error', 'Refresh Failed', 'Host not found');
      return;
    }

    const assignmentKey = `${hostId}-${displayId}`;
    const assignment = assignments[assignmentKey];
    const dashboardName = assignment ? 
      dashboards.find(d => d.id === assignment.dashboardId)?.name || 'Dashboard' : 
      'Dashboard';

    try {
      addNotification('info', 'Refreshing Dashboard', `Refreshing ${dashboardName} on ${displayId.replace('display-', 'Display ')}...`);
      
      // ✅ Refresh display via web-controller API (which uses gRPC)
      const response = await fetch(`/api/host/${host.id}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'refresh_page',
          targetDisplay: displayId,
          timestamp: new Date()
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          addNotification('success', 'Dashboard Refreshed', 
            `${dashboardName} has been refreshed on ${host.hostname} - ${displayId.replace('display-', 'Display ')}`);
        } else {
          addNotification('error', 'Refresh Failed', 
            result.error || 'Unknown error occurred during refresh');
        }
      } else {
        const errorData = await response.json();
        addNotification('error', 'Refresh Request Failed', errorData.error || `HTTP ${response.status}`);
      }
    } catch (error: any) {
      let errorMessage = 'Unknown error occurred';
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = `Cannot connect to web controller API`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      addNotification('error', 'Connection Error', errorMessage);

    }
  };

  // ❌ REMOVED: HTTP polling replaced with real-time gRPC/SSE events
  // The useEffect above now handles real-time sync automatically

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dashboards List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Available Dashboards</h3>
          
          {dashboards.map((dashboard) => (
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
                        deleteDashboard(dashboard);
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
          ))}
        </div>

        {/* Display Assignment Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Display Assignments</h3>
            <button
              onClick={syncAssignmentsFromHosts}
              className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Sync assignments from hosts"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Status
            </button>
          </div>
          
          {hosts.length === 0 ? (
            <div className="card text-center py-8">
              <Monitor className="w-8 h-8 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No hosts available for assignment</p>
            </div>
          ) : (
            hosts.map((host) => (
              <div key={host.id} className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <Monitor className="w-6 h-6 text-primary-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">{host.hostname}</h4>
                      <p className="text-sm text-gray-500">{host.ipAddress}</p>
                    </div>
                  </div>
                  
                  <span className={host.status.online ? 'status-online' : 'status-offline'}>
                    {host.status.online ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className="space-y-3">
                  {host.displays.map((displayId) => {
                    const assignmentKey = `${host.id}-${displayId}`;
                    const assignment = assignments[assignmentKey];
                    const realTimeAssignment = realTimeAssignments[assignmentKey];
                    const assignedDashboard = assignment 
                      ? dashboards.find(d => d.id === assignment.dashboardId)
                      : null;

                    return (
                      <div 
                        key={displayId}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded mr-3 ${
                            realTimeAssignment?.isActive 
                              ? 'bg-green-500' 
                              : assignedDashboard 
                                ? 'bg-yellow-500' 
                                : 'bg-gray-400'
                          }`}></div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {displayId.replace('display-', 'Display ')}
                            </div>
                            {assignedDashboard && (
                              <div className="text-sm text-gray-600">
                                {assignedDashboard.name}
                                {realTimeAssignment && (
                                  <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                                    realTimeAssignment.isActive 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {realTimeAssignment.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {/* Dashboard Selection */}
                          <div className="relative">
                            <select
                              value={assignment?.dashboardId || ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleDeployDashboard(e.target.value, host.id, displayId);
                                }
                              }}
                              className="text-sm border border-gray-300 rounded px-2 py-1 pr-8"
                              disabled={!host.status.online || loadingDeployments.has(`${host.id}-${displayId}`)}
                            >
                              <option value="">Select dashboard...</option>
                              {dashboards.map((dashboard) => (
                                <option key={dashboard.id} value={dashboard.id}>
                                  {dashboard.name}
                                </option>
                              ))}
                            </select>
                            
                            {/* Loading indicator */}
                            {loadingDeployments.has(`${host.id}-${displayId}`) && (
                              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                <Loader className="w-3 h-3 animate-spin text-gray-500" />
                              </div>
                            )}
                          </div>

                          {/* Control Buttons */}
                          {assignment && (
                            <>
                              <button
                                onClick={() => handleRefreshDashboard(host.id, displayId)}
                                className="p-1 text-gray-500 hover:text-gray-700"
                                title="Refresh dashboard"
                                disabled={!host.status.online}
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
