import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Loader, 
  AlertCircle,
  LayoutDashboard
} from 'lucide-react';
import { useDashboards } from '@/hooks/useDashboards';

interface DashboardSelectorModalProps {
  isOpen: boolean;
  hostId: string | null;
  displayId: string | null;
  onClose: () => void;
  onSelectDashboard: (dashboardId: string, hostId: string, displayId: string) => Promise<void>;
}

export const DashboardSelectorModal: React.FC<DashboardSelectorModalProps> = ({
  isOpen,
  hostId,
  displayId,
  onClose,
  onSelectDashboard
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const { dashboards, loading: dashboardsLoading, error: dashboardsError } = useDashboards();

  // Filter dashboards based on search query
  const filteredDashboards = dashboards.filter(dashboard => 
    dashboard.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dashboard.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset search when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setIsDeploying(false);
    }
  }, [isOpen]);

  // Handle dashboard selection
  const handleDashboardSelection = async (dashboardId: string) => {
    if (!hostId || !displayId || isDeploying) return;
    
    setIsDeploying(true);
    try {
      await onSelectDashboard(dashboardId, hostId, displayId);
      onClose();
    } catch (error) {
      console.error('Failed to deploy dashboard:', error);
    } finally {
      setIsDeploying(false);
    }
  };

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isDeploying) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isDeploying, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-modal p-4" style={{ margin: 0 }}>
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Select Dashboard</h2>
          <button
            onClick={onClose}
            disabled={isDeploying}
            className="text-gray-400 hover:text-gray-600 p-1 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="mb-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search dashboards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
              disabled={isDeploying}
            />
          </div>
        </div>

        {/* Dashboard List */}
        <div className="flex-1 overflow-y-auto mb-4">
          {dashboardsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">Loading dashboards...</span>
            </div>
          ) : dashboardsError ? (
            <div className="text-center py-8 text-red-600">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p>Failed to load dashboards</p>
            </div>
          ) : filteredDashboards.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2" />
              <p>{searchQuery ? 'No dashboards found' : 'No dashboards available'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDashboards.map((dashboard) => (
                <button
                  key={dashboard.id}
                  onClick={() => handleDashboardSelection(dashboard.id)}
                  disabled={isDeploying}
                  className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                        {dashboard.name}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {dashboard.category && (
                          <span className="inline-flex items-center">
                            <LayoutDashboard className="w-3 h-3 mr-1" />
                            {dashboard.category}
                          </span>
                        )}
                      </div>
                      {dashboard.url && (
                        <div className="text-xs text-gray-400 mt-1">
                          {dashboard.url}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
          {isDeploying && (
            <div className="flex items-center text-blue-600">
              <Loader className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm">Deploying dashboard...</span>
            </div>
          )}
          <div className="flex justify-end gap-3 ml-auto">
            <button
              onClick={onClose}
              disabled={isDeploying}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};