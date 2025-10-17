// DisplayOps Extension Popup - Modern ES6+ Redesign

class DisplayOpsPopup {
  constructor() {
    this.state = {
      connected: false,
      currentDomain: null,
      hasCredentials: false,
      domains: [],
      officeDisplay: null,
      connectionState: 'disconnected',
      reconnectionAttempts: 0,
      lastConnectionCheck: null,
      stats: {
        connectedHosts: 0,
        syncedToday: 0
      }
    };

    this.elements = {};
    this.timers = {
      statsUpdate: null,
      connectionCheck: null
    };

    this.init();
  }

  async init() {
    try {
      this.cacheElements();
      this.attachEventListeners();
      await this.loadState();
      this.render();
      this.startBackgroundTasks();
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.showToast('Failed to initialize extension', 'error');
    }
  }

  cacheElements() {
    this.elements = {
      // Main sections
      loadingState: document.getElementById('loadingState'),
      mainContent: document.getElementById('mainContent'),

      // Connection status
      connectionStatus: document.getElementById('connectionStatus'),
      statusDot: document.querySelector('.status-dot'),
      statusText: document.querySelector('.status-text'),
      reconnectBtn: document.getElementById('reconnectBtn'),

      // Current domain
      currentDomain: document.getElementById('currentDomain'),
      credentialsBadge: document.getElementById('credentialsBadge'),
      credentialsMeta: document.getElementById('credentialsMeta'),
      syncButton: document.getElementById('syncButton'),

      // Activity
      domainsList: document.getElementById('domainsList'),
      noDomains: document.getElementById('noDomains'),

      // Stats
      connectedHosts: document.getElementById('connectedHosts'),
      syncedToday: document.getElementById('syncedToday'),

      // Settings
      settingsToggle: document.getElementById('settingsToggle'),
      settingsContent: document.getElementById('settingsContent'),
      endpointInput: document.getElementById('endpointInput'),
      testButton: document.getElementById('testButton'),
      saveButton: document.getElementById('saveButton'),

      // Others
      fabMenu: document.getElementById('fabMenu'),
      toastContainer: document.getElementById('toastContainer'),

      // Debug buttons
      debugCheckTab: document.getElementById('debugCheckTab'),
      debugAddDomain: document.getElementById('debugAddDomain')
    };
  }

