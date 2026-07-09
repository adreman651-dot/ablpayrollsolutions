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
      middle_name TEXT,
      email TEXT,
      phone TEXT,
      department TEXT,
      job_title TEXT,
      basic_salary REAL DEFAULT 0,
      hire_date TEXT,
      employment_status TEXT DEFAULT 'active',
      sss_number TEXT,
      philhealth_number TEXT,
      pagibig_number TEXT,
      tin_number TEXT,
      payroll_type TEXT DEFAULT 'monthly_rate',
      sss_schedule TEXT DEFAULT 'both',
      phic_schedule TEXT DEFAULT 'both',
      hdmf_schedule TEXT DEFAULT 'both',
      sss_contribution REAL DEFAULT 0,
      phic_contribution REAL DEFAULT 0,
      hdmf_contribution REAL DEFAULT 0,
      address TEXT,
      birthdate TEXT,
      leave_credits REAL DEFAULT 0,
      profile_photo_url TEXT,
      created_at TEXT,
      updated_at TEXT,
      sync_status TEXT DEFAULT 'synced'
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      employee_id TEXT,
      date TEXT,
      time_in TEXT,
      time_out TEXT,
      photo_in_url TEXT,
      photo_out_url TEXT,
      selfie_url TEXT,
      latitude REAL,
      longitude REAL,
      latitude_in REAL,
      longitude_in REAL,
      latitude_out REAL,
      longitude_out REAL,
      location_label_in TEXT,
      location_label_out TEXT,
      total_hours REAL DEFAULT 0,
      total_hours_worked REAL DEFAULT 0,
      late_minutes REAL DEFAULT 0,
      overtime_minutes REAL DEFAULT 0,
      undertime_minutes REAL DEFAULT 0,
      notes TEXT,
      status TEXT,
      created_at TEXT,
      sync_status TEXT DEFAULT 'pending',
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS leave_types (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      description TEXT,
      credits_per_year REAL DEFAULT 0,
      created_at TEXT,
      sync_status TEXT DEFAULT 'synced'
    );

    CREATE TABLE IF NOT EXISTS leaves (
      id TEXT PRIMARY KEY,
      employee_id TEXT,
      leave_type_id TEXT,
      start_date TEXT,
      end_date TEXT,
      duration REAL DEFAULT 1,
      status TEXT DEFAULT 'pending',
      reason TEXT,
      approved_by TEXT,
      created_at TEXT,
      updated_at TEXT,
      sync_status TEXT DEFAULT 'synced',
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY(leave_type_id) REFERENCES leave_types(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      employee_id TEXT,
      loan_type TEXT,
      principal_amount REAL DEFAULT 0,
      monthly_amortization REAL DEFAULT 0,
      per_cutoff_amortization REAL DEFAULT 0,
      remaining_balance REAL DEFAULT 0,
      total_paid REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      start_date TEXT,
      approved_by TEXT,
      created_at TEXT,
      updated_at TEXT,
      sync_status TEXT DEFAULT 'synced',
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS loan_payments (
      id TEXT PRIMARY KEY,
      loan_id TEXT,
      amount REAL DEFAULT 0,
      payment_date TEXT,
      payroll_run_id TEXT,
      created_at TEXT,
      sync_status TEXT DEFAULT 'synced',
      FOREIGN KEY(loan_id) REFERENCES loans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payroll_runs (
      id TEXT PRIMARY KEY,
      period_start TEXT,
      period_end TEXT,
      run_date TEXT,
      cutoff_type TEXT DEFAULT 'semi-monthly',
      status TEXT DEFAULT 'draft',
      notes TEXT,
      created_by TEXT,
      created_at TEXT,
      updated_at TEXT,
      sync_status TEXT DEFAULT 'synced'
    );

    CREATE TABLE IF NOT EXISTS payroll_items (
      id TEXT PRIMARY KEY,
      payroll_run_id TEXT,
      employee_id TEXT,
      basic_pay REAL DEFAULT 0,
      allowances REAL DEFAULT 0,
      gross_pay REAL DEFAULT 0,
      sss_contribution REAL DEFAULT 0,
      philhealth_contribution REAL DEFAULT 0,
      pagibig_contribution REAL DEFAULT 0,
      withholding_tax REAL DEFAULT 0,
      loan_deductions REAL DEFAULT 0,
      cash_advance REAL DEFAULT 0,
      other_deductions REAL DEFAULT 0,
      total_deductions REAL DEFAULT 0,
      absence_deductions REAL DEFAULT 0,
      late_deductions REAL DEFAULT 0,
      overtime_pay REAL DEFAULT 0,
      holiday_pay REAL DEFAULT 0,
      net_pay REAL DEFAULT 0,
      created_at TEXT,
      sync_status TEXT DEFAULT 'synced',
      FOREIGN KEY(payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      full_name TEXT,
      avatar_url TEXT,
      employee_id TEXT,
      created_at TEXT,
      updated_at TEXT,
      sync_status TEXT DEFAULT 'synced',
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE,
      value TEXT,
      description TEXT,
      updated_at TEXT,
      sync_status TEXT DEFAULT 'synced'
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      role TEXT,
      sync_status TEXT DEFAULT 'synced'
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
      uploaded_records INTEGER DEFAULT 0,
      downloaded_records INTEGER DEFAULT 0,
      failed_records INTEGER DEFAULT 0,
      last_sync_date TEXT,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const ensureColumnExists = (table, column, definition) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes(column)) {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    }
  };

  const syncTables = [
    'employees',
    'attendance',
    'leave_types',
    'leaves',
    'loans',
    'loan_payments',
    'payroll_runs',
    'payroll_items',
    'profiles',
    'system_settings',
    'user_roles'
  ];

  for (const table of syncTables) {
    ensureColumnExists(table, 'sync_status', "TEXT DEFAULT 'synced'");
    ensureColumnExists(table, 'updated_at', 'TEXT');
    ensureColumnExists(table, 'synced_at', 'TEXT');
  }

  // Seed default settings and system settings if empty
  const settingsCount = db.prepare("SELECT COUNT(*) as count FROM system_settings").get().count;
  if (settingsCount === 0) {
    const seedSettings = [
      { id: '1', key: 'pagibig_employee', value: '400', description: 'Pag-IBIG Employee Contribution Share' },
      { id: '2', key: 'pagibig_employer', value: '400', description: 'Pag-IBIG Employer Contribution Share' },
      { id: '3', key: 'sss_contribution_rate', value: '0.045', description: 'SSS Employee Contribution rate' },
      { id: '4', key: 'phic_contribution_rate', value: '0.025', description: 'PhilHealth Employee Contribution rate' }
    ];
    const insertSetting = db.prepare("INSERT INTO system_settings (id, key, value, description, updated_at) VALUES (?, ?, ?, ?, ?)");
    for (const s of seedSettings) {
      insertSetting.run(s.id, s.key, s.value, s.description, new Date().toISOString());
    }
  }

  // Seed user roles and profiles for admin fallback
  const rolesCount = db.prepare("SELECT COUNT(*) as count FROM user_roles").get().count;
  if (rolesCount === 0) {
    db.prepare("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)").run("1", "offline-admin-id", "admin");
    db.prepare("INSERT INTO profiles (id, full_name, employee_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run("offline-admin-id", "Offline Admin", "offline-admin-employee-id", new Date().toISOString(), new Date().toISOString());
  }
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

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
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

ipcMain.handle('read-selfie', async (event, filePath) => {
  try {
    if (!filePath) return null;
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      return `data:${mimeType};base64,${data.toString('base64')}`;
    }
    return null;
  } catch (err) {
    console.error('Error reading selfie:', err.message);
    return null;
  }
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

// ─── System Tray (minimize to tray on close) ─────────────────────────────────
const { Tray, Menu, nativeImage } = require('electron');
let tray = null;

app.whenReady().then(() => {
  // Tray icon fallback (white circle 16x16)
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open ABL Payroll', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit(); } }
  ]);
  tray.setToolTip('ABL Payroll Solutions');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
});



app.on('before-quit', () => { app.isQuiting = true; });
