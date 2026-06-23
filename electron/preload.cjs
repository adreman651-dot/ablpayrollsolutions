const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Database
  dbQuery: (sql, params) => ipcRenderer.invoke('db-query', sql, params),
  dbExecute: (sql, params) => ipcRenderer.invoke('db-execute', sql, params),
  dbTransaction: (operations) => ipcRenderer.invoke('db-transaction', operations),

  // Store
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),

  // File system
  backupDatabase: (destPath) => ipcRenderer.invoke('backup-db', destPath),
  restoreDatabase: (srcPath) => ipcRenderer.invoke('restore-db', srcPath),
  exportToExcel: (data, fileName) => ipcRenderer.invoke('export-excel', data, fileName),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectFile: (filters) => ipcRenderer.invoke('select-file', filters),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
});
