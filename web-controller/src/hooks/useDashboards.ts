import { useState, useEffect } from 'react';
import { Dashboard } from '@/types/shared-types';
import { dashboardService } from '@/services/dashboardService';
import { createContextLogger } from '@/utils/logger';

const dashboardsLogger = createContextLogger('use-dashboards');

export const useDashboards = () => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboards = async (force = false) => {
    try {
      setLoading(true);
      setError(null);
      const fetchedDashboards = await dashboardService.fetchDashboards(force);
      setDashboards(fetchedDashboards);
    } catch (err) {
      setError('Failed to load dashboards');
      dashboardsLogger.error('Error loading dashboards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboards();
  }, []);

  const addDashboard = (dashboard: Dashboard) => {
    setDashboards(prev => [...prev, dashboard]);
  };

  const updateDashboard = (id: string, updates: Partial<Dashboard>) => {
    setDashboards(prev => prev.map(d => 
      d.id === id ? { ...d, ...updates } : d
    ));
  };

  const removeDashboard = (id: string) => {
    setDashboards(prev => prev.filter(d => d.id !== id));
  };

  return {
    dashboards,
    loading,
    error,
    fetchDashboards,
    addDashboard,
    updateDashboard,
    removeDashboard
  };
};