import { NextApiRequest, NextApiResponse } from 'next';
import { withPerformanceMetrics } from '@/lib/performance-metrics';

interface TestResponse {
  message: string;
  timestamp: string;
  delay?: number;
}

async function handler(req: NextApiRequest, res: NextApiResponse<TestResponse>) {
  // Simulate different response times based on query param
  const delay = parseInt(req.query.delay as string) || Math.floor(Math.random() * 100);
  
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Simulate errors based on query param
  if (req.query.error === 'true') {
    return res.status(500).json({
      message: 'Simulated error for testing',
      timestamp: new Date().toISOString()
    });
  }

  res.status(200).json({
    message: 'Test endpoint for performance metrics',
    timestamp: new Date().toISOString(),
    delay
  });
}

// Export with performance metrics middleware
export default withPerformanceMetrics(handler);