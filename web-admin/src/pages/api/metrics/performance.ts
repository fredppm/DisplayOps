import { NextApiRequest, NextApiResponse } from 'next';
import { performanceCollector, withPerformanceMetrics } from '@/lib/performance-metrics';
import { withPermission, ProtectedApiRequest } from '@/lib/api-protection';

interface PerformanceApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

async function handler(req: ProtectedApiRequest, res: NextApiResponse<PerformanceApiResponse>) {
  const { method, query } = req;

  switch (method) {
    case 'GET':
      return handleGetMetrics(req, res);
    case 'DELETE':
      return handleCleanupMetrics(req, res);
    default:
      res.setHeader('Allow', ['GET', 'DELETE']);
      return res.status(405).json({
        success: false,
        error: `Method ${method} not allowed`,
        timestamp: new Date().toISOString()
      });
  }
}

async function handleGetMetrics(req: ProtectedApiRequest, res: NextApiResponse<PerformanceApiResponse>) {
  try {
    const { type, endpoint, method: queryMethod, summary } = req.query;

    if (summary === 'true') {
      // Return summary metrics
      const summaryData = performanceCollector.getSummary();
      return res.status(200).json({
        success: true,
        data: summaryData,
        timestamp: new Date().toISOString()
      });
    }

    if (endpoint && queryMethod) {
      // Return specific endpoint metrics
      const endpointMetrics = performanceCollector.getEndpointMetrics(
        queryMethod as string, 
        endpoint as string
      );
      
      return res.status(200).json({
        success: true,
        data: {
          endpoint: endpoint as string,
          method: queryMethod as string,
          metrics: endpointMetrics,
          count: endpointMetrics.length,
          averageResponseTime: endpointMetrics.length > 0 
            ? endpointMetrics.reduce((sum, m) => sum + m.responseTime, 0) / endpointMetrics.length 
            : 0
        },
        timestamp: new Date().toISOString()
      });
    }

    if (type) {
      // Return specific metric type
      const allMetrics = performanceCollector.getMetrics();
      
      switch (type) {
        case 'system':
          return res.status(200).json({
            success: true,
            data: allMetrics.system,
            timestamp: new Date().toISOString()
          });
          
        case 'api':
          // Convert Map to object for JSON serialization
          const apiMetrics = {
            ...allMetrics.api,
            endpoints: Object.fromEntries(allMetrics.api.endpoints)
          };
          return res.status(200).json({
            success: true,
            data: apiMetrics,
            timestamp: new Date().toISOString()
          });
          
        case 'application':
          return res.status(200).json({
            success: true,
            data: allMetrics.application,
            timestamp: new Date().toISOString()
          });
          
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid metric type. Use: system, api, or application',
            timestamp: new Date().toISOString()
          });
      }
    }

    // Return all metrics
    const allMetrics = performanceCollector.getMetrics();
    
    // Convert Map to object for JSON serialization
    const serializedMetrics = {
      ...allMetrics,
      api: {
        ...allMetrics.api,
        endpoints: Object.fromEntries(allMetrics.api.endpoints)
      }
    };

    return res.status(200).json({
      success: true,
      data: serializedMetrics,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Failed to get performance metrics:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get performance metrics',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleCleanupMetrics(req: ProtectedApiRequest, res: NextApiResponse<PerformanceApiResponse>) {
  try {
    performanceCollector.cleanup();
    
    return res.status(200).json({
      success: true,
      data: { message: 'Performance metrics cleaned up' },
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Failed to cleanup performance metrics:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to cleanup performance metrics',
      timestamp: new Date().toISOString()
    });
  }
}

// Export with performance metrics middleware and authentication
// Requires 'metrics:read' permission for GET, 'metrics:write' for DELETE
export default withPerformanceMetrics(
  withPermission('metrics:read')(handler)
);