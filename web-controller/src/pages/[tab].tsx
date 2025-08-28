import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { HostsList } from '@/components/HostsList';
import { DashboardManager } from '@/components/DashboardManager';
import { AuthorizationManager } from '@/components/AuthorizationManager';
import { SystemStatus } from '@/components/SystemStatus';

// Removed client-side discovery imports - now using API
import { MiniPC } from '@/types/types';

type TabType = 'hosts' | 'dashboards' | 'authorization' | 'status';

interface TabPageProps {
  tab: TabType;
}

export default function TabPage({ tab }: TabPageProps) {
  const router = useRouter();
  const [discoveredHosts, setDiscoveredHosts] = useState<MiniPC[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Function to navigate to a specific tab
  const navigateToTab = (newTab: TabType) => {
    router.push(`/${newTab}`);
  };

  useEffect(() => {
    const loadHosts = async () => {
      setIsDiscovering(true);
      
      try {
        console.log('🔄 Loading hosts from API...');
        
        // Use the discovery API instead of client-side discovery
        const response = await fetch('/api/discovery/hosts');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setDiscoveredHosts(result.data || []);
            console.log('✅ Loaded', result.data?.length || 0, 'hosts from API');
          } else {
            console.error('❌ API error:', result.error);
            setDiscoveredHosts([]);
          }
        } else {
          console.error('❌ HTTP error:', response.status);
          setDiscoveredHosts([]);
        }
      } catch (error) {
        console.error('❌ Failed to load hosts:', error);
        setDiscoveredHosts([]);
      } finally {
        setIsDiscovering(false);
      }
    };

    // Initial load
    loadHosts();
    
    // Refresh hosts every 30 seconds
    const interval = setInterval(loadHosts, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getPageTitle = (tab: TabType) => {
    switch (tab) {
      case 'hosts': return 'Host Agents - Office TV Management';
      case 'dashboards': return 'Dashboards - Office TV Management';
      case 'authorization': return 'Authorization - Office TV Management';
      case 'status': return 'System Status - Office TV Management';
      default: return 'Office TV Management System';
    }
  };

  return (
    <>
      <Head>
        <title>{getPageTitle(tab)}</title>
        <meta name="description" content="Centralized management for office TV displays" />
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
                  Office TV Management
                </h1>
                <span className="ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                  Phase 3
                </span>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isDiscovering ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
                  <span className="text-sm text-gray-600">
                    {isDiscovering ? 'Discovering...' : `${discoveredHosts.length} hosts found`}
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
                onClick={() => navigateToTab('dashboards')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  tab === 'dashboards'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Dashboards
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
                onClick={() => navigateToTab('status')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  tab === 'status'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                System Status
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
              />
            )}
            
            {tab === 'dashboards' && (
              <DashboardManager 
                hosts={discoveredHosts}
              />
            )}
            
            {tab === 'authorization' && (
              <AuthorizationManager 
                hosts={discoveredHosts}
              />
            )}
            
            {tab === 'status' && (
              <SystemStatus 
                hosts={discoveredHosts}
              />
            )}
          </div>
        </main>
      </div>
      

    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { tab } = context.params!;
  const validTabs: TabType[] = ['hosts', 'dashboards', 'authorization', 'status'];
  
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
