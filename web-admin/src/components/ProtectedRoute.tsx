import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  allowedSites?: string[];
}

export default function ProtectedRoute({ 
  children, 
  adminOnly = false,
  allowedSites = []
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      // Redirect to login with return URL
      router.push(`/login?returnUrl=${encodeURIComponent(router.asPath)}`);
    }
  }, [user, isLoading, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return null;
  }

  // Check admin permission
  if (adminOnly && user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-50 border border-red-200 rounded-md p-6">
            <h1 className="text-xl font-bold text-red-800 mb-2">Access Denied</h1>
            <p className="text-red-600">You don't have permission to access this page.</p>
            <p className="text-red-600 text-sm mt-2">Admin privileges required.</p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check site permission
  if (allowedSites.length > 0) {
    const hasAccess = user.role === 'admin' || 
                      user.sites.includes('*') ||
                      allowedSites.some(site => user.sites.includes(site));
    
    if (!hasAccess) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full text-center">
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6">
              <h1 className="text-xl font-bold text-yellow-800 mb-2">Access Restricted</h1>
              <p className="text-yellow-600">You don't have permission to access this site.</p>
              <p className="text-yellow-600 text-sm mt-2">Contact admin to request access.</p>
              <button
                onClick={() => router.back()}
                className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}