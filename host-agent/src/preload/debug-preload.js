const { contextBridge, ipcRenderer } = require('electron');

// Expose debug API to renderer process
contextBridge.exposeInMainWorld('debugAPI', {
  // Debug data
  getEvents: () => ipcRenderer.invoke('debug:get-events'),
  getMetrics: () => ipcRenderer.invoke('debug:get-metrics'),
  clearEvents: () => ipcRenderer.invoke('debug:clear-events'),
  exportEvents: (format) => ipcRenderer.invoke('debug:export-events', format),
  
  // State management
  getState: () => ipcRenderer.invoke('debug:get-state'),
  togglePin: () => ipcRenderer.invoke('debug:toggle-pin'),
  setTab: (tab) => ipcRenderer.invoke('debug:set-tab', tab),
  
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('debug:close'),
  
  // Real-time updates
  onUpdate: (callback) => {
    ipcRenderer.on('debug:update', (event, data) => callback(data));
  },
  
  // System information
  getSystemInfo: () => {
    return {
      pid: process.pid,
      nodeVersion: process.versions?.node,
      electronVersion: process.versions?.electron,
      platform: process.platform,
      arch: process.arch,
      version: process.version
    };
  },
  
  // Remove listeners
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('debug:update');
  }
});

// Console override for capturing logs
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

window.addEventListener('DOMContentLoaded', () => {
  // Override console methods to capture logs in overlay
  console.log = (...args) => {
    originalLog.apply(console, args);
    window.debugAPI?.onConsoleLog?.('log', args);
  };
  
  console.error = (...args) => {
    originalError.apply(console, args);
    window.debugAPI?.onConsoleLog?.('error', args);
  };
  
  console.warn = (...args) => {
    originalWarn.apply(console, args);
    window.debugAPI?.onConsoleLog?.('warn', args);
  };
});
