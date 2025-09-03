import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'site-manager' | 'viewer';
  sites: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkPermission: (siteId: string) => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);


export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    setUser(data.user);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      if (mountedRef.current) {
        setUser(null);
        setAuthCheckCalled(false);
        router.push('/login');
      }
    }
  };

  const checkPermission = (siteId: string): boolean => {
    if (!user) return false;
    
    // Admin has access to all sites
    if (user.role === 'admin' || user.sites.includes('*')) {
      return true;
    }

    // Check if user has access to specific site
    return user.sites.includes(siteId);
  };

  const isAdmin = (): boolean => {
    return user?.role === 'admin' || false;
  };

  const value = {
    user,
    isLoading,
    login,
    logout,
    checkPermission,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}