  attachEventListeners() {
    // Sync button
    this.elements.syncButton?.addEventListener('click', () => this.handleSync());

    // Settings toggle
    this.elements.settingsToggle?.addEventListener('click', () => this.toggleSettings());

    // Test button
    this.elements.testButton?.addEventListener('click', () => this.handleTest());

    // Save button
    this.elements.saveButton?.addEventListener('click', () => this.handleSave());

    // Reconnect button
    this.elements.reconnectBtn?.addEventListener('click', () => this.handleReconnect());

    // Debug buttons
    this.elements.debugCheckTab?.addEventListener('click', () => this.handleDebugCheckTab());
    this.elements.debugAddDomain?.addEventListener('click', () => this.handleDebugAddDomain());

    // Ripple effect for all buttons
    document.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.createRipple(e));
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's' && this.state.hasCredentials) {
          e.preventDefault();
          this.handleSync();
        }
      }
    });
  }

  async loadState() {
    this.showLoading(true);

    try {
      // ALWAYS check current tab when popup opens to detect already-open dashboards
      const tabCheckResponse = await this.sendMessage({ type: 'CHECK_CURRENT_TAB' });
      
      if (!tabCheckResponse.success) {
        console.warn('⚠️ Tab check failed:', tabCheckResponse.error);
      }

      // Delay to ensure background has processed everything
      await new Promise(resolve => setTimeout(resolve, 500));

      // Now load the complete state
      const response = await this.sendMessage({ type: 'GET_STATE' });

      if (response.success) {
        this.state = {
          ...this.state,
          ...response.data,
          connected: response.data.connectionState === 'connected'
        };

        // Calculate stats
        await this.updateStats();

        // If disconnected, try to reconnect automatically (but not if already reconnecting)
        if (response.data.connectionState === 'disconnected' &&
            response.data.reconnectionAttempts === 0) {
          setTimeout(() => this.handleReconnect(true), 1000);
        } else if (response.data.connectionState === 'reconnecting') {
          // If already reconnecting, start polling to track progress
          this.pollReconnectionStatus();
        }
      } else {
        throw new Error(response.error || 'Failed to load state');
      }
    } catch (error) {
      console.error('❌ [POPUP] Failed to load state:', error);
      this.showToast('Failed to connect to extension', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async updateStats() {
    // Count connected hosts (mock data for now)
    this.state.stats.connectedHosts = this.state.domains.filter(d =>
      d.status === 'synced' && d.lastSync
    ).length;

    // Count syncs today
    const today = new Date().toDateString();
    this.state.stats.syncedToday = this.state.domains.filter(d => {
      if (!d.lastSync) return false;
      return new Date(d.lastSync).toDateString() === today;
    }).length;
  }

  render() {
    this.renderConnectionStatus();
    this.renderCurrentDomain();
    this.renderDomainsList();
    this.renderStats();
    this.renderConfiguration();
  }

  renderConnectionStatus() {
    const { connectionStatus, reconnectBtn } = this.elements;
    const { connectionState, reconnectionAttempts } = this.state;

    // Remove all state classes
    connectionStatus.classList.remove('connected', 'error', 'connecting', 'reconnecting');

    switch (connectionState) {
      case 'connected':
        connectionStatus.classList.add('connected');
        this.elements.statusText.textContent = 'Connected';
        this.elements.statusDot.style.background = 'var(--success)';
        reconnectBtn.style.display = 'none';
        break;

      case 'connecting':
        connectionStatus.classList.add('connecting');
        this.elements.statusText.textContent = 'Connecting...';
        this.elements.statusDot.style.background = 'var(--warning)';
        reconnectBtn.style.display = 'none';
        break;

      case 'reconnecting':
        connectionStatus.classList.add('reconnecting');
        this.elements.statusText.textContent = `Reconnecting... (${reconnectionAttempts}/30)`;
        this.elements.statusDot.style.background = 'var(--warning)';
        reconnectBtn.style.display = 'none';
        break;

      case 'disconnected':
      default:
        connectionStatus.classList.add('error');
        this.elements.statusText.textContent = 'Disconnected';
        this.elements.statusDot.style.background = 'var(--error)';
        reconnectBtn.style.display = 'flex';
        break;
    }
  }

  renderCurrentDomain() {
    const { currentDomain, hasCredentials, connected } = this.state;

    if (currentDomain) {
      this.elements.currentDomain.textContent = currentDomain;

      if (hasCredentials) {
        // Count cookies for current domain
        const domainInfo = this.state.domains.find(d => d.domain === currentDomain);
        const cookieCount = domainInfo?.cookieCount || 0;

        this.elements.credentialsBadge.textContent = 'Ready';
        this.elements.credentialsBadge.className = 'badge ready';
        this.elements.credentialsMeta.textContent = `${cookieCount} authentication cookies detected`;
        this.elements.syncButton.disabled = !connected; // Only enable if connected

        // Add pulse animation to sync button
        this.elements.syncButton.classList.add('pulse');
      } else {
        this.elements.credentialsBadge.textContent = 'Detected';
        this.elements.credentialsBadge.className = 'badge';
        this.elements.credentialsMeta.textContent = 'Dashboard detected. Login to capture credentials.';
        this.elements.syncButton.disabled = true;
        this.elements.syncButton.classList.remove('pulse');
      }
    } else {
      this.elements.currentDomain.textContent = 'No dashboard detected';
      this.elements.credentialsBadge.textContent = 'Waiting';
      this.elements.credentialsBadge.className = 'badge';
      this.elements.credentialsMeta.textContent = 'Navigate to a dashboard or use Debug Tools → Add Domain';
      this.elements.syncButton.disabled = true;
    }
  }

  renderDomainsList() {
    const { domains } = this.state;
    const { domainsList, noDomains } = this.elements;

    if (!domains || domains.length === 0) {
      domainsList.style.display = 'none';
      noDomains.style.display = 'block';
      return;
    }

    domainsList.style.display = 'block';
    noDomains.style.display = 'none';

    // Sort domains by last sync time, but prioritize current domain
    const sortedDomains = [...domains].sort((a, b) => {
      // Current domain always first
      if (a.domain === this.state.currentDomain) return -1;
      if (b.domain === this.state.currentDomain) return 1;
      
      // Then by last sync time
      if (!a.lastSync) return 1;
      if (!b.lastSync) return -1;
      return new Date(b.lastSync) - new Date(a.lastSync);
    });

    // Render activity items
    domainsList.innerHTML = sortedDomains.slice(0, 5).map(domain => {
      const statusIcon = this.getStatusIcon(domain.status);
      const timeAgo = domain.lastSync ? this.formatTimeAgo(domain.lastSync) : 'Never';
      const displayName = domain.name || this.formatDomainName(domain.domain);
      const isCurrent = domain.domain === this.state.currentDomain;

      return `
        <div class="activity-item ${isCurrent ? 'current-domain' : ''}" data-domain="${domain.domain}">
          <div class="activity-info">
            <div class="activity-name">
              ${displayName}
              ${isCurrent ? '<span class="badge-mini">Current</span>' : ''}
            </div>
            <div class="activity-meta">${domain.domain}</div>
          </div>
          <div class="activity-status">
            ${statusIcon}
            <span class="activity-time">${timeAgo}</span>
          </div>
        </div>
      `;
    }).join('');

    // Add hover effects
    domainsList.querySelectorAll('.activity-item').forEach(item => {
      item.addEventListener('click', () => {
        const domain = item.dataset.domain;
        this.showDomainDetails(domain);
      });
    });
  }

  renderStats() {
    const { connectedHosts, syncedToday } = this.state.stats;

    // Animate number changes
    this.animateValue(this.elements.connectedHosts, connectedHosts);
    this.animateValue(this.elements.syncedToday, syncedToday);
  }

  renderConfiguration() {
    const { officeDisplay } = this.state;

    if (officeDisplay) {
      this.elements.endpointInput.value = officeDisplay;
    }
  }

  // UI Helpers
  showLoading(show) {
    if (show) {
      this.elements.loadingState.style.display = 'flex';
      this.elements.mainContent.style.display = 'none';
    } else {
      this.elements.loadingState.style.display = 'none';
      this.elements.mainContent.style.display = 'block';

      // Fade in animation
      this.elements.mainContent.style.animation = 'fadeIn 0.3s ease-out';
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Icon based on type
    const icons = {
      success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    toast.innerHTML = `
      ${icons[type] || icons.info}
      <span>${message}</span>
    `;

    this.elements.toastContainer.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto remove
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  createRipple(event) {
    const button = event.currentTarget;
    const ripple = button.querySelector('.btn-ripple');

    if (!ripple) return;

    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('active');

    setTimeout(() => ripple.classList.remove('active'), 600);
  }

  animateValue(element, endValue) {
    const startValue = parseInt(element.textContent) || 0;
    const duration = 500;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const value = Math.floor(startValue + (endValue - startValue) * progress);
      element.textContent = value;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  // Event Handlers
  async handleSync() {
    const button = this.elements.syncButton;
    const buttonText = button.querySelector('.btn-text');
    const buttonSpinner = button.querySelector('.btn-spinner');
    const buttonIcon = button.querySelector('.btn-icon');

    try {
      // Update button state - keep color, just show loading
      button.disabled = true;
      button.classList.add('loading');
      buttonText.textContent = 'Syncing...';
      
      // Hide icon, show spinner (CSS will handle positioning)
      if (buttonIcon) buttonIcon.style.display = 'none';
      if (buttonSpinner) buttonSpinner.style.display = 'flex';

      // Send sync request
      const response = await this.sendMessage({ type: 'SYNC_CURRENT' });

      if (response.success) {
        // Success animation - remove loading, add success
        button.classList.remove('loading');
        button.classList.add('success');
        buttonText.textContent = 'Synced!';
        
        // Hide spinner, show success icon
        if (buttonSpinner) buttonSpinner.style.display = 'none';
        if (buttonIcon) {
          buttonIcon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
          buttonIcon.style.display = 'block';
        }

        // Show success message
        let message = 'Credentials synced successfully!';
        if (response.data?.hostDistribution) {
          const { hostsSuccess, hostsFound } = response.data.hostDistribution;
          message += ` Distributed to ${hostsSuccess}/${hostsFound} displays.`;
        }
        this.showToast(message, 'success');

        // Update state WITHOUT reloading everything - just refresh data silently
        setTimeout(async () => {
          // Get fresh state from background
          const stateResponse = await this.sendMessage({ type: 'GET_STATE' });
          
          if (stateResponse.success) {
            // Update state without triggering full reload
            this.state = {
              ...this.state,
              ...stateResponse.data,
              connected: stateResponse.data.connectionState === 'connected'
            };
            
            await this.updateStats();
            
            // Only re-render the domains list (not the whole UI)
            this.renderDomainsList();
          }
          
          // Reset button to ready state
          button.classList.remove('success', 'loading');
          button.disabled = false;
          buttonText.textContent = 'Sync to All Displays';
          
          // Restore icon, hide spinner
          if (buttonIcon) {
            buttonIcon.innerHTML = '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>';
            buttonIcon.style.display = 'block';
          }
          if (buttonSpinner) {
            buttonSpinner.style.display = 'none';
          }
          
        }, 2000); // Show "Synced!" for 2 seconds

      } else {
        throw new Error(response.error || 'Sync failed');
      }

    } catch (error) {
      console.error('❌ [POPUP] Sync failed:', error);
      this.showToast(`Sync failed: ${error.message}`, 'error');

      // Reset button completely
      button.disabled = false;
      button.classList.remove('loading', 'success');
      buttonText.textContent = 'Sync to All Displays';
      
      // Restore original state
      if (buttonSpinner) buttonSpinner.style.display = 'none';
      if (buttonIcon) {
        buttonIcon.style.display = 'block';
        buttonIcon.innerHTML = '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>';
      }
    }
  }

  async handleTest() {
    const button = this.elements.testButton;
    const endpoint = this.elements.endpointInput.value.trim();

    if (!endpoint) {
      this.showToast('Please enter a valid endpoint', 'error');
      return;
    }

    const buttonText = button.querySelector('.btn-text');
    const buttonSpinner = button.querySelector('.btn-spinner');

    try {
      // Update button state
      button.disabled = true;
      buttonText.textContent = 'Testing...';
      buttonSpinner.style.display = 'block';

      // Test connection
      const response = await this.sendMessage({
        type: 'TEST_CONNECTION',
        endpoint
      });

      if (response.success && response.data.isValid) {
        button.classList.add('success');
        buttonText.textContent = 'Connected!';
        this.showToast('Connection successful!', 'success');
      } else {
        button.classList.add('error');
        buttonText.textContent = 'Failed';
        this.showToast('Connection failed', 'error');
      }

    } catch (error) {
      console.error('Test failed:', error);
      button.classList.add('error');
      buttonText.textContent = 'Error';
      this.showToast('Test failed', 'error');
    } finally {
      // Reset button after delay
      setTimeout(() => {
        button.disabled = false;
        button.classList.remove('success', 'error');
        buttonText.textContent = 'Test';
        buttonSpinner.style.display = 'none';
      }, 2000);
    }
  }

  async handleSave() {
    const endpoint = this.elements.endpointInput.value.trim();

    if (!endpoint) {
      this.showToast('Please enter a valid endpoint', 'error');
      return;
    }

    try {
      const response = await this.sendMessage({
        type: 'SET_ENDPOINT',
        endpoint
      });

      if (response.success) {
        this.showToast('Configuration saved!', 'success');

        // Reload state
        setTimeout(async () => {
          await this.loadState();
          this.render();
        }, 500);
      } else {
        throw new Error(response.error || 'Failed to save');
      }

    } catch (error) {
      console.error('Save failed:', error);
      this.showToast('Failed to save configuration', 'error');
    }
  }

  toggleSettings() {
    const { settingsToggle, settingsContent } = this.elements;
    const isOpen = settingsContent.style.display !== 'none';

    if (isOpen) {
      settingsToggle.classList.remove('active');
      settingsContent.style.display = 'none';
    } else {
      settingsToggle.classList.add('active');
      settingsContent.style.display = 'block';
    }
  }

  async handleReconnect(isAutomatic = false) {
    const { reconnectBtn } = this.elements;
    let pollInterval = null;
    let pollCount = 0;
    const maxPolls = 30; // 30 seconds max

    try {
      // Update button state
      if (!isAutomatic) {
        reconnectBtn.classList.add('spinning');
        this.showToast('Attempting to reconnect...', 'info');
      }

      // Send reconnect message
      const response = await this.sendMessage({ type: 'FORCE_RECONNECT' });

      if (response.success) {
        // Poll state more frequently during reconnection
        pollInterval = setInterval(async () => {
          pollCount++;

          try {
            const stateResponse = await this.sendMessage({ type: 'GET_STATE' });
            if (stateResponse.success) {
              this.state = {
                ...this.state,
                ...stateResponse.data,
                connected: stateResponse.data.connectionState === 'connected'
              };
              await this.updateStats();
              this.render();

              // Check if connected
              if (this.state.connected) {
                clearInterval(pollInterval);
                this.showToast('Reconnected successfully!', 'success');
                return;
              }

              // Check if still reconnecting
              if (stateResponse.data.connectionState !== 'reconnecting') {
                // State changed from reconnecting, stop polling
                clearInterval(pollInterval);

                if (stateResponse.data.connectionState === 'disconnected') {
                  if (!isAutomatic) {
                    this.showToast('Reconnection failed', 'error');
                  }
                }
              }

              // Timeout after 30 seconds
              if (pollCount >= maxPolls) {
                clearInterval(pollInterval);
                console.log('Reconnection timeout');

                // Force state update to disconnected
                this.state.connectionState = 'disconnected';
                this.render();

                if (!isAutomatic) {
                  this.showToast('Reconnection timeout', 'error');
                }
              }
            }
          } catch (err) {
            console.error('Failed to poll state:', err);
            clearInterval(pollInterval);
          }
        }, 1000); // Poll every second

      } else {
        throw new Error(response.error || 'Reconnection failed');
      }

    } catch (error) {
      console.error('Reconnect failed:', error);
      if (!isAutomatic) {
        this.showToast(`Failed to reconnect: ${error.message}`, 'error');
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    } finally {
      // Clean up button state after a delay
      setTimeout(() => {
        if (reconnectBtn) {
          reconnectBtn.classList.remove('spinning');
        }
      }, 500);
    }
  }

  pollReconnectionStatus() {
    let pollInterval = null;
    let pollCount = 0;
    const maxPolls = 30; // 30 seconds max

    pollInterval = setInterval(async () => {
      pollCount++;

      try {
        const stateResponse = await this.sendMessage({ type: 'GET_STATE' });
        if (stateResponse.success) {
          this.state = {
            ...this.state,
            ...stateResponse.data,
            connected: stateResponse.data.connectionState === 'connected'
          };
          await this.updateStats();
          this.render();

          // Check if no longer reconnecting
          if (stateResponse.data.connectionState !== 'reconnecting') {
            clearInterval(pollInterval);

            if (this.state.connected) {
              this.showToast('Connected!', 'success');
            }
          }

          // Timeout after 30 seconds
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            console.log('Reconnection monitoring timeout');
          }
        }
      } catch (err) {
        console.error('Failed to poll reconnection status:', err);
        clearInterval(pollInterval);
      }
    }, 1000);
  }

  // Utilities
  sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }

  formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  formatDomainName(domain) {
    // Extract meaningful name from domain
    const parts = domain.split('.');
    const name = parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  getStatusIcon(status) {
    const icons = {
      synced: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
      ready: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
      error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      detected: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'
    };

    return icons[status] || icons.detected;
  }

  showDomainDetails(domain) {
    // Future: Show detailed modal or expand inline
    console.log('Show details for:', domain);
  }

  // Debug handlers
  async handleDebugCheckTab() {
    try {
      this.showToast('Checking current tab...', 'info');

      const response = await this.sendMessage({ type: 'CHECK_CURRENT_TAB' });

      if (response.success) {
        this.showToast(`Domain: ${response.data.domain || 'none'}`, 'success');

        // Reload state after check
        setTimeout(async () => {
          await this.loadState();
          this.render();
        }, 500);
      } else {
        throw new Error(response.error || 'Check failed');
      }
    } catch (error) {
      console.error('Debug check failed:', error);
      this.showToast('Failed to check tab', 'error');
    }
  }

  async handleDebugAddDomain() {
    try {
      this.showToast('Adding current domain...', 'info');

      const response = await this.sendMessage({ type: 'ADD_CURRENT_DOMAIN' });

      if (response.success) {
        const message = response.data.hasCredentials
          ? `Added ${response.data.domain} - Credentials found!`
          : `Added ${response.data.domain} - No credentials yet`;
        this.showToast(message, 'success');

        // Reload state after adding
        setTimeout(async () => {
          await this.loadState();
          this.render();
        }, 500);
      } else {
        throw new Error(response.error || 'Failed to add domain');
      }
    } catch (error) {
      console.error('Debug add domain failed:', error);
      this.showToast('Failed to add domain', 'error');
    }
  }

  // Background Tasks
  startBackgroundTasks() {
    // Update stats periodically
    this.timers.statsUpdate = setInterval(() => {
      this.updateStats();
      this.renderStats();
    }, 30000); // Every 30 seconds

    // Check connection periodically
    this.timers.connectionCheck = setInterval(async () => {
      await this.loadState();
      this.renderConnectionStatus();
    }, 60000); // Every minute
  }

  // Cleanup
  destroy() {
    // Clear timers
    Object.values(this.timers).forEach(timer => {
      if (timer) clearInterval(timer);
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.displayOpsPopup = new DisplayOpsPopup();
});

// Cleanup on unload
window.addEventListener('unload', () => {
  if (window.displayOpsPopup) {
    window.displayOpsPopup.destroy();
  }
});