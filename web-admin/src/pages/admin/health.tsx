import React from 'react';
import { NextPage } from 'next';
import Link from 'next/link';
import Layout from '@/components/Layout';

const HealthPage: NextPage = () => {
  return (
    <Layout>
      <div className="container mx-auto p-4">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">System Health</h1>
          <Link 
            href="/admin" 
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            Back to Admin
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-green-600">Web Admin</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="text-green-600 font-semibold">Online</span>
              </div>
              <div className="flex justify-between">
                <span>Uptime:</span>
                <span>Running</span>
              </div>
              <div className="flex justify-between">
                <span>Version:</span>
                <span>1.0.0</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-orange-600">Controllers</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total:</span>
                <span>3</span>
              </div>
              <div className="flex justify-between">
                <span>Online:</span>
                <span className="text-red-600">0</span>
              </div>
              <div className="flex justify-between">
                <span>Offline:</span>
                <span className="text-gray-600">3</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-blue-600">Sites</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total:</span>
                <span>2</span>
              </div>
              <div className="flex justify-between">
                <span>Active:</span>
                <span>2</span>
              </div>
              <div className="flex justify-between">
                <span>Issues:</span>
                <span className="text-red-600">0</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
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
    </Layout>
  );
};

export default HealthPage;