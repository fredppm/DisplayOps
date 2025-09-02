// Preload script for Electron renderer processes
// This script runs in the renderer process before the web page loads
// It provides a secure bridge between the main process and renderer process

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window management
  createWindow: (config) => ipcRenderer.invoke('window:create', config),
  closeWindow: (windowId) => ipcRenderer.invoke('window:close', windowId),
  navigateWindow: (windowId, url) => ipcRenderer.invoke('window:navigate', windowId, url),
  
  // System status
  getSystemStatus: () => ipcRenderer.invoke('system:status'),
  
  // Event listeners
  onWindowClosed: (callback) => ipcRenderer.on('window:closed', callback),
  onWindowError: (callback) => ipcRenderer.on('window:error', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Log when preload script is loaded
console.log('DisplayOps Host Agent preload script loaded');

// Add error handling for the renderer process
window.addEventListener('error', (event) => {
  console.error('Renderer process error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in renderer:', event.reason);
});

// Disable right-click context menu in production
if (process.env.NODE_ENV === 'production') {
  window.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
}

// Disable keyboard shortcuts that could interfere with kiosk mode
window.addEventListener('keydown', (event) => {
  // Disable F11 (fullscreen toggle)
  if (event.key === 'F11') {
    event.preventDefault();
  }
  
  // Disable Alt+F4 (close window)
  if (event.altKey && event.key === 'F4') {
    event.preventDefault();
  }
});
