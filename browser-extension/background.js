// Office Display Credentials Sync - Background Service Worker

// Enhanced logging system
const Logger = {
  levels: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  },
  
  currentLevel: 2, // INFO by default
  
  formatMessage(level, category, message, data = null) {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      category,
      message,
      data
    };
    
    const prefix = `[${timestamp}] ${level.toUpperCase()} [${category}]`;
    
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
    
    // Store recent logs for debugging
    this.addToHistory(logData);
  },
  
  error(category, message, data) {
    if (this.currentLevel >= this.levels.ERROR) {
      this.formatMessage('error', category, message, data);
    }
  },
  
  warn(category, message, data) {
    if (this.currentLevel >= this.levels.WARN) {
      this.formatMessage('warn', category, message, data);
    }
  },
  
  info(category, message, data) {
    if (this.currentLevel >= this.levels.INFO) {
      this.formatMessage('info', category, message, data);
    }
  },
  
  debug(category, message, data) {
    if (this.currentLevel >= this.levels.DEBUG) {
      this.formatMessage('debug', category, message, data);
    }
  },
  
  // Keep last 50 log entries for debugging
  history: [],
  maxHistory: 50,
  
  addToHistory(logData) {
    this.history.unshift(logData);
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }
  },
  
  getHistory() {
    return this.history;
  },
  
  clearHistory() {
    this.history = [];
  }
};

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

// Connection states
const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting'
};

// Reconnection configuration
const RECONNECTION_CONFIG = {
  INITIAL_DELAY: 2000,     // Start with 2s delay
  MAX_DELAY: 30000,        // Max 30s between attempts
  MULTIPLIER: 1.5,         // Exponential backoff
  MAX_ATTEMPTS: 10,        // Stop after 10 failed attempts
  HEALTH_CHECK_INTERVAL: 15000  // Check connection every 15s
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
  hasCredentials: false,
  connectionState: CONNECTION_STATES.DISCONNECTED,
  reconnectionAttempts: 0,
  reconnectionTimer: null,
  healthCheckTimer: null,
  lastConnectionCheck: null
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  Logger.info('EXTENSION', 'Office Display Extension installed');
  await initializeExtension();
});

chrome.runtime.onStartup.addListener(async () => {
  Logger.info('EXTENSION', 'Office Display Extension starting up');
  await initializeExtension();
});

// Initialize extension state
async function initializeExtension() {
  try {
    Logger.info('INIT', 'Initializing Office Display Extension...');
    
    // Load stored configuration
    const stored = await chrome.storage.local.get(['officeDisplayEndpoint', 'monitoredDomains']);
    Logger.debug('INIT', 'Loaded stored configuration', { endpoint: stored.officeDisplayEndpoint, domainsCount: Object.keys(stored.monitoredDomains || {}).length });
    
    // Load monitored domains
    if (stored.monitoredDomains) {
      currentState.domains = new Map(Object.entries(stored.monitoredDomains));
    }
    
    // Initialize connection management
    await initializeConnection(stored.officeDisplayEndpoint);
    
  } catch (error) {
    Logger.error('INIT', 'Failed to initialize extension', error);
    currentState.connectionState = CONNECTION_STATES.DISCONNECTED;
    updateIcon(ICON_STATES.ERROR);
  }
}

// Initialize connection with auto-detection and reconnection
async function initializeConnection(storedEndpoint = null) {
  Logger.info('CONNECTION', 'Initializing connection management...', { storedEndpoint });
  
  // Try stored endpoint first, then auto-detect
  let endpoint = storedEndpoint;
  
  if (!endpoint || !(await testConnection(endpoint))) {
    Logger.info('CONNECTION', 'Auto-detecting Office Display endpoint...');
    currentState.connectionState = CONNECTION_STATES.CONNECTING;
    endpoint = await autoDetectOfficeDisplay();
  }
  
  if (endpoint) {
    currentState.officeDisplay = endpoint;
    await chrome.storage.local.set({ officeDisplayEndpoint: endpoint });
    
    if (await testConnection(endpoint)) {
      currentState.connectionState = CONNECTION_STATES.CONNECTED;
      currentState.reconnectionAttempts = 0;
      currentState.lastConnectionCheck = Date.now();
      Logger.info('CONNECTION', 'Connected to Office Display', { endpoint });
    } else {
      currentState.connectionState = CONNECTION_STATES.DISCONNECTED;
      Logger.warn('CONNECTION', 'Failed to connect to detected endpoint', { endpoint });
    }
  } else {
    currentState.connectionState = CONNECTION_STATES.DISCONNECTED;
    Logger.warn('CONNECTION', 'No valid endpoint found');
  }
  
  // Start health monitoring
  startHealthMonitoring();
  
  // Update UI
  updateIcon(currentState.connectionState === CONNECTION_STATES.CONNECTED ? ICON_STATES.IDLE : ICON_STATES.ERROR);
}

