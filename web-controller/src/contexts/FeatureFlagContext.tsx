import React, { createContext, useContext, useState, useEffect } from 'react';

interface FeatureFlags {
  useWebSocket: boolean;
  enableNewDashboard: boolean;
  enableDebugMode: boolean;
}

interface FeatureFlagContextType {
  flags: FeatureFlags;
  setFlag: (flag: keyof FeatureFlags, value: boolean) => void;
  toggleFlag: (flag: keyof FeatureFlags) => void;
}

const defaultFlags: FeatureFlags = {
  useWebSocket: false, // Default to false for gradual rollout
  enableNewDashboard: false,
  enableDebugMode: true
};

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

interface FeatureFlagProviderProps {
  children: React.ReactNode;
  initialFlags?: Partial<FeatureFlags>;
}

export const FeatureFlagProvider: React.FC<FeatureFlagProviderProps> = ({ 
  children, 
  initialFlags = {} 
}) => {
  const [flags, setFlags] = useState<FeatureFlags>(() => {
    // Try to load from localStorage if available
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('office-tv-feature-flags');
        if (stored) {
          const parsedFlags = JSON.parse(stored);
          return { ...defaultFlags, ...initialFlags, ...parsedFlags };
        }
      } catch (error) {
        console.warn('Failed to load feature flags from localStorage:', error);
      }
    }
    
    return { ...defaultFlags, ...initialFlags };
  });

  // Save to localStorage whenever flags change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('office-tv-feature-flags', JSON.stringify(flags));
        console.log('🏁 Feature flags saved:', flags);
      } catch (error) {
        console.warn('Failed to save feature flags to localStorage:', error);
      }
    }
  }, [flags]);

  const setFlag = (flag: keyof FeatureFlags, value: boolean) => {
    console.log(`🏁 Setting feature flag ${flag} to ${value}`);
    setFlags(prev => ({ ...prev, [flag]: value }));
  };

  const toggleFlag = (flag: keyof FeatureFlags) => {
    console.log(`🏁 Toggling feature flag ${flag}`);
    setFlags(prev => ({ ...prev, [flag]: !prev[flag] }));
  };

  const value: FeatureFlagContextType = {
    flags,
    setFlag,
    toggleFlag
  };

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
};

export const useFeatureFlags = (): FeatureFlagContextType => {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
};

// Hook to check specific flag
export const useFeatureFlag = (flag: keyof FeatureFlags): boolean => {
  const { flags } = useFeatureFlags();
  return flags[flag];
};