import React from 'react';
import { NextPage, GetServerSideProps } from 'next';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { 
  UsersIcon, 
  BuildingOfficeIcon, 
  ServerIcon, 
  HeartIcon,
  ChartBarIcon,
  BellIcon,
  ChartPieIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { useDashboardData, useSystemHealth } from '@/hooks/useDashboardData';
import { useAdminStatus, useAdminEvents } from '@/contexts/AdminStatusContext';
import { 
  MetricCardSkeleton, 
  PerformanceCardSkeleton, 
  AlertCardSkeleton 
} from '@/components/skeletons/DashboardSkeleton';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLogin: string | null;
}

interface Site {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
}

interface Controller {
  id: string;
  name: string;
  siteId: string;
  status: 'online' | 'offline';
}

interface AdminDashboardData {
  users: User[];
  sites: Site[];
  controllers: Controller[];
}

interface AdminPageProps {
  dashboardData: AdminDashboardData;
}

const AdminPage: NextPage<AdminPageProps> = ({ dashboardData }) => {
  // Hook para dados dinâmicos (CSR) com refresh automático
  const { monitoringData, alertData, loading: dashboardLoading, error: dashboardError, refetch } = useDashboardData(30000);
  const { healthChecksData, loading: healthLoading, error: healthError } = useAdminStatus();
  
  // Combine loading and error states
  const loading = dashboardLoading || healthLoading;
  const error = dashboardError || healthError;
  
  // Hook para dados em tempo real via SSE
  const { systemHealth: realtimeHealth, controllers: realtimeControllers, sites: realtimeSites, isConnected } = useAdminEvents();
  
  // Hook para status do sistema com fallback
  const systemHealth = useSystemHealth(monitoringData);
  
  // Hook para status completo incluindo gRPC
  const { status: adminStatus } = useAdminStatus();
  
  // Usar dados em tempo real quando disponíveis, senão fallback para SSR
  const totalUsers = dashboardData.users.length;
  const onlineSites = realtimeSites?.filter(s => s.status === 'healthy').length || dashboardData.sites.filter(s => s.status === 'online').length;
  const onlineControllers = realtimeControllers?.filter(c => c.status === 'online').length || dashboardData.controllers.filter(c => c.status === 'online').length;
  const totalSites = realtimeSites?.length || dashboardData.sites.length;
  const totalControllers = realtimeControllers?.length || dashboardData.controllers.length;
  const activeAlerts = alertData?.stats?.activeAlerts || 0;

  // Função para obter ícone e cor do status do sistema
  const getSystemHealthIcon = () => {
    if (!monitoringData) return { icon: ExclamationTriangleIcon, color: systemHealth.color };
    
    switch (monitoringData.overview?.systemHealth) {
      case 'healthy':
        return { icon: CheckCircleIcon, color: systemHealth.color };
      case 'warning':
        return { icon: ExclamationTriangleIcon, color: systemHealth.color };
      case 'critical':
        return { icon: XCircleIcon, color: systemHealth.color };
      default:
        return { icon: ExclamationTriangleIcon, color: systemHealth.color };
    }
  };

  const healthIcon = getSystemHealthIcon();

  const quickActions = [
    {
      title: 'Users',
      description: 'Manage accounts and permissions',
      href: '/admin/users',
      icon: UsersIcon,
      count: totalUsers
    },
    {
      title: 'Sites',
      description: 'Manage all sites',
      href: '/sites',
      icon: BuildingOfficeIcon,
      count: onlineSites,
      total: totalSites
    },
    {
      title: 'Controllers',
      description: 'Local site controllers',
      href: '/controllers',
      icon: ServerIcon,
      count: onlineControllers,
      total: totalControllers
    }
  ];

  const systemTools = [
    {
      title: 'System Health',
      description: 'System health monitoring',
      href: '/admin/health',
      icon: HeartIcon,
      status: systemHealth.status
    },
    {
      title: 'Metrics',
      description: 'Performance and statistics',
      href: '/admin/metrics',
      icon: ChartBarIcon,
      status: monitoringData?.overview?.uptime || 'Loading...'
    },
    {
      title: 'Alerts',
      description: 'Notifications and alerts',
      href: '/admin/alerts',
      icon: BellIcon,
      status: `${activeAlerts} ativos`
    },
    {
      title: 'Monitoring',
      description: 'Complete dashboard',
      href: '/admin/monitoring',
      icon: ChartPieIcon,
      status: 'Real-time'
    }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-6 py-8">
          {/* Status de Conexão SSE */}
          <div className="mb-4">
            <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              isConnected 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20' 
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-600/20'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              {isConnected ? 'Live Updates Active' : 'Live Updates Disconnected'}
            </div>
          </div>
          {/* Métricas Principais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {onlineSites}/{totalSites}
                  </p>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sites Online</p>
                </div>
                <div className="h-12 w-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <BuildingOfficeIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {onlineControllers}/{totalControllers}
                  </p>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Controllers Online</p>
                </div>
                <div className="h-12 w-12 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                  <ServerIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>

            {realtimeHealth ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                      realtimeHealth.status === 'healthy' 
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20' 
                        : realtimeHealth.status === 'degraded' 
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 ring-1 ring-inset ring-yellow-600/20'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-600/20'
                    }`}>
                      {realtimeHealth.status}
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">System Health</p>
                  </div>
                  <div className="h-12 w-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <div className={`w-6 h-6 rounded-full ${
                      realtimeHealth.status === 'healthy' ? 'bg-green-500' :
                      realtimeHealth.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                  </div>
                </div>
                {adminStatus?.grpc && (
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">gRPC Service</span>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${adminStatus.grpc.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className={`text-xs font-medium ${adminStatus.grpc.isRunning ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {adminStatus.grpc.isRunning ? 'Running' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : loading ? (
              <MetricCardSkeleton />
            ) : healthChecksData ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                      healthChecksData.data.overallStatus === 'healthy' 
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20' 
                        : healthChecksData.data.overallStatus === 'warning' 
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 ring-1 ring-inset ring-yellow-600/20'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-600/20'
                    }`}>
                      {healthChecksData.data.overallStatus}
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">System Health</p>
                  </div>
                  <div className="h-12 w-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <div className={`w-6 h-6 rounded-full ${
                      healthChecksData.data.overallStatus === 'healthy' ? 'bg-green-500' :
                      healthChecksData.data.overallStatus === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                  </div>
                </div>
                {adminStatus?.grpc && (
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">gRPC Service</span>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${adminStatus.grpc.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className={`text-xs font-medium ${adminStatus.grpc.isRunning ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {adminStatus.grpc.isRunning ? 'Running' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800/50 ring-1 ring-inset ring-gray-300 dark:ring-gray-600">
                      Loading
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">System Health</p>
                  </div>
                  <div className="h-12 w-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full bg-gray-400"></div>
                  </div>
                </div>
                {adminStatus?.grpc && (
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">gRPC Service</span>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${adminStatus.grpc.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className={`text-xs font-medium ${adminStatus.grpc.isRunning ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {adminStatus.grpc.isRunning ? 'Running' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Coluna Principal */}
            <div className="lg:col-span-2 space-y-6">
              {/* Ações Rápidas */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {quickActions.map((action) => (
                    <Link key={action.title} href={action.href} className="group block h-full">
                      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-6 hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-md transition-all duration-200 bg-white dark:bg-gray-800 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                          <action.icon className="h-8 w-8 text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100" />
                          <ArrowRightIcon className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors" />
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{action.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 flex-grow">{action.description}</p>
                        {action.total ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{action.count} de {action.total} online</p>
                        ) : (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{action.count} total</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Ferramentas do Sistema */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">System Tools</h2>
                <div className="space-y-3">
                  {systemTools.map((tool) => (
                    <Link key={tool.title} href={tool.href} className="group block">
                      <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <div className="flex items-center space-x-3">
                          <tool.icon className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200" />
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-gray-800 dark:group-hover:text-gray-50">{tool.title}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{tool.description}</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                          {tool.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Performance Metrics */}
              {loading ? (
                <PerformanceCardSkeleton />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-slide-in">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Performance</h3>
                  {monitoringData ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center transition-all duration-200">
                        <span className="text-sm text-gray-600 dark:text-gray-400">CPU</span>
                        <span className={`text-sm font-medium transition-colors duration-300 ${
                          monitoringData.performance?.cpu?.status === 'normal' ? 'text-green-600 dark:text-green-400' :
                          monitoringData.performance?.cpu?.status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {monitoringData.performance?.cpu?.current?.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center transition-all duration-200">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Memory</span>
                        <span className={`text-sm font-medium transition-colors duration-300 ${
                          monitoringData.performance?.memory?.status === 'normal' ? 'text-green-600 dark:text-green-400' :
                          monitoringData.performance?.memory?.status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {monitoringData.performance?.memory?.current?.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center transition-all duration-200">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Active Connections</span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200">
                          {monitoringData.performance?.network?.activeConnections}
                        </span>
                      </div>
                      <div className="pt-3 border-t transition-all duration-200">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Uptime: {monitoringData.overview?.uptime}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 animate-fade-in">
                      {error ? `Erro: ${error}` : 'Dados não disponíveis'}
                    </div>
                  )}
                </div>
              )}

              {/* Alertas Ativos */}
              {loading ? (
                <AlertCardSkeleton />
              ) : alertData && activeAlerts > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-slide-in">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Active Alerts</h3>
                    <Link 
                      href="/admin/alerts" 
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 transition-colors duration-200"
                    >
                      Ver todos
                    </Link>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm transition-all duration-200">
                      <span className="text-gray-600 dark:text-gray-400">Critical</span>
                      <span className="font-medium text-red-600 dark:text-red-400 transition-colors duration-300">{alertData.stats.criticalAlerts || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm transition-all duration-200">
                      <span className="text-gray-600 dark:text-gray-400">Total</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">{activeAlerts}</span>
                    </div>
                  </div>
                </div>
              ) : !loading && alertData && activeAlerts === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-fade-in">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">System Stable</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">No active alerts at the moment.</p>
                </div>
              ) : null}

            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    // Import repositories - usando padrão repository ao invés de api-server
    const { UsersRepository } = await import('@/lib/repositories/UsersRepository');
    const { SitesRepository } = await import('@/lib/repositories/SitesRepository');
    const { ControllersRepository } = await import('@/lib/repositories/ControllersRepository');
    
    // Instanciar repositories
    const usersRepo = new UsersRepository();
    const sitesRepo = new SitesRepository();
    const controllersRepo = new ControllersRepository();
    
    // Buscar dados dos repositories
    const [users, sites, controllers] = await Promise.all([
      usersRepo.getAll(),
      sitesRepo.getAll(),
      controllersRepo.getAll()
    ]);
    
    // Preparar dados do dashboard
    const dashboardData: AdminDashboardData = {
      users,
      sites,
      controllers
    };
    
    return {
      props: {
        dashboardData,
      },
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    
    // Return fallback data
    return {
      props: {
        dashboardData: {
          users: [],
          sites: [],
          controllers: []
        },
      },
    };
  }
};

export default AdminPage;