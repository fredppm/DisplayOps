import React from 'react';
import { NextPage, GetServerSideProps } from 'next';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { getSystemStats, SystemStatsProps } from '@/lib/api-server';

interface AdminPageProps {
  systemStats: SystemStatsProps;
}

const AdminPage: NextPage<AdminPageProps> = ({ systemStats }) => {
  return (
    <Layout>
      <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      
      <div className="mb-8 bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Stats</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-700">{systemStats.totalUsers}</div>
            <div className="text-sm text-gray-600">Total Users</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-700">{systemStats.totalSites}</div>
            <div className="text-sm text-gray-600">Active Sites</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-700">{systemStats.totalControllers}</div>
            <div className="text-sm text-gray-600">Controllers</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${
              systemStats.systemStatus === 'Online' ? 'text-green-600' : 
              systemStats.systemStatus === 'Offline' ? 'text-red-600' : 
              'text-yellow-600'
            }`}>
              {systemStats.systemStatus}
            </div>
            <div className="text-sm text-gray-600">System Status</div>
          </div>
        </div>
        <div className="text-xs text-gray-400 mt-4 text-center">
          Last updated: {new Date(systemStats.timestamp).toLocaleString()}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Users</h2>
          <p className="text-gray-600 mb-4">Manage user accounts and permissions</p>
          <Link 
            href="/admin/users" 
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded block text-center transition-colors"
          >
            Manage Users
          </Link>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Sites</h2>
          <p className="text-gray-600 mb-4">Manage all sites in the organization</p>
          <Link 
            href="/sites" 
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded block text-center transition-colors"
          >
            Manage Sites
          </Link>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Controllers</h2>
          <p className="text-gray-600 mb-4">Manage local controllers for each site</p>
          <Link 
            href="/controllers" 
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded block text-center transition-colors"
          >
            Manage Controllers
          </Link>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">System Health</h2>
          <p className="text-gray-600 mb-4">Monitor system-wide health metrics</p>
          <Link 
            href="/admin/health" 
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded block text-center transition-colors"
          >
            View Health
          </Link>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Metrics</h2>
          <p className="text-gray-600 mb-4">View system performance metrics</p>
          <Link 
            href="/admin/metrics" 
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded block text-center transition-colors"
          >
            View Metrics
          </Link>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Alerts</h2>
          <p className="text-gray-600 mb-4">Manage system alerts and notifications</p>
          <Link 
            href="/admin/alerts" 
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded block text-center transition-colors"
          >
            Manage Alerts
          </Link>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Monitoring</h2>
          <p className="text-gray-600 mb-4">Comprehensive monitoring dashboard</p>
          <Link 
            href="/admin/monitoring" 
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded block text-center transition-colors"
          >
            View Dashboard
          </Link>
        </div>
      </div>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    const systemStats = await getSystemStats();
    
    return {
      props: {
        systemStats,
      },
    };
  } catch (error) {
    console.error('Error fetching system stats:', error);
    
    // Return fallback data
    return {
      props: {
        systemStats: {
          totalUsers: 0,
          totalSites: 0,
          totalControllers: 0,
          systemStatus: 'Error',
          timestamp: new Date().toISOString()
        },
      },
    };
  }
};

export default AdminPage;