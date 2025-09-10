import React from 'react';

// Componente base para shimmer animation
const ShimmerBase: React.FC<{ className?: string; children?: React.ReactNode }> = ({ 
  className = "", 
  children 
}) => (
  <div className={`animate-pulse ${className}`}>
    {children}
  </div>
);

// Skeleton para cards do admin dashboard
export const AdminCardSkeleton: React.FC = () => (
  <ShimmerBase>
    <div className="bg-white shadow rounded-lg p-6">
      <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
      <div className="h-10 bg-gray-200 rounded w-full"></div>
    </div>
  </ShimmerBase>
);

// Skeleton para stats do admin dashboard
export const AdminStatsSkeleton: React.FC = () => (
  <ShimmerBase>
    <div className="bg-white shadow rounded-lg p-6">
      <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="text-center">
            <div className="h-8 bg-gray-200 rounded w-16 mx-auto mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-20 mx-auto"></div>
          </div>
        ))}
      </div>
    </div>
  </ShimmerBase>
);

// Skeleton para lista de dashboards
export const DashboardListSkeleton: React.FC = () => (
  <ShimmerBase>
    <div className="divide-y divide-gray-200">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <div className="h-5 bg-gray-200 rounded w-48"></div>
                <div className="h-4 w-4 bg-gray-200 rounded"></div>
              </div>
              <div className="space-y-1 mb-2">
                <div className="h-3 bg-gray-200 rounded w-64"></div>
                <div className="flex items-center space-x-4">
                  <div className="h-3 bg-gray-200 rounded w-20"></div>
                  <div className="h-3 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
            </div>
            <div className="ml-6 flex items-center space-x-2">
              <div className="h-6 bg-gray-200 rounded w-12"></div>
              <div className="h-6 bg-gray-200 rounded w-14"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </ShimmerBase>
);

// Skeleton para operações em dashboards
export const DashboardOperationSkeleton: React.FC = () => (
  <ShimmerBase>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="space-y-4">
          <div className="h-10 bg-gray-200 rounded w-full"></div>
          <div className="h-10 bg-gray-200 rounded w-full"></div>
          <div className="h-20 bg-gray-200 rounded w-full"></div>
          <div className="flex justify-end space-x-3">
            <div className="h-8 bg-gray-200 rounded w-20"></div>
            <div className="h-8 bg-gray-200 rounded w-28"></div>
          </div>
        </div>
      </div>
    </div>
  </ShimmerBase>
);

// Skeleton para grid de métricas
export const MetricsGridSkeleton: React.FC = () => (
  <ShimmerBase>
    <div className="space-y-6">
      {/* System Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="h-6 bg-gray-200 rounded w-40 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="text-center">
              <div className="h-8 bg-gray-200 rounded w-16 mx-auto mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-20 mx-auto"></div>
            </div>
          ))}
        </div>
      </div>

      {/* API Performance */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="h-6 bg-gray-200 rounded w-36 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="text-center">
              <div className="h-8 bg-gray-200 rounded w-20 mx-auto mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-24 mx-auto"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Application Metrics */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="h-6 bg-gray-200 rounded w-44 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="text-center">
              <div className="h-8 bg-gray-200 rounded w-14 mx-auto mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-18 mx-auto"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </ShimmerBase>
);

// Skeleton para lista de alerts
export const AlertsListSkeleton: React.FC = () => (
  <ShimmerBase>
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="border rounded-lg p-4 bg-gray-50">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-5 bg-gray-200 rounded w-16"></div>
                <div className="h-5 bg-gray-200 rounded w-32"></div>
              </div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="space-y-1">
                <div className="h-3 bg-gray-200 rounded w-24"></div>
                <div className="h-3 bg-gray-200 rounded w-48"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
              </div>
            </div>
            <div className="h-8 bg-gray-200 rounded w-20 ml-4"></div>
          </div>
        </div>
      ))}
    </div>
  </ShimmerBase>
);

// Skeleton para tabs de alerts
export const AlertsTabSkeleton: React.FC = () => (
  <ShimmerBase>
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8 px-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="py-4 px-1 flex items-center">
            <div className="h-4 bg-gray-200 rounded w-20 mr-2"></div>
            <div className="h-5 bg-gray-200 rounded-full w-6"></div>
          </div>
        ))}
      </nav>
    </div>
  </ShimmerBase>
);

// Skeleton para dashboard de monitoring
export const MonitoringGridSkeleton: React.FC = () => (
  <ShimmerBase>
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-48"></div>
          </div>
          <div className="text-right">
            <div className="h-6 bg-gray-200 rounded w-20 mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-32"></div>
          </div>
        </div>
      </div>

      {/* System Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="h-6 bg-gray-200 rounded w-40 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="h-8 bg-gray-200 rounded w-16 mx-auto mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-20 mx-auto"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time and Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="h-6 bg-gray-200 rounded w-36 mb-4"></div>
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="flex justify-between items-center">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="flex items-center">
                  <div className="h-2 bg-gray-200 rounded-full w-32 mr-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-12"></div>
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div className="text-center">
                <div className="h-6 bg-gray-200 rounded w-12 mx-auto mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-20 mx-auto"></div>
              </div>
              <div className="text-center">
                <div className="h-6 bg-gray-200 rounded w-12 mx-auto mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-20 mx-auto"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </div>
                    <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-24"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Endpoints Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="h-6 bg-gray-200 rounded w-40 mb-4"></div>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            <div className="border-b pb-2 mb-4">
              <div className="grid grid-cols-5 gap-4">
                {['Method', 'Endpoint', 'Requests', 'Avg Time', 'Error Rate'].map((_, index) => (
                  <div key={index} className="h-4 bg-gray-200 rounded w-full"></div>
                ))}
              </div>
            </div>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="grid grid-cols-5 gap-4 py-2 border-b">
                <div className="h-6 bg-gray-200 rounded w-12"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
                <div className="h-4 bg-gray-200 rounded w-12"></div>
                <div className="h-4 bg-gray-200 rounded w-12"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </ShimmerBase>
);

// Skeleton para operações específicas
export const AlertOperationSkeleton: React.FC = () => (
  <ShimmerBase className="inline-flex items-center px-3 py-1 rounded">
    <div className="h-4 bg-gray-200 rounded w-20"></div>
  </ShimmerBase>
);

export const RuleToggleSkeleton: React.FC = () => (
  <ShimmerBase className="inline-flex items-center px-3 py-1 rounded">
    <div className="h-4 bg-gray-200 rounded w-16"></div>
  </ShimmerBase>
);

// Skeleton para componente de erro com retry
export const ErrorFallback: React.FC<{ 
  onRetry: () => void; 
  message?: string;
  className?: string;
}> = ({ onRetry, message = "Failed to load data", className = "" }) => (
  <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
    <div className="flex items-center">
      <div className="text-red-600 mr-3">⚠️</div>
      <div>
        <p className="text-red-800 font-medium">Error</p>
        <p className="text-red-600 text-sm">{message}</p>
      </div>
      <button 
        onClick={onRetry}
        className="ml-auto px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm transition-colors"
      >
        Retry
      </button>
    </div>
  </div>
);