import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
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
import { NotificationProvider } from '@/contexts/NotificationContext';
import { GlobalNotifications } from '@/components/GlobalNotifications';
import ThemeToggle from '@/components/ThemeToggle';

type TabType = 'hosts' | 'authorization' | 'dashboards';

interface TabPageProps {
  tab: TabType;
}

export default function TabPage({ tab }: TabPageProps) {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Use SSE host discovery
  const {
    discoveredHosts,
    isConnected: isDiscoveryConnected,
    isDiscovering,
    lastUpdate,
    connectionError,
    reconnectAttempts,
    requestHostsUpdate,
    updateHostOptimistic
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

  // Handle page unload to notify backend when dashboard is closed
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable delivery during page unload
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/dashboard-closed', JSON.stringify({}));
      } else {
        // Fallback for older browsers - use synchronous request
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/dashboard-closed', false); // synchronous
        xhr.setRequestHeader('Content-Type', 'application/json');
        try {
          xhr.send(JSON.stringify({}));
        } catch (error) {
          console.warn('Failed to send dashboard closure notification:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const getPageTitle = (tab: TabType) => {
    switch (tab) {
      case 'hosts': return 'Host Agents - DisplayOps Management';
      case 'authorization': return 'Authorization - DisplayOps Management';
      case 'dashboards': return 'Dashboards - DisplayOps Management';
      default: return 'DisplayOps Management System';
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

  const getStatusLogo = () => {
    if (connectionError) return '/logo-error.png';
    if (isDiscovering) return '/logo-idle.png';
    if (systemHealth.totalHosts === 0) return '/logo-idle.png';
    if (systemHealth.healthPercentage === 100) return '/logo-synced.png';
    return '/logo-ready.png';
  };

  return (
    <NotificationProvider>
      <Head>
        <title>{getPageTitle(tab)}</title>
        <meta name="description" content="Centralized management for DisplayOps display devices" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <GlobalNotifications />

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo */}
              <div className="flex items-center">
                <Image 
                  src={getStatusLogo()} 
                  alt="DisplayOps" 
                  width={32}
                  height={32}
                  className="w-8 h-8 mr-3"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== '/favicon.ico') {
                      target.src = '/favicon.ico';
                    }
                  }}
                />
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">DisplayOps</span>
              </div>
              
              {/* Navigation Menu */}
              <nav className="hidden md:flex space-x-8">
                <button
                  onClick={() => navigateToTab('hosts')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    tab === 'hosts'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Host Agents
                </button>
                <button
                  onClick={() => navigateToTab('authorization')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    tab === 'authorization'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Authorization
                </button>
                <button
                  onClick={() => navigateToTab('dashboards')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    tab === 'dashboards'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Dashboards
                </button>
              </nav>
              
              {/* Right Side Actions */}
              <div className="flex items-center space-x-4">
                {/* System Health with Icon */}
                <div className="flex items-center space-x-2 text-sm">
                  <div className="relative">
                    <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${systemHealth.healthPercentage > 80 ? 'bg-green-500' : systemHealth.healthPercentage > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                  </div>
                  <span className="text-gray-600 dark:text-gray-400 font-medium">{systemHealth.onlineHosts}/{systemHealth.totalHosts}</span>
                </div>
                
                <ThemeToggle />
                
                <ExtensionDropdown />
                
                {/* Mobile menu button */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isMobileMenuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden">
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    navigateToTab('hosts');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`block px-3 py-2 rounded-md text-base font-medium w-full text-left transition-colors ${
                    tab === 'hosts'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Host Agents
                </button>
                <button
                  onClick={() => {
                    navigateToTab('authorization');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`block px-3 py-2 rounded-md text-base font-medium w-full text-left transition-colors ${
                    tab === 'authorization'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Authorization
                </button>
                <button
                  onClick={() => {
                    navigateToTab('dashboards');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`block px-3 py-2 rounded-md text-base font-medium w-full text-left transition-colors ${
                    tab === 'dashboards'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Dashboards
                </button>
              </div>
            </div>
          )}
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
                onUpdateHostOptimistic={updateHostOptimistic}
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
    </NotificationProvider>
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
