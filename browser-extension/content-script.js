// Office Display Extension - Content Script
// Detects login events and dashboard patterns

(function() {
  'use strict';
  
  // Configuration
  const LOGIN_DETECTION_DELAY = 2000; // Wait 2s after navigation
  const CREDENTIAL_CHECK_INTERVAL = 5000; // Check every 5s
  
  let lastURL = window.location.href;
  let loginCheckTimeout = null;
  let credentialCheckInterval = null;
  
  // Dashboard detection patterns
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
  
  // Login success indicators
  const LOGIN_SUCCESS_INDICATORS = {
    // URL patterns that indicate successful login
    urlPatterns: [
      /\/dashboard/i,
      /\/home/i,
      /\/main/i,
      /\/overview/i,
      /\/app/i
    ],
    
    // DOM selectors that indicate logged-in state
    domSelectors: [
      // Generic dashboard elements
      '[data-testid*="dashboard"]',
      '[class*="dashboard"]',
      '[class*="navigation"]',
      '[class*="sidebar"]',
      
      // User/profile indicators
      '[class*="user-menu"]',
      '[class*="profile"]',
      '[data-testid*="user"]',
      
      // Grafana specific
      '[data-testid="data-testid Nav"]',
      '.sidemenu',
      '[aria-label="Grafana"]',
      
      // Generic logout buttons (indicates user is logged in)
      '[href*="logout"]',
      '[data-testid*="logout"]',
      'button[title*="logout" i]'
    ],
    
    // Text content that indicates login success
    textPatterns: [
      /welcome/i,
      /dashboard/i,
      /logout/i,
      /profile/i,
      /settings/i
    ]
  };
  
  // Initialize content script
  function initialize() {
    console.log('Office Display content script initialized for:', window.location.hostname);
    
    // Check if this is a dashboard domain
    if (isDashboardDomain()) {
      startMonitoring();
    }
    
    // Listen for navigation changes (SPA)
    observeURLChanges();
  }
  
  // Check if current domain is a dashboard
  function isDashboardDomain() {
    const hostname = window.location.hostname;
    return DASHBOARD_PATTERNS.some(pattern => pattern.test(hostname));
  }
  
  // Start monitoring for login events
  function startMonitoring() {
    console.log('Starting login monitoring for dashboard domain');
    
    // Initial login check after page load
    scheduleLoginCheck();
    
    // Periodic credential validation
    startCredentialChecking();
    
    // Monitor DOM changes for dynamic content
    observeDOMChanges();
  }
  
  // Schedule login detection check
  function scheduleLoginCheck() {
    if (loginCheckTimeout) {
      clearTimeout(loginCheckTimeout);
    }
    
    loginCheckTimeout = setTimeout(() => {
      checkForLogin();
    }, LOGIN_DETECTION_DELAY);
  }
  
  // Check if user has logged in successfully
  function checkForLogin() {
    console.log('Checking for login success indicators...');
    
    const loginDetected = detectLoginSuccess();
    
    if (loginDetected) {
      console.log('Login success detected!');
      notifyBackground('LOGIN_DETECTED');
    }
  }
  
  // Detect login success using various indicators
  function detectLoginSuccess() {
    // Check URL patterns
    const url = window.location.href;
    const hasLoginURL = LOGIN_SUCCESS_INDICATORS.urlPatterns.some(pattern => 
      pattern.test(url)
    );
    
    // Check DOM elements
    const hasLoginDOM = LOGIN_SUCCESS_INDICATORS.domSelectors.some(selector => {
      try {
        return document.querySelector(selector) !== null;
      } catch (e) {
        return false;
      }
    });
    
    // Check page text content
    const pageText = document.body.textContent || '';
    const hasLoginText = LOGIN_SUCCESS_INDICATORS.textPatterns.some(pattern =>
      pattern.test(pageText)
    );
    
    console.log('Login detection results:', {
      url: hasLoginURL,
      dom: hasLoginDOM, 
      text: hasLoginText,
      currentURL: url
    });
    
    // Consider login successful if we have URL + DOM indicators
    // or DOM + Text indicators (to avoid false positives)
    return (hasLoginURL && hasLoginDOM) || (hasLoginDOM && hasLoginText);
  }
  
  // Start periodic credential checking
  function startCredentialChecking() {
    if (credentialCheckInterval) {
      clearInterval(credentialCheckInterval);
    }
    
    credentialCheckInterval = setInterval(() => {
      // This will trigger background script to check cookies
      notifyBackground('CHECK_CREDENTIALS');
    }, CREDENTIAL_CHECK_INTERVAL);
  }
  
  // Observe URL changes for SPA navigation
  function observeURLChanges() {
    // Use both popstate and pushstate/replacestate
    window.addEventListener('popstate', handleURLChange);
    
    // Override pushState and replaceState to catch programmatic navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      setTimeout(handleURLChange, 100);
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      setTimeout(handleURLChange, 100);
    };
  }
  
  // Handle URL change events
  function handleURLChange() {
    const newURL = window.location.href;
    
    if (newURL !== lastURL) {
      console.log('URL changed:', lastURL, '->', newURL);
      lastURL = newURL;
      
      // Re-check for login after navigation
      if (isDashboardDomain()) {
        scheduleLoginCheck();
      }
    }
  }
  
  // Observe DOM changes for dynamic content loading
  function observeDOMChanges() {
    const observer = new MutationObserver((mutations) => {
      let significantChange = false;
      
      mutations.forEach((mutation) => {
        // Check for added nodes that might indicate login success
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if added element matches login indicators
              const element = node;
              const hasLoginClass = LOGIN_SUCCESS_INDICATORS.domSelectors.some(selector => {
                try {
                  return element.matches && element.matches(selector) || 
                         element.querySelector && element.querySelector(selector);
                } catch (e) {
                  return false;
                }
              });
              
              if (hasLoginClass) {
                significantChange = true;
              }
            }
          });
        }
      });
      
      if (significantChange) {
        console.log('Significant DOM change detected, checking for login...');
        scheduleLoginCheck();
      }
    });
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });
  }
  
  // Notify background script
  function notifyBackground(event, data = {}) {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.warn('Extension context invalidated, stopping notifications');
        if (credentialCheckInterval) {
          clearInterval(credentialCheckInterval);
          credentialCheckInterval = null;
        }
        return;
      }

      chrome.runtime.sendMessage({
        type: 'CONTENT_SCRIPT_EVENT',
        event: event,
        data: {
          ...data,
          url: window.location.href,
          domain: window.location.hostname,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      // If extension context is invalidated, stop the interval
      if (error.message.includes('Extension context invalidated')) {
        console.warn('Extension context invalidated, stopping credential checking');
        if (credentialCheckInterval) {
          clearInterval(credentialCheckInterval);
          credentialCheckInterval = null;
        }
      } else {
        console.error('Failed to notify background:', error);
      }
    }
  }
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.warn('Extension context invalidated, ignoring message');
        return false;
      }

      switch (message.type) {
        case 'CHECK_LOGIN_STATUS':
          const loginStatus = detectLoginSuccess();
          sendResponse({ loginDetected: loginStatus });
          break;
          
        case 'FORCE_LOGIN_CHECK':
          checkForLogin();
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
    
    return true; // Keep message channel open for async responses
  });
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (loginCheckTimeout) {
      clearTimeout(loginCheckTimeout);
    }
    
    if (credentialCheckInterval) {
      clearInterval(credentialCheckInterval);
    }
  });
  
  // Start the content script
  function startScript() {
    // Check if extension context is valid before starting
    if (!chrome.runtime?.id) {
      console.warn('Extension context is invalid, not starting content script');
      return;
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize);
    } else {
      initialize();
    }
  }

  startScript();
  
})();