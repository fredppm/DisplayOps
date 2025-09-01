import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { HostsList } from '@/components/HostsList';
import { DashboardManager } from '@/components/DashboardManager';
import { AuthorizationManager } from '@/components/AuthorizationManager';
import { ExtensionDropdown } from '@/components/ExtensionDropdown';
// WebSocketStatus removed - using SSE now
// WebSocket manager removed - using SSE aggregator now
import { useSSEHostDiscovery } from '@/hooks/useSSEHostDiscovery';

// Removed client-side discovery imports - now using API
import { MiniPC } from '@/types/shared-types';

type TabType = 'hosts' | 'authorization' | 'dashboards';

interface TabPageProps {
  tab: TabType;
}

export default function TabPage({ tab }: TabPageProps) {
  const router = useRouter();
  
  // Use SSE host discovery
  const {
    discoveredHosts,
    isConnected: isDiscoveryConnected,
    isDiscovering,
    lastUpdate,
    connectionError,
    reconnectAttempts,
    requestHostsUpdate
  } = useSSEHostDiscovery();
  
  // WebSocket manager removed - using SSE for real-time updates

  // Function to navigate to a specific tab
  const navigateToTab = (newTab: TabType) => {
    router.push(`/${newTab}`);
  };

  // Log only important errors
  useEffect(() => {
    if (connectionError) {
      console.error('Host discovery error:', connectionError);
    }
  }, [connectionError]);

  const getPageTitle = (tab: TabType) => {
    switch (tab) {
      case 'hosts': return 'Host Agents - Office Display Management';
      case 'authorization': return 'Authorization - Office Display Management';
      case 'dashboards': return 'Dashboards - Office Display Management';
      default: return 'Office Display Management System';
    }
  };

  const getOverallSystemHealth = () => {
    const onlineHosts = discoveredHosts.filter(h => h.metrics.online).length;
    const totalHosts = discoveredHosts.length;
    
    return {
      totalHosts,
      onlineHosts,
      offlineHosts: totalHosts - onlineHosts,
      healthPercentage: totalHosts > 0 ? (onlineHosts / totalHosts) * 100 : 0
    };
  };

  const systemHealth = getOverallSystemHealth();

  return (
    <>
      <Head>
        <title>{getPageTitle(tab)}</title>
        <meta name="description" content="Centralized management for office display devices" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <h1 className="text-3xl font-bold text-gray-900">
                  Office Display Management
                </h1>
              </div>
              
              <div className="flex items-center space-x-6">
                {/* System Health Summary */}
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-gray-600">{systemHealth.totalHosts} Total</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-gray-600">{systemHealth.onlineHosts} Online</span>
                  </div>
                  {systemHealth.offlineHosts > 0 && (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span className="text-gray-600">{systemHealth.offlineHosts} Offline</span>
                    </div>
                  )}
                  <div className="text-gray-500">|
                    Health: {systemHealth.healthPercentage.toFixed(0)}%
                  </div>
                </div>
                
                {/* Extension Dropdown */}
                <ExtensionDropdown />
                
                {/* Discovery Status */}
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isDiscovering ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
                  <span className="text-sm text-gray-600">
                    {isDiscovering ? 'Discovering...' : 'Connected'}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex space-x-8">
              <button
                onClick={() => navigateToTab('hosts')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  tab === 'hosts'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Host Agents
              </button>
              <button
                onClick={() => navigateToTab('authorization')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  tab === 'authorization'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Authorization
              </button>
              <button
                onClick={() => navigateToTab('dashboards')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  tab === 'dashboards'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Dashboards
              </button>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {tab === 'hosts' && (
              <HostsList 
                hosts={discoveredHosts}
                isDiscovering={isDiscovering}
                discoveryStatus={{
                  isConnected: isDiscoveryConnected,
                  lastUpdate,
                  connectionError,
                  reconnectAttempts
                }}
              />
            )}
            
            {tab === 'authorization' && (
              <AuthorizationManager 
                hosts={discoveredHosts}
              />
            )}
            
            {tab === 'dashboards' && (
              <DashboardManager />
            )}
          </div>
        </main>
      </div>
      

    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { tab } = context.params!;
  const validTabs: TabType[] = ['hosts', 'authorization', 'dashboards'];
  
  // Check if tab is valid
  if (!tab || typeof tab !== 'string' || !validTabs.includes(tab as TabType)) {
    return {
      redirect: {
        destination: '/hosts',
        permanent: false,
      },
    };
  }

  return {
    props: {
      tab: tab as TabType,
    },
  };
};
