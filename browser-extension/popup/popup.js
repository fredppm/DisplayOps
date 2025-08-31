// Office Display Extension Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  await initializePopup();
});

let currentState = null;

// Initialize popup
async function initializePopup() {
  try {
    showLoading(true);
    
    // Get current state from background
    const response = await sendMessage({ type: 'GET_STATE' });
    
    if (response.success) {
      currentState = response.data;
      updateUI();
    } else {
      showMessage('Failed to load extension state', 'error');
    }
    
  } catch (error) {
    console.error('Failed to initialize popup:', error);
    showMessage('Failed to initialize popup', 'error');
  } finally {
    showLoading(false);
  }
}

// Update UI with current state
function updateUI() {
  updateConnectionStatus();
  updateCurrentDomain();
  updateDomainsList();
  updateConfiguration();
  setupEventListeners();
}

// Update connection status with enhanced states
function updateConnectionStatus() {
  const statusEl = document.getElementById('connectionStatus');
  const textEl = statusEl.querySelector('.text');
  const reconnectInfoEl = document.getElementById('reconnectInfo');
  const connectionActionsEl = document.getElementById('connectionActions');
  
  const connectionState = currentState.connectionState || 'disconnected';
  const reconnectAttempts = currentState.reconnectionAttempts || 0;
  const lastCheck = currentState.lastConnectionCheck;
  
  // Update status indicator class and text
  switch (connectionState) {
    case 'connected':
      statusEl.className = 'status-indicator connected';
      textEl.textContent = 'Connected';
      reconnectInfoEl.style.display = 'none';
      connectionActionsEl.style.display = 'none';
      break;
      
    case 'connecting':
      statusEl.className = 'status-indicator connecting';
      textEl.textContent = 'Connecting...';
      reconnectInfoEl.style.display = 'none';
      connectionActionsEl.style.display = 'none';
      break;
      
    case 'reconnecting':
      statusEl.className = 'status-indicator reconnecting';
      textEl.textContent = `Reconnecting... (${reconnectAttempts}/10)`;
      reconnectInfoEl.style.display = 'none';
      connectionActionsEl.style.display = 'none';
      break;
      
    case 'disconnected':
    default:
      statusEl.className = 'status-indicator error';
      textEl.textContent = 'Disconnected';
      
      // Show reconnection info if attempts have been made
      if (reconnectAttempts > 0) {
        reconnectInfoEl.textContent = `${reconnectAttempts} reconnection attempts`;
        reconnectInfoEl.style.display = 'inline';
      } else {
        reconnectInfoEl.style.display = 'none';
      }
      
      // Show reconnect button
      connectionActionsEl.style.display = 'block';
      break;
  }
  
  // Show last connection check time if available
  if (lastCheck && connectionState === 'connected') {
    const timeDiff = Date.now() - lastCheck;
    if (timeDiff > 60000) { // More than 1 minute
      const minutes = Math.floor(timeDiff / 60000);
      reconnectInfoEl.textContent = `Last check: ${minutes}m ago`;
      reconnectInfoEl.style.display = 'inline';
    }
  }
}

// Update current domain section
function updateCurrentDomain() {
  const domainNameEl = document.getElementById('domainName');
  const credentialsStatusEl = document.getElementById('credentialsStatus');
  const syncButtonEl = document.getElementById('syncButton');
  
  if (currentState.currentDomain) {
    domainNameEl.textContent = currentState.currentDomain;
    
    if (currentState.hasCredentials) {
      credentialsStatusEl.textContent = 'Credentials ready';
      credentialsStatusEl.className = 'credentials-status ready';
      syncButtonEl.disabled = false;
    } else {
      credentialsStatusEl.textContent = 'No credentials';
      credentialsStatusEl.className = 'credentials-status';
      syncButtonEl.disabled = true;
    }
  } else {
    domainNameEl.textContent = 'No dashboard domain detected';
    credentialsStatusEl.textContent = '';
    credentialsStatusEl.className = 'credentials-status';
    syncButtonEl.disabled = true;
  }
}

// Update domains list
function updateDomainsList() {
  const domainsListEl = document.getElementById('domainsList');
  const noDomainsEl = document.getElementById('noDomains');
  
  if (!currentState.domains || currentState.domains.length === 0) {
    domainsListEl.style.display = 'none';
    noDomainsEl.style.display = 'block';
    return;
  }
  
  domainsListEl.style.display = 'block';
  noDomainsEl.style.display = 'none';
  
  domainsListEl.innerHTML = currentState.domains.map(domain => {
    const statusClass = getStatusClass(domain.status);
    const statusText = getStatusText(domain.status, domain.lastSync);
    const metaText = getMetaText(domain);
    
    return `
      <div class="domain-item">
        <div class="domain-header">
          <div class="domain-title">${domain.name || domain.domain}</div>
          <div class="domain-status ${statusClass}">${statusText}</div>
        </div>
        <div class="domain-url">${domain.domain}</div>
        ${metaText ? `<div class="domain-meta">${metaText}</div>` : ''}
      </div>
    `;
  }).join('');
}

