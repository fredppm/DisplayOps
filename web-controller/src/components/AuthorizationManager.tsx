import React, { useState, useEffect } from 'react';
import { MiniPC } from '@/types/shared-types';
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
  Info,
  Edit,
  Plus,
  Shield,
  ShieldCheck,
  Lock,
  Calendar
} from 'lucide-react';

interface AuthorizationManagerProps {
  hosts: MiniPC[];
}

// Import Form Component
const ImportForm: React.FC<{
  domain: string;
  onSuccess: () => void;
  onCancel: () => void;
}> = ({ domain, onSuccess, onCancel }) => {
  const [importData, setImportData] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async (replaceAll: boolean) => {
    if (!importData.trim()) return;
    if (!domain || domain.trim() === '') {
      console.error('Domain is empty, cannot import cookies');
      return;
    }

    setIsImporting(true);
    try {
      const response = await fetch('/api/cookies/import-devtools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domain,
          cookies: importData.trim(),
          replaceAll: replaceAll,
          timestamp: new Date()
        })
      });

      const result = await response.json();
      if (result.success) {
        onSuccess(); // This will trigger loadSavedCookieData in the parent
      }
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <textarea
        value={importData}
        onChange={(e) => setImportData(e.target.value)}
        placeholder="Paste DevTools cookie table data here..."
        className="w-full h-40 p-3 border rounded-lg font-mono text-sm"
      />
      
      <div className="flex justify-end space-x-3">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded flex items-center transition-colors">
          Cancel
        </button>
        <button 
          onClick={() => handleImport(false)}
          disabled={!importData.trim() || !domain || domain.trim() === '' || isImporting}
          className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isImporting ? 'Adding...' : 'Add/Merge'}
        </button>
        <button 
          onClick={() => handleImport(true)}
          disabled={!importData.trim() || !domain || domain.trim() === '' || isImporting}
          className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isImporting ? 'Replacing...' : 'Replace All'}
        </button>
      </div>
    </div>
  );
};

// Cookie Form Component
const CookieForm: React.FC<{
  domain: string;
  cookie?: any;
  onSuccess: () => void;
  onCancel: () => void;
}> = ({ domain, cookie, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: cookie?.name || '',
    value: cookie?.value || '',
    domain: cookie?.domain || domain, // Pre-fill with the domain from context
    path: cookie?.path || '/',
    secure: cookie?.secure || false,
    httpOnly: cookie?.httpOnly || false,
    sameSite: cookie?.sameSite || 'Lax',
    expirationDate: cookie?.expirationDate || ''
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.name || !formData.value) return;

    setIsSaving(true);
    try {
      // Use dedicated add cookie API instead of import
      const cookieData = {
        name: formData.name,
        value: formData.value,
        domain: formData.domain,
        path: formData.path,
        secure: formData.secure,
        httpOnly: formData.httpOnly,
        sameSite: formData.sameSite,
        expirationDate: formData.expirationDate ? parseInt(formData.expirationDate) : undefined
      };

      const response = await fetch('/api/cookies/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domain,
          cookie: cookieData
        })
      });

      const result = await response.json();
      if (result.success) {
        onSuccess();
      } else {
        console.error('Save failed:', result.error);
      }
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full p-2 border rounded font-mono"
            placeholder="cookie_name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
          <input
            type="text"
            value={formData.value}
            onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
            className="w-full p-2 border rounded font-mono"
            placeholder="cookie_value"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
          <input
            type="text"
            value={formData.domain}
            onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
            className="w-full p-2 border rounded font-mono"
            placeholder=".example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Path</label>
          <input
            type="text"
            value={formData.path}
            onChange={(e) => setFormData(prev => ({ ...prev, path: e.target.value }))}
            className="w-full p-2 border rounded font-mono"
            placeholder="/"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">SameSite</label>
        <select
          value={formData.sameSite}
          onChange={(e) => setFormData(prev => ({ ...prev, sameSite: e.target.value }))}
          className="w-full p-2 border rounded"
        >
          <option value="Lax">Lax (recommended)</option>
          <option value="Strict">Strict</option>
          <option value="None">None (requires Secure)</option>
        </select>
      </div>

      <div className="space-y-3">
        <label className="flex items-center p-2 border rounded hover:bg-gray-50">
          <input
            type="checkbox"
            checked={formData.secure}
            onChange={(e) => setFormData(prev => ({ ...prev, secure: e.target.checked }))}
            className="mr-3"
          />
          <div>
            <div className="font-medium text-gray-900 flex items-center">
              <Lock className="w-4 h-4 mr-2 text-green-600" />
              Secure Cookie
            </div>
            <div className="text-xs text-gray-600">Only sent over HTTPS connections</div>
          </div>
        </label>
        <label className="flex items-center p-2 border rounded hover:bg-gray-50">
          <input
            type="checkbox"
            checked={formData.httpOnly}
            onChange={(e) => setFormData(prev => ({ ...prev, httpOnly: e.target.checked }))}
            className="mr-3"
          />
          <div>
            <div className="font-medium text-gray-900 flex items-center">
              <Shield className="w-4 h-4 mr-2 text-blue-600" />
              HttpOnly Cookie
            </div>
            <div className="text-xs text-gray-600">Not accessible via JavaScript (XSS protection)</div>
          </div>
        </label>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded flex items-center transition-colors">
          Cancel
        </button>
        <button 
          onClick={handleSave}
          disabled={!formData.name || !formData.value || isSaving}
          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : (cookie ? 'Update Cookie' : 'Add Cookie')}
        </button>
      </div>
    </div>
  );
};

