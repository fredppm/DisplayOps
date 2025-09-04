import { NextApiRequest, NextApiResponse } from 'next';
import { createContextLogger } from '@/utils/logger';

const dashboardClosedLogger = createContextLogger('api-dashboard-closed');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    // Log that the dashboard management interface was closed
    dashboardClosedLogger.info('Dashboard management interface closed by user');
    
    // In the future, we could add logic here to:
    // - Notify specific hosts if needed
    // - Update global state
    // - Send cleanup signals
    
    res.status(200).json({ 
      success: true, 
      message: 'Dashboard closure notification received' 
    });
  } catch (error) {
    dashboardClosedLogger.error('Error handling dashboard closure notification', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}