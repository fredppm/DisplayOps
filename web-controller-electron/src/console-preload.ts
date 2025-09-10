import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('console-minimize'),
  maximize: () => ipcRenderer.invoke('console-maximize'), 
  close: () => ipcRenderer.invoke('console-close'),
  onNewLog: (callback: (data: any) => void) => {
    ipcRenderer.on('new-log', (event, data) => callback(data));
  }
});