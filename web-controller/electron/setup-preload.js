const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isPortAvailable: (port) => ipcRenderer.invoke('setup-isPortAvailable', port),
  saveSetupConfig: (config) => ipcRenderer.invoke('setup-saveConfig', config),
  getAutoStartStatus: () => ipcRenderer.invoke('setup-getAutoStartStatus')
});