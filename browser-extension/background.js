// Office Display Credentials Sync - Background Service Worker

// Configuration
const DEFAULT_ENDPOINTS = [
  'http://localhost:3000',
  'http://localhost:3002', 
  'http://127.0.0.1:3000'
];

// Icon states
const ICON_STATES = {
  IDLE: 'idle',
  READY: 'ready', 
  SYNCED: 'synced',
  ERROR: 'error'
};

// Dashboard patterns for auto-detection
const DASHBOARD_PATTERNS = [
  /grafana\./i,
  /tableau\./i,
  /healthmonitor\./i,
  /dashboard\./i,
  /monitoring\./i,
  /metrics\./i,
  /kibana\./i,
  /sentry\./i,
  /datadog\./i
];

let currentState = {
  officeDisplay: null,
  domains: new Map(),
  currentDomain: null,
  hasCredentials: false
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Office Display Extension installed');
  await initializeExtension();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('Office Display Extension starting up');
  await initializeExtension();
});

// Initialize extension state
async function initializeExtension() {
  try {
    // Load stored configuration
    const stored = await chrome.storage.local.get(['officeDisplayEndpoint', 'monitoredDomains']);
    
    // Auto-detect Office Display endpoint if not configured
    if (!stored.officeDisplayEndpoint) {
      const endpoint = await autoDetectOfficeDisplay();
      if (endpoint) {
        await chrome.storage.local.set({ officeDisplayEndpoint: endpoint });
        currentState.officeDisplay = endpoint;
      }
    } else {
      currentState.officeDisplay = stored.officeDisplayEndpoint;
    }
    
    // Load monitored domains
    if (stored.monitoredDomains) {
      currentState.domains = new Map(Object.entries(stored.monitoredDomains));
    }
    
    updateIcon(ICON_STATES.IDLE);
    
  } catch (error) {
    console.error('Failed to initialize extension:', error);
  }
}

// Auto-detect Office Display endpoint
async function autoDetectOfficeDisplay() {
  console.log('Auto-detecting Office Display endpoint...');
  
  for (const endpoint of DEFAULT_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}/api/cookies/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2s timeout
      });
      
      if (response.ok) {
        console.log(`Found Office Display at: ${endpoint}`);
        return endpoint;
      }
    } catch (error) {
      // Continue to next endpoint
    }
  }
  
  console.log('No Office Display endpoint found, using default');
  return DEFAULT_ENDPOINTS[0];
}

// Handle tab activation/update
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  await handleTabChange(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    await handleTabChange(tab);
  }
});

// Handle tab changes
async function handleTabChange(tab) {
  if (!tab.url) return;
  
  try {
    const url = new URL(tab.url);
    const domain = url.hostname;
    
    // Skip non-HTTP(S) URLs
    if (!url.protocol.startsWith('http')) return;
    
    currentState.currentDomain = domain;
    
    // Check if this is a dashboard domain
    const isDashboard = DASHBOARD_PATTERNS.some(pattern => pattern.test(domain));
    
    if (isDashboard) {
      // Add to monitored domains if not already there
      if (!currentState.domains.has(domain)) {
        currentState.domains.set(domain, {
          name: detectDashboardName(domain),
          lastSync: null,
          status: 'detected'
        });
        await saveDomains();
      }
      
      // Check for credentials
      await checkCredentials(domain);
    } else {
      updateIcon(ICON_STATES.IDLE);
      currentState.hasCredentials = false;
    }
    
  } catch (error) {
    console.error('Error handling tab change:', error);
  }
}

// Detect dashboard name from domain
function detectDashboardName(domain) {
  if (domain.includes('grafana')) return 'Grafana Dashboard';
  if (domain.includes('tableau')) return 'Tableau Server';
  if (domain.includes('healthmonitor')) return 'Health Monitor';
  if (domain.includes('kibana')) return 'Kibana';
  if (domain.includes('sentry')) return 'Sentry';
  if (domain.includes('datadog')) return 'DataDog';
  if (domain.includes('monitoring')) return 'Monitoring System';
  return 'Dashboard';
}

// Check if domain has valid credentials
async function checkCredentials(domain) {
  try {
    const cookies = await chrome.cookies.getAll({ domain });
    
    // Filter for authentication-related cookies
    const authCookies = cookies.filter(cookie => 
      isAuthenticationCookie(cookie.name, cookie.value)
    );
    
    const hasValidAuth = authCookies.length > 0;
    currentState.hasCredentials = hasValidAuth;
    
    if (hasValidAuth) {
      updateIcon(ICON_STATES.READY);
      
      // Update domain status
      if (currentState.domains.has(domain)) {
        const domainInfo = currentState.domains.get(domain);
        domainInfo.status = 'ready';
        domainInfo.cookieCount = authCookies.length;
        await saveDomains();
      }
    } else {
      updateIcon(ICON_STATES.IDLE);
    }
    
  } catch (error) {
    console.error('Error checking credentials:', error);
    updateIcon(ICON_STATES.ERROR);
  }
}

