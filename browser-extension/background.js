// DisplayOps Credentials Sync - Background Service Worker

// Configuration
const CONFIG = {
  environment: 'production', // Mude para 'development' ou 'staging' conforme necessário
  
  endpoints: {
    production: [
      'https://displayops.vtex.com'
    ],
    staging: [
      'https://staging.displayops.vtex.com'
    ],
    development: [
      'http://localhost:3000',
      'http://localhost:3002', 
      'http://127.0.0.1:3000'
    ]
  }
};

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

// Configuration - Usar endpoints baseados no ambiente atual
const DEFAULT_ENDPOINTS = CONFIG.endpoints[CONFIG.environment];

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

// Reconnection configuration - More robust settings
const RECONNECTION_CONFIG = {
  INITIAL_DELAY: 2000,     // Start with 2s delay
  MAX_DELAY: 60000,        // Max 60s between attempts
  MULTIPLIER: 1.5,         // Exponential backoff
  MAX_ATTEMPTS: 30,        // Stop after 30 failed attempts (increased from 10)
  HEALTH_CHECK_INTERVAL: 20000,  // Check connection every 20s (reduced frequency)
  CONNECTION_TIMEOUT: 15000,     // Increased from 5s to 15s for slower networks
  JITTER_FACTOR: 0.3       // Add randomness to prevent thundering herd
};

// Dashboard patterns for auto-detection
const DASHBOARD_PATTERNS = [
  // Production dashboard services (domain patterns)
  /grafana/i,
  /tableau/i,
  /healthmonitor/i,     // Matches healthmonitor.vtex.com
  /kibana/i,
  /sentry/i,
  /datadog/i,
  /elastic/i,
  /newrelic/i,
  /splunk/i,
  /prometheus/i,
  /observability/i,
  /analytics/i,
  
  // Generic dashboard/monitoring keywords in domain
  /dashboard/i,
  /monitoring/i,
  /metrics/i,
  
  // Local development and testing
  /localhost/i,        // Any localhost
  /127\.0\.0\.1/i,     // Loopback IP
  /0\.0\.0\.0/i,       // All interfaces
  /\[::1\]/i,          // IPv6 loopback
  
  // Common URL path patterns
  /\/dashboard/i,      // URL path contains /dashboard
  /\/monitoring/i,     // URL path contains /monitoring
  /\/metrics/i,        // URL path contains /metrics
  /\/grafana/i,        // URL path contains /grafana
  
  // Domain suffixes
  /\.local/i,          // Local domains (.local)
  /\.vtex\.com/i       // VTEX domains
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
  lastConnectionCheck: null,
  lastSuccessfulSync: null,
  persistedStateLoaded: false
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  Logger.info('EXTENSION', 'DisplayOps Extension installed');
  await initializeExtension();
});

chrome.runtime.onStartup.addListener(async () => {
  Logger.info('EXTENSION', 'DisplayOps Extension starting up');
  await initializeExtension();
});

