import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

const sqlite = new SQLiteConnection(CapacitorSQLite);
let db: SQLiteDBConnection | null = null;

export const initDB = async () => {
  if (Capacitor.getPlatform() === 'web') {
    console.warn('SQLite not fully supported on web without jeep-sqlite setup.');
    return;
  }

  try {
    const ret = await sqlite.checkConnectionsConsistency();
    const isConn = (await sqlite.isConnection('attendance_db', false)).result;

    if (ret.result && isConn) {
      db = await sqlite.retrieveConnection('attendance_db', false);
    } else {
      db = await sqlite.createConnection('attendance_db', false, 'no-encryption', 1, false);
    }

    await db.open();

    const schemaSql = `
      CREATE TABLE IF NOT EXISTS attendance_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT NOT NULL,
        employee_name TEXT NOT NULL,
        employee_code TEXT NOT NULL,
        attendance_date TEXT NOT NULL,
        attendance_type TEXT NOT NULL,
        time_in TEXT,
        time_out TEXT,
        selfie_image_path TEXT,
        latitude TEXT,
        longitude TEXT,
        sync_status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT
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
        total_hours REAL DEFAULT 0,
        late_minutes REAL DEFAULT 0,
        overtime_minutes REAL DEFAULT 0,
        notes TEXT,
        status TEXT,
        created_at TEXT,
        updated_at TEXT,
        sync_status TEXT DEFAULT 'synced'
      );

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
        updated_at TEXT,
        sync_status TEXT DEFAULT 'synced'
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
        sync_status TEXT DEFAULT 'synced'
      );

      CREATE TABLE IF NOT EXISTS loans (
        id TEXT PRIMARY KEY,
        employee_id TEXT,
        loan_type TEXT,
        principal_amount REAL DEFAULT 0,
        monthly_amortization REAL DEFAULT 0,
        remaining_balance REAL DEFAULT 0,
        total_paid REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        start_date TEXT,
        approved_by TEXT,
        created_at TEXT,
        updated_at TEXT,
        sync_status TEXT DEFAULT 'synced'
      );

      CREATE TABLE IF NOT EXISTS loan_payments (
        id TEXT PRIMARY KEY,
        loan_id TEXT,
        amount REAL DEFAULT 0,
        payment_date TEXT,
        payroll_run_id TEXT,
        created_at TEXT,
        sync_status TEXT DEFAULT 'synced'
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
        net_pay REAL DEFAULT 0,
        created_at TEXT,
        updated_at TEXT,
        sync_status TEXT DEFAULT 'synced'
      );

      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        full_name TEXT,
        avatar_url TEXT,
        employee_id TEXT,
        created_at TEXT,
        updated_at TEXT,
        sync_status TEXT DEFAULT 'synced'
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
+      );
+    `;
+
+    await db.execute(schemaSql);
+  } catch (err) {
+    console.error('initDB error', err);
+  }
+};
+
+export const offlineQuery = async (sql: string, params: any[] = []) => {
+  if (!db) await initDB();
+  if (!db) return [];
+  const res = await db.query(sql, params);
+  return res.values || [];
+};
+
+export const offlineExecute = async (sql: string, params: any[] = []) => {
+  if (!db) await initDB();
+  if (!db) return;
+  await db.run(sql, params);
+};
+
+export const insertPendingAttendance = async (record: any) => {
+  if (!db) await initDB();
+  if (!db) return;
+  const query = `INSERT INTO attendance_records (
+    employee_id, employee_name, employee_code, attendance_date, attendance_type,
+    time_in, time_out, selfie_image_path, latitude, longitude, sync_status, created_at
+  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`;
+  const values = [
+    record.employee_id,
+    record.employee_name,
+    record.employee_code,
+    record.attendance_date,
+    record.attendance_type,
+    record.time_in || null,
+    record.time_out || null,
+    record.selfie_image_path || null,
+    record.latitude || null,
+    record.longitude || null,
+    new Date().toISOString()
+  ];
+  await db.run(query, values);
+};
+
+export const getPendingRecords = async () => {
+  return offlineQuery("SELECT * FROM attendance_records WHERE sync_status = 'pending'");
+};
+
+export const getAllRecords = async () => {
+  return offlineQuery('SELECT * FROM attendance_records ORDER BY id DESC');
+};
+
+export const markAsSynced = async (id: number) => {
+  return offlineExecute("UPDATE attendance_records SET sync_status = 'synced' WHERE id = ?", [id]);
+};
+
+export const getRecordCountByDateAndType = async (employeeId: string, date: string, type: string) => {
+  if (!db) await initDB();
+  if (!db) return 0;
+
+  const res = await db.query(
+    "SELECT COUNT(*) as count FROM attendance_records WHERE employee_id = ? AND attendance_date = ? AND attendance_type = ?",
+    [employeeId, date, type]
+  );
+  return res.values?.[0]?.count || 0;
+};
