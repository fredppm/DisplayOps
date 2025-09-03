import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { useEffect } from 'react';
import '@/styles/globals.css';
import { AppProvider } from '@/contexts/AppContext';
import { AuthProvider } from '@/contexts/AuthContext';

const inter = Inter({ subsets: ['latin'] });

export default function App({ Component, pageProps }: AppProps) {

  return (
    <AuthProvider>
      <AppProvider>
        <main className={inter.className}>
          <Component {...pageProps} />
        </main>
      </AppProvider>
    </AuthProvider>
  );
}
