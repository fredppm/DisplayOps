import React, { useState, useEffect } from 'react';
import { MiniPC } from '@/types/types';
import { 
  Cookie, 
  Copy, 
  Check, 
  AlertCircle, 
  ExternalLink,
  RefreshCw,
  Upload,
  Download,
  Eye,
  EyeOff,
  X,
  CheckCircle,
  Info
} from 'lucide-react';

interface CookieManagerProps {
  hosts: MiniPC[];
}

interface CookieDomain {
  id: string;
  domain: string;
  cookies: string;
  lastSync: Date | null;
  isValid: boolean;
  description: string;
}

export const CookieManager: React.FC<CookieManagerProps> = ({ hosts }) => {
  const [cookieDomains, setCookieDomains] = useState<CookieDomain[]>([
    {
      id: 'grafana',
      domain: 'https://grafana.vtex.com',
      cookies: '',
      lastSync: null,
      isValid: false,
      description: 'Grafana monitoring dashboards'
    },
    {
      id: 'tableau',
      domain: 'https://healthmonitor.vtex.com/',
      cookies: '',
      lastSync: null,
      isValid: false,
      description: 'Health monitor for all systems'
    }
  ]);

  const [isLoadingData, setIsLoadingData] = useState(false);

  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp: Date;
  }>>([]);

  const [showInstructions, setShowInstructions] = useState(false);
  const [syncingDomains, setSyncingDomains] = useState<Set<string>>(new Set());
  const [showCookies, setShowCookies] = useState<Set<string>>(new Set());

  // Helper function to add notifications
  const addNotification = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    const notification = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title,
      message,
      timestamp: new Date()
    };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 8000);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Load saved cookie data from server
  const loadSavedCookieData = async (showNotifications = true) => {

    setIsLoadingData(true);
    try {
      if (showNotifications) {
        addNotification('info', 'Loading Data', 'Loading saved cookie data...');
      }
      
      const response = await fetch('/api/cookies/status');
      if (response.ok) {
        const result = await response.json();

        
        if (result.success && result.data && result.data.domainDetails && result.data.domainDetails.length > 0) {
          // Update existing domains with saved data

          
          // Load actual cookies for all domains
          const loadCookiesPromises = result.data.domainDetails.map(async (savedDomain: any) => {

            
            try {
              const encodedDomain = encodeURIComponent(savedDomain.domain);
              const cookieResponse = await fetch(`/api/cookies/domain/${encodedDomain}`);
              
              let actualCookies = '';
              if (cookieResponse.ok) {
                const cookieResult = await cookieResponse.json();
                if (cookieResult.success) {
                  actualCookies = cookieResult.data.cookies;

                }
              }
              
              return {
                ...savedDomain,
                actualCookies
              };
              
            } catch (error) {

              return {
                ...savedDomain,
                actualCookies: ''
              };
            }
          });
          
          const domainsWithCookies = await Promise.all(loadCookiesPromises);
          
          setCookieDomains(prev => {

            const updated = [...prev];
            
            domainsWithCookies.forEach(savedDomain => {
              const existingIndex = updated.findIndex(d => d.domain === savedDomain.domain);
              
              if (existingIndex >= 0) {

                // Update existing domain with actual cookies
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  cookies: savedDomain.actualCookies,
                  lastSync: savedDomain.lastImport ? new Date(savedDomain.lastImport) : null,
                  isValid: savedDomain.cookieCount > 0,
                  description: savedDomain.description || updated[existingIndex].description
                };
              } else {

                // Add new domain from saved data with actual cookies
                updated.push({
                  id: `saved-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  domain: savedDomain.domain,
                  cookies: savedDomain.actualCookies,
                  lastSync: savedDomain.lastImport ? new Date(savedDomain.lastImport) : null,
                  isValid: savedDomain.cookieCount > 0,
                  description: savedDomain.description
                });
              }
            });
            

            return updated;
          });
          
          if (showNotifications) {
            addNotification('success', 'Data Loaded', 
              `Loaded data for ${result.data.domains} domains with ${result.data.totalCookies} cookies`);
          }
          

        } else {

          if (showNotifications) {
            addNotification('info', 'No Saved Data', 'No previously saved cookies found');
          }
        }
      } else {
        if (showNotifications) {
          addNotification('warning', 'Load Warning', 'Could not load saved cookie data');
        }
      }
    } catch (error) {

      if (showNotifications) {
        addNotification('error', 'Load Failed', 'Failed to load saved cookie data');
      }
    } finally {
      setIsLoadingData(false);
    }
  };

  // Load data on component mount (silently)
  useEffect(() => {

    loadSavedCookieData(false);
  }, []);

  const updateCookies = (domainId: string, cookies: string) => {
    setCookieDomains(prev => prev.map(domain => 
      domain.id === domainId 
        ? { ...domain, cookies, isValid: cookies.trim().length > 0 }
        : domain
    ));
  };

  const addNewDomain = () => {
    const newDomain: CookieDomain = {
      id: `domain-${Date.now()}`,
      domain: 'https://example.com',
      cookies: '',
      lastSync: null,
      isValid: false,
      description: 'New domain'
    };
    setCookieDomains(prev => [...prev, newDomain]);
    addNotification('info', 'Domain Added', 'New domain added. Configure it now.');
  };

  const removeDomain = (domainId: string) => {
    const domain = cookieDomains.find(d => d.id === domainId);
    setCookieDomains(prev => prev.filter(d => d.id !== domainId));
    addNotification('success', 'Domain Removed', `${domain?.domain} has been removed`);
  };

  const validateCookies = async (domainId: string) => {
    const domain = cookieDomains.find(d => d.id === domainId);
    if (!domain || !domain.cookies.trim()) {
      addNotification('error', 'Validation Failed', 'No cookies to validate');
      return;
    }

    addNotification('info', 'Validating Cookies', `Testing cookies for ${domain.domain}...`);

    // Simple validation - check if cookies have basic format
    const cookieLines = domain.cookies.split('\n').filter(line => line.trim());
    const validCookies = cookieLines.filter(line => 
      line.includes('=') && !line.startsWith('#')
    );

    if (validCookies.length === 0) {
      addNotification('error', 'Invalid Format', 'No valid cookies found. Check the format.');
      return;
    }

    // Update validation status
    setCookieDomains(prev => prev.map(d => 
      d.id === domainId ? { ...d, isValid: true } : d
    ));

    addNotification('success', 'Cookies Valid', `Found ${validCookies.length} valid cookies for ${domain.domain}`);
  };

  const syncToAllTVs = async (domainId: string) => {
    const domain = cookieDomains.find(d => d.id === domainId);
    if (!domain || !domain.cookies.trim()) {
      addNotification('error', 'Sync Failed', 'No cookies to sync');
      return;
    }

    setSyncingDomains(prev => new Set([...prev, domainId]));

    try {
      addNotification('info', 'Syncing Cookies', `Syncing ${domain.domain} to all TVs...`);

      let successCount = 0;
      let errorCount = 0;

      // Process cookies locally in web-controller
      try {
        const response = await fetch('/api/cookies/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            domain: domain.domain,
            cookies: domain.cookies,
            timestamp: new Date()
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            successCount = result.data.injectedCount;


          } else {
            errorCount++;

          }
        } else {
          errorCount++;

        }
      } catch (error) {
        errorCount++;

      }

      if (successCount > 0) {
        // Update last sync time and valid status
        setCookieDomains(prev => prev.map(d => 
          d.id === domainId ? { 
            ...d, 
            lastSync: new Date(),
            isValid: true 
          } : d
        ));

        addNotification('success', 'Sync Complete', 
          `Successfully processed ${successCount} cookies${errorCount > 0 ? `, ${errorCount} errors` : ''}. Data saved permanently!`);
        
        // Auto-reload data to reflect server state (silently)
        setTimeout(() => loadSavedCookieData(false), 1000);
      } else {
        addNotification('error', 'Sync Failed', 
          `Failed to process cookies. Check format and try again.`);
      }

    } catch (error) {

      addNotification('error', 'Sync Error', 'Failed to sync cookies to TVs');
    } finally {
      setSyncingDomains(prev => {
        const newSet = new Set(prev);
        newSet.delete(domainId);
        return newSet;
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addNotification('success', 'Copied', 'Copied to clipboard');
    }).catch(() => {
      addNotification('error', 'Copy Failed', 'Failed to copy to clipboard');
    });
  };

  const toggleShowCookies = (domainId: string) => {
    setShowCookies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(domainId)) {
        newSet.delete(domainId);
      } else {
        newSet.add(domainId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-lg shadow-lg p-4 border-l-4 bg-white ${
                notification.type === 'success' ? 'border-green-500' :
                notification.type === 'error' ? 'border-red-500' :
                notification.type === 'warning' ? 'border-yellow-500' :
                'border-blue-500'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className={`mt-0.5 ${
                    notification.type === 'success' ? 'text-green-500' :
                    notification.type === 'error' ? 'text-red-500' :
                    notification.type === 'warning' ? 'text-yellow-500' :
                    'text-blue-500'
                  }`}>
                    {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
                    {notification.type === 'error' && <AlertCircle className="w-5 h-5" />}
                    {notification.type === 'warning' && <AlertCircle className="w-5 h-5" />}
                    {notification.type === 'info' && <Info className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900">
                      {notification.title}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {notification.message}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="text-gray-400 hover:text-gray-600 ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Cookie className="w-8 h-8 text-amber-500 mr-3" />
            Cookie Management
            {isLoadingData && (
              <RefreshCw className="w-5 h-5 text-blue-500 ml-3 animate-spin" />
            )}
          </h2>
          <p className="text-gray-600 mt-1">
            Import cookies to enable automatic login on TV displays
            {isLoadingData && (
              <span className="text-blue-600 font-medium ml-2">• Loading saved data...</span>
            )}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="btn-secondary flex items-center"
          >
            <Info className="w-5 h-5 mr-2" />
            How to Extract Cookies
          </button>
          
           <button
             onClick={() => loadSavedCookieData()}
             className="btn-secondary flex items-center"
             disabled={isLoadingData}
           >
             {isLoadingData ? (
               <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
             ) : (
               <Download className="w-5 h-5 mr-2" />
             )}
             Reload Data
           </button>
           
           <button
             onClick={() => {

               loadSavedCookieData(true);
             }}
             className="btn-secondary flex items-center"
           >
             <AlertCircle className="w-5 h-5 mr-2" />
             Force Load
           </button>
           

           
           <button
             onClick={addNewDomain}
             className="btn-primary flex items-center"
           >
             <Upload className="w-5 h-5 mr-2" />
             Add Domain
           </button>
        </div>
      </div>

      {/* Instructions Panel */}
      {showInstructions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            📋 How to Extract Cookies from Your Browser
          </h3>
          
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-3">
               <h4 className="font-medium text-blue-800">🥇 Chrome/Edge (Easier):</h4>
               <ol className="text-sm text-blue-700 space-y-2">
                 <li><strong>1.</strong> Go to your dashboard and make sure you're logged in</li>
                 <li><strong>2.</strong> Press <code className="bg-blue-100 px-1 rounded">F12</code> to open DevTools</li>
                 <li><strong>3.</strong> Go to <strong>Application</strong> tab</li>
                 <li><strong>4.</strong> Click <strong>Cookies</strong> in sidebar</li>
                 <li><strong>5.</strong> Select your domain (e.g., healthmonitor.vtex.com)</li>
                 <li><strong>6.</strong> <span className="bg-yellow-100 px-1 rounded font-semibold">Click on the first cookie row, then select ALL with Ctrl+A</span></li>
                 <li><strong>7.</strong> Copy with <code className="bg-blue-100 px-1 rounded">Ctrl+C</code></li>
                 <li><strong>8.</strong> Paste in the box below - our system now supports table format! ✨</li>
               </ol>
             </div>
             
             <div className="space-y-3">
               <h4 className="font-medium text-blue-800">🥈 Firefox:</h4>
               <ol className="text-sm text-blue-700 space-y-2">
                 <li><strong>1.</strong> Go to your dashboard and login</li>
                 <li><strong>2.</strong> Press <code className="bg-blue-100 px-1 rounded">F12</code> to open DevTools</li>
                 <li><strong>3.</strong> Go to <strong>Storage</strong> tab</li>
                 <li><strong>4.</strong> Click <strong>Cookies</strong></li>
                 <li><strong>5.</strong> Select your domain</li>
                 <li><strong>6.</strong> Select all cookies and copy</li>
                 <li><strong>7.</strong> Paste in the box below</li>
               </ol>
             </div>
           </div>
           
           <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
             <h4 className="font-medium text-green-800 mb-2">✅ Supported Formats:</h4>
             <div className="text-sm text-green-700 space-y-1">
               <div><strong>• Table format:</strong> Direct copy from DevTools (what you just tried)</div>
               <div><strong>• Simple format:</strong> cookie_name=cookie_value (one per line)</div>
               <div><strong>• Mixed format:</strong> Any combination of the above</div>
             </div>
           </div>
          
          <div className="mt-4 p-4 bg-blue-100 rounded">
            <p className="text-sm text-blue-800">
              <strong>💡 Tip:</strong> Make sure you're logged in to the dashboard before extracting cookies!
            </p>
          </div>
        </div>
      )}

      {/* Cookie Domains */}
      <div className="space-y-6">
        {cookieDomains.map((domain) => (
          <div key={domain.id} className="card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={domain.domain}
                    onChange={(e) => setCookieDomains(prev => prev.map(d => 
                      d.id === domain.id ? { ...d, domain: e.target.value } : d
                    ))}
                    className="text-lg font-medium bg-transparent border-none p-0 focus:outline-none focus:ring-0 text-gray-900"
                    placeholder="https://example.com"
                  />
                  <span className={`px-2 py-1 rounded text-xs ${
                    domain.isValid ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {domain.isValid ? 'Valid' : 'Not Set'}
                  </span>
                </div>
                <input
                  type="text"
                  value={domain.description}
                  onChange={(e) => setCookieDomains(prev => prev.map(d => 
                    d.id === domain.id ? { ...d, description: e.target.value } : d
                  ))}
                  className="text-sm text-gray-600 bg-transparent border-none p-0 focus:outline-none focus:ring-0 mt-1"
                  placeholder="Domain description"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.open(domain.domain, '_blank')}
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Open domain"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeDomain(domain.id)}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  title="Remove domain"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Cookies (paste from browser DevTools)
                  </label>
                  <button
                    onClick={() => toggleShowCookies(domain.id)}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center"
                  >
                    {showCookies.has(domain.id) ? (
                      <>
                        <EyeOff className="w-4 h-4 mr-1" />
                        Hide
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-1" />
                        Show
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={domain.cookies}
                  onChange={(e) => updateCookies(domain.id, e.target.value)}
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                  placeholder="Paste cookies here (name=value format, one per line)"
                  style={{
                    fontFamily: 'monospace',
                    filter: showCookies.has(domain.id) ? 'none' : 'blur(4px)'
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => validateCookies(domain.id)}
                    className="btn-secondary flex items-center text-sm"
                    disabled={!domain.cookies.trim()}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Validate
                  </button>
                  
                  <button
                    onClick={() => copyToClipboard(domain.cookies)}
                    className="btn-secondary flex items-center text-sm"
                    disabled={!domain.cookies.trim()}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </button>
                </div>

                <div className="flex items-center space-x-4">
                  {domain.lastSync && (
                    <span className="text-xs text-gray-500">
                      Last sync: {domain.lastSync.toLocaleString()}
                    </span>
                  )}
                  
                  <button
                    onClick={() => syncToAllTVs(domain.id)}
                    className="btn-primary flex items-center text-sm"
                    disabled={!domain.isValid || hosts.filter(h => h.status.online).length === 0 || syncingDomains.has(domain.id)}
                  >
                    {syncingDomains.has(domain.id) ? (
                      <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-1" />
                    )}
                    Sync to All TVs
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Sync Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">
              {cookieDomains.filter(d => d.isValid).length}
            </div>
            <div className="text-sm text-gray-600">Valid Domains</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {hosts.filter(h => h.status.online).length}
            </div>
            <div className="text-sm text-gray-600">Online Hosts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {cookieDomains.filter(d => d.lastSync).length}
            </div>
            <div className="text-sm text-gray-600">Synced Domains</div>
          </div>
        </div>
      </div>
    </div>
  );
};
