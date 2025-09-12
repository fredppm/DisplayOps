const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('console-minimize'),
  maximize: () => ipcRenderer.invoke('console-maximize'),
  close: () => ipcRenderer.invoke('console-close'),
  onNewLog: (callback) => ipcRenderer.on('new-log', callback)
});