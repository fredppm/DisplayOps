import React from 'react';
import { NextPage } from 'next';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import SyncStatusCard from '@/components/SyncStatusCard';
import { useAdminStatus } from '@/contexts/AdminStatusContext';

// Componente interno que usa os hooks do AdminStatusProvider
const HealthPageContent: React.FC = () => {
  const { status: healthStatus, isConnected, error, reconnect } = useAdminStatus();

  const getStatusColor = (isRunning: boolean, isConnected?: boolean) => {
    if (isRunning) return 'text-green-600 dark:text-green-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getConnectionStatusColor = (count: number) => {
    if (count > 0) return 'text-green-600 dark:text-green-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  return (
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
        
        {/* Real-time System Health Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-600">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 text-green-600 dark:text-green-400">Web Admin</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Status:</span>
                <span className="text-green-600 dark:text-green-400 font-semibold">Online</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">SSE:</span>
                <span className={`font-semibold ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Version:</span>
                <span className="text-gray-900 dark:text-gray-100">1.0.0</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 text-blue-600">WebSocket Service</h2>
              <div className={`w-3 h-3 rounded-full ${healthStatus?.websocket.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Status:</span>
                <span className={`font-semibold ${getStatusColor(healthStatus?.websocket.isRunning || false)}`}>
                  {healthStatus?.websocket.isRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Port:</span>
                <span className="text-gray-900 dark:text-gray-100">3001</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Connections:</span>
                <span className={`font-semibold ${getConnectionStatusColor(healthStatus?.websocket.connections || 0)}`}>
                  {healthStatus?.websocket.connections || 0}
                </span>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-600">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 text-orange-600">Controllers</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Total:</span>
                <span className="text-gray-900 dark:text-gray-100">{healthStatus?.controllers.total || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Online:</span>
                <span className={`font-semibold ${getConnectionStatusColor(healthStatus?.controllers.online || 0)}`}>
                  {healthStatus?.controllers.online || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Connected:</span>
                <span className={`font-semibold ${getConnectionStatusColor(healthStatus?.controllers.online || 0)}`}>
                  {healthStatus?.controllers.online || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-900 dark:text-gray-100">Offline:</span>
                <span className="text-gray-600">{(healthStatus?.controllers.total || 0) - (healthStatus?.controllers.online || 0)}</span>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Real-time Status</h2>
            {error && (
              <button
                onClick={reconnect}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
              >
                Reconnect
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {healthStatus && (
              <div className="flex items-center space-x-3 py-2 border-b border-gray-200 dark:border-gray-600">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div className="flex-1">
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    Last update received
                  </span>
                  <div className="text-xs text-gray-500">
                    {new Date().toLocaleString()}
                  </div>
                </div>
              </div>
            )}
            
            {isConnected && (
              <div className="flex items-center space-x-3 py-2 border-b border-gray-200 dark:border-gray-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    Real-time monitoring active
                  </span>
                  <div className="text-xs text-gray-500">
                    Updates every 3 seconds
                  </div>
                </div>
              </div>
            )}
            
            {error && (
              <div className="flex items-center space-x-3 py-2 border-b border-gray-200 dark:border-gray-600">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <div className="flex-1">
                  <span className="text-sm text-red-600 dark:text-red-400">
                    Connection error: {error}
                  </span>
                  <div className="text-xs text-gray-500">
                    Click reconnect to retry
                  </div>
                </div>
              </div>
            )}
            
            {!healthStatus && !error && (
              <div className="flex items-center space-x-3 py-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Connecting to real-time status...
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
  );
};

// Componente principal que envolve o conteúdo com AdminLayout e Provider
const HealthPage: NextPage = () => {
  return (
    <AdminLayout>
      <HealthPageContent />
    </AdminLayout>
  );
};

export default HealthPage;