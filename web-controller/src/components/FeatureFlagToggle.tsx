import React from 'react';
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';
import { Settings, ToggleLeft, ToggleRight, Wifi, Radio } from 'lucide-react';

interface FeatureFlagToggleProps {
  className?: string;
}

export const FeatureFlagToggle: React.FC<FeatureFlagToggleProps> = ({ 
  className = '' 
}) => {
  const { flags, toggleFlag } = useFeatureFlags();

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Settings className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-medium text-gray-900">Feature Flags</h3>
        </div>
      </div>

      <div className="space-y-3">
        {/* WebSocket Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {flags.useWebSocket ? (
              <Wifi className="w-4 h-4 text-blue-600" />
            ) : (
              <Radio className="w-4 h-4 text-gray-600" />
            )}
            <div>
              <div className="text-sm font-medium text-gray-900">
                Communication Protocol
              </div>
              <div className="text-xs text-gray-500">
                {flags.useWebSocket ? 'WebSocket (Real-time bidirectional)' : 'SSE + HTTP (Legacy)'}
              </div>
            </div>
          </div>
          <button
            onClick={() => toggleFlag('useWebSocket')}
            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
              flags.useWebSocket ? 'bg-primary-600' : 'bg-gray-200'
            }`}
            title={`Switch to ${flags.useWebSocket ? 'SSE + HTTP' : 'WebSocket'}`}
          >
            <span
              className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                flags.useWebSocket ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Debug Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-4 h-4 rounded ${flags.enableDebugMode ? 'bg-yellow-500' : 'bg-gray-400'}`} />
            <div>
              <div className="text-sm font-medium text-gray-900">
                Debug Mode
              </div>
              <div className="text-xs text-gray-500">
                Enhanced logging and diagnostics
              </div>
            </div>
          </div>
          <button
            onClick={() => toggleFlag('enableDebugMode')}
            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
              flags.enableDebugMode ? 'bg-yellow-500' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                flags.enableDebugMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          🏁 Feature flags are saved to localStorage and persist between sessions.
          {flags.useWebSocket && (
            <div className="mt-1 text-blue-600">
              ⚠️ WebSocket mode is experimental. Switch back to SSE if issues occur.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};