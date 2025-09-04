import React, { useState, useEffect, useRef } from 'react';
import { AuthorizationManager } from '@/components/AuthorizationManager';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { MiniPC } from '@/types/shared-types';

export default function CookiesPage() {
  const [hosts, setHosts] = useState<MiniPC[]>([]);
  const [loading, setLoading] = useState(true);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchHosts();
    }
  }, []);

  const fetchHosts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/discovery/hosts');
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setHosts(result.data);
        }
      }
    } catch (error) {
      console.error('Error fetching hosts:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="pb-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center mb-2">
                  <h1 className="text-2xl font-bold leading-7 text-gray-900 dark:text-gray-100 sm:truncate sm:text-3xl sm:tracking-tight">
                    Cookie Management
                  </h1>
                  <span className="ml-3 inline-flex items-center rounded-full bg-green-50 dark:bg-green-900/20 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20 dark:ring-green-400/20">
                    {loading ? '...' : `${hosts.length} ${hosts.length === 1 ? 'host' : 'hosts'}`}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                  Import and manage authentication cookies for automatic login on display devices
                </p>
              </div>
            </div>
          </div>
          
          <AuthorizationManager hosts={hosts} />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

