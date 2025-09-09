import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { useEffect } from 'react';
import { createContextLogger } from '@/utils/logger';
import { ThemeProvider } from '@/contexts/ThemeContext';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'] });

const appLogger = createContextLogger('app');

export default function App({ Component, pageProps }: AppProps) {

  // 🚀 AUTO-INICIALIZAÇÃO: Chamar auto-init quando app carrega (gRPC + Discovery)
  useEffect(() => {
    appLogger.info('App initialized - starting auto-init services');
    
    const autoInit = async () => {
      try {
        const response = await fetch('/api/auto-init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const result = await response.json();
          appLogger.info('Auto-init completed successfully', { message: result.message });
        } else {
          appLogger.warn('Auto-init failed', { status: response.statusText });
        }
      } catch (error) {
        appLogger.error('Auto-init error', { error: error instanceof Error ? error.message : String(error) });
      }
    };

    autoInit();
  }, []); // Executar apenas uma vez quando o app carrega

  return (
    <ThemeProvider>
      <main className={inter.className}>
        <Component {...pageProps} />
      </main>
    </ThemeProvider>
  );
}