// Auto-detect Office Display endpoint
async function autoDetectOfficeDisplay() {
  console.log('🔍 Auto-detecting Office Display endpoint...');
  
  for (const endpoint of DEFAULT_ENDPOINTS) {
    try {
      console.log(`  Testing endpoint: ${endpoint}`);
      const response = await fetch(`${endpoint}/api/cookies/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // Increased to 5s timeout
      });
      
      if (response.ok) {
        console.log(`✅ Found Office Display at: ${endpoint}`);
        return endpoint;
      } else {
        console.log(`  ❌ Endpoint ${endpoint} returned ${response.status}`);
      }
    } catch (error) {
      console.log(`  ❌ Endpoint ${endpoint} failed:`, error.message);
    }
  }
  
  console.log('❌ No Office Display endpoint found');
  return null; // Don't use default if nothing found
}

// Test connection to specific endpoint
async function testConnection(endpoint) {
  if (!endpoint) return false;
  
  try {
    const response = await fetch(`${endpoint}/api/cookies/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Start health monitoring and reconnection logic
function startHealthMonitoring() {
  // Clear existing timer
  if (currentState.healthCheckTimer) {
    clearInterval(currentState.healthCheckTimer);
  }
  
  console.log('❤️ Starting health monitoring...');
  
  currentState.healthCheckTimer = setInterval(async () => {
    await checkConnectionHealth();
  }, RECONNECTION_CONFIG.HEALTH_CHECK_INTERVAL);
}

// Check connection health and trigger reconnection if needed
async function checkConnectionHealth() {
  if (!currentState.officeDisplay) {
    console.log('🔍 No endpoint configured, attempting auto-detection...');
    await attemptReconnection();
    return;
  }
  
  const isConnected = await testConnection(currentState.officeDisplay);
  
  if (isConnected) {
    if (currentState.connectionState !== CONNECTION_STATES.CONNECTED) {
      console.log('✅ Connection restored to:', currentState.officeDisplay);
      currentState.connectionState = CONNECTION_STATES.CONNECTED;
      currentState.reconnectionAttempts = 0;
      updateIcon(currentState.hasCredentials ? ICON_STATES.READY : ICON_STATES.IDLE);
    }
    currentState.lastConnectionCheck = Date.now();
  } else {
    if (currentState.connectionState === CONNECTION_STATES.CONNECTED) {
      console.log('❌ Connection lost to:', currentState.officeDisplay);
      currentState.connectionState = CONNECTION_STATES.DISCONNECTED;
      updateIcon(ICON_STATES.ERROR);
    }
    
    // Attempt reconnection if not already trying
    if (currentState.connectionState !== CONNECTION_STATES.RECONNECTING) {
      await attemptReconnection();
    }
  }
}

// Attempt reconnection with exponential backoff
async function attemptReconnection() {
  if (currentState.reconnectionAttempts >= RECONNECTION_CONFIG.MAX_ATTEMPTS) {
    console.log('❌ Max reconnection attempts reached, stopping');
    return;
  }
  
  currentState.connectionState = CONNECTION_STATES.RECONNECTING;
  currentState.reconnectionAttempts++;
  
  const delay = Math.min(
    RECONNECTION_CONFIG.INITIAL_DELAY * Math.pow(RECONNECTION_CONFIG.MULTIPLIER, currentState.reconnectionAttempts - 1),
    RECONNECTION_CONFIG.MAX_DELAY
  );
  
  console.log(`🔄 Attempting reconnection ${currentState.reconnectionAttempts}/${RECONNECTION_CONFIG.MAX_ATTEMPTS} in ${delay}ms...`);
  
  // Clear existing timer
  if (currentState.reconnectionTimer) {
    clearTimeout(currentState.reconnectionTimer);
  }
  
  currentState.reconnectionTimer = setTimeout(async () => {
    try {
      // Try current endpoint first
      if (currentState.officeDisplay && await testConnection(currentState.officeDisplay)) {
        console.log('✅ Reconnected to existing endpoint:', currentState.officeDisplay);
        currentState.connectionState = CONNECTION_STATES.CONNECTED;
        currentState.reconnectionAttempts = 0;
        updateIcon(currentState.hasCredentials ? ICON_STATES.READY : ICON_STATES.IDLE);
        return;
      }
      
      // Try auto-detection
      const newEndpoint = await autoDetectOfficeDisplay();
      if (newEndpoint && await testConnection(newEndpoint)) {
        console.log('✅ Reconnected to new endpoint:', newEndpoint);
        currentState.officeDisplay = newEndpoint;
        await chrome.storage.local.set({ officeDisplayEndpoint: newEndpoint });
        currentState.connectionState = CONNECTION_STATES.CONNECTED;
        currentState.reconnectionAttempts = 0;
        updateIcon(currentState.hasCredentials ? ICON_STATES.READY : ICON_STATES.IDLE);
        return;
      }
      
      console.log('❌ Reconnection attempt failed');
      currentState.connectionState = CONNECTION_STATES.DISCONNECTED;
      
    } catch (error) {
      console.error('❌ Reconnection error:', error);
      currentState.connectionState = CONNECTION_STATES.DISCONNECTED;
    }
  }, delay);
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
  
  // Check connection before syncing
  if (currentState.connectionState !== CONNECTION_STATES.CONNECTED) {
    console.log('🔄 Connection not established, attempting to connect...');
    await checkConnectionHealth();
    
    if (currentState.connectionState !== CONNECTION_STATES.CONNECTED) {
      throw new Error('Cannot connect to Office Display. Please check if the service is running.');
    }
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
    
    // Format cookies for API - send structured objects instead of string
    console.log('🍪 [EXTENSION] Extracting complete cookie data for', authCookies.length, 'cookies');
    
    const cookieObjects = authCookies.map(cookie => {
      const cookieObj = {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expirationDate: cookie.expirationDate
      };
      
      console.log('🍪 [EXTENSION] Cookie extracted:', {
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        valueLength: cookie.value?.length || 0
      });
      
      return cookieObj;
    });
    
    // Send to Office Display with structured cookie objects
    const response = await fetch(`${currentState.officeDisplay}/api/cookies/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        domain: `https://${domain}`,
        cookies: cookieObjects,  // Send objects instead of string
        cookieFormat: 'structured', // Flag to indicate new format
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
            connectionState: currentState.connectionState,
            reconnectionAttempts: currentState.reconnectionAttempts,
            lastConnectionCheck: currentState.lastConnectionCheck,
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
        console.log('🔧 Setting new endpoint:', message.endpoint);
        currentState.officeDisplay = message.endpoint;
        await chrome.storage.local.set({ officeDisplayEndpoint: message.endpoint });
        
        // Test new endpoint immediately
        currentState.connectionState = CONNECTION_STATES.CONNECTING;
        const isConnected = await testConnection(message.endpoint);
        
        if (isConnected) {
          currentState.connectionState = CONNECTION_STATES.CONNECTED;
          currentState.reconnectionAttempts = 0;
          console.log('✅ New endpoint connected successfully');
        } else {
          currentState.connectionState = CONNECTION_STATES.DISCONNECTED;
          console.log('❌ New endpoint failed to connect');
        }
        
        sendResponse({ success: true, data: { connected: isConnected } });
        break;
        
      case 'TEST_CONNECTION':
        try {
          const isValid = await testConnection(message.endpoint);
          sendResponse({ success: true, data: { isValid } });
        } catch (error) {
          sendResponse({ success: true, data: { isValid: false, error: error.message } });
        }
        break;
        
      case 'FORCE_RECONNECT':
        Logger.info('CONNECTION', 'Forcing reconnection...');
        currentState.reconnectionAttempts = 0;
        await attemptReconnection();
        sendResponse({ success: true });
        break;
        
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Cleanup on extension unload
chrome.runtime.onSuspend.addListener(() => {
  console.log('🧹 Extension suspending, cleaning up timers...');
  
  if (currentState.healthCheckTimer) {
    clearInterval(currentState.healthCheckTimer);
    currentState.healthCheckTimer = null;
  }
  
  if (currentState.reconnectionTimer) {
    clearTimeout(currentState.reconnectionTimer);
    currentState.reconnectionTimer = null;
  }
});