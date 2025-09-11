import React, { useState, useEffect, useRef } from 'react';
import { DashboardManager } from '@/components/DashboardManager';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import { Dashboard } from '@/types/shared-types';
import { Plus } from 'lucide-react';

export default function DashboardsPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchDashboards();
    }
  }, []);

  const fetchDashboards = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboards');
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setDashboards(result.data);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboards:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header with Actions */}
          <div className="pb-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center mb-2">
                  <h1 className="text-2xl font-bold leading-7 text-gray-900 dark:text-gray-100 sm:truncate sm:text-3xl sm:tracking-tight">
                    Dashboard Management
                  </h1>
                  <span className="ml-3 inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/20 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-600/20 dark:ring-blue-400/20">
                    {loading ? '...' : `${dashboards.length} ${dashboards.length === 1 ? 'dashboard' : 'dashboards'}`}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                  Configure and deploy dashboards to display devices across your organization
                </p>
              </div>
              <div className="ml-6 flex flex-shrink-0">
                <Link
                  href="/dashboards/new"
                  className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
                >
                  <Plus className="-ml-0.5 mr-1.5 h-4 w-4" />
                  Add Dashboard
                </Link>
              </div>
            </div>
          </div>
          
          <DashboardManager initialDashboards={dashboards} hideHeader={true} />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

