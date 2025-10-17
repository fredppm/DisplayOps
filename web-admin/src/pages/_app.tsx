import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { useEffect } from 'react';
import '@/styles/globals.css';
import { AppProvider } from '@/contexts/AppContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

const inter = Inter({ subsets: ['latin'] });

// WebSocket server will be initialized on-demand via middleware in API routes

export default function App({ Component, pageProps }: AppProps) {
  // Initialize Socket.IO server on app startup
  useEffect(() => {
    fetch('/api/websocket', { method: 'POST' }).catch(() => {
      // Ignore errors - Socket.IO might already be initialized
    });
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <ToastProvider>
            <main className={inter.className}>
              <Component {...pageProps} />
            </main>
          </ToastProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
