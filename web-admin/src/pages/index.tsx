import React, { useEffect } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import Head from 'next/head';

const HomePage: NextPage = () => {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Aguarda o auth carregar
    if (isLoading) return;
    
    if (!user) {
      // Não logado → redirect para login
      router.push('/login');
      return;
    }

    // Logado → redirect baseado no role
    switch (user.role) {
      case 'admin':
        router.push('/admin');
        break;
      case 'site-manager':
        router.push('/sites');
        break;
      case 'viewer':
        router.push('/sites'); // Viewer também vai para sites (só visualizar)
        break;
      default:
        // Fallback para caso de role desconhecido
        router.push('/login');
    }
  }, [user, isLoading, router]);

  // Loading state durante o processo de redirect
  return (
    <>
      <Head>
        <title>DisplayOps - Loading...</title>
        <meta name="description" content="DisplayOps Management System" />
      </Head>
      
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4">
            <img 
              src="/icon-idle-128.png" 
              alt="DisplayOps" 
              className="w-16 h-16 mx-auto mb-4"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src !== '/favicon.ico') {
                  target.src = '/favicon.ico';
                }
              }}
            />
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">DisplayOps</h1>
            
            {isLoading ? (
              <>
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-gray-600">Checking authentication...</p>
              </>
            ) : (
              <>
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-gray-600">Redirecting to dashboard...</p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default HomePage;