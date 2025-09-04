import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { useEffect } from 'react';
import { useAutoRegister } from '@/hooks/useAutoRegister';
import { createContextLogger } from '@/utils/logger';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'] });

const appLogger = createContextLogger('app');

export default function App({ Component, pageProps }: AppProps) {

  appLogger.info('App carregado');
  // 🚀 AUTO-REGISTRO: Tentar auto-registrar controller no admin
  const autoRegisterStatus = useAutoRegister();

  // 🚀 AUTO-INICIALIZAÇÃO: Chamar auto-init quando app carrega
  useEffect(() => {
    const autoInit = async () => {
      try {
        appLogger.info('Client: Solicitando auto-inicialização dos serviços');
        const response = await fetch('/api/auto-init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const result = await response.json();
          appLogger.info('Client: Serviços auto-inicializados', { message: result.message });
        } else {
          appLogger.warn('Client: Falha na auto-inicialização', { status: response.statusText });
        }
      } catch (error) {
        appLogger.warn('Client: Erro na auto-inicialização', { error: error instanceof Error ? error.message : String(error) });
      }
    };

    autoInit();
  }, []); // Executar apenas uma vez quando o app carrega

  return (
    <main className={inter.className}>
      <Component {...pageProps} />
    </main>
  );
}