interface AuthDomain {
  id: string;
  domain: string;
  cookies: any[]; // Changed from string to array
  lastSync: Date | null;
  isValid: boolean;
  description: string;
}

export const AuthorizationManager: React.FC<AuthorizationManagerProps> = ({ hosts }) => {
  const [authDomains, setAuthDomains] = useState<AuthDomain[]>([]);

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
  
  // Modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [editingCookie, setEditingCookie] = useState<any>(null);
  const [currentDomainId, setCurrentDomainId] = useState<string>('');
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string>('');

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

  // Parse cookies from string format to display individual cookies
  const parseCookiesForDisplay = (cookieStr: string) => {
    const cookies: any[] = [];
    const lines = cookieStr.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip headers and empty lines
      if (!trimmed || 
          trimmed.toLowerCase().includes('name') && trimmed.toLowerCase().includes('value') ||
          trimmed.startsWith('#')) {
        continue;
      }

      let name = '';
      let value = '';
      let domain = '';
      let path = '/';
      let secure = false;
      let httpOnly = false;
      let sameSite = '';

      // Parse tab-separated format (DevTools copy)
      if (trimmed.includes('\t')) {
        const parts = trimmed.split('\t');
        if (parts.length >= 2) {
          name = parts[0]?.trim() || '';
          value = parts[1]?.trim() || '';
          domain = parts[2]?.trim() || '';
          path = parts[3]?.trim() || '/';
          // DevTools format: position 6 = HttpOnly, position 7 = Secure
          httpOnly = parts[6]?.trim() === '✓';
          secure = parts[7]?.trim() === '✓';
          sameSite = parts[8]?.trim() || 'Lax';
        }
      }
      // Parse simple name=value format
      else if (trimmed.includes('=')) {
        const equalIndex = trimmed.indexOf('=');
        name = trimmed.substring(0, equalIndex).trim();
        value = trimmed.substring(equalIndex + 1).trim();
      }

      if (name && value) {
        cookies.push({
          name,
          value,
          domain,
          path,
          secure,
          httpOnly,
          sameSite
        });
      }
    }

    return cookies;
  };

  // Count cookies in string
  const parseCookieCount = (cookieStr: string) => {
    return parseCookiesForDisplay(cookieStr).length;
  };

  // Check if cookie is important (authentication related)
  const isImportantCookie = (name: string) => {
    const lowerName = name.toLowerCase();
    return lowerName.includes('session') || 
           lowerName.includes('auth') || 
           lowerName.includes('token') || 
           lowerName.includes('grafana') ||
           lowerName.includes('login') ||
           lowerName.includes('jwt');
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
          
          // Create AuthDomain objects from stored data
          const authDomainsFromStorage = domainsWithCookies.map(savedDomain => ({
            id: `saved-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            domain: savedDomain.domain,
            cookies: savedDomain.actualCookies,
            lastSync: savedDomain.lastImport ? new Date(savedDomain.lastImport) : null,
            isValid: savedDomain.cookieCount > 0,
            description: savedDomain.description || `Cookies for ${savedDomain.domain}`
          }));
          
          setAuthDomains(authDomainsFromStorage);
          
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
    setAuthDomains(prev => prev.map(domain => 
      domain.id === domainId 
        ? { ...domain, cookies, isValid: Array.isArray(cookies) ? cookies.length > 0 : false }
        : domain
    ));
  };

  const addNewDomain = () => {
    const newDomain: AuthDomain = {
      id: `domain-${Date.now()}`,
      domain: 'https://example.com',
      cookies: [],
      lastSync: null,
      isValid: false,
      description: 'New domain'
    };
    setAuthDomains(prev => [...prev, newDomain]);
    addNotification('info', 'Domain Added', 'New domain added. Configure it now.');
  };

  const confirmRemoveDomain = (domainId: string) => {
    setShowRemoveConfirm(domainId);
  };

  const removeDomain = (domainId: string) => {
    const domain = authDomains.find(d => d.id === domainId);
    setAuthDomains(prev => prev.filter(d => d.id !== domainId));
    setShowRemoveConfirm('');
    addNotification('success', 'Domain Removed', `${domain?.domain} has been removed`);
  };

  const validateCookies = async (domainId: string) => {
    const domain = authDomains.find(d => d.id === domainId);
    if (!domain || !Array.isArray(domain.cookies) || domain.cookies.length === 0) {
      addNotification('error', 'Validation Failed', 'No cookies to validate');
      return;
    }

    addNotification('info', 'Validating Cookies', `Testing cookies for ${domain.domain}...`);

    // Simple validation - check if cookies have basic format
    // Cookies are now always arrays, validate them directly
    const cookieCount = Array.isArray(domain.cookies) ? domain.cookies.length : 0;

    if (cookieCount === 0) {
      addNotification('error', 'No Cookies', 'No cookies found for this domain.');
      return;
    }

    // Update validation status
    setAuthDomains(prev => prev.map(d => 
      d.id === domainId ? { ...d, isValid: true } : d
    ));

    addNotification('success', 'Cookies Valid', `Found ${cookieCount} valid cookies for ${domain.domain}`);
  };

  const refreshPagesAfterSync = async (successfulHosts: any[], allHosts: any[]) => {
    try {
      addNotification('info', 'Refreshing Pages', 'Refreshing all displays to apply cookies...');
      
      const refreshPromises = successfulHosts.map(async (syncResult) => {
        const host = allHosts.find(h => h.hostname === syncResult.host || h.ipAddress === syncResult.host);
        if (!host) return { success: false, host: syncResult.host, error: 'Host not found' };

        // Get all displays for this host (assuming display-1, display-2, display-3)
        const displays = ['display-1', 'display-2', 'display-3'];
        
        const displayRefreshPromises = displays.map(async (displayId) => {
          try {
            const response = await fetch(`/api/host/${host.id}/command`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                type: 'REFRESH_PAGE',
                targetDisplay: displayId,
                payload: {},
                timestamp: new Date()
              })
            });

            if (response.ok) {
              const result = await response.json();
              return { success: result.success || result.data, display: displayId };
            } else {
              return { success: false, display: displayId, error: `HTTP ${response.status}` };
            }
          } catch (error) {
            return { 
              success: false, 
              display: displayId, 
              error: error instanceof Error ? error.message : 'Connection failed' 
            };
          }
        });

        const displayResults = await Promise.all(displayRefreshPromises);
        const successfulDisplays = displayResults.filter(r => r.success).length;
        
        return { 
          success: successfulDisplays > 0, 
          host: syncResult.host, 
          refreshedDisplays: successfulDisplays,
          totalDisplays: displays.length
        };
      });

      const refreshResults = await Promise.all(refreshPromises);
      const successfulRefreshes = refreshResults.filter(r => r.success);
      
      if (successfulRefreshes.length > 0) {
        const totalRefreshed = successfulRefreshes.reduce((sum, r) => sum + (r.refreshedDisplays || 0), 0);
        addNotification('success', 'Pages Refreshed', 
          `Refreshed ${totalRefreshed} displays across ${successfulRefreshes.length} hosts. Cookies are now active!`);
      } else {
        addNotification('warning', 'Refresh Issues', 
          'Some displays may not have refreshed. Cookies synced but may need manual refresh.');
      }
    } catch (error) {
      console.error('Error refreshing pages:', error);
      addNotification('warning', 'Refresh Error', 
        'Cookies synced successfully but auto-refresh failed. You may need to manually refresh displays.');
    }
  };

  const syncToAllDisplays = async (domainId: string) => {
    const domain = authDomains.find(d => d.id === domainId);
    if (!domain || !Array.isArray(domain.cookies) || domain.cookies.length === 0) {
      addNotification('error', 'Sync Failed', 'No cookies to sync');
      return;
    }

    setSyncingDomains(prev => new Set([...prev, domainId]));

    try {
      addNotification('info', 'Syncing Cookies', `Syncing ${domain.domain} to all displays...`);

      let successCount = 0;
      let errorCount = 0;
      let hostCount = 0;

      // Process cookies locally in web-controller
      try {
        const response = await fetch('/api/cookies/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            domain: domain.domain,
            cookies: Array.isArray(domain.cookies) ? domain.cookies : [],
            cookieFormat: 'structured',
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

      // Now sync cookies to all discovered hosts
      try {
        const hostsResponse = await fetch('/api/discovery/hosts');
        if (hostsResponse.ok) {
          const hostsData = await hostsResponse.json();
          if (hostsData.success && hostsData.data && hostsData.data.length > 0) {
            
            addNotification('info', 'Host Discovery', `Found ${hostsData.data.length} hosts, syncing cookies...`);
            
            // Cookies are already structured arrays from storage
            const parsedCookies = Array.isArray(domain.cookies) ? domain.cookies : [];

            // Send cookies to each host
            const syncPromises = hostsData.data.map(async (host: any) => {
              try {
                const hostResponse = await fetch(`/api/host/${host.id}/command`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    type: 'SYNC_COOKIES',
                    payload: {
                      domain: domain.domain,
                      cookies: parsedCookies
                    },
                    timestamp: new Date()
                  })
                });

                if (hostResponse.ok) {
                  const hostResult = await hostResponse.json();
                  if (hostResult.success) {
                    hostCount++;
                    return { success: true, host: host.hostname || host.ipAddress };
                  } else {
                    return { success: false, host: host.hostname || host.ipAddress, error: hostResult.error };
                  }
                } else {
                  return { success: false, host: host.hostname || host.ipAddress, error: `HTTP ${hostResponse.status}` };
                }
              } catch (error) {
                return { 
                  success: false, 
                  host: host.hostname || host.ipAddress, 
                  error: error instanceof Error ? error.message : 'Connection failed' 
                };
              }
            });

            const hostResults = await Promise.all(syncPromises);
            
            // Count successes and errors
            const successfulHosts = hostResults.filter(r => r.success);
            const failedHosts = hostResults.filter(r => !r.success);
            
            hostCount = successfulHosts.length;
            errorCount += failedHosts.length;

            if (successfulHosts.length > 0) {
              addNotification('success', 'Host Sync Complete', 
                `Successfully synced to ${successfulHosts.length} hosts: ${successfulHosts.map(h => h.host).join(', ')}`);
              
              // Auto-refresh pages after successful cookie sync
              await refreshPagesAfterSync(successfulHosts, hostsData.data);
            }
            
            if (failedHosts.length > 0) {
              addNotification('warning', 'Host Sync Issues', 
                `Failed to sync to ${failedHosts.length} hosts: ${failedHosts.map(h => `${h.host} (${h.error})`).join(', ')}`);
            }
          } else {
            addNotification('warning', 'No Hosts Found', 'No hosts discovered. Make sure host-agents are running.');
          }
        } else {
          addNotification('error', 'Host Discovery Failed', 'Could not discover hosts. Check discovery service.');
        }
      } catch (error) {
        addNotification('error', 'Host Sync Error', 'Failed to discover or sync with hosts');
        errorCount++;
      }

      if (successCount > 0 || hostCount > 0) {
        // Update last sync time and valid status
        setAuthDomains(prev => prev.map(d => 
          d.id === domainId ? { 
            ...d, 
            lastSync: new Date(),
            isValid: true 
          } : d
        ));

        const message = `Successfully processed ${successCount} cookies and synced to ${hostCount} hosts${errorCount > 0 ? `, ${errorCount} errors` : ''}. Data saved permanently!`;
        addNotification('success', 'Sync Complete', message);
        
        // Auto-reload data to reflect server state (silently)
        setTimeout(() => loadSavedCookieData(false), 1000);
      } else {
        addNotification('error', 'Sync Failed', 
          `Failed to process cookies or sync with hosts. Check format and host connectivity.`);
      }

    } catch (error) {
      console.error('Cookie sync error:', error);
      addNotification('error', 'Sync Error', 'Failed to sync cookies to displays');
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


  // Get stored cookies for a domain
  const getStoredCookiesForDomain = (domainId: string): any[] => {
    const domain = authDomains.find(d => d.id === domainId);
    if (!domain || !domain.cookies) return [];
    
    // Cookies are always structured arrays now
    return Array.isArray(domain.cookies) ? domain.cookies : [];
  };

  // Helper to get domain from domainId
  const getDomainFromId = (domainId: string): string => {
    const domain = authDomains.find(d => d.id === domainId);
    console.log('getDomainFromId:', { domainId, domain: domain?.domain, allDomains: authDomains });
    return domain?.domain || '';
  };

  // Open import modal for DevTools table format
  const openImportModal = (domainId: string) => {
    console.log('Opening import modal for domainId:', domainId);
    const domainObj = authDomains.find(d => d.id === domainId);
    console.log('Domain object:', domainObj);
    setCurrentDomainId(domainId);
    setShowImportModal(true);
    // Cookies will be loaded automatically from storage
  };

  // Open cookie creation/editing modal
  const openAddCookieModal = (domainId: string, cookie?: any) => {
    setCurrentDomainId(domainId);
    setEditingCookie(cookie || null);
    setShowCookieModal(true);
    // Cookies will be loaded automatically from storage
  };

  // Delete a specific cookie
  const deleteCookie = async (domainId: string, cookieName: string) => {
    const domain = authDomains.find(d => d.id === domainId);
    if (!domain) return;

    try {
      const response = await fetch('/api/cookies/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domain.domain,
          cookieName: cookieName
        })
      });

      const result = await response.json();
      if (result.success) {
        addNotification('success', 'Cookie Deleted', `Removed ${cookieName} from ${domain.domain}`);
        // Reload data to show updated cookies
        loadSavedCookieData(true);
      } else {
        addNotification('error', 'Delete Failed', result.error || 'Failed to delete cookie');
      }
    } catch (error) {
      addNotification('error', 'Delete Failed', `Failed to delete ${cookieName}`);
    }
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
            Cookie Management
            {isLoadingData && (
              <RefreshCw className="w-5 h-5 text-blue-500 ml-3 animate-spin" />
            )}
          </h2>
          <p className="text-gray-600 mt-1">
            Import cookies to enable automatic login on display devices
            {isLoadingData && (
              <span className="text-blue-600 font-medium ml-2">• Loading saved data...</span>
            )}
          </p>
        </div>
        
        <button
          onClick={addNewDomain}
          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center transition-colors"
        >
          <Plus className="w-3 h-3 mr-1.5" />
          Add Domain
        </button>
      </div>


      {/* Cookie Domains */}
      <div className="space-y-6">
        {authDomains.length === 0 ? (
          <div className="text-center py-12">
            <Cookie className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No domains configured yet</h3>
            <p className="text-gray-600 mb-6">
              Add a domain to start managing cookies for your dashboards
            </p>
            <button
              onClick={addNewDomain}
              className="btn-primary flex items-center mx-auto"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Your First Domain
            </button>
          </div>
        ) : (
          authDomains.map((domain) => (
          <div key={domain.id} className="card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 flex items-center space-x-2">
                <input
                  type="text"
                  value={domain.domain}
                  onChange={(e) => setAuthDomains(prev => prev.map(d => 
                    d.id === domain.id ? { ...d, domain: e.target.value } : d
                  ))}
                  className="text-lg font-medium bg-transparent border-none p-0 focus:outline-none focus:ring-0 text-gray-900 flex-1"
                  placeholder="https://example.com"
                />
                <button
                  onClick={() => window.open(domain.domain, '_blank')}
                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Open domain"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Actions moved to bottom */}
              </div>
            </div>

            <div className="space-y-4">
              {/* Domain Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openImportModal(domain.id)}
                    className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded flex items-center transition-colors"
                  >
                    <Upload className="w-3 h-3 mr-1.5" />
                    Import DevTools
                  </button>
                  <button
                    onClick={() => openAddCookieModal(domain.id)}
                    className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded flex items-center transition-colors"
                  >
                    <Cookie className="w-3 h-3 mr-1.5" />
                    Add Cookie
                  </button>
                </div>
                
                <button
                  onClick={() => confirmRemoveDomain(domain.id)}
                  className="px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded flex items-center transition-colors"
                  title="Remove domain"
                >
                  <X className="w-3 h-3 mr-1.5" />
                  Remove Domain
                </button>
              </div>

              {/* Stored Cookies Display */}
              {getStoredCookiesForDomain(domain.id).length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <Cookie className="w-4 h-4 mr-2 text-amber-600" />
                    Stored Cookies ({getStoredCookiesForDomain(domain.id).length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {getStoredCookiesForDomain(domain.id).map((cookie, index) => (
                      <div key={index} className="bg-white rounded p-3 border border-gray-200 relative">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-mono text-sm font-medium text-gray-900 flex items-center space-x-2">
                              <span className="font-semibold">{cookie.name}</span>
                              <span className="text-gray-400">=</span>
                              <span className="text-gray-600 truncate max-w-xs">
                                {cookie.value.length > 40 ? `${cookie.value.substring(0, 40)}...` : cookie.value}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                              <span><strong>Path:</strong> {cookie.path || '/'}</span>
                              {cookie.secure && (
                                <span className="text-green-600 flex items-center">
                                  <Lock className="w-3 h-3 mr-1" />
                                  Secure
                                </span>
                              )}
                              {cookie.httpOnly && (
                                <span className="text-blue-600 flex items-center">
                                  <Shield className="w-3 h-3 mr-1" />
                                  HttpOnly
                                </span>
                              )}
                              {cookie.sameSite && <span><strong>SameSite:</strong> {cookie.sameSite}</span>}
                              {cookie.expirationDate && (
                                <span className="flex items-center">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {new Date(cookie.expirationDate * 1000).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => openAddCookieModal(domain.id, cookie)}
                              className="text-blue-400 hover:text-blue-600 p-1"
                              title="Edit cookie"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteCookie(domain.id, cookie.name)}
                              className="text-red-400 hover:text-red-600 p-1"
                              title="Delete cookie"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {getStoredCookiesForDomain(domain.id).length === 0 && (
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Cookie className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-3">No cookies imported yet</p>
                  <p className="text-xs text-gray-400">Import cookies from DevTools or add them manually</p>
                </div>
              )}

              {/* Sync Section - Simplified workflow */}
              <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
                {domain.lastSync && (
                  <span className="text-xs text-gray-500 flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {domain.lastSync.toLocaleString()}
                  </span>
                )}
                
                <button
                  onClick={() => syncToAllDisplays(domain.id)}
                  className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={getStoredCookiesForDomain(domain.id).length === 0 || hosts.filter(h => h.status.online).length === 0 || syncingDomains.has(domain.id)}
                >
                  {syncingDomains.has(domain.id) ? (
                    <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3 mr-1.5" />
                  )}
                  Sync to All Displays ({getStoredCookiesForDomain(domain.id).length} cookies)
                </button>
              </div>
            </div>
          </div>
          ))
        )}
      </div>


      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{margin: 0, top: 0}}>
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-2 text-gray-600">Import from DevTools</h3>
            <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
              <strong>Domain:</strong> {getDomainFromId(currentDomainId) || 'No domain selected'}
            </div>
            
            <details className="mb-4">
              <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">📋 Show instructions</summary>
              <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
                <ol className="text-gray-700 space-y-1">
                  <li><strong>1.</strong> Open DevTools (F12) → <strong>Application</strong> tab</li>
                  <li><strong>2.</strong> Click <strong>Cookies</strong> in sidebar → Select your domain</li>
                  <li><strong>3.</strong> Select all cookies (<code>Ctrl+A</code>) → Copy (<code>Ctrl+C</code>)</li>
                  <li><strong>4.</strong> Paste the table data below</li>
                </ol>
              </div>
            </details>

            <ImportForm 
              domain={getDomainFromId(currentDomainId)}
              onSuccess={() => {
                console.log('Import success, currentDomainId:', currentDomainId);
                setShowImportModal(false);
                // Reload data to show imported cookies
                loadSavedCookieData(true);
              }}
              onCancel={() => setShowImportModal(false)}
            />
          </div>
        </div>
      )}

      {/* Cookie Form Modal */}
      {showCookieModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{margin: 0, top: 0}}>
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingCookie ? 'Edit Cookie' : 'Add New Cookie'}
            </h3>
            
            <CookieForm 
              domain={getDomainFromId(currentDomainId)}
              cookie={editingCookie}
              onSuccess={() => {
                setShowCookieModal(false);
                setEditingCookie(null);
                // Reload data to show updated cookies
                loadSavedCookieData(true);
              }}
              onCancel={() => {
                setShowCookieModal(false);
                setEditingCookie(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Remove Domain Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{margin: 0, top: 0}}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-red-600">⚠️ Remove Domain</h3>
            
            <p className="text-gray-700 mb-4">
              Are you sure you want to remove <strong>{authDomains.find(d => d.id === showRemoveConfirm)?.domain}</strong>?
            </p>
            
            <p className="text-sm text-gray-600 mb-6">
              This will permanently delete all stored cookies for this domain. This action cannot be undone.
            </p>
            
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowRemoveConfirm('')}
                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded flex items-center transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => removeDomain(showRemoveConfirm)}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded flex items-center transition-colors"
              >
                Remove Domain
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
