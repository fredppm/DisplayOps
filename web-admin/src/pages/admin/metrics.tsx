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
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Performance Metrics</h1>
          <p className="text-gray-600">
            Real-time system and application performance monitoring
          </p>
        </div>

        <PerformanceMetrics initialMetrics={initialMetrics} />

        {/* Test Section */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Test Metrics Collection</h3>
          <p className="text-sm text-gray-600 mb-4">
            Use these buttons to generate test data for the metrics system:
          </p>
          
          <div className="space-x-2">
            <button
              onClick={() => fetch('/api/metrics/test')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Fast Request
            </button>
            
            <button
              onClick={() => fetch('/api/metrics/test?delay=500')}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              Slow Request (500ms)
            </button>
            
            <button
              onClick={() => fetch('/api/metrics/test?error=true')}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Error Request
            </button>
            
            <button
              onClick={async () => {
                for (let i = 0; i < 10; i++) {
                  fetch(`/api/metrics/test?delay=${Math.floor(Math.random() * 200)}`);
                }
              }}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              10x Random Requests
            </button>
          </div>
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