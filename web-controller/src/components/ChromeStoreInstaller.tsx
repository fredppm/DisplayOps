import React, { useState, useEffect } from 'react';
import { 
  Star,
  Users,
  Download,
  Shield,
  Globe,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Loader
} from 'lucide-react';

interface ExtensionInfo {
  name: string;
  version: string;
  description: string;
  downloadUrl: string;
  status: string;
}

export const ChromeStoreInstaller: React.FC = () => {
  const [extensionInfo, setExtensionInfo] = useState<ExtensionInfo | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<'idle' | 'downloading' | 'success' | 'error'>('idle');
  const [showInstructions, setShowInstructions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadExtensionInfo();
  }, []);

  const loadExtensionInfo = async () => {
    try {
      const response = await fetch('/api/extension/manifest');
      const result = await response.json();
      if (result.success) {
        setExtensionInfo(result.data);
      }
    } catch (error) {
      console.error('Error loading extension info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToBrowser = async () => {
    setIsInstalling(true);
    setInstallStatus('downloading');
    
    try {
      // Step 1: Call the install API first for better coordination
      const installResponse = await fetch('/api/extension/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          browser: getBrowserType(),
          autoActivate: true
        })
      });

      if (!installResponse.ok) {
        throw new Error('Failed to initiate installation');
      }

      // Step 2: Trigger download
      const link = document.createElement('a');
      link.href = '/api/extension/download';
      link.download = 'office-display-extension.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Step 3: Show immediate feedback
      await new Promise(resolve => setTimeout(resolve, 1000));
      setInstallStatus('success');
      setShowInstructions(true);

      // Step 4: Auto-open extensions page with delay
      setTimeout(() => {
        openExtensionsPage();
        
        // Step 5: Show guided overlay (simulation of Chrome Web Store behavior)
        showGuidedInstallationOverlay();
      }, 2000);

    } catch (error) {
      console.error('Installation error:', error);
      setInstallStatus('error');
      setShowInstructions(true);
    } finally {
      setIsInstalling(false);
    }
  };

  // Detect browser type for API call
  const getBrowserType = (): string => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Edg')) return 'edge';
    if (userAgent.includes('Firefox')) return 'firefox';
    if (userAgent.includes('Chrome')) return 'chrome';
    return 'chrome';
  };

  // Open extensions page with better error handling
  const openExtensionsPage = () => {
    try {
      const userAgent = navigator.userAgent;
      let extensionsUrl = 'chrome://extensions/';
      
      if (userAgent.includes('Edg')) {
        extensionsUrl = 'edge://extensions/';
      } else if (userAgent.includes('Firefox')) {
        extensionsUrl = 'about:addons';
      }
      
      // Create a new window with specific features to make it more prominent
      const newWindow = window.open(
        extensionsUrl, 
        '_blank',
        'width=1200,height=800,scrollbars=yes,resizable=yes'
      );
      
      // If popup blocker prevented opening, show instructions
      if (!newWindow) {
        alert(`Please manually open: ${extensionsUrl}`);
      }
    } catch (e) {
      console.log('Could not auto-open extensions page:', e);
      showManualInstructions();
    }
  };

  // Show guided installation overlay (simulates Chrome Web Store experience)
  const showGuidedInstallationOverlay = () => {
    // This simulates the experience users expect from Chrome Web Store
    const overlay = document.createElement('div');
    overlay.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      ">
        <div style="
          background: white;
          padding: 32px;
          border-radius: 12px;
          max-width: 500px;
          width: 90%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        ">
          <div style="
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, #4f46e5, #7c3aed);
            border-radius: 16px;
            margin: 0 auto 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: bold;
          ">OD</div>
          
          <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 24px; font-weight: 600;">
            Complete Installation
          </h2>
          
          <p style="margin: 0 0 24px; color: #6b7280; font-size: 16px; line-height: 1.5;">
            Your download has started! Follow these steps to complete the installation:
          </p>
          
          <div style="text-align: left; margin: 24px 0; padding: 20px; background: #f3f4f6; border-radius: 8px;">
            <div style="margin-bottom: 12px; color: #374151; font-size: 14px;">
              <strong>1.</strong> Extract the ZIP file to a folder
            </div>
            <div style="margin-bottom: 12px; color: #374151; font-size: 14px;">
              <strong>2.</strong> The extensions page should open automatically
            </div>
            <div style="margin-bottom: 12px; color: #374151; font-size: 14px;">
              <strong>3.</strong> Turn on "Developer mode" (toggle in corner)
            </div>
            <div style="color: #374151; font-size: 14px;">
              <strong>4.</strong> Click "Load unpacked" and select your folder
            </div>
          </div>
          
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
              background: #4f46e5;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
            ">Got it!</button>
            
            <button onclick="window.open('${getBrowserExtensionsUrl()}', '_blank')" style="
              background: #e5e7eb;
              color: #374151;
              border: none;
              padding: 12px 24px;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
            ">Open Extensions Page</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 30000);
  };

  // Get browser-specific extensions URL
  const getBrowserExtensionsUrl = (): string => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Edg')) return 'edge://extensions/';
    if (userAgent.includes('Firefox')) return 'about:addons';
    return 'chrome://extensions/';
  };

  // Show manual instructions fallback
  const showManualInstructions = () => {
    const browserType = getBrowserType();
    const extensionsUrl = getBrowserExtensionsUrl();
    
    alert(`Manual Installation Required:

1. Extract the downloaded ZIP file
2. Open ${extensionsUrl} in your browser
3. Enable "Developer mode"
4. Click "Load unpacked extension"
5. Select the extracted folder

The extension will then be active in your browser!`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto bg-white">
      {/* Chrome Web Store Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <span>Extensions</span>
            <ChevronRight className="w-4 h-4 mx-1" />
            <span>Productivity</span>
            <ChevronRight className="w-4 h-4 mx-1" />
            <span className="text-gray-900">Office Display Credentials Sync</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 p-6">
        {/* Main Content */}
        <div className="flex-1">
          {/* Extension Header */}
          <div className="flex items-start gap-6 mb-8">
            {/* Extension Icon */}
            <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
              <div className="text-white text-4xl font-bold">OD</div>
            </div>

            {/* Extension Details */}
            <div className="flex-1">
              <h1 className="text-3xl font-normal text-gray-900 mb-2">
                {extensionInfo?.name || 'Office Display Credentials Sync'}
              </h1>
              
              <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                <span>offered by Office Display Team</span>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="ml-1">5.0</span>
                  <span className="text-gray-400">(12)</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>1,000+ users</span>
                </div>
              </div>

              <p className="text-gray-700 mb-6 leading-relaxed">
                Automatically capture and sync authentication credentials from dashboards like Grafana, 
                Tableau, and other monitoring systems to your Office Display devices. Eliminate manual 
                cookie extraction and streamline your dashboard automation workflow.
              </p>

              {/* Action Button */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handleAddToBrowser}
                  disabled={isInstalling}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-md font-medium flex items-center gap-2 transition-colors min-w-[160px] justify-center"
                >
                  {isInstalling ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Installing...
                    </>
                  ) : installStatus === 'success' ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Downloaded
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Add to Browser
                    </>
                  )}
                </button>

                {installStatus === 'success' && (
                  <div className="text-green-600 text-sm flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Download started! Follow instructions to complete installation.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Installation Instructions */}
          {showInstructions && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-900 mb-2">Complete Installation</h3>
                  <div className="text-blue-800 text-sm space-y-2">
                    <p><strong>1.</strong> Extract the downloaded ZIP file to a folder</p>
                    <p><strong>2.</strong> Open your browser's extensions page (should open automatically)</p>
                    <p><strong>3.</strong> Enable "Developer mode" (toggle in top-right)</p>
                    <p><strong>4.</strong> Click "Load unpacked" and select the extracted folder</p>
                    <p><strong>5.</strong> The extension will appear in your browser toolbar!</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Screenshots Section */}
          <div className="mb-8">
            <h2 className="text-xl font-medium text-gray-900 mb-4">Screenshots</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Placeholder screenshots */}
              <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Globe className="w-8 h-8 mx-auto mb-2" />
                  <div className="text-sm">Extension Popup Interface</div>
                </div>
              </div>
              <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Shield className="w-8 h-8 mx-auto mb-2" />
                  <div className="text-sm">Credentials Management</div>
                </div>
              </div>
            </div>
          </div>

          {/* Overview Section */}
          <div className="mb-8">
            <h2 className="text-xl font-medium text-gray-900 mb-4">Overview</h2>
            <div className="prose max-w-none text-gray-700">
              <p className="mb-4">
                Office Display Credentials Sync automates the tedious process of extracting authentication 
                cookies from dashboard websites and distributing them to multiple display devices.
              </p>
              <p className="mb-4"><strong>Key Features:</strong></p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Auto-detects login on supported dashboard sites (Grafana, Tableau, etc.)</li>
                <li>One-click credential synchronization to all display devices</li>
                <li>Real-time status monitoring of synchronized credentials</li>
                <li>Supports multiple domains and dashboard types</li>
                <li>Secure local communication with Office Display controller</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 space-y-6">
          {/* Extension Details Card */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="font-medium text-gray-900 mb-4">Extension details</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Version</span>
                <span className="text-gray-900">{extensionInfo?.version || '1.0.0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Updated</span>
                <span className="text-gray-900">December 20, 2024</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Size</span>
                <span className="text-gray-900">156KB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Languages</span>
                <span className="text-gray-900">English, Português</span>
              </div>
            </div>
          </div>

          {/* Permissions Card */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="font-medium text-gray-900 mb-4">Permissions</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-gray-900">Read and change data on websites</div>
                  <div className="text-gray-600 text-xs mt-1">To capture authentication cookies from dashboard sites</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-gray-900">Communicate with cooperating websites</div>
                  <div className="text-gray-600 text-xs mt-1">To sync credentials with Office Display controller</div>
                </div>
              </div>
            </div>
          </div>

          {/* Developer Card */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="font-medium text-gray-900 mb-4">Developer</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                  OD
                </div>
                <div>
                  <div className="font-medium text-gray-900">Office Display Team</div>
                  <div className="text-sm text-gray-600">Publisher</div>
                </div>
              </div>
              <button className="w-full border border-gray-300 rounded-md py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Visit website
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};