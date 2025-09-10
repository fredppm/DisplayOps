import React, { useState, useEffect } from 'react';
import { Download, ChevronDown, ExternalLink, X, CheckCircle, ChevronUp } from 'lucide-react';

interface BrowserInfo {
  name: string;
  extensionsUrl: string;
  instructions: string;
}

export const ExtensionDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showFullModal, setShowFullModal] = useState(false);
  const [currentBrowser, setCurrentBrowser] = useState<BrowserInfo | null>(null);
  const [showAllBrowsers, setShowAllBrowsers] = useState(false);

  // Browser detection
  useEffect(() => {
    detectBrowser();
  }, []);

  // Close dropdown when clicking outside, pressing ESC, or when modals open
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is outside the dropdown component
      const isInsideDropdown = target.closest('.extension-dropdown-container');
      
      // Check if any modal is opening by looking for modal elements
      const modalExists = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50');
      
      if ((!isInsideDropdown || modalExists) && isOpen) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleGlobalClick);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleGlobalClick);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen]);

  const detectBrowser = () => {
    const userAgent = navigator.userAgent;
    let browser: BrowserInfo;

    if (userAgent.includes('Edg/')) {
      browser = {
        name: 'Microsoft Edge',
        extensionsUrl: 'edge://extensions/',
        instructions: 'Type edge://extensions/ in the address bar'
      };
    } else if (userAgent.includes('Chrome/') && !userAgent.includes('Edg/')) {
      browser = {
        name: 'Google Chrome',
        extensionsUrl: 'chrome://extensions/',
        instructions: 'Type chrome://extensions/ in the address bar'
      };
    } else if (userAgent.includes('Firefox/')) {
      browser = {
        name: 'Mozilla Firefox',
        extensionsUrl: 'about:addons',
        instructions: 'Type about:addons in the address bar'
      };
    } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) {
      browser = {
        name: 'Safari',
        extensionsUrl: '',
        instructions: 'Safari does not support development extensions. Use Chrome, Edge or Firefox.'
      };
    } else if (userAgent.includes('OPR/') || userAgent.includes('Opera/')) {
      browser = {
        name: 'Opera',
        extensionsUrl: 'chrome://extensions/',
        instructions: 'Type chrome://extensions/ in the address bar'
      };
    } else if (userAgent.includes('Brave/')) {
      browser = {
        name: 'Brave',
        extensionsUrl: 'chrome://extensions/',
        instructions: 'Type chrome://extensions/ in the address bar'
      };
    } else {
      browser = {
        name: 'Unknown Browser',
        extensionsUrl: 'chrome://extensions/',
        instructions: 'Try chrome://extensions/ in the address bar'
      };
    }

    setCurrentBrowser(browser);
  };

  // All browsers for the expandable section
  const getAllBrowsers = (): BrowserInfo[] => [
    {
      name: 'Google Chrome',
      extensionsUrl: 'chrome://extensions/',
      instructions: 'Type chrome://extensions/ in the address bar'
    },
    {
      name: 'Microsoft Edge',
      extensionsUrl: 'edge://extensions/', 
      instructions: 'Type edge://extensions/ in the address bar'
    },
    {
      name: 'Mozilla Firefox',
      extensionsUrl: 'about:addons',
      instructions: 'Type about:addons in the address bar'
    },
    {
      name: 'Opera',
      extensionsUrl: 'chrome://extensions/',
      instructions: 'Type chrome://extensions/ in the address bar'
    },
    {
      name: 'Brave',
      extensionsUrl: 'chrome://extensions/',
      instructions: 'Type chrome://extensions/ in the address bar'
    },
    {
      name: 'Vivaldi',
      extensionsUrl: 'chrome://extensions/',
      instructions: 'Type chrome://extensions/ in the address bar'
    },
    {
      name: 'Safari',
      extensionsUrl: '',
      instructions: 'Does not support development extensions. Use another browser.'
    }
  ];

  const handleQuickInstall = async () => {
    // Quick install - start download and show modal
    const link = document.createElement('a');
    link.href = '/api/extension/download';
    link.download = 'office-display-extension.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setIsOpen(false);
    setShowFullModal(true);
    
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
        window.open(currentBrowser.extensionsUrl, '_blank');
      } else {
        alert(currentBrowser.instructions);
      }
    } catch (e) {
      console.log('Could not auto-open extensions page:', e);
      alert(currentBrowser.instructions);
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

  return (
    <>
      {/* Dropdown Button */}
      <div className="relative extension-dropdown-container">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Extension</span>
          <ChevronDown className="w-3 h-3" />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-dropdown-backdrop"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Menu Content */}
            <div className="absolute right-0 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-dropdown">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Browser Extension</h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Automate dashboard credential capture and sync.
                </p>
                
                <div className="space-y-2">
                  <button
                    onClick={handleQuickInstall}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Quick Download
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setShowFullModal(true);
                    }}
                    className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Full Instructions
                  </button>
                </div>
                
              </div>
            </div>
          </>
        )}
      </div>

      {/* Installation Modal - same as after download */}
      {showFullModal && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-modal p-4" style={{ margin: 0 }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Extension Installation</h2>
              <button
                onClick={() => setShowFullModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Download Button */}
            <div className="mb-6">
              <button
                onClick={handleQuickInstall}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download Extension
              </button>
            </div>

            {/* Instructions */}
            <div className="space-y-4 mb-6">
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">1</div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">Extract file</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Unzip the file to a folder on your computer</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">2</div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">Open extensions</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Go to your {currentBrowser?.name || 'browser'} extensions page
                    </div>
                    {currentBrowser && (
                      <button
                        onClick={openExtensionsPage}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open {currentBrowser.extensionsUrl || 'extensions page'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">3</div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">Enable developer mode</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Turn on &quot;Developer mode&quot; toggle in the top right corner</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">4</div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">Load extension</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Click &quot;Load unpacked&quot; and select the extracted folder</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowFullModal(false)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                Got it!
              </button>
              <button
                onClick={openExtensionsPage}
                className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 py-3 px-4 rounded-lg font-medium transition-colors"
              >
                Open Extensions
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};