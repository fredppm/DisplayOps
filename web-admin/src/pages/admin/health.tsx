import React from 'react';
import { NextPage } from 'next';
import Link from 'next/link';
import Layout from '@/components/Layout';
import SyncStatusCard from '@/components/SyncStatusCard';

const HealthPage: NextPage = () => {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto p-4">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Health</h1>
          <Link 
            href="/admin" 
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            Back to Admin
          </Link>
        </div>
        
        {/* Sync Status Dashboard - Main Feature */}
        <div className="mb-8">
          <SyncStatusCard />
        </div>
        
        {/* Legacy System Health Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-600">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 text-green-600 dark:text-green-400">Web Admin</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Status:</span>
                <span className="text-green-600 dark:text-green-400 font-semibold">Online</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Uptime:</span>
                <span className="text-gray-900 dark:text-gray-100">Running</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Version:</span>
                <span className="text-gray-900 dark:text-gray-100">1.0.0</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-600">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 text-orange-600">Controllers</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Total:</span>
                <span className="text-gray-900 dark:text-gray-100">3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Online:</span>
                <span className="text-red-600 dark:text-red-400">0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Offline:</span>
                <span className="text-gray-600">3</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-600">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 text-blue-600">Sites</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Total:</span>
                <span className="text-gray-900 dark:text-gray-100">2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Active:</span>
                <span className="text-gray-900 dark:text-gray-100">2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Issues:</span>
                <span className="text-red-600 dark:text-red-400">0</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-600">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Activity</h2>
          <div className="space-y-3">
            <div className="flex items-center space-x-3 py-2 border-b">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <div className="flex-1">
                <span className="text-sm text-gray-600">System initialized</span>
                <div className="text-xs text-gray-400">Just now</div>
              </div>
            </div>
            <div className="text-gray-500 text-sm py-4 text-center">
              No recent activity
            </div>
          </div>
        </div>
        </div>
      </div>
    </Layout>
  );
};

export default HealthPage;