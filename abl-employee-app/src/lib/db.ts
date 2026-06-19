import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

const sqlite = new SQLiteConnection(CapacitorSQLite);
let db: SQLiteDBConnection | null = null;

export const initDatabase = async () => {
  try {
    const ret = await sqlite.checkConnectionsConsistency();
    const isConn = (await sqlite.isConnection('employee_db', false)).result;
    
    if (ret.result && isConn) {
      db = await sqlite.retrieveConnection('employee_db', false);
    } else {
      // Create and open the database
      // The plugin automatically handles encryption if specified, but for simplicity
      // and without a persistent key management system, we create a standard connection here.
      // In a production environment, you would use 'true' for encryption and provide a key.
      db = await sqlite.createConnection('employee_db', false, 'no-encryption', 1, false);
    }
    
    if (db) {
      await db.open();

      const schema = `
        CREATE TABLE IF NOT EXISTS employees (
          id TEXT PRIMARY KEY,
          employee_code TEXT,
          first_name TEXT,
          last_name TEXT,
          department TEXT,
          position TEXT,
          daily_rate REAL,
          last_synced TEXT
        );

        CREATE TABLE IF NOT EXISTS attendance (
          id TEXT PRIMARY KEY,
          employee_id TEXT,
          attendance_date TEXT,
          time_in TEXT,
          time_out TEXT,
          break_out TEXT,
          break_in TEXT,
          sync_status TEXT DEFAULT 'PENDING',
          created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS sync_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sync_date TEXT,
          records_synced INTEGER,
          status TEXT
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `;
      await db.execute(schema);
    }
    return db;
  } catch (error) {
    console.error('SQLite initialization failed', error);
    throw error;
  }
};

export const getDb = async (): Promise<SQLiteDBConnection> => {
  if (db) return db;
  return await initDatabase();
};
