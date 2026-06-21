const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let mainWindow;
let db;
let store = null;

// electron-store v11+ is ESM-only; we use a simple JSON-based fallback in CJS context
class SimpleStore {
  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'store.json');
    try {
      this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch {
      this.data = {};
    }
  }
  get(key) {
    return this.data[key];
  }
  set(key, value) {
    this.data[key] = value;
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }
  delete(key) {
    delete this.data[key];
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }
}

function initDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'abl_payroll.db');
  db = new Database(dbPath);

  // Enable WAL mode and foreign keys for better performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables if they do not exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      employee_code TEXT UNIQUE,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      department TEXT,
      position TEXT,
      daily_rate REAL,
      monthly_rate REAL,
      sss_no TEXT,
      phic_no TEXT,
      hdmf_no TEXT,
      tin TEXT,
      status TEXT DEFAULT 'active',
      hire_date TEXT,
      employment_type TEXT DEFAULT 'regular',
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      employee_id TEXT,
      employee_name TEXT,
      employee_code TEXT,
      attendance_date TEXT,
      attendance_type TEXT,
      time_in TEXT,
      time_out TEXT,
      selfie_image_path TEXT,
      latitude REAL,
      longitude REAL,
      exact_address TEXT,
      hours_worked REAL DEFAULT 0,
      is_overtime INTEGER DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      sync_status TEXT DEFAULT 'pending',
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS leaves (
      id TEXT PRIMARY KEY,
      employee_id TEXT,
      leave_type TEXT,
      start_date TEXT,
      end_date TEXT,
      days_count REAL DEFAULT 1,
      status TEXT DEFAULT 'pending',
      reason TEXT,
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      employee_id TEXT,
      loan_type TEXT,
      amount REAL,
      monthly_amortization REAL,
      balance REAL,
      total_paid REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      start_date TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payroll_runs (
      id TEXT PRIMARY KEY,
      period_start TEXT,
      period_end TEXT,
      pay_date TEXT,
      payroll_type TEXT DEFAULT 'semi-monthly',
      status TEXT DEFAULT 'draft',
      notes TEXT,
      created_by TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS payroll_items (
      id TEXT PRIMARY KEY,
      payroll_run_id TEXT,
      employee_id TEXT,
      days_worked REAL,
      hours_worked REAL DEFAULT 0,
      basic_pay REAL DEFAULT 0,
      overtime_pay REAL DEFAULT 0,
      holiday_pay REAL DEFAULT 0,
      allowances REAL DEFAULT 0,
      gross_pay REAL,
      sss_deduction REAL DEFAULT 0,
      phic_deduction REAL DEFAULT 0,
      hdmf_deduction REAL DEFAULT 0,
      tax_deduction REAL DEFAULT 0,
      loan_deduction REAL DEFAULT 0,
      cash_advance REAL DEFAULT 0,
      other_deductions REAL DEFAULT 0,
      net_pay REAL,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY(payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS government_contributions (
      id TEXT PRIMARY KEY,
      employee_id TEXT,
      contribution_type TEXT,
      month TEXT,
      year INTEGER,
      employee_share REAL DEFAULT 0,
      employer_share REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE,
      value TEXT,
      description TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      user_email TEXT,
      action TEXT,
      table_name TEXT,
      record_id TEXT,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      direction TEXT,
      status TEXT,
      records_synced INTEGER DEFAULT 0,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false,
    backgroundColor: '#0f172a'
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // In production, load build/index.html, in development load dev server
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  store = new SimpleStore();
  initDatabase();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    if (db) db.close();
    app.quit();
  }
});

// ─── DB IPC Handlers ─────────────────────────────────────────────────────────

ipcMain.handle('db-query', async (event, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(params);
  } catch (error) {
    console.error('db-query error:', error.message, '\nSQL:', sql);
    throw error;
  }
});

ipcMain.handle('db-execute', async (event, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(params);
    return { success: true, changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  } catch (error) {
    console.error('db-execute error:', error.message, '\nSQL:', sql);
    throw error;
  }
});

ipcMain.handle('db-transaction', async (event, operations) => {
  try {
    const runTransaction = db.transaction(() => {
      const results = [];
      for (const op of operations) {
        const stmt = db.prepare(op.sql);
        results.push(stmt.run(op.params || []));
      }
      return results;
    });
    return { success: true, results: runTransaction() };
  } catch (error) {
    console.error('db-transaction error:', error.message);
    throw error;
  }
});

// ─── Store IPC Handlers ───────────────────────────────────────────────────────

ipcMain.handle('store-get', async (event, key) => {
  return store.get(key);
});

ipcMain.handle('store-set', async (event, key, value) => {
  store.set(key, value);
  return true;
});

// ─── File System IPC Handlers ─────────────────────────────────────────────────

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('select-file', async (event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

// ─── Backup / Restore ────────────────────────────────────────────────────────

ipcMain.handle('backup-db', async (event, destFolder) => {
  try {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'abl_payroll.db');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const destPath = path.join(destFolder || userDataPath, `ABL-Payroll-Backup-${timestamp}.sqlite`);
    db.exec('PRAGMA wal_checkpoint(FULL)');
    fs.copyFileSync(dbPath, destPath);
    return { success: true, path: destPath };
  } catch (err) {
    console.error('backup-db error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('restore-db', async (event, srcPath) => {
  try {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'abl_payroll.db');
    const backupPath = path.join(userDataPath, `pre-restore-backup-${Date.now()}.sqlite`);

    // Backup current db first
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
    }

    // Close DB connection
    db.close();

    // Copy new DB
    fs.copyFileSync(srcPath, dbPath);

    // Re-open DB
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    return { success: true };
  } catch (err) {
    console.error('restore-db error:', err.message);
    // Try to re-open original
    try {
      const dbPath = path.join(app.getPath('userData'), 'abl_payroll.db');
      db = new Database(dbPath);
    } catch (e) {}
    return { success: false, error: err.message };
  }
});

// ─── Export Excel ─────────────────────────────────────────────────────────────

ipcMain.handle('export-excel', async (event, data, fileName) => {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: fileName || 'export.xlsx',
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });
    if (!filePath) return { success: false, cancelled: true };

    // Write CSV as fallback (no native xlsx in main process without extra deps)
    if (!Array.isArray(data) || data.length === 0) {
      return { success: false, error: 'No data to export' };
    }
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row =>
      Object.values(row).map(v =>
        typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v
      ).join(',')
    );
    const csvPath = filePath.replace('.xlsx', '.csv');
    fs.writeFileSync(csvPath, [headers, ...rows].join('\n'), 'utf8');
    return { success: true, path: csvPath };
  } catch (err) {
    console.error('export-excel error:', err.message);
    return { success: false, error: err.message };
  }
});

// ─── App Info ─────────────────────────────────────────────────────────────────

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});
