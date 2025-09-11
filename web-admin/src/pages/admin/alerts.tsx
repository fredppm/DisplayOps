import React from 'react';
import { NextPage, GetServerSideProps } from 'next';
import Layout from '@/components/Layout';
import AlertsManager from '@/components/AlertsManager';
// Removed api-server import - now uses /api/alerts/active endpoint

interface AlertsPageProps {
  initialAlertsData: {
    activeAlerts: any[];
    alertHistory: any;
    alertRules: any[];
    stats: any;
  };
}

const AlertsPage: NextPage<AlertsPageProps> = ({ initialAlertsData }) => {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">System Alerts</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and manage system alerts and notifications
          </p>
        </div>

        <AlertsManager 
          initialData={{
            activeAlerts: initialAlertsData.activeAlerts,
            alertHistory: initialAlertsData.alertHistory,
            alertRules: initialAlertsData.alertRules,
            stats: initialAlertsData.stats
          }}
        />
        </div>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    // Component will fetch data via API, providing fallback data
    const initialAlertsData = {
      activeAlerts: [],
      stats: {
        totalRules: 0,
        activeRules: 0,
        activeAlerts: 0,
        criticalAlerts: 0,
        recentAlerts24h: 0
      },
      alertHistory: {
        alerts: [],
        totalCount: 0,
        unacknowledgedCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0
      },
      alertRules: [],
      timestamp: new Date().toISOString()
    };
    
    return {
      props: {
        initialAlertsData,
      },
    };
  } catch (error) {
    console.error('Error fetching alerts data:', error);
    
    // Return fallback data
    return {
      props: {
        initialAlertsData: {
          activeAlerts: [],
          stats: {
            totalRules: 0,
            activeRules: 0,
            activeAlerts: 0,
            criticalAlerts: 0,
            recentAlerts24h: 0
          },
          alertHistory: {
            alerts: [],
            totalCount: 0,
            unacknowledgedCount: 0,
            criticalCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0
          },
          alertRules: [],
          timestamp: new Date().toISOString()
        },
      },
    };
  }
};

export default AlertsPage;