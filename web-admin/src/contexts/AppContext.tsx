import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import useLocalStorage from '@/hooks/useLocalStorage';

// Types for the global state
interface Site {
  id: string;
  name: string;
  location: string;
  timezone: string;
  status: 'online' | 'offline' | 'error';
  createdAt: string;
  updatedAt: string;
}

interface AppState {
  sites: Site[];
  loading: boolean;
  error: string | null;
}

// Action types
type AppAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SITES'; payload: Site[] }
  | { type: 'ADD_SITE'; payload: Site }
  | { type: 'UPDATE_SITE'; payload: Site }
  | { type: 'DELETE_SITE'; payload: string }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: AppState = {
  sites: [],
  loading: false,
  error: null,
};

// Reducer function
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SET_SITES':
      return { ...state, sites: action.payload };
    
    case 'ADD_SITE':
      return { 
        ...state, 
        sites: [...state.sites, action.payload] 
      };
    
    case 'UPDATE_SITE':
      return {
        ...state,
        sites: state.sites.map(site => 
          site.id === action.payload.id ? action.payload : site
        )
      };
    
    case 'DELETE_SITE':
      return {
        ...state,
        sites: state.sites.filter(site => site.id !== action.payload)
      };
    
    case 'RESET_STATE':
      return initialState;
    
    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Helper functions
  addSite: (site: Omit<Site, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSite: (id: string, updates: Partial<Site>) => void;
  deleteSite: (id: string) => void;
  getSiteById: (id: string) => Site | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [persistedSites, setPersistedSites] = useLocalStorage<Site[]>('displayops-sites', []);

  // Load persisted data on mount
  useEffect(() => {
    if (persistedSites.length > 0) {
      dispatch({ type: 'SET_SITES', payload: persistedSites });
    }
  }, [persistedSites]);

  // Persist data when state changes
  useEffect(() => {
    if (state.sites.length > 0) {
      setPersistedSites(state.sites);
    }
  }, [state.sites, setPersistedSites]);

  // Helper functions
  const addSite = (siteData: Omit<Site, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const site: Site = {
      ...siteData,
      id: `site-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    dispatch({ type: 'ADD_SITE', payload: site });
  };

  const updateSite = (id: string, updates: Partial<Site>) => {
    const existingSite = state.sites.find(s => s.id === id);
    if (existingSite) {
      const updatedSite: Site = {
        ...existingSite,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      dispatch({ type: 'UPDATE_SITE', payload: updatedSite });
    }
  };

  const deleteSite = (id: string) => {
    dispatch({ type: 'DELETE_SITE', payload: id });
  };

  const getSiteById = (id: string) => {
    return state.sites.find(site => site.id === id);
  };

  const value: AppContextType = {
    state,
    dispatch,
    addSite,
    updateSite,
    deleteSite,
    getSiteById,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

// Custom hook to use the context
export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Export types
export type { Site, AppState, AppAction };