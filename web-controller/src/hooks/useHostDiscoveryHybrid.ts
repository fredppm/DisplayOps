import React from 'react';
import { useFeatureFlag } from '@/contexts/FeatureFlagContext';
import { useHostDiscovery } from './useHostDiscovery';
import { useHostDiscoveryWebSocket } from './useHostDiscoveryWebSocket';

/**
 * Hybrid hook that switches between SSE and WebSocket based on feature flag
 * This allows for gradual rollout and A/B testing of the WebSocket implementation
 */
export const useHostDiscoveryHybrid = () => {
  const useWebSocket = useFeatureFlag('useWebSocket');
  
  // Get both implementations
  const sseResult = useHostDiscovery();
  const wsResult = useHostDiscoveryWebSocket();
  
  // Add some logging to track which implementation is being used
  React.useEffect(() => {
    console.log(`🏁 Using ${useWebSocket ? 'WebSocket' : 'SSE'} for host discovery`);
  }, [useWebSocket]);
  
  // Return the appropriate implementation based on feature flag
  if (useWebSocket) {
    return {
      ...wsResult,
      implementation: 'websocket' as const
    };
  } else {
    return {
      ...sseResult,
      implementation: 'sse' as const,
      // Add WebSocket-specific methods as no-ops for compatibility
      subscribeToHosts: () => console.log('💡 subscribeToHosts not available in SSE mode'),
      deployDashboard: () => console.log('💡 deployDashboard not available in SSE mode'),
      refreshDisplay: () => console.log('💡 refreshDisplay not available in SSE mode'),
      validateUrl: () => console.log('💡 validateUrl not available in SSE mode'),
      healthCheck: () => console.log('💡 healthCheck not available in SSE mode')
    };
  }
};