import { supabase } from '@/integrations/supabase/client';
import { offlineQuery, offlineExecute } from './offlineDb';
import { toast } from 'sonner';

interface SyncStatus {
  lastSyncDate: string | null;
  status: 'idle' | 'syncing' | 'failed' | 'success';
  logs: string[];
}

export const getSyncStatus = async (): Promise<SyncStatus> => {
  try {
    const logs = await offlineQuery("SELECT * FROM sync_logs ORDER BY id DESC LIMIT 50");
    const lastSuccess = await offlineQuery("SELECT created_at FROM sync_logs WHERE status = 'success' ORDER BY id DESC LIMIT 1");
    
    return {
      lastSyncDate: lastSuccess.length > 0 ? lastSuccess[0].created_at : null,
      status: logs.length > 0 ? (logs[0].status as any) : 'idle',
      logs: logs.map(l => `[${l.created_at}] [${l.direction}] [${l.status.toUpperCase()}]: ${l.details}`)
    };
  } catch (err) {
    return { lastSyncDate: null, status: 'failed', logs: [] };
  }
};

export const syncAllData = async (): Promise<{ success: boolean; details: string }> => {
  const syncTime = new Date().toISOString();
  console.log("Starting sync engine...");
  
  const tables = ['employees', 'attendance', 'leaves', 'loans', 'payroll_runs', 'payroll_items', 'system_settings'];
  let totalUploaded = 0;
  let totalDownloaded = 0;
  let conflictCount = 0;
  
  try {
    // 1. Upload Pending Attendance Records
    const pendingAttendance = await offlineQuery("SELECT * FROM attendance WHERE sync_status = 'pending'");
    for (const record of pendingAttendance) {
      // Check if it already exists on Supabase
      const { data: existing } = await supabase.from('attendance').select('id, updated_at' as any).eq('id', record.id).maybeSingle();
      
      let shouldUpload = true;
      if (existing) {
        const localUpdated = new Date(record.updated_at || record.created_at).getTime();
        const remoteUpdated = new Date((existing as any).updated_at).getTime();
        if (remoteUpdated >= localUpdated) {
          shouldUpload = false;
          // Remote wins, mark as synced and overwrite local later
          await offlineExecute("UPDATE attendance SET sync_status = 'synced' WHERE id = ?", [record.id]);
        }
      }
      
      if (shouldUpload) {
        const uploadObj = { ...record };
        delete uploadObj.sync_status;
        const { error } = await supabase.from('attendance').upsert(uploadObj);
        if (!error) {
          await offlineExecute("UPDATE attendance SET sync_status = 'synced' WHERE id = ?", [record.id]);
          totalUploaded++;
        } else {
          console.error("Failed to upload attendance:", error);
        }
      }
    }

    // 2. Dual-Sync (Download & Conflict Resolve) for other tables
    for (const table of tables) {
      // Fetch latest from Supabase
      const { data: remoteRecords, error: remoteErr } = await supabase.from(table as any).select('*');
      if (remoteErr) throw remoteErr;
      
      // Fetch local records
      const localRecords = await offlineQuery(`SELECT * FROM ${table}`);
      const localMap = new Map(localRecords.map(r => [r.id, r]));
      
      for (const remote of remoteRecords) {
        const local = localMap.get(remote.id);
        
        if (!local) {
          // New record from Supabase -> Save to Local
          await saveRecordLocally(table, remote);
          totalDownloaded++;
        } else {
          // Conflict Resolution: Newest wins
          const localUpdated = new Date(local.updated_at || local.created_at || 0).getTime();
          const remoteUpdated = new Date(remote.updated_at || remote.created_at || 0).getTime();
          
          if (remoteUpdated > localUpdated) {
            // Supabase is newer -> Update Local
            await saveRecordLocally(table, remote);
            conflictCount++;
            await logConflict(table, remote.id, 'remote_wins', `Remote updated_at: ${remote.updated_at}, Local updated_at: ${local.updated_at}`);
            totalDownloaded++;
          } else if (localUpdated > remoteUpdated) {
            // Local is newer -> Upload to Supabase
            const { error: upsertErr } = await supabase.from(table as any).upsert(remote);
            if (!upsertErr) {
              conflictCount++;
              await logConflict(table, remote.id, 'local_wins', `Local updated_at: ${local.updated_at}, Remote updated_at: ${remote.updated_at}`);
              totalUploaded++;
            }
          }
        }
      }

      // Check for local records that don't exist on remote yet (e.g. created offline)
      const remoteIds = new Set(remoteRecords.map(r => r.id));
      for (const local of localRecords) {
        if (!remoteIds.has(local.id)) {
          // Upload to Supabase
          const uploadObj = { ...local };
          if (table === 'attendance') delete uploadObj.sync_status;
          
          const { error } = await supabase.from(table as any).upsert(uploadObj);
          if (!error) {
            totalUploaded++;
          }
        }
      }
    }

    const details = `Sync completed. Uploaded: ${totalUploaded}, Downloaded: ${totalDownloaded}, Conflicts resolved: ${conflictCount}`;
    await offlineExecute(
      "INSERT INTO sync_logs (direction, status, records_synced, details, created_at) VALUES (?, ?, ?, ?, ?)",
      ['both', 'success', totalUploaded + totalDownloaded, details, syncTime]
    );
    return { success: true, details };
  } catch (err: any) {
    const errorDetails = `Sync failed: ${err.message}`;
    await offlineExecute(
      "INSERT INTO sync_logs (direction, status, records_synced, details, created_at) VALUES (?, ?, ?, ?, ?)",
      ['both', 'failed', 0, errorDetails, syncTime]
    );
    return { success: false, details: errorDetails };
  }
};

const saveRecordLocally = async (table: string, record: any): Promise<void> => {
  const keys = Object.keys(record);
  const placeholders = keys.map(() => '?').join(', ');
  const values = Object.values(record);
  
  // Replace or Insert
  const sql = `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  await offlineExecute(sql, values);
};

const logConflict = async (table: string, recordId: string, winner: string, details: string): Promise<void> => {
  await offlineExecute(
    "INSERT INTO audit_logs (action, table_name, record_id, details) VALUES (?, ?, ?, ?)",
    [`conflict_${winner}`, table, recordId, details]
  );
};
