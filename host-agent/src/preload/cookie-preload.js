const { contextBridge, ipcRenderer } = require('electron');

// Expose cookie API to renderer process
contextBridge.exposeInMainWorld('cookieAPI', {
  // Cookie management
  getCookies: () => ipcRenderer.invoke('get-all-cookies'),
  setCookie: (cookie) => ipcRenderer.invoke('set-cookie', cookie.domain ? `https://${cookie.domain}` : 'https://localhost', cookie),
  deleteCookie: (name, domain) => ipcRenderer.invoke('remove-cookie', domain ? `https://${domain}` : 'https://localhost', name),
  clearAllCookies: () => ipcRenderer.invoke('clear-all-cookies'),
  
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('cookie-editor:close'),
  
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
    // No specific listeners for cookie editor yet
  }
});