import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { HostsList } from '@/components/HostsList';
import { DashboardManager } from '@/components/DashboardManager';
import { SystemStatus } from '@/components/SystemStatus';
import { DiscoveryService } from '@/lib/discovery-service';
import { MiniPC } from '@/types/types';

export default function Home() {
  const [discoveredHosts, setDiscoveredHosts] = useState<MiniPC[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [activeTab, setActiveTab] = useState<'hosts' | 'dashboards' | 'status'>('hosts');

  useEffect(() => {
    // Initialize discovery service
    const discoveryService = new DiscoveryService();
    
    const startDiscovery = async () => {
      setIsDiscovering(true);
      try {
        await discoveryService.startDiscovery();
        
        // Listen for discovered hosts
        discoveryService.onHostDiscovered((host) => {
          setDiscoveredHosts(prev => {
            const existingIndex = prev.findIndex(h => h.id === host.id);
            if (existingIndex >= 0) {
              // Update existing host
              const updated = [...prev];
              updated[existingIndex] = host;
              return updated;
            } else {
              // Add new host
              return [...prev, host];
            }
          });
        });

        // Listen for host removal
        discoveryService.onHostRemoved((hostId) => {
          setDiscoveredHosts(prev => prev.filter(h => h.id !== hostId));
        });

      } catch (error) {
        console.error('Failed to start discovery:', error);
      } finally {
        setIsDiscovering(false);
      }
    };

    startDiscovery();

    return () => {
      discoveryService.stopDiscovery();
    };
  }, []);

  return (
    <>
      <Head>
        <title>Office TV Management System</title>
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
                  Phase 1
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
                onClick={() => setActiveTab('hosts')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'hosts'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Host Agents
              </button>
              <button
                onClick={() => setActiveTab('dashboards')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'dashboards'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Dashboards
              </button>
              <button
                onClick={() => setActiveTab('status')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'status'
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
            {activeTab === 'hosts' && (
              <HostsList 
                hosts={discoveredHosts}
                isDiscovering={isDiscovering}
              />
            )}
            
            {activeTab === 'dashboards' && (
              <DashboardManager 
                hosts={discoveredHosts}
              />
            )}
            
            {activeTab === 'status' && (
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
