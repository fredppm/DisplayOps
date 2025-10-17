import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MiniPC } from '@/types/shared-types';
import { 
  Cookie, 
  Copy, 
  Check, 
  AlertCircle, 
  ExternalLink,
  RefreshCw,
  Download,
  Eye,
  EyeOff,
  X,
  CheckCircle,
  Info,
  Shield,
  ShieldCheck,
  Lock,
  Calendar
} from 'lucide-react';

interface AuthorizationManagerProps {
  hosts: MiniPC[];
  hideHeader?: boolean;
}

interface AuthDomain {
  id: string;
  domain: string;
  cookies: any[]; // Changed from string to array
  lastSync: Date | null;
  isValid: boolean;
  description: string;
}

export const AuthorizationManager: React.FC<AuthorizationManagerProps> = ({ hosts, hideHeader = false }) => {
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
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  
  // Modal states
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string>('');
  const [removingDomains, setRemovingDomains] = useState<Set<string>>(new Set());
  const [deletingCookies, setDeletingCookies] = useState<Set<string>>(new Set());

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

  const updateCookies = (domainId: string, cookies: any[]) => {
    setAuthDomains(prev => prev.map(domain => 
      domain.id === domainId 
        ? { ...domain, cookies, isValid: Array.isArray(cookies) ? cookies.length > 0 : false }
        : domain
    ));
  };


  const confirmRemoveDomain = (domainId: string) => {
    setShowRemoveConfirm(domainId);
  };

  const removeDomain = async (domainId: string) => {
    const domain = authDomains.find(d => d.id === domainId);
    if (!domain) return;

    setRemovingDomains(prev => new Set([...prev, domainId]));
    
    try {
      // Call API to remove domain from server
      const response = await fetch('/api/cookies/domain', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.domain })
      });

      const result = await response.json();
      
      if (result.success) {
        setAuthDomains(prev => prev.filter(d => d.id !== domainId));
        setShowRemoveConfirm('');
        addNotification('success', 'Domain Removed', `${domain.domain} and all its cookies have been removed`);
      } else {
        addNotification('error', 'Remove Failed', result.error || 'Failed to remove domain from server');
      }
    } catch (error) {
      console.error('Error removing domain:', error);
      addNotification('error', 'Remove Failed', 'Failed to communicate with server');
    } finally {
      setRemovingDomains(prev => {
        const newSet = new Set(prev);
        newSet.delete(domainId);
        return newSet;
      });
    }
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
      addNotification('info', 'Optimized Refresh', 'Refreshing only active displays with dashboards to apply cookies...');
      
      const refreshPromises = successfulHosts.map(async (syncResult) => {
        const host = allHosts.find(h => h.hostname === syncResult.host || h.ipAddress === syncResult.host);
        if (!host) return { success: false, host: syncResult.host, error: 'Host not found' };

        // Only refresh displays that have active dashboards
        const activeDisplays = (host.displayStates || [])
          .filter((display: any) => display.isActive && display.assignedDashboard)
          .map((display: any) => display.id);
        
        console.debug(`Cookie refresh: Host ${host.hostname} has ${activeDisplays.length} active displays with dashboards:`, activeDisplays);
        
        // Skip if no active displays with dashboards
        if (activeDisplays.length === 0) {
          console.debug(`Cookie refresh: Skipping host ${host.hostname} - no active displays with dashboards`);
          return { success: true, host: syncResult.host, refreshedDisplays: 0, totalDisplays: 0 };
        }
        
        const displayRefreshPromises = activeDisplays.map(async (displayId: string) => {
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
          totalDisplays: activeDisplays.length
        };
      });

      const refreshResults = await Promise.all(refreshPromises);
      const successfulRefreshes = refreshResults.filter(r => r.success);
      const totalRefreshed = successfulRefreshes.reduce((sum, r) => sum + (r.refreshedDisplays || 0), 0);
      const hostsWithActiveDisplays = successfulRefreshes.filter(r => r.totalDisplays > 0);
      
      if (totalRefreshed > 0) {
        addNotification('success', 'Pages Refreshed', 
          `Refreshed ${totalRefreshed} active displays across ${hostsWithActiveDisplays.length} hosts. Cookies are now active!`);
      } else if (successfulRefreshes.length > 0) {
        addNotification('info', 'Cookies Synced', 
          'Cookies synced successfully, but no active displays found to refresh.');
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

    // Single notification ID to update progress
    const syncNotificationId = Math.random().toString(36).substr(2, 9);
    
    // Initial notification
    const initialNotification = {
      id: syncNotificationId,
      type: 'info' as const,
      title: 'Syncing Cookies',
      message: `Starting sync for ${domain.domain}...`,
      timestamp: new Date()
    };
    setNotifications(prev => [initialNotification, ...prev.slice(0, 4)]);

    try {
      let successCount = 0;
      let errorCount = 0;
      let hostCount = 0;
      const results: string[] = [];

      // Process cookies locally in web-admin
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
            results.push(`Local: ${successCount} cookies processed`);
          } else {
            errorCount++;
            results.push('Local processing failed');
          }
        } else {
          errorCount++;
          results.push('Local processing failed');
        }
      } catch (error) {
        errorCount++;
        results.push('Local processing failed');
      }

      // Update notification - discovering hosts
      setNotifications(prev => prev.map(n => 
        n.id === syncNotificationId 
          ? { ...n, message: `Discovering hosts...` }
          : n
      ));

      // Now sync cookies to all discovered hosts
      try {
        const hostsResponse = await fetch('/api/discovery/hosts');
        if (hostsResponse.ok) {
          const hostsData = await hostsResponse.json();
          if (hostsData.success && hostsData.data && hostsData.data.length > 0) {
            
            // Update notification - syncing to hosts
            setNotifications(prev => prev.map(n => 
              n.id === syncNotificationId 
                ? { ...n, message: `Syncing to ${hostsData.data.length} hosts...` }
                : n
            ));
            
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
            
            const successfulHosts = hostResults.filter(r => r.success);
            const failedHosts = hostResults.filter(r => !r.success);
            
            hostCount = successfulHosts.length;
            errorCount += failedHosts.length;

            if (successfulHosts.length > 0) {
              results.push(`Hosts: ${successfulHosts.length}/${hostsData.data.length} synced`);
              
              // Auto-refresh pages after successful cookie sync
              await refreshPagesAfterSync(successfulHosts, hostsData.data);
            }
            
            if (failedHosts.length > 0) {
              results.push(`Failed: ${failedHosts.map(h => h.host).join(', ')}`);
            }
          } else {
            results.push('No hosts discovered');
          }
        } else {
          results.push('Host discovery failed');
        }
      } catch (error) {
        results.push('Host sync error');
        errorCount++;
      }

      // Final consolidated notification
      if (successCount > 0 || hostCount > 0) {
        // Update last sync time and valid status
        setAuthDomains(prev => prev.map(d => 
          d.id === domainId ? { 
            ...d, 
            lastSync: new Date(),
            isValid: true 
          } : d
        ));

        // Replace with success notification
        setNotifications(prev => prev.map(n => 
          n.id === syncNotificationId 
            ? { 
                ...n, 
                type: 'success' as const, 
                title: 'Sync Complete', 
                message: results.join(' • ') 
              }
            : n
        ));
        
        // Auto-reload data to reflect server state (silently)
        setTimeout(() => loadSavedCookieData(false), 1000);
      } else {
        // Replace with error notification
        setNotifications(prev => prev.map(n => 
          n.id === syncNotificationId 
            ? { 
                ...n, 
                type: 'error' as const, 
                title: 'Sync Failed', 
                message: 'No cookies synced. Check connectivity and format.' 
              }
            : n
        ));
      }

    } catch (error) {
      console.error('Cookie sync error:', error);
      // Replace with error notification
      setNotifications(prev => prev.map(n => 
        n.id === syncNotificationId 
          ? { 
              ...n, 
              type: 'error' as const, 
              title: 'Sync Error', 
              message: 'Failed to sync cookies to displays' 
            }
          : n
      ));
    } finally {
      setSyncingDomains(prev => {
        const newSet = new Set(prev);
        newSet.delete(domainId);
        return newSet;
      });
      
      // Auto-remove notification after 8 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== syncNotificationId));
      }, 8000);
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
  // Delete a specific cookie
  const deleteCookie = async (domainId: string, cookieName: string) => {
    const domain = authDomains.find(d => d.id === domainId);
    if (!domain) return;

    const cookieKey = `${domainId}-${cookieName}`;
    setDeletingCookies(prev => new Set([...prev, cookieKey]));

    try {
      const response = await fetch('/api/cookies/domain', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domain.domain,
          cookieName: cookieName
        })
      });

      const result = await response.json();
      if (result.success) {
        addNotification('success', 'Cookie Deleted', `Removed "${cookieName}" from ${domain.domain}`);
        // Reload data to show updated cookies
        loadSavedCookieData(false);
      } else {
        addNotification('error', 'Delete Failed', result.error || `Failed to delete "${cookieName}"`);
      }
    } catch (error) {
      console.error('Error deleting cookie:', error);
      addNotification('error', 'Delete Failed', `Failed to delete "${cookieName}" - check connection`);
    } finally {
      setDeletingCookies(prev => {
        const newSet = new Set(prev);
        newSet.delete(cookieKey);
        return newSet;
      });
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
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
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



      {/* Cookie Management Card */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
        {/* Header */}
        {!hideHeader && (
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100 flex items-center">
                  Cookie Management
                </h2>
                <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">
                  Import cookies to enable automatic login on display devices
                </div>
              </div>
              
              <div className="ml-6 flex items-center space-x-3">
                <Link
                  href="/cookies/new"
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Import Cookies
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Domains List */}
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {isLoadingData ? (
            // Loading skeletons - show 2 placeholder items
            Array.from({ length: 2 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="px-6 py-6 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <div className="h-5 bg-gray-300 rounded w-56"></div>
                      <div className="h-4 w-4 bg-gray-200 rounded"></div>
                    </div>
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center space-x-4">
                        <div className="h-3 bg-gray-200 rounded w-20"></div>
                        <div className="h-3 bg-gray-200 rounded w-16"></div>
                        <div className="h-3 bg-gray-200 rounded w-24"></div>
                      </div>
                    </div>
                  </div>
                  <div className="ml-6 flex items-center space-x-2">
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                    <div className="h-6 bg-gray-200 rounded w-14"></div>
                  </div>
                </div>
              </div>
            ))
          ) : authDomains.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <Cookie className="w-12 h-12 text-gray-400 dark:text-gray-500 dark:text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-2">No domains configured yet</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Use the "Import Cookies" button above to start managing cookies
              </p>
            </div>
          ) : (
            authDomains.map((domain) => {
            const storedCookies = getStoredCookiesForDomain(domain.id);
            const secureCookiesCount = storedCookies.filter(c => c.secure).length;
            const hasSecureCookies = secureCookiesCount > 0;
            const securityRatio = storedCookies.length > 0 ? Math.round((secureCookiesCount / storedCookies.length) * 100) : 0;
            
            return (
          <div 
            key={domain.id} 
            className={`px-6 py-6 ${
              selectedDomain === domain.id ? 'bg-gray-50 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
            } cursor-pointer transition-colors`}
            onClick={() => setSelectedDomain(
              selectedDomain === domain.id ? null : domain.id
            )}
          >
            {/* Domain Header */}
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1">
                  <span
                    className="text-lg font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100 bg-transparent border-none p-0 focus:outline-none focus:ring-0"
                  >{domain.domain}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(domain.domain, '_blank');
                    }}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Description with statistics */}
                <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">
                  <span className="flex items-center">
                    <Cookie className="w-4 h-4 mr-1" />
                    {storedCookies.length} {storedCookies.length === 1 ? 'cookie' : 'cookies'}
                  </span>
                  
                  {storedCookies.length > 0 && (
                    <>
                      <span className="flex items-center">
                        {hasSecureCookies ? (
                          <ShieldCheck className="w-4 h-4 mr-1 text-green-500" />
                        ) : (
                          <Shield className="w-4 h-4 mr-1 text-gray-400" />
                        )}
                        {securityRatio}% secure
                      </span>
                      
                      {domain.lastSync && (
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          Last sync: {domain.lastSync.toLocaleDateString()}
                        </span>
                      )}
                    </>
                  )}
                  
                  {storedCookies.length === 0 && (
                    <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400">No cookies imported yet</span>
                  )}
                </div>
              </div>
              
              {/* Domain Actions - Smaller buttons */}
              <div className="ml-6 flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    syncToAllDisplays(domain.id);
                  }}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-indigo-600 border border-transparent rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={storedCookies.length === 0 || syncingDomains.has(domain.id)}
                >
                  {syncingDomains.has(domain.id) ? (
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3 h-3 mr-1" />
                  )}
                  Sync to All
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmRemoveDomain(domain.id);
                  }}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/40 border border-red-300 dark:border-red-600 rounded hover:bg-red-100 dark:hover:bg-red-900/60 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={removingDomains.has(domain.id)}
                  title="Remove domain"
                >
                  {removingDomains.has(domain.id) ? (
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <X className="w-3 h-3 mr-1" />
                  )}
                  Remove
                </button>
              </div>
            </div>

            {/* Expanded Details - Show only when selected */}
            {selectedDomain === domain.id && (
              <div className="mt-4">
                {/* Stored Cookies Display */}
                {getStoredCookiesForDomain(domain.id).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center mb-3">
                    <Cookie className="w-4 h-4 mr-2 text-indigo-600" />
                    Stored Cookies ({getStoredCookiesForDomain(domain.id).length})
                  </h4>
                  
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {getStoredCookiesForDomain(domain.id).map((cookie, index) => (
                      <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            {/* Cookie Name and Value */}
                            <div className="flex items-center space-x-3 mb-3">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{cookie.name}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400 truncate font-mono">
                                  {cookie.value.length > 60 ? `${cookie.value.substring(0, 60)}...` : cookie.value}
                                </div>
                              </div>
                            </div>
                            
                            {/* Cookie Attributes */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                                Path: {cookie.path || '/'}
                              </span>
                              
                              {cookie.secure && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                  <Lock className="w-3 h-3 mr-1" />
                                  Secure
                                </span>
                              )}
                              
                              {cookie.httpOnly && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                  <Shield className="w-3 h-3 mr-1" />
                                  HttpOnly
                                </span>
                              )}
                              
                              {cookie.sameSite && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                                  SameSite: {cookie.sameSite}
                                </span>
                              )}
                              
                              {cookie.expirationDate && cookie.expirationDate !== 0 ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {new Date(cookie.expirationDate * 1000).toLocaleDateString()}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                  Session
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Cookie Actions */}
                          <div className="flex items-center ml-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCookie(domain.id, cookie.name);
                              }}
                              className="inline-flex items-center p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={deletingCookies.has(`${domain.id}-${cookie.name}`)}
                              title="Delete cookie"
                            >
                              {deletingCookies.has(`${domain.id}-${cookie.name}`) ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
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
                <div className="bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                  <Cookie className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">No cookies imported yet</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Use "Import Cookies" or "Download Extension" buttons at the top to get started</p>
                </div>
              )}
              </div>
            )}
          </div>
          );
          })
        )}
        </div>
      </div>

      {/* Remove Domain Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{margin: 0, top: 0}}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-red-600 dark:text-red-400">⚠️ Remove Domain</h3>
            
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to remove <strong>{authDomains.find(d => d.id === showRemoveConfirm)?.domain}</strong>?
            </p>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              This will permanently delete all stored cookies for this domain. This action cannot be undone.
            </p>
            
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowRemoveConfirm('')}
                className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded flex items-center transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => removeDomain(showRemoveConfirm)}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={removingDomains.has(showRemoveConfirm)}
              >
                {removingDomains.has(showRemoveConfirm) ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
                    Removing...
                  </>
                ) : (
                  'Remove Domain'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
