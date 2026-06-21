const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  dbQuery: (sql, params) => ipcRenderer.invoke('db-query', sql, params),
  dbExecute: (sql, params) => ipcRenderer.invoke('db-execute', sql, params),
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
  backupDatabase: (destPath) => ipcRenderer.invoke('backup-db', destPath),
  restoreDatabase: (srcPath) => ipcRenderer.invoke('restore-db', srcPath),
  exportToExcel: (data, fileName) => ipcRenderer.invoke('export-excel', data, fileName),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getAppPath: () => ipcRenderer.invoke('get-app-path')
});
