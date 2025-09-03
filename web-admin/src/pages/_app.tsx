import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { useEffect } from 'react';
import '@/styles/globals.css';
import { AppProvider } from '@/contexts/AppContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';

const inter = Inter({ subsets: ['latin'] });

export default function App({ Component, pageProps }: AppProps) {

  return (
    <AuthProvider>
      <AppProvider>
        <ToastProvider>
          <main className={inter.className}>
            <Component {...pageProps} />
          </main>
        </ToastProvider>
      </AppProvider>
    </AuthProvider>
  );
}
