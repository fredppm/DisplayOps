const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isPortAvailable: (port: number) => ipcRenderer.invoke('setup-isPortAvailable', port),
  saveSetupConfig: (config: any) => ipcRenderer.invoke('setup-saveConfig', config),
  getAutoStartStatus: () => ipcRenderer.invoke('setup-getAutoStartStatus')
});