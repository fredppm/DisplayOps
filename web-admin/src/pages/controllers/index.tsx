import React from 'react';
import { NextPage, GetServerSideProps } from 'next';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { getControllers } from '@/lib/api-server';
import { Server, Network, Clock, AlertCircle, CheckCircle, XCircle, Plus } from 'lucide-react';

interface Controller {
  id: string;
  siteId: string;
  name: string;
  localNetwork: string;
  mdnsService: string;
  webAdminUrl: string;
  status: 'online' | 'offline' | 'error';
  lastSync: string;
  version: string;
}

interface ControllersPageProps {
  initialControllers: Controller[];
}

const ControllersPage: NextPage<ControllersPageProps> = ({ initialControllers }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'offline':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };
  return (
    <Layout>
      <div className="container mx-auto p-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Server className="h-8 w-8 text-blue-600 mr-3" />
                Controllers Management
              </h1>
              <p className="mt-2 text-gray-600">
                Manage DisplayOps controllers across all sites
              </p>
            </div>
            <Link
              href="/controllers/new"
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Controller
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Server className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Controllers</p>
                <p className="text-2xl font-bold text-gray-900">{initialControllers.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Online</p>
                <p className="text-2xl font-bold text-gray-900">
                  {initialControllers.filter(c => c.status === 'online').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Offline</p>
                <p className="text-2xl font-bold text-gray-900">
                  {initialControllers.filter(c => c.status === 'offline').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Controllers Grid */}
        {initialControllers.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Server className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Controllers Found</h3>
            <p className="text-gray-600 mb-6">
              Get started by adding your first controller to manage displays.
            </p>
            <Link
              href="/controllers/new"
              className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Your First Controller
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {initialControllers.map((controller) => (
              <Link
                key={controller.id}
                href={`/controllers/${controller.id}`}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 block"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    {getStatusIcon(controller.status)}
                    <h3 className="ml-2 text-lg font-semibold text-gray-900">
                      {controller.name}
                    </h3>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    controller.status === 'online'
                      ? 'bg-green-100 text-green-800'
                      : controller.status === 'offline'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {controller.status.charAt(0).toUpperCase() + controller.status.slice(1)}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center text-gray-600">
                    <Network className="h-4 w-4 mr-2" />
                    <span className="text-sm">{controller.localNetwork}</span>
                  </div>

                  <div className="flex items-center text-gray-600">
                    <Server className="h-4 w-4 mr-2" />
                    <span className="text-sm font-mono">{controller.mdnsService}</span>
                  </div>

                  <div className="flex items-center text-gray-600">
                    <Clock className="h-4 w-4 mr-2" />
                    <span className="text-sm">
                      Last sync: {new Date(controller.lastSync).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Version {controller.version}</span>
                    <span>Site: {controller.siteId}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    const controllersData = await getControllers();
    
    return {
      props: {
        initialControllers: controllersData.controllers,
      },
    };
  } catch (error) {
    console.error('Error fetching controllers:', error);
    
    return {
      props: {
        initialControllers: [],
      },
    };
  }
};

export default ControllersPage;