import React, { useState, useEffect } from 'react';
import { Download, X, ExternalLink, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface BrowserInfo {
  name: string;
  extensionsUrl: string;
  instructions: string;
}

export const SimpleExtensionInstaller: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [currentBrowser, setCurrentBrowser] = useState<BrowserInfo | null>(null);
  const [showAllBrowsers, setShowAllBrowsers] = useState(false);

  // Browser detection and configuration
  useEffect(() => {
    detectBrowser();
  }, []);

  const detectBrowser = () => {
    const userAgent = navigator.userAgent;
    let browser: BrowserInfo;

    if (userAgent.includes('Edg/')) {
      browser = {
        name: 'Microsoft Edge',
        extensionsUrl: 'edge://extensions/',
        instructions: 'Digite edge://extensions/ na barra de endereço'
      };
    } else if (userAgent.includes('Chrome/') && !userAgent.includes('Edg/')) {
      browser = {
        name: 'Google Chrome',
        extensionsUrl: 'chrome://extensions/',
        instructions: 'Digite chrome://extensions/ na barra de endereço'
      };
    } else if (userAgent.includes('Firefox/')) {
      browser = {
        name: 'Mozilla Firefox',
        extensionsUrl: 'about:addons',
        instructions: 'Digite about:addons na barra de endereço'
      };
    } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) {
      browser = {
        name: 'Safari',
        extensionsUrl: '',
        instructions: 'Safari não suporta extensões de desenvolvimento. Use Chrome, Edge ou Firefox.'
      };
    } else if (userAgent.includes('OPR/') || userAgent.includes('Opera/')) {
      browser = {
        name: 'Opera',
        extensionsUrl: 'chrome://extensions/',
        instructions: 'Digite chrome://extensions/ na barra de endereço'
      };
    } else if (userAgent.includes('Brave/')) {
      browser = {
        name: 'Brave',
        extensionsUrl: 'chrome://extensions/',
        instructions: 'Digite chrome://extensions/ na barra de endereço'
      };
    } else {
      browser = {
        name: 'Navegador Desconhecido',
        extensionsUrl: 'chrome://extensions/',
        instructions: 'Tente chrome://extensions/ na barra de endereço'
      };
    }

    console.log('Browser detected:', browser.name);
    setCurrentBrowser(browser);
  };

  // All browsers for the expandable section
  const getAllBrowsers = (): BrowserInfo[] => [
    {
      name: 'Google Chrome',
      extensionsUrl: 'chrome://extensions/',
      instructions: 'Digite chrome://extensions/ na barra de endereço'
    },
    {
      name: 'Microsoft Edge',
      extensionsUrl: 'edge://extensions/', 
      instructions: 'Digite edge://extensions/ na barra de endereço'
    },
    {
      name: 'Mozilla Firefox',
      extensionsUrl: 'about:addons',
      instructions: 'Digite about:addons na barra de endereço'
    },
    {
      name: 'Opera',
      extensionsUrl: 'chrome://extensions/',
      instructions: 'Digite chrome://extensions/ na barra de endereço'
    },
    {
      name: 'Brave',
      extensionsUrl: 'chrome://extensions/',
      instructions: 'Digite chrome://extensions/ na barra de endereço'
    },
    {
      name: 'Vivaldi',
      extensionsUrl: 'chrome://extensions/',
      instructions: 'Digite chrome://extensions/ na barra de endereço'
    },
    {
      name: 'Safari',
      extensionsUrl: '',
      instructions: 'Não suporta extensões de desenvolvimento. Use outro navegador.'
    }
  ];

  const handleInstallClick = async () => {
    // Start download immediately
    const link = document.createElement('a');
    link.href = '/api/extension/download';
    link.download = 'office-display-extension.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadStarted(true);
    setShowModal(true);

    // Try to open extensions page for detected browser
    setTimeout(() => {
      if (currentBrowser && currentBrowser.extensionsUrl) {
        openExtensionsPage();
      }
    }, 1000);
  };

  const openExtensionsPage = () => {
    if (!currentBrowser) return;
    
    try {
      if (currentBrowser.extensionsUrl) {
        // Try to open the browser-specific URL
        window.open(currentBrowser.extensionsUrl, '_blank');
      } else {
        // Fallback for unsupported browsers
        showBrowserInstructions();
      }
    } catch (e) {
      console.log('Could not auto-open extensions page:', e);
      showBrowserInstructions();
    }
  };

  const openSpecificBrowser = (browser: BrowserInfo) => {
    try {
      if (browser.extensionsUrl) {
        window.open(browser.extensionsUrl, '_blank');
      } else {
        alert(browser.instructions);
      }
    } catch (e) {
      alert(browser.instructions);
    }
  };

  const showBrowserInstructions = () => {
    if (currentBrowser) {
      alert(currentBrowser.instructions);
    }
  };

  return (
    <>
      {/* Simple Installation Card */}
      <div className="max-w-2xl mx-auto">
        <div className="card text-center p-8">
          {/* Extension Icon */}
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <div className="text-white text-2xl font-bold">🔐</div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Office Display Browser Extension
          </h1>
          
          <p className="text-gray-600 mb-8 max-w-lg mx-auto">
            Automatize a captura de credenciais de dashboards e sincronize com todos os displays do escritório.
          </p>

          {/* Install Button */}
          <button
            onClick={handleInstallClick}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold text-lg flex items-center gap-3 mx-auto transition-colors shadow-lg hover:shadow-xl"
          >
            <Download className="w-6 h-6" />
            Instalar Extensão
          </button>

          {downloadStarted && (
            <div className="mt-4 text-green-600 flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>Download iniciado! Siga as instruções para completar.</span>
            </div>
          )}
        </div>

        {/* Simple Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="card text-center p-4">
            <div className="text-blue-600 mb-2">⚡</div>
            <h3 className="font-semibold text-gray-900 mb-1">Rápido</h3>
            <p className="text-sm text-gray-600">Instalação em 2 minutos</p>
          </div>
          
          <div className="card text-center p-4">
            <div className="text-green-600 mb-2">🔒</div>
            <h3 className="font-semibold text-gray-900 mb-1">Seguro</h3>
            <p className="text-sm text-gray-600">Dados ficam no seu computador</p>
          </div>
          
          <div className="card text-center p-4">
            <div className="text-purple-600 mb-2">🚀</div>
            <h3 className="font-semibold text-gray-900 mb-1">Automático</h3>
            <p className="text-sm text-gray-600">Sincroniza com um clique</p>
          </div>
        </div>
      </div>

      {/* Installation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Complete a Instalação</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Download Status */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <div className="font-medium text-green-900">Download Concluído!</div>
                  <div className="text-sm text-green-700">O arquivo ZIP foi baixado para seu computador.</div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-4 mb-6">
              <h3 className="font-semibold text-gray-900">Próximos passos:</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">1</div>
                  <div>
                    <div className="font-medium text-gray-900">Extrair arquivo</div>
                    <div className="text-sm text-gray-600">Descompacte o ZIP em uma pasta no seu computador</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">2</div>
                  <div>
                    <div className="font-medium text-gray-900">Abrir extensões</div>
                    <div className="text-sm text-gray-600 mb-2">
                      Vá para a página de extensões do {currentBrowser?.name || 'seu navegador'}
                    </div>
                    {currentBrowser && (
                      <button
                        onClick={openExtensionsPage}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 mb-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Abrir {currentBrowser.extensionsUrl || 'página de extensões'}
                      </button>
                    )}
                    
                    {/* Expandable browser list */}
                    <div className="mt-2">
                      <button
                        onClick={() => setShowAllBrowsers(!showAllBrowsers)}
                        className="text-gray-500 hover:text-gray-700 text-xs font-medium flex items-center gap-1"
                      >
                        {showAllBrowsers ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        Outros navegadores
                      </button>
                      
                      {showAllBrowsers && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                          {getAllBrowsers().map((browser, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-700">{browser.name}</span>
                              {browser.extensionsUrl ? (
                                <button
                                  onClick={() => openSpecificBrowser(browser)}
                                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  {browser.extensionsUrl}
                                </button>
                              ) : (
                                <span className="text-xs text-gray-500">Não suportado</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">3</div>
                  <div>
                    <div className="font-medium text-gray-900">Ativar modo desenvolvedor</div>
                    <div className="text-sm text-gray-600">Ative o botão "Modo do desenvolvedor" no canto superior direito</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">4</div>
                  <div>
                    <div className="font-medium text-gray-900">Carregar extensão</div>
                    <div className="text-sm text-gray-600">Clique "Carregar sem compactação" e selecione a pasta extraída</div>
                  </div>
                </div>
              </div>
            </div>


            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                Entendi!
              </button>
              <button
                onClick={openExtensionsPage}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 py-3 px-4 rounded-lg font-medium transition-colors"
              >
                Abrir Extensões
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};