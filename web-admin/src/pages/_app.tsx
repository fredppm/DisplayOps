import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { useEffect } from 'react';
import '@/styles/globals.css';
import { AppProvider } from '@/contexts/AppContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AdminStatusProvider } from '@/contexts/AdminStatusContext';

const inter = Inter({ subsets: ['latin'] });

// Initialize gRPC server on app startup (server-side only)
if (typeof window === 'undefined') {
  import('@/lib/grpc-server-init').then(({ initializeGrpcServer }) => {
    initializeGrpcServer().catch((error) => {
      console.error('Failed to initialize gRPC server on app startup:', error);
    });
  });
}

export default function App({ Component, pageProps }: AppProps) {

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <AdminStatusProvider>
            <ToastProvider>
              <main className={inter.className}>
                <Component {...pageProps} />
              </main>
            </ToastProvider>
          </AdminStatusProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
