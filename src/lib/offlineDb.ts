import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

// Define the global window interface
declare global {
  interface Window {
    electronAPI?: {
      dbQuery: (sql: string, params?: any[]) => Promise<any[]>;
      dbExecute: (sql: string, params?: any[]) => Promise<{ success: boolean }>;
      storeGet: (key: string) => Promise<any>;
      storeSet: (key: string, value: any) => Promise<boolean>;
      backupDatabase: (destPath?: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      restoreDatabase: (srcPath: string) => Promise<{ success: boolean; error?: string }>;
      selectDirectory: () => Promise<string | null>;
      getAppPath: () => Promise<string>;
    };
  }
}

// Global variable for Capacitor connection
let capacitorDb: any = null;

export const initOfflineDb = async (): Promise<void> => {
  if (window.electronAPI) {
    console.log("Offline Database: Running on Electron Desktop.");
    return;
  }

  if (Capacitor.isNativePlatform()) {
    console.log("Offline Database: Running on Capacitor Android.");
    try {
      const { SQLiteConnection, CapacitorSQLite } = await import('@capacitor-community/sqlite');
      const sqlite = new SQLiteConnection(CapacitorSQLite);
      const isConn = (await sqlite.isConnection("abl_payroll_db", false)).result;
      if (isConn) {
        capacitorDb = await sqlite.retrieveConnection("abl_payroll_db", false);
      } else {
        capacitorDb = await sqlite.createConnection("abl_payroll_db", false, "no-encryption", 1, false);
      }
      await capacitorDb.open();
      
      // Initialize database structure for Android
      await capacitorDb.execute(`
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
          gps_accuracy REAL,
          exact_address TEXT,
          sync_status TEXT DEFAULT 'pending',
          created_at TEXT,
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS leaves (
          id TEXT PRIMARY KEY,
          employee_id TEXT,
          leave_type TEXT,
          start_date TEXT,
          end_date TEXT,
          status TEXT,
          reason TEXT,
          created_at TEXT,
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS loans (
          id TEXT PRIMARY KEY,
          employee_id TEXT,
          loan_type TEXT,
          amount REAL,
          monthly_amortization REAL,
          balance REAL,
          status TEXT,
          created_at TEXT,
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS payroll_runs (
          id TEXT PRIMARY KEY,
          period_start TEXT,
          period_end TEXT,
          status TEXT,
          created_at TEXT,
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS payroll_items (
          id TEXT PRIMARY KEY,
          payroll_run_id TEXT,
          employee_id TEXT,
          days_worked REAL,
          gross_pay REAL,
          sss_deduction REAL,
          phic_deduction REAL,
          hdmf_deduction REAL,
          tax_deduction REAL,
          cash_advance REAL,
          other_deductions REAL,
          net_pay REAL,
          created_at TEXT,
          updated_at TEXT
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
      console.log("Offline Database: Capacitor SQLite initialized.");
    } catch (err) {
      console.error("Failed to init Capacitor SQLite db:", err);
    }
    return;
  }

  console.log("Offline Database: Web environment. Directing to Supabase with mock-offline fallback.");
};

export const offlineQuery = async (sql: string, params: any[] = []): Promise<any[]> => {
  if (window.electronAPI) {
    return await window.electronAPI.dbQuery(sql, params);
  }

  if (capacitorDb) {
    const res = await capacitorDb.query(sql, params);
    return res.values || [];
  }

  // Fallback to local storage mock or dummy list if offline, or Supabase if online
  console.warn("Direct query not natively supported on Web, falling back to mock");
  return [];
};

export const offlineExecute = async (sql: string, params: any[] = []): Promise<void> => {
  if (window.electronAPI) {
    await window.electronAPI.dbExecute(sql, params);
    return;
  }

  if (capacitorDb) {
    await capacitorDb.run(sql, params);
    return;
  }

  console.warn("Direct execute not natively supported on Web");
};