// Check if cookie is authentication-related
function isAuthenticationCookie(name, value) {
  const authPatterns = [
    /session/i,
    /auth/i, 
    /token/i,
    /login/i,
    /user/i,
    /csrf/i,
    /jwt/i,
    /bearer/i,
    /grafana/i,
    /tableau/i
  ];
  
  // Skip empty or very short values
  if (!value || value.length < 10) return false;
  
  return authPatterns.some(pattern => pattern.test(name)) || value.length > 50;
}

// Update extension icon
function updateIcon(state) {
  const iconPath = {
    16: `icons/icon-${state}-16.png`,
    32: `icons/icon-${state}-32.png`,
    48: `icons/icon-${state}-48.png`,
    128: `icons/icon-${state}-128.png`
  };
  
  const titles = {
    [ICON_STATES.IDLE]: 'Office Display - Waiting for credentials',
    [ICON_STATES.READY]: 'Office Display - Credentials ready for sync',
    [ICON_STATES.SYNCED]: 'Office Display - Recently synced', 
    [ICON_STATES.ERROR]: 'Office Display - Sync error'
  };
  
  chrome.action.setIcon({ path: iconPath });
  chrome.action.setTitle({ title: titles[state] });
}

// Sync credentials to Office Display
async function syncCredentials(domain) {
  if (!currentState.officeDisplay) {
    throw new Error('Office Display endpoint not configured');
  }
  
  try {
    // Get all cookies for domain
    const cookies = await chrome.cookies.getAll({ domain });
    
    // Filter authentication cookies
    const authCookies = cookies.filter(cookie => 
      isAuthenticationCookie(cookie.name, cookie.value)
    );
    
    if (authCookies.length === 0) {
      throw new Error('No authentication cookies found');
    }
    
    // Format cookies for API
    const cookieString = authCookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('\n');
    
    // Send to Office Display
    const response = await fetch(`${currentState.officeDisplay}/api/cookies/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        domain: `https://${domain}`,
        cookies: cookieString,
        timestamp: new Date()
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Unknown error from Office Display');
    }
    
    // Update domain status with comprehensive sync results
    if (currentState.domains.has(domain)) {
      const domainInfo = currentState.domains.get(domain);
      domainInfo.lastSync = new Date().toISOString();
      domainInfo.status = 'synced';
      domainInfo.syncResult = {
        injectedCount: result.data.injectedCount,
        skippedCount: result.data.skippedCount,
        errors: result.data.errors,
        // New: Host distribution info
        hostDistribution: result.data.hostDistribution || null
      };
      await saveDomains();
    }
    
    updateIcon(ICON_STATES.SYNCED);
    
    // Reset to ready after 5 seconds
    setTimeout(() => {
      if (currentState.hasCredentials) {
        updateIcon(ICON_STATES.READY);
      }
    }, 5000);
    
    return result.data;
    
  } catch (error) {
    console.error('Sync error:', error);
    updateIcon(ICON_STATES.ERROR);
    
    // Reset to previous state after 3 seconds
    setTimeout(() => {
      if (currentState.hasCredentials) {
        updateIcon(ICON_STATES.READY);
      } else {
        updateIcon(ICON_STATES.IDLE);
      }
    }, 3000);
    
    throw error;
  }
}

// Save domains to storage
async function saveDomains() {
  const domainsObj = Object.fromEntries(currentState.domains);
  await chrome.storage.local.set({ monitoredDomains: domainsObj });
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case 'GET_STATE':
        sendResponse({
          success: true,
          data: {
            officeDisplay: currentState.officeDisplay,
            currentDomain: currentState.currentDomain,
            hasCredentials: currentState.hasCredentials,
            domains: Array.from(currentState.domains.entries()).map(([domain, info]) => ({
              domain,
              ...info
            }))
          }
        });
        break;
        
      case 'SYNC_CURRENT':
        if (!currentState.currentDomain || !currentState.hasCredentials) {
          throw new Error('No credentials available for current domain');
        }
        
        const result = await syncCredentials(currentState.currentDomain);
        sendResponse({ success: true, data: result });
        break;
        
      case 'SET_ENDPOINT':
        currentState.officeDisplay = message.endpoint;
        await chrome.storage.local.set({ officeDisplayEndpoint: message.endpoint });
        sendResponse({ success: true });
        break;
        
      case 'TEST_CONNECTION':
        try {
          const response = await fetch(`${message.endpoint}/api/cookies/status`);
          const isValid = response.ok;
          sendResponse({ success: true, data: { isValid } });
        } catch {
          sendResponse({ success: true, data: { isValid: false } });
        }
        break;
        
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}