// Get status CSS class
function getStatusClass(status) {
  switch (status) {
    case 'ready': return 'ready';
    case 'synced': return 'synced';
    case 'error': return 'error';
    default: return '';
  }
}

// Get status text
function getStatusText(status, lastSync) {
  switch (status) {
    case 'detected': return 'Detected';
    case 'ready': return 'Ready';
    case 'synced': 
      if (lastSync) {
        const time = formatTimeAgo(lastSync);
        return `Sync ${time}`;
      }
      return 'Synced';
    case 'error': return 'Error';
    default: return 'Waiting';
  }
}

// Get meta text
function getMetaText(domain) {
  const parts = [];
  
  if (domain.cookieCount) {
    parts.push(`${domain.cookieCount} credentials`);
  }
  
  if (domain.syncResult) {
    parts.push(`${domain.syncResult.injectedCount} injected`);
    
    // Add host distribution info if available
    if (domain.syncResult.hostDistribution) {
      const hostInfo = domain.syncResult.hostDistribution;
      if (hostInfo.hostsFound > 0) {
        parts.push(`${hostInfo.hostsSuccess}/${hostInfo.hostsFound} hosts`);
      }
    }
  }
  
  return parts.join(' • ');
}

// Format time ago
function formatTimeAgo(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now - time;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

// Update configuration
function updateConfiguration() {
  const endpointInput = document.getElementById('endpointInput');
  
  if (currentState.officeDisplay) {
    endpointInput.value = currentState.officeDisplay;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Sync button
  document.getElementById('syncButton').addEventListener('click', handleSync);
  
  // Test button
  document.getElementById('testButton').addEventListener('click', handleTest);
  
  // Save button  
  document.getElementById('saveButton').addEventListener('click', handleSave);
  
  // Reconnect button
  document.getElementById('reconnectButton').addEventListener('click', handleReconnect);
}

// Handle sync credentials
async function handleSync() {
  const syncButton = document.getElementById('syncButton');
  const buttonText = syncButton.querySelector('.button-text');
  const buttonSpinner = syncButton.querySelector('.button-spinner');
  
  try {
    // Update button state
    syncButton.disabled = true;
    syncButton.className = 'sync-button syncing';
    buttonText.textContent = 'Syncing...';
    buttonSpinner.style.display = 'block';
    
    // Send sync message
    const response = await sendMessage({ type: 'SYNC_CURRENT' });
    
    if (response.success) {
      // Create detailed success message with host distribution info
      let successMessage = 'Credentials synced successfully!';
      
      if (response.data && response.data.hostDistribution) {
        const hostInfo = response.data.hostDistribution;
        if (hostInfo.hostsFound > 0) {
          successMessage += ` Distributed to ${hostInfo.hostsSuccess}/${hostInfo.hostsFound} hosts.`;
        } else {
          successMessage += ' (No hosts found for auto-distribution)';
        }
      }
      
      showMessage(successMessage, 'success');
      
      // Update button state to success
      syncButton.className = 'sync-button';
      buttonText.textContent = 'Synced!';
      buttonSpinner.style.display = 'none';
      
      // Refresh state after showing success
      setTimeout(async () => {
        const stateResponse = await sendMessage({ type: 'GET_STATE' });
        if (stateResponse.success) {
          currentState = stateResponse.data;
          updateCurrentDomain();
          updateDomainsList();
        }
      }, 1000);
      
    } else {
      throw new Error(response.error || 'Erro desconhecido');
    }
    
  } catch (error) {
    console.error('Sync failed:', error);
    showMessage(`Sync error: ${error.message}`, 'error');
    
    // Reset button
    syncButton.disabled = false;
    syncButton.className = 'sync-button';
    buttonText.textContent = 'Sync Credentials';
    buttonSpinner.style.display = 'none';
  }
}

// Handle test connection
async function handleTest() {
  const testButton = document.getElementById('testButton');
  const endpointInput = document.getElementById('endpointInput');
  const buttonText = testButton.querySelector('.button-text');
  const buttonSpinner = testButton.querySelector('.button-spinner');
  
  const endpoint = endpointInput.value.trim();
  
  if (!endpoint) {
    showMessage('Enter a valid endpoint', 'error');
    return;
  }
  
  try {
    // Update button state
    testButton.disabled = true;
    testButton.className = 'test-button testing';
    buttonText.textContent = 'Testing...';
    buttonSpinner.style.display = 'block';
    
    // Test connection
    const response = await sendMessage({ 
      type: 'TEST_CONNECTION', 
      endpoint 
    });
    
    if (response.success && response.data.isValid) {
      testButton.className = 'test-button success';
      buttonText.textContent = 'Connected';
      showMessage('Connection successful!', 'success');
    } else {
      testButton.className = 'test-button error';  
      buttonText.textContent = 'Failed';
      showMessage('Failed to connect to Office Display', 'error');
    }
    
    // Reset button after 2 seconds
    setTimeout(() => {
      testButton.disabled = false;
      testButton.className = 'test-button';
      buttonText.textContent = 'Test';
      buttonSpinner.style.display = 'none';
    }, 2000);
    
  } catch (error) {
    console.error('Test failed:', error);
    testButton.className = 'test-button error';
    buttonText.textContent = 'Error';
    showMessage('Error testing connection', 'error');
    
    setTimeout(() => {
      testButton.disabled = false;
      testButton.className = 'test-button';
      buttonText.textContent = 'Test';
      buttonSpinner.style.display = 'none';
    }, 2000);
  }
}

// Handle save configuration
async function handleSave() {
  const endpointInput = document.getElementById('endpointInput');
  const endpoint = endpointInput.value.trim();
  
  if (!endpoint) {
    showMessage('Enter a valid endpoint', 'error');
    return;
  }
  
  try {
    const response = await sendMessage({ 
      type: 'SET_ENDPOINT', 
      endpoint 
    });
    
    if (response.success) {
      const connected = response.data?.connected;
      if (connected) {
        showMessage('Configuration saved and connected!', 'success');
      } else {
        showMessage('Configuration saved, but connection failed', 'warning');
      }
      
      // Refresh state to get updated connection status
      setTimeout(async () => {
        const stateResponse = await sendMessage({ type: 'GET_STATE' });
        if (stateResponse.success) {
          currentState = stateResponse.data;
          updateConnectionStatus();
        }
      }, 500);
    } else {
      throw new Error(response.error || 'Failed to save');
    }
    
  } catch (error) {
    console.error('Save failed:', error);
    showMessage('Failed to save configuration', 'error');
  }
}

// Handle manual reconnection
async function handleReconnect() {
  const reconnectButton = document.getElementById('reconnectButton');
  const buttonText = reconnectButton.querySelector('.button-text');
  const buttonSpinner = reconnectButton.querySelector('.button-spinner');
  
  try {
    // Update button state
    reconnectButton.disabled = true;
    reconnectButton.className = 'reconnect-button reconnecting';
    buttonText.textContent = '🔄 Reconnecting...';
    buttonSpinner.style.display = 'block';
    
    // Send reconnect message
    const response = await sendMessage({ type: 'FORCE_RECONNECT' });
    
    if (response.success) {
      showMessage('Reconnection initiated', 'info');
      
      // Wait a bit then refresh state
      setTimeout(async () => {
        const stateResponse = await sendMessage({ type: 'GET_STATE' });
        if (stateResponse.success) {
          currentState = stateResponse.data;
          updateConnectionStatus();
          updateCurrentDomain();
        }
      }, 2000);
    } else {
      throw new Error(response.error || 'Reconnection failed');
    }
    
  } catch (error) {
    console.error('Reconnect failed:', error);
    showMessage(`Reconnect error: ${error.message}`, 'error');
  } finally {
    // Reset button state
    setTimeout(() => {
      reconnectButton.disabled = false;
      reconnectButton.className = 'reconnect-button';
      buttonText.textContent = '🔄 Reconnect';
      buttonSpinner.style.display = 'none';
    }, 1500);
  }
}

// Show/hide loading state
function showLoading(show) {
  const loadingEl = document.getElementById('loadingState');
  const mainEl = document.getElementById('mainContent');
  
  if (show) {
    loadingEl.style.display = 'block';
    mainEl.style.display = 'none';
  } else {
    loadingEl.style.display = 'none';
    mainEl.style.display = 'block';
  }
}

// Show message
function showMessage(text, type = 'info') {
  const container = document.getElementById('messageContainer');
  
  const message = document.createElement('div');
  message.className = `message ${type}`;
  message.textContent = text;
  
  container.appendChild(message);
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    if (message.parentNode) {
      message.parentNode.removeChild(message);
    }
  }, 4000);
}

// Send message to background script
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

