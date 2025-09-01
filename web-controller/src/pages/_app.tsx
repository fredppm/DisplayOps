import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { useEffect } from 'react';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function App({ Component, pageProps }: AppProps) {
  // 🚀 AUTO-INICIALIZAÇÃO: Chamar auto-init quando app carrega
  useEffect(() => {
    const autoInit = async () => {
      try {
        console.log('🚀 Client: Solicitando auto-inicialização dos serviços...');
        const response = await fetch('/api/auto-init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Client: Serviços auto-inicializados:', result.message);
        } else {
          console.warn('⚠️ Client: Falha na auto-inicialização:', response.statusText);
        }
      } catch (error) {
        console.warn('⚠️ Client: Erro na auto-inicialização:', error);
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
