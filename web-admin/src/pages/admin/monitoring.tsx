import React from 'react';
import { NextPage, GetServerSideProps } from 'next';
import Layout from '@/components/Layout';
import MonitoringDashboard from '@/components/MonitoringDashboard';
import { getMonitoringData } from '@/lib/api-server';

interface MonitoringPageProps {
  initialMonitoringData: Awaited<ReturnType<typeof getMonitoringData>>;
}

const MonitoringPage: NextPage<MonitoringPageProps> = ({ initialMonitoringData }) => {
  return (
    <Layout>
      <div className="container mx-auto p-4">
        <MonitoringDashboard 
          initialData={{
            metrics: initialMonitoringData.metrics,
            alerts: initialMonitoringData.alerts,
            alertStats: initialMonitoringData.alertStats
          }}
        />
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    const initialMonitoringData = await getMonitoringData();
    
    return {
      props: {
        initialMonitoringData,
      },
    };
  } catch (error) {
    console.error('Error fetching monitoring data:', error);
    
    // Return fallback data
    return {
      props: {
        initialMonitoringData: {
          metrics: {
            overview: {
              uptime: 'Error',
              totalRequests: 0,
              averageResponseTime: 0,
              errorRate: 0,
              currentLoad: 0
            },
            realtime: {
              requestsPerMinute: 0,
              activeConnections: 0,
              activeSessions: 0,
              memoryUsage: 0,
              cpuUsage: 0
            },
            topEndpoints: [],
            systemHealth: 'critical' as 'healthy' | 'warning' | 'critical'
          },
          alerts: [],
          alertStats: {
            totalRules: 0,
            activeRules: 0,
            activeAlerts: 0,
            criticalAlerts: 0,
            recentAlerts24h: 0
          },
          timestamp: new Date().toISOString()
        },
      },
    };
  }
};

export default MonitoringPage;