import React, { useState } from 'react';
import { MiniPC, Dashboard } from '@/types/types';
import { 
  Plus, 
  Monitor, 
  ExternalLink, 
  Settings, 
  Play, 
  Pause,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  X,
  Loader
} from 'lucide-react';

interface DashboardManagerProps {
  hosts: MiniPC[];
}

export const DashboardManager: React.FC<DashboardManagerProps> = ({ hosts }) => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([
    {
      id: 'grafana-main',
      name: 'Grafana Main Dashboard', 
      url: 'https://grafana.company.com/d/main',
      description: 'Main system monitoring dashboard',
      refreshInterval: 300,
      requiresAuth: true,
      category: 'Monitoring'
    },
    {
      id: 'tableau-sales',
      name: 'Sales Dashboard',
      url: 'https://tableau.company.com/sales',
      description: 'Sales performance metrics',
      refreshInterval: 600,
      requiresAuth: true,
      category: 'Business Intelligence'
    }
  ]);

  const [selectedDashboard, setSelectedDashboard] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, { hostId: string, tvId: string, dashboardId: string }>>({});
  
  // Loading and notification states
  const [loadingDeployments, setLoadingDeployments] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp: Date;
  }>>([]);

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

  const handleDeployDashboard = async (dashboardId: string, hostId: string, tvId: string) => {
    const dashboard = dashboards.find(d => d.id === dashboardId);
    const host = hosts.find(h => h.id === hostId);
    
    if (!dashboard || !host) {
      addNotification('error', 'Deployment Failed', 'Dashboard or host not found');
      return;
    }

    const deploymentKey = `${hostId}-${tvId}`;
    
    // Set loading state
    setLoadingDeployments(prev => new Set([...prev, deploymentKey]));

    try {
      console.log(`Deploying ${dashboard.name} to ${host.name} - ${tvId}`);
      
      // First validate the URL
      addNotification('info', 'Validating URL', `Checking ${dashboard.name} accessibility...`);
      
      const validateResponse = await fetch(`http://${host.ipAddress}:${host.port}/api/validate-url`, {
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

        const validation = validateResult.data?.validation;
        if (!validation?.isReachable) {
          addNotification('warning', 'URL Not Reachable', 
            `The URL ${dashboard.name} is not reachable: ${validation?.error || 'Connection failed'}`);
          // Continue anyway - the user might want to deploy it
        }
      }

      // Deploy the dashboard
      addNotification('info', 'Deploying Dashboard', `Opening ${dashboard.name} on ${tvId.replace('display-', 'TV ')}...`);
      
      const response = await fetch(`http://${host.ipAddress}:${host.port}/api/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'open_dashboard',
          targetTv: tvId,
          payload: {
            dashboardId: dashboard.id,
            url: dashboard.url,
            monitorIndex: parseInt(tvId.replace('display-', '')) - 1,
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
          const assignmentKey = `${hostId}-${tvId}`;
          setAssignments(prev => ({
            ...prev,
            [assignmentKey]: { hostId, tvId, dashboardId }
          }));
          
          addNotification('success', 'Dashboard Deployed Successfully', 
            `${dashboard.name} is now displaying on ${host.name} - ${tvId.replace('display-', 'TV ')}`);
        } else {
          addNotification('error', 'Deployment Failed', 
            result.error || 'Unknown error occurred during deployment');
        }
      } else {
        // Try to get error details from response
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Ignore JSON parsing errors
        }
        
        addNotification('error', 'Deployment Request Failed', errorMessage);
      }
    } catch (error: any) {
      let errorMessage = 'Unknown error occurred';
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = `Cannot connect to host ${host.name} (${host.ipAddress}:${host.port})`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      addNotification('error', 'Connection Error', errorMessage);
      console.error('Error deploying dashboard:', error);
    } finally {
      // Remove loading state
      setLoadingDeployments(prev => {
        const newSet = new Set(prev);
        newSet.delete(deploymentKey);
        return newSet;
      });
    }
  };

  const handleRefreshDashboard = async (hostId: string, tvId: string) => {
    const host = hosts.find(h => h.id === hostId);
    if (!host) {
      addNotification('error', 'Refresh Failed', 'Host not found');
      return;
    }

    const assignmentKey = `${hostId}-${tvId}`;
    const assignment = assignments[assignmentKey];
    const dashboardName = assignment ? 
      dashboards.find(d => d.id === assignment.dashboardId)?.name || 'Dashboard' : 
      'Dashboard';

    try {
      addNotification('info', 'Refreshing Dashboard', `Refreshing ${dashboardName} on ${tvId.replace('display-', 'TV ')}...`);
      
      const response = await fetch(`http://${host.ipAddress}:${host.port}/api/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'refresh_page',
          targetTv: tvId,
          timestamp: new Date()
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          addNotification('success', 'Dashboard Refreshed', 
            `${dashboardName} has been refreshed on ${host.name} - ${tvId.replace('display-', 'TV ')}`);
        } else {
          addNotification('error', 'Refresh Failed', 
            result.error || 'Unknown error occurred during refresh');
        }
      } else {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Ignore JSON parsing errors
        }
        
        addNotification('error', 'Refresh Request Failed', errorMessage);
      }
    } catch (error: any) {
      let errorMessage = 'Unknown error occurred';
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = `Cannot connect to host ${host.name} (${host.ipAddress}:${host.port})`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      addNotification('error', 'Connection Error', errorMessage);
      console.error('Error refreshing dashboard:', error);
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
            Configure and deploy dashboards to TV displays
          </p>
        </div>
        
        <button
          onClick={() => setShowAddForm(true)}
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
              className={`card hover:shadow-md transition-shadow cursor-pointer ${
                selectedDashboard === dashboard.id ? 'ring-2 ring-primary-500' : ''
              }`}
              onClick={() => setSelectedDashboard(
                selectedDashboard === dashboard.id ? null : dashboard.id
              )}
            >
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
                  {dashboard.requiresAuth && (
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                  )}
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center space-x-4">
                  <span>Refresh: {dashboard.refreshInterval}s</span>
                  {dashboard.category && (
                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                      {dashboard.category}
                    </span>
                  )}
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(dashboard.url, '_blank');
                  }}
                  className="text-primary-600 hover:text-primary-700"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>

              {/* Expanded Details */}
              {selectedDashboard === dashboard.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">URL</span>
                      <div className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                        {dashboard.url}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* TV Assignment Grid */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">TV Assignments</h3>
          
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
                      <h4 className="font-medium text-gray-900">{host.name}</h4>
                      <p className="text-sm text-gray-500">{host.ipAddress}</p>
                    </div>
                  </div>
                  
                  <span className={host.status.online ? 'status-online' : 'status-offline'}>
                    {host.status.online ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className="space-y-3">
                  {host.tvs.map((tvId) => {
                    const assignmentKey = `${host.id}-${tvId}`;
                    const assignment = assignments[assignmentKey];
                    const assignedDashboard = assignment 
                      ? dashboards.find(d => d.id === assignment.dashboardId)
                      : null;

                    return (
                      <div 
                        key={tvId}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-gray-400 rounded mr-3"></div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {tvId.replace('display-', 'TV ')}
                            </div>
                            {assignedDashboard && (
                              <div className="text-sm text-gray-600">
                                {assignedDashboard.name}
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
                                  handleDeployDashboard(e.target.value, host.id, tvId);
                                }
                              }}
                              className="text-sm border border-gray-300 rounded px-2 py-1 pr-8"
                              disabled={!host.status.online || loadingDeployments.has(`${host.id}-${tvId}`)}
                            >
                              <option value="">Select dashboard...</option>
                              {dashboards.map((dashboard) => (
                                <option key={dashboard.id} value={dashboard.id}>
                                  {dashboard.name}
                                </option>
                              ))}
                            </select>
                            
                            {/* Loading indicator */}
                            {loadingDeployments.has(`${host.id}-${tvId}`) && (
                              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                <Loader className="w-3 h-3 animate-spin text-gray-500" />
                              </div>
                            )}
                          </div>

                          {/* Control Buttons */}
                          {assignment && (
                            <>
                              <button
                                onClick={() => handleRefreshDashboard(host.id, tvId)}
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