// Initialize extension state with enhanced persistence
async function initializeExtension() {
  try {
    Logger.info('INIT', 'Initializing DisplayOps Extension...');
    
    // Load comprehensive stored state
    const stored = await chrome.storage.local.get([
      'officeDisplayEndpoint', 
      'monitoredDomains',
      'connectionState',
      'lastConnectionCheck',
      'lastSuccessfulSync',
      'reconnectionAttempts'
    ]);
    
    Logger.debug('INIT', 'Loaded stored configuration', { 
      endpoint: stored.officeDisplayEndpoint, 
      domainsCount: Object.keys(stored.monitoredDomains || {}).length,
      previousConnectionState: stored.connectionState,
      lastCheck: stored.lastConnectionCheck
    });
    
    // Restore persisted state
    if (stored.monitoredDomains) {
      currentState.domains = new Map(Object.entries(stored.monitoredDomains));
    }
    
    if (stored.lastConnectionCheck) {
      currentState.lastConnectionCheck = stored.lastConnectionCheck;
    }
    
    if (stored.lastSuccessfulSync) {
      currentState.lastSuccessfulSync = stored.lastSuccessfulSync;
    }
    
    // Don't restore reconnection attempts - start fresh
    currentState.reconnectionAttempts = 0;
    currentState.persistedStateLoaded = true;
    
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
    Logger.info('CONNECTION', 'Auto-detecting DisplayOps endpoint...');
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

// Auto-detect Office Display endpoint with improved timeout handling
async function autoDetectOfficeDisplay() {
  console.log('🔍 Auto-detecting DisplayOps endpoint...');
  
  for (const endpoint of DEFAULT_ENDPOINTS) {
    try {
      console.log(`  Testing endpoint: ${endpoint}`);
      const response = await fetch(`${endpoint}/api/cookies/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(RECONNECTION_CONFIG.CONNECTION_TIMEOUT)
      });
      
      if (response.ok) {
        console.log(`✅ Found DisplayOps at: ${endpoint}`);
        await persistConnectionState(endpoint);
        return endpoint;
      } else {
        console.log(`  ❌ Endpoint ${endpoint} returned ${response.status}`);
      }
    } catch (error) {
      console.log(`  ❌ Endpoint ${endpoint} failed:`, error.message);
    }
  }
  
  console.log('❌ No DisplayOps endpoint found');
  return null;
}

// Test connection to specific endpoint with improved timeout
async function testConnection(endpoint) {
  if (!endpoint) return false;
  
  try {
    const response = await fetch(`${endpoint}/api/cookies/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(RECONNECTION_CONFIG.CONNECTION_TIMEOUT)
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
      currentState.lastConnectionCheck = Date.now();
      await persistConnectionState();
      updateIcon(currentState.hasCredentials ? ICON_STATES.READY : ICON_STATES.IDLE);
    } else {
      // Update last check time even if already connected
      currentState.lastConnectionCheck = Date.now();
      await persistConnectionState();
    }
  } else {
    if (currentState.connectionState === CONNECTION_STATES.CONNECTED) {
      console.log('❌ Connection lost to:', currentState.officeDisplay);
      currentState.connectionState = CONNECTION_STATES.DISCONNECTED;
      await persistConnectionState();
      updateIcon(ICON_STATES.ERROR);
    }
    
    // Attempt reconnection if not already trying
    if (currentState.connectionState !== CONNECTION_STATES.RECONNECTING) {
      await attemptReconnection();
    }
  }
}

// Attempt reconnection with exponential backoff and jitter
async function attemptReconnection() {
  if (currentState.reconnectionAttempts >= RECONNECTION_CONFIG.MAX_ATTEMPTS) {
    console.log('❌ Max reconnection attempts reached, stopping');
    await persistConnectionState();
    return;
  }
  
  currentState.connectionState = CONNECTION_STATES.RECONNECTING;
  currentState.reconnectionAttempts++;
  
  // Calculate base delay with exponential backoff
  const baseDelay = Math.min(
    RECONNECTION_CONFIG.INITIAL_DELAY * Math.pow(RECONNECTION_CONFIG.MULTIPLIER, currentState.reconnectionAttempts - 1),
    RECONNECTION_CONFIG.MAX_DELAY
  );
  
  // Add jitter to prevent thundering herd
  const jitter = baseDelay * RECONNECTION_CONFIG.JITTER_FACTOR * (Math.random() - 0.5);
  const delay = Math.max(1000, baseDelay + jitter); // Minimum 1s delay
  
  console.log(`🔄 Attempting reconnection ${currentState.reconnectionAttempts}/${RECONNECTION_CONFIG.MAX_ATTEMPTS} in ${Math.round(delay)}ms...`);
  
  // Clear existing timer
  if (currentState.reconnectionTimer) {
    clearTimeout(currentState.reconnectionTimer);
  }
  
  // Persist reconnection attempt
  await persistConnectionState();
  
  currentState.reconnectionTimer = setTimeout(async () => {
    try {
      // Try current endpoint first
      if (currentState.officeDisplay && await testConnection(currentState.officeDisplay)) {
        console.log('✅ Reconnected to existing endpoint:', currentState.officeDisplay);
        currentState.connectionState = CONNECTION_STATES.CONNECTED;
        currentState.reconnectionAttempts = 0;
        currentState.lastConnectionCheck = Date.now();
        await persistConnectionState();
        updateIcon(currentState.hasCredentials ? ICON_STATES.READY : ICON_STATES.IDLE);
        return;
      }
      
      // Try auto-detection
      const newEndpoint = await autoDetectOfficeDisplay();
      if (newEndpoint && await testConnection(newEndpoint)) {
        console.log('✅ Reconnected to new endpoint:', newEndpoint);
        currentState.officeDisplay = newEndpoint;
        currentState.connectionState = CONNECTION_STATES.CONNECTED;
        currentState.reconnectionAttempts = 0;
        currentState.lastConnectionCheck = Date.now();
        await chrome.storage.local.set({ officeDisplayEndpoint: newEndpoint });
        await persistConnectionState();
        updateIcon(currentState.hasCredentials ? ICON_STATES.READY : ICON_STATES.IDLE);
        return;
      }
      
      console.log('❌ Reconnection attempt failed');
      currentState.connectionState = CONNECTION_STATES.DISCONNECTED;
      await persistConnectionState();
      
    } catch (error) {
      console.error('❌ Reconnection error:', error);
      currentState.connectionState = CONNECTION_STATES.DISCONNECTED;
      await persistConnectionState();
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
  if (!tab.url) {
    Logger.debug('TAB_CHANGE', 'No URL in tab, skipping');
    return;
  }

  try {
    const url = new URL(tab.url);
    const domain = url.hostname;

    Logger.info('TAB_CHANGE', `Checking URL: ${tab.url}`);
    Logger.info('TAB_CHANGE', `Extracted domain: ${domain}`);

    // Skip non-HTTP(S) URLs
    if (!url.protocol.startsWith('http')) {
      Logger.debug('TAB_CHANGE', 'Skipping non-HTTP URL');
      return;
    }

    currentState.currentDomain = domain;
    Logger.debug('TAB_CHANGE', `Current domain set to: ${domain}`);

    // Check if this is a dashboard domain
    let matchedPattern = null;
    const isDashboard = DASHBOARD_PATTERNS.some(pattern => {
      const matches = pattern.test(domain) || pattern.test(url.href);
      if (matches && !matchedPattern) {
        matchedPattern = pattern.source;
      }
      return matches;
    });

    if (isDashboard) {
      Logger.info('TAB_CHANGE', `Dashboard detected: ${domain} (pattern: ${matchedPattern})`);
    } else {
      Logger.debug('TAB_CHANGE', `Not a dashboard: ${domain}`);
    }

    if (isDashboard) {
      // Add to monitored domains if not already there
      if (!currentState.domains.has(domain)) {
        currentState.domains.set(domain, {
          name: detectDashboardName(domain),
          lastSync: null,
          status: 'detected'
        });
        await saveDomains();
        Logger.info('TAB_CHANGE', `New domain added: ${domain}`);
      }

      // Check for credentials
      await checkCredentials(domain);
      
      // Ensure state is persisted
      await saveDomains();
    } else {
      // Only update to IDLE if we're connected (don't override ERROR state)
      if (currentState.connectionState === CONNECTION_STATES.CONNECTED) {
        updateIcon(ICON_STATES.IDLE);
      }
      currentState.hasCredentials = false;
    }

  } catch (error) {
    Logger.error('TAB_CHANGE', 'Error handling tab change', error);
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
    
    Logger.info('CREDENTIALS', `${domain}: ${authCookies.length} auth cookies found`);

    // Update icon based on connection state and credentials
    if (currentState.connectionState === CONNECTION_STATES.CONNECTED) {
      if (hasValidAuth) {
        updateIcon(ICON_STATES.READY);
      } else {
        updateIcon(ICON_STATES.IDLE);
      }
    }

    // Always update domain status, even if no credentials
    if (currentState.domains.has(domain)) {
      const domainInfo = currentState.domains.get(domain);
      domainInfo.status = hasValidAuth ? 'ready' : 'detected';
      domainInfo.cookieCount = authCookies.length;
      await saveDomains();
    }

  } catch (error) {
    Logger.error('CREDENTIALS', 'Error checking credentials', error);
    if (currentState.connectionState === CONNECTION_STATES.CONNECTED) {
      updateIcon(ICON_STATES.ERROR);
    }
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
  if (!value || value.length < 10) {
    return false;
  }

  const patternMatch = authPatterns.some(pattern => pattern.test(name));
  const longValue = value.length > 50;

  return patternMatch || longValue;
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
    [ICON_STATES.IDLE]: 'DisplayOps - Waiting for credentials',
    [ICON_STATES.READY]: 'DisplayOps - Credentials ready for sync',
    [ICON_STATES.SYNCED]: 'DisplayOps - Recently synced', 
    [ICON_STATES.ERROR]: 'DisplayOps - Connection error'
  };
  
  Logger.info('ICON', `Updating icon to: ${state} - ${titles[state]}`);
  
  chrome.action.setIcon({ path: iconPath }, () => {
    if (chrome.runtime.lastError) {
      Logger.error('ICON', 'Failed to set icon', chrome.runtime.lastError);
    }
  });
  
  chrome.action.setTitle({ title: titles[state] }, () => {
    if (chrome.runtime.lastError) {
      Logger.error('ICON', 'Failed to set title', chrome.runtime.lastError);
    }
  });
}

// Sync credentials to Office Display
async function syncCredentials(domain) {
  if (!currentState.officeDisplay) {
    throw new Error('DisplayOps endpoint not configured');
  }
  
  // Check connection before syncing
  if (currentState.connectionState !== CONNECTION_STATES.CONNECTED) {
    console.log('🔄 Connection not established, attempting to connect...');
    await checkConnectionHealth();
    
    if (currentState.connectionState !== CONNECTION_STATES.CONNECTED) {
      throw new Error('Cannot connect to DisplayOps. Please check if the service is running.');
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
      throw new Error(result.error || 'Unknown error from DisplayOps');
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
    
    // Update last successful sync time and persist
    currentState.lastSuccessfulSync = Date.now();
    await persistConnectionState();
    
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

// Persist connection state to storage
async function persistConnectionState(endpoint = null) {
  try {
    const stateToSave = {
      connectionState: currentState.connectionState,
      lastConnectionCheck: currentState.lastConnectionCheck,
      reconnectionAttempts: currentState.reconnectionAttempts,
      lastSuccessfulSync: currentState.lastSuccessfulSync
    };
    
    if (endpoint) {
      stateToSave.officeDisplayEndpoint = endpoint;
    }
    
    await chrome.storage.local.set(stateToSave);
  } catch (error) {
    console.warn('Failed to persist connection state:', error);
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
        // Clear any existing timers
        if (currentState.reconnectionTimer) {
          clearTimeout(currentState.reconnectionTimer);
          currentState.reconnectionTimer = null;
        }
        // Reset attempts and force immediate reconnection
        currentState.reconnectionAttempts = 0;
        currentState.connectionState = CONNECTION_STATES.DISCONNECTED;
        await persistConnectionState();
        await attemptReconnection();
        sendResponse({ success: true });
        break;

      case 'CHECK_CURRENT_TAB':
        try {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab && activeTab.url) {
            // Wait for handleTabChange to complete fully
            await handleTabChange(activeTab);
            
            // Give it a moment to save state
            await new Promise(resolve => setTimeout(resolve, 100));
            
            sendResponse({ 
              success: true, 
              data: { 
                url: activeTab.url, 
                domain: currentState.currentDomain,
                hasCredentials: currentState.hasCredentials,
                isDashboard: currentState.domains.has(currentState.currentDomain)
              } 
            });
          } else {
            sendResponse({ success: false, error: 'No active tab found' });
          }
        } catch (error) {
          Logger.error('CHECK_TAB', 'Error checking tab', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'ADD_CURRENT_DOMAIN':
        console.log('➕ [DEBUG] Manual domain addition requested');
        try {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab && activeTab.url) {
            const url = new URL(activeTab.url);
            const domain = url.hostname;

            // Force add to dashboard domains
            currentState.domains.set(domain, {
              name: detectDashboardName(domain) || 'Manual Dashboard',
              lastSync: null,
              status: 'detected'
            });
            await saveDomains();

            // Check credentials
            await checkCredentials(domain);

            sendResponse({ success: true, data: { domain, hasCredentials: currentState.hasCredentials } });
          } else {
            sendResponse({ success: false, error: 'No active tab found' });
          }
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
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