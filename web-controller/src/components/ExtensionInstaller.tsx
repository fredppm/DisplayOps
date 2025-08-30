import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Chrome, 
  Globe, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  Loader,
  Zap,
  RefreshCw,
  Info
} from 'lucide-react';

interface ExtensionInfo {
  name: string;
  version: string;
  description: string;
  installUrl: string;
  downloadUrl: string;
  supportedBrowsers: string[];
  status: string;
}

interface BrowserInfo {
  name: string;
  detected: boolean;
  supported: boolean;
  extensionsUrl: string;
  icon: React.ReactNode;
}

export const ExtensionInstaller: React.FC = () => {
  const [extensionInfo, setExtensionInfo] = useState<ExtensionInfo | null>(null);
  const [currentBrowser, setCurrentBrowser] = useState<BrowserInfo | null>(null);
  const [installStatus, setInstallStatus] = useState<'idle' | 'installing' | 'success' | 'error'>('idle');
  const [installMessage, setInstallMessage] = useState<string>('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Detect browser and load extension info
  useEffect(() => {
    detectBrowser();
    loadExtensionInfo();
  }, []);

  // Detect user's browser with better detection
  const detectBrowser = () => {
    const userAgent = navigator.userAgent;
    const vendor = navigator.vendor || '';
    let browser: BrowserInfo;

    // Edge (must come before Chrome check)
    if (userAgent.includes('Edg')) {
      browser = {
        name: 'Microsoft Edge',
        detected: true,
        supported: true,
        extensionsUrl: 'edge://extensions/',
        icon: <Globe className="w-5 h-5" />
      };
    }
    // Chrome (but not Edge)
    else if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browser = {
        name: 'Google Chrome',
        detected: true,
        supported: true,
        extensionsUrl: 'chrome://extensions/',
        icon: <Chrome className="w-5 h-5" />
      };
    }
    // Firefox
    else if (userAgent.includes('Firefox')) {
      browser = {
        name: 'Mozilla Firefox',
        detected: true,
        supported: true,
        extensionsUrl: 'about:addons',
        icon: <Globe className="w-5 h-5" />
      };
    }
    // Safari
    else if (userAgent.includes('Safari') && vendor.includes('Apple')) {
      browser = {
        name: 'Safari',
        detected: true,
        supported: false, // Safari doesn't support local dev extensions easily
        extensionsUrl: '',
        icon: <Globe className="w-5 h-5" />
      };
    }
    // Brave (Chromium-based)
    else if (userAgent.includes('Brave') || (navigator as any).brave) {
      browser = {
        name: 'Brave Browser',
        detected: true,
        supported: true,
        extensionsUrl: 'chrome://extensions/',
        icon: <Globe className="w-5 h-5" />
      };
    }
    // Opera (Chromium-based)
    else if (userAgent.includes('OPR') || userAgent.includes('Opera')) {
      browser = {
        name: 'Opera',
        detected: true,
        supported: true,
        extensionsUrl: 'chrome://extensions/',
        icon: <Globe className="w-5 h-5" />
      };
    }
    // Generic Chromium
    else if (userAgent.includes('Chromium')) {
      browser = {
        name: 'Chromium',
        detected: true,
        supported: true,
        extensionsUrl: 'chrome://extensions/',
        icon: <Globe className="w-5 h-5" />
      };
    }
    // Unknown browser
    else {
      browser = {
        name: `Navegador: ${getBrowserNameFromUA(userAgent)}`,
        detected: false,
        supported: false,
        extensionsUrl: '',
        icon: <Globe className="w-5 h-5" />
      };
    }

    console.log('Browser detected:', browser.name, 'UserAgent:', userAgent);
    setCurrentBrowser(browser);
  };

  // Helper to extract browser name from user agent
  const getBrowserNameFromUA = (userAgent: string): string => {
    // Extract browser name from user agent
    const browserMatch = userAgent.match(/(Firefox|Chrome|Safari|Opera|Edge|Edg)\/[\d.]+/);
    return browserMatch ? browserMatch[1] : 'Desconhecido';
  };

  // Load extension information from API
  const loadExtensionInfo = async () => {
    try {
      const response = await fetch('/api/extension/manifest');
      const result = await response.json();

      if (result.success) {
        setExtensionInfo(result.data);
      } else {
        throw new Error(result.error || 'Failed to load extension info');
      }
    } catch (error) {
      console.error('Error loading extension info:', error);
      setInstallMessage('Erro ao carregar informações da extensão');
      setInstallStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle auto-install
  const handleAutoInstall = async () => {
    if (!currentBrowser || !currentBrowser.supported) {
      handleManualDownload();
      return;
    }

    setInstallStatus('installing');
    setInstallMessage('Iniciando instalação automática...');

    try {
      // Call install API
      const response = await fetch('/api/extension/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          browser: getBrowserKey(currentBrowser.name),
          autoActivate: true
        })
      });

      const result = await response.json();

      if (result.success) {
        setInstallStatus('success');
        setInstallMessage('Download iniciado! Siga as instruções para completar a instalação.');
        setShowInstructions(true);
        
        // Execute auto-install script
        if (result.data.autoScript) {
          executeInstallScript(result.data.autoScript);
        }
      } else {
        throw new Error(result.error || 'Installation failed');
      }
    } catch (error) {
      console.error('Auto-install error:', error);
      setInstallStatus('error');
      setInstallMessage('Instalação automática falhou. Use o download manual.');
    }
  };

  // Handle manual download
  const handleManualDownload = () => {
    const downloadUrl = extensionInfo?.downloadUrl || '/api/extension/download';
    
    // Create download link
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'office-display-extension.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setInstallMessage('Download iniciado! Extraia o arquivo e siga as instruções de instalação.');
    setShowInstructions(true);
  };

  // Execute install script
  const executeInstallScript = (script: string) => {
    try {
      // Execute the auto-install helper script
      eval(script);
    } catch (error) {
      console.error('Script execution error:', error);
    }
  };

  // Get browser key for API
  const getBrowserKey = (browserName: string): string => {
    if (browserName.includes('Chrome')) return 'chrome';
    if (browserName.includes('Edge')) return 'edge';
    if (browserName.includes('Firefox')) return 'firefox';
    return 'chrome'; // Default
  };

  // Open browser extensions page with fallback
  const openExtensionsPage = () => {
    if (!currentBrowser) {
      alert('Navegador não detectado. Por favor, abra manualmente a página de extensões do seu navegador.');
      return;
    }

    if (!currentBrowser.supported) {
      showBrowserSpecificInstructions(currentBrowser);
      return;
    }

    if (!currentBrowser.extensionsUrl) {
      showBrowserSpecificInstructions(currentBrowser);
      return;
    }

    try {
      // Try to open extensions page
      window.open(currentBrowser.extensionsUrl, '_blank');
    } catch (error) {
      console.error('Failed to open extensions page:', error);
      showBrowserSpecificInstructions(currentBrowser);
    }
  };

  // Show browser-specific instructions
  const showBrowserSpecificInstructions = (browser: BrowserInfo) => {
    let instructions = '';
    let title = 'Como abrir extensões';

    if (browser.name.includes('Edge')) {
      title = 'Microsoft Edge - Extensões';
      instructions = `Para abrir extensões no Edge:

1. Digite na barra de endereço: edge://extensions/
2. Ou vá em Menu (⋯) → Extensões
3. Ative "Modo do desenvolvedor" 
4. Clique "Carregar extensão descompactada"`;
    } 
    else if (browser.name.includes('Chrome')) {
      title = 'Google Chrome - Extensões';
      instructions = `Para abrir extensões no Chrome:

1. Digite na barra de endereço: chrome://extensions/
2. Ou vá em Menu (⋮) → Mais ferramentas → Extensões  
3. Ative "Modo do desenvolvedor"
4. Clique "Carregar sem compactação"`;
    }
    else if (browser.name.includes('Firefox')) {
      title = 'Mozilla Firefox - Complementos';
      instructions = `Para abrir extensões no Firefox:

1. Digite na barra de endereço: about:addons
2. Ou vá em Menu (☰) → Complementos e temas
3. Vá na aba "Extensões"
4. Use "Instalar complemento de um arquivo" (precisa ser assinado)`;
    }
    else if (browser.name.includes('Safari')) {
      title = 'Safari - Não Suportado';
      instructions = `Safari não suporta extensões de desenvolvimento local facilmente.

Recomendamos usar:
• Chrome, Edge, Firefox ou outro navegador baseado em Chromium
• Ou instalar via Mac App Store (requer publicação)`;
    }
    else if (browser.name.includes('Brave') || browser.name.includes('Opera') || browser.name.includes('Chromium')) {
      title = `${browser.name} - Extensões (Baseado em Chromium)`;
      instructions = `Para abrir extensões no ${browser.name}:

1. Digite na barra de endereço: chrome://extensions/
2. Ou vá no menu → Extensões
3. Ative "Modo do desenvolvedor"  
4. Clique "Carregar sem compactação"`;
    }
    else {
      title = 'Navegador Não Identificado';
      instructions = `Não conseguimos identificar seu navegador: ${browser.name}

Se for baseado em Chromium (Chrome, Edge, Brave, etc.):
• Digite: chrome://extensions/ ou edge://extensions/

Se for Firefox:  
• Digite: about:addons

Se for Safari:
• Use outro navegador (recomendado: Chrome ou Edge)`;
    }

    // Show instructions in a better format
    setInstallMessage(`${title}\n\n${instructions}`);
    setInstallStatus('error'); // Use error styling to make it stand out
    setShowInstructions(true);
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center p-8">
          <Loader className="w-8 h-8 animate-spin text-blue-500 mr-3" />
          <span>Carregando informações da extensão...</span>
        </div>
      </div>
    );
  }

  if (!extensionInfo) {
    return (
      <div className="card">
        <div className="text-center p-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Extensão Não Encontrada
          </h3>
          <p className="text-gray-600">
            A extensão Office Display não foi encontrada no servidor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Zap className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Extensão de Navegador
              </h2>
              <p className="text-gray-600 mt-1">
                Automatize a captura de credenciais com nossa extensão
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm text-gray-500">
              Versão {extensionInfo.version}
            </div>
            <div className="flex items-center mt-1">
              <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">Disponível</span>
            </div>
          </div>
        </div>
      </div>

      {/* Browser Detection */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          🔍 Navegador Detectado
        </h3>
        
        {currentBrowser && (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              {currentBrowser.icon}
              <div>
                <div className="font-medium text-gray-900">
                  {currentBrowser.name}
                </div>
                <div className="text-sm text-gray-500">
                  {currentBrowser.supported ? 'Compatível' : 'Não suportado'}
                </div>
              </div>
            </div>
            
            {currentBrowser.supported && (
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-green-600 font-medium">
                  Suportado
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Installation Options */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          ⚡ Instalação
        </h3>

        <div className="space-y-4">
          {/* Auto Install Button */}
          {currentBrowser?.supported && (
            <div>
              <button
                onClick={handleAutoInstall}
                disabled={installStatus === 'installing'}
                className="w-full btn-primary flex items-center justify-center text-lg py-4"
              >
                {installStatus === 'installing' ? (
                  <>
                    <Loader className="w-6 h-6 animate-spin mr-3" />
                    Instalando...
                  </>
                ) : (
                  <>
                    <Zap className="w-6 h-6 mr-3" />
                    Instalação Automática
                  </>
                )}
              </button>
              
              <p className="text-sm text-gray-500 mt-2 text-center">
                Download automático + instruções guiadas
              </p>
            </div>
          )}

          {/* Manual Download */}
          <div>
            <button
              onClick={handleManualDownload}
              className="w-full btn-secondary flex items-center justify-center py-3"
            >
              <Download className="w-5 h-5 mr-2" />
              Download Manual
            </button>
            
            <p className="text-sm text-gray-500 mt-2 text-center">
              Baixar arquivo ZIP e instalar manualmente
            </p>
          </div>
        </div>

        {/* Status Message */}
        {installMessage && (
          <div className={`mt-4 p-4 rounded-lg ${
            installStatus === 'success' ? 'bg-green-50 border border-green-200' :
            installStatus === 'error' ? 'bg-yellow-50 border border-yellow-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-start">
              <div className="flex-shrink-0 mr-3 mt-0.5">
                {installStatus === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                {installStatus === 'error' && <Info className="w-5 h-5 text-yellow-600" />}
                {installStatus === 'installing' && <Loader className="w-5 h-5 animate-spin text-blue-600" />}
              </div>
              <div className="flex-1">
                <pre className={`whitespace-pre-wrap text-sm ${
                  installStatus === 'success' ? 'text-green-800' :
                  installStatus === 'error' ? 'text-yellow-800' :
                  'text-blue-800'
                } font-medium`}>{installMessage}</pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Installation Instructions */}
      {showInstructions && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📋 Instruções de Instalação
          </h3>

          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">
                Próximos Passos:
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-blue-800">
                <li>Extraia o arquivo ZIP baixado</li>
                <li>
                  Abra a página de extensões do seu navegador
                  {currentBrowser && (
                    <button
                      onClick={openExtensionsPage}
                      className="ml-2 text-blue-600 hover:text-blue-800 underline"
                    >
                      <ExternalLink className="w-4 h-4 inline" />
                      Abrir agora
                    </button>
                  )}
                </li>
                <li>Ative o "Modo do desenvolvedor"</li>
                <li>Clique em "Carregar sem compactação"</li>
                <li>Selecione a pasta extraída da extensão</li>
                <li>A extensão será ativada automaticamente!</li>
              </ol>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-start">
                <Info className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-yellow-800">
                  <p className="font-medium mb-1">Dica:</p>
                  <p className="text-sm">
                    Após a instalação, a extensão se conectará automaticamente 
                    ao Office Display e começará a detectar credenciais em 
                    dashboards como Grafana, Tableau, etc.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extension Status (if installed) */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📊 Status da Extensão
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">?</div>
            <div className="text-sm text-gray-600 mt-1">Status</div>
            <div className="text-xs text-gray-500 mt-1">
              Instale para ver status
            </div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">0</div>
            <div className="text-sm text-gray-600 mt-1">Domínios</div>
            <div className="text-xs text-gray-500 mt-1">
              Monitorados
            </div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">-</div>
            <div className="text-sm text-gray-600 mt-1">Última Sync</div>
            <div className="text-xs text-gray-500 mt-1">
              Aguardando instalação
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};