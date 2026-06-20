import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

const sqlite = new SQLiteConnection(CapacitorSQLite);
let db: SQLiteDBConnection | null = null;

export const initDB = async () => {
  if (Capacitor.getPlatform() === 'web') {
    // For web development we would normally setup jeep-sqlite here,
    // but focusing on Android build as requested.
    console.warn("SQLite not fully supported on web without jeep-sqlite setup.");
    return;
  }

  try {
    const ret = await sqlite.checkConnectionsConsistency();
    const isConn = (await sqlite.isConnection("attendance_db", false)).result;

    if (ret.result && isConn) {
      db = await sqlite.retrieveConnection("attendance_db", false);
    } else {
      db = await sqlite.createConnection("attendance_db", false, "no-encryption", 1, false);
    }

    await db.open();

    const query = `
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await db.execute(query);
    console.log("Local database initialized.");
  } catch (err) {
    console.error("Error initializing DB:", err);
  }
};

export const saveRecord = async (record: any) => {
  if (!db) await initDB();
  if (!db) return;

  const query = `
    INSERT INTO attendance_records (
      employee_id, employee_name, employee_code, attendance_date, attendance_type, 
      time_in, time_out, selfie_image_path, latitude, longitude, sync_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?);
  `;
  const values = [
    record.employee_id,
    record.employee_name,
    record.employee_code,
    record.attendance_date,
    record.attendance_type,
    record.time_in || null,
    record.time_out || null,
    record.selfie_image_path || null,
    record.latitude || null,
    record.longitude || null,
    new Date().toISOString()
  ];
  
  await db.run(query, values);
};

export const getPendingRecords = async () => {
  if (!db) await initDB();
  if (!db) return [];

  const res = await db.query("SELECT * FROM attendance_records WHERE sync_status = 'pending'");
  return res.values || [];
};

export const getAllRecords = async () => {
  if (!db) await initDB();
  if (!db) return [];

  const res = await db.query("SELECT * FROM attendance_records ORDER BY id DESC");
  return res.values || [];
};

export const markAsSynced = async (id: number) => {
  if (!db) await initDB();
  if (!db) return;

  await db.run("UPDATE attendance_records SET sync_status = 'synced' WHERE id = ?", [id]);
};

export const getRecordCountByDateAndType = async (employeeId: string, date: string, type: string) => {
  if (!db) await initDB();
  if (!db) return 0;

  const res = await db.query(
    "SELECT COUNT(*) as count FROM attendance_records WHERE employee_id = ? AND attendance_date = ? AND attendance_type = ?",
    [employeeId, date, type]
  );
  return res.values?.[0]?.count || 0;
};
