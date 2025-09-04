import React from 'react';
import { NextPage, GetServerSideProps } from 'next';
import Layout from '@/components/Layout';
import PerformanceMetrics from '@/components/PerformanceMetrics';
import { getPerformanceMetrics, PerformanceMetricsProps } from '@/lib/api-server';

interface MetricsPageProps {
  initialMetrics: PerformanceMetricsProps;
}

const MetricsPage: NextPage<MetricsPageProps> = ({ initialMetrics }) => {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Performance Metrics</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time system and application performance monitoring
          </p>
        </div>

        <PerformanceMetrics initialMetrics={initialMetrics} />

        </div>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    const initialMetrics = await getPerformanceMetrics();
    
    return {
      props: {
        initialMetrics,
      },
    };
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    
    // Return fallback data
    return {
      props: {
        initialMetrics: {
          uptime: 0,
          system: {
            cpuUsage: 0,
            memoryUsage: 0,
            loadAverage: 0,
          },
          api: {
            averageResponseTime: 0,
            totalRequests: 0,
            errorRate: 0,
            requestsPerMinute: 0,
          },
          application: {
            activeSessions: 0,
            activeConnections: 0,
            errorRate: 0,
            requestsPerMinute: 0,
          },
          timestamp: Date.now()
        },
      },
    };
  }
};

export default MetricsPage;