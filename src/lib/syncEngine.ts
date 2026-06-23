import { supabase } from '@/integrations/supabase/client';
import { offlineQuery, offlineExecute } from './offlineDb';

interface SyncStatus {
  lastSyncDate: string | null;
  status: 'idle' | 'syncing' | 'failed' | 'success';
  logs: string[];
}

export const getSyncStatus = async (): Promise<SyncStatus> => {
  try {
    const logs = await offlineQuery(
      "SELECT * FROM sync_logs ORDER BY id DESC LIMIT 50"
    );
    const lastSuccess = await offlineQuery(
      "SELECT created_at FROM sync_logs WHERE status = 'success' ORDER BY id DESC LIMIT 1"
    );
    return {
      lastSyncDate: lastSuccess.length > 0 ? lastSuccess[0].created_at : null,
      status: logs.length > 0 ? (logs[0].status as any) : 'idle',
      logs: logs.map(
        (l: any) =>
          `[${l.created_at}] [${l.direction}] [${l.status.toUpperCase()}]: ${l.details}`
      ),
    };
  } catch {
    return { lastSyncDate: null, status: 'failed', logs: [] };
  }
};

// ─── MAIN SYNC — Attendance Only ─────────────────────────────────────────────
// Direction: Android kiosk (via Supabase) → Desktop (local SQLite) + Desktop → Supabase
// Only syncs: attendance table (Time In / Time Out records)
export const syncAllData = async (): Promise<{ success: boolean; details: string }> => {
  const syncTime = new Date().toISOString();
  let totalUploaded = 0;
  let totalDownloaded = 0;
  let conflictCount = 0;

  try {
    // ── STEP 1: Upload pending local attendance to Supabase ──────────────────
    const pendingLocal = await offlineQuery(
      "SELECT * FROM attendance WHERE sync_status = 'pending'"
    );

    for (const record of pendingLocal) {
      const uploadObj = { ...record };
      delete uploadObj.sync_status;

      // Check if remote already has this record
      const { data: existing } = await supabase
        .from('attendance')
        .select('id, created_at')
        .eq('id', record.id)
        .maybeSingle();

      if (existing) {
        // Conflict: compare timestamps — newest wins
        const localTs = new Date(record.updated_at || record.created_at || 0).getTime();
        const remoteTs = new Date((existing as any).created_at || 0).getTime();
        if (remoteTs >= localTs) {
          // Remote is newer or equal — mark synced, download will overwrite local
          await offlineExecute(
            "UPDATE attendance SET sync_status = 'synced' WHERE id = ?",
            [record.id]
          );
          continue;
        }
      }

      const { error } = await supabase.from('attendance').upsert(uploadObj);
      if (!error) {
        await offlineExecute(
          "UPDATE attendance SET sync_status = 'synced' WHERE id = ?",
          [record.id]
        );
        totalUploaded++;
      } else {
        console.error('[SyncEngine] Upload error:', error.message);
      }
    }
    // ── STEP 2: Download all attendance from Supabase → Local ────────────────
    const { data: remoteAttendance, error: remoteErr } = await supabase
      .from('attendance')
      .select('*')
      .order('date', { ascending: false })
      .limit(5000); // last 5000 records to keep local DB lean

    if (remoteErr) throw remoteErr;

    const localAttendance = await offlineQuery('SELECT id, updated_at, created_at FROM attendance');
    const localMap = new Map(localAttendance.map((r: any) => [r.id, r]));

    for (const remote of remoteAttendance || []) {
      const local = localMap.get(remote.id);

      if (!local) {
        // New record from Android kiosk — insert locally
        await insertOrReplaceAttendance(remote);
        totalDownloaded++;
      } else {
        // Conflict resolution: newest wins
        const localTs = new Date(
          local.updated_at || local.created_at || 0
        ).getTime();
        const remoteTs = new Date(
          (remote as any).updated_at || remote.created_at || 0
        ).getTime();

        if (remoteTs > localTs) {
          await insertOrReplaceAttendance(remote);
          conflictCount++;
          totalDownloaded++;
        }
        // If local is newer, it was already uploaded in STEP 1
      }
    }

    // ── STEP 3: Log success ───────────────────────────────────────────────────
    const details = `Uploaded: ${totalUploaded}, Downloaded: ${totalDownloaded}, Conflicts resolved: ${conflictCount}`;
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
    ).catch(() => {});
    return { success: false, details: errorDetails };
  }
};

// ─── Helper: Insert or Replace attendance record locally ─────────────────────
const insertOrReplaceAttendance = async (record: any): Promise<void> => {
  const safeRecord = {
    id: record.id,
    employee_id: record.employee_id ?? null,
    employee_name: record.employee_name ?? null,
    employee_code: record.employee_code ?? null,
    date: record.date ?? null,
    time_in: record.time_in ?? null,
    time_out: record.time_out ?? null,
    photo_in_url: record.photo_in_url ?? null,
    photo_out_url: record.photo_out_url ?? null,
    latitude_in: record.latitude_in ?? null,
    longitude_in: record.longitude_in ?? null,
    latitude_out: record.latitude_out ?? null,
    longitude_out: record.longitude_out ?? null,
    gps_accuracy: record.gps_accuracy ?? null,
    location_label_in: record.location_label_in ?? null,
    location_label_out: record.location_label_out ?? null,
    total_hours: record.total_hours ?? 0,
    device_type: record.device_type ?? null,
    device_timestamp_in: record.device_timestamp_in ?? null,
    device_timestamp_out: record.device_timestamp_out ?? null,
    server_timestamp_in: record.server_timestamp_in ?? null,
    server_timestamp_out: record.server_timestamp_out ?? null,
    sync_status: 'synced',
    created_at: record.created_at ?? new Date().toISOString(),
    updated_at: record.updated_at ?? new Date().toISOString(),
  };

  const keys = Object.keys(safeRecord);
  const placeholders = keys.map(() => '?').join(', ');
  const values = Object.values(safeRecord);

  await offlineExecute(
    `INSERT OR REPLACE INTO attendance (${keys.join(', ')}) VALUES (${placeholders})`,
    values
  );
};
