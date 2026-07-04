import { supabase } from './supabase';
import { offlineQuery, offlineExecute } from './db';

const TABLES_TO_SYNC = [
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

const TABLE_TIMESTAMP_FILTERS: Record<string, 'updated_at' | 'created_at'> = {
  employees: 'updated_at',
  attendance: 'updated_at',
  leave_types: 'created_at',
  leaves: 'updated_at',
  loans: 'updated_at',
  loan_payments: 'created_at',
  payroll_runs: 'updated_at',
  payroll_items: 'updated_at',
  profiles: 'updated_at',
  system_settings: 'updated_at',
  user_roles: 'created_at'
};

const LOCAL_ONLY_UPLOAD_FIELDS = ['sync_status', 'synced_at', 'last_synced', 'offline_id', 'local_id', 'device_id', 'created_by_device', 'last_modified_device'];

const ALLOWED_COLUMNS: Record<string, Set<string>> = {
  employees: new Set(['id','employee_code','first_name','last_name','middle_name','email','phone','address','birthdate','hire_date','job_title','department','basic_salary','sss_number','philhealth_number','pagibig_number','tin_number','employment_status','profile_photo_url','updated_at']),
  attendance: new Set(['id','employee_id','date','time_in','time_out','photo_in_url','photo_out_url','selfie_url','latitude','longitude','latitude_in','longitude_in','latitude_out','longitude_out','location_label_in','location_label_out','late_minutes','status','notes','total_hours','overtime_minutes','undertime_minutes','employee_code','employee_name','device_type','gps_accuracy']),
  leaves: new Set(['id','employee_id','leave_type_id','start_date','end_date','duration','reason','status','approved_by','updated_at']),
  loans: new Set(['id','employee_id','loan_type','principal_amount','monthly_amortization','remaining_balance','total_paid','status','start_date','approved_by','updated_at']),
  loan_payments: new Set(['id','loan_id','amount','payment_date','payroll_run_id']),
  payroll_runs: new Set(['id','period_start','period_end','run_date','status','notes','created_by','updated_at']),
  payroll_items: new Set(['id','payroll_run_id','employee_id','basic_pay','allowances','gross_pay','sss_contribution','philhealth_contribution','pagibig_contribution','withholding_tax','loan_deductions','cash_advance','other_deductions','net_pay','updated_at']),
  system_settings: new Set(['id','key','value','description','updated_at']),
  profiles: new Set(['id','full_name','avatar_url','employee_id','updated_at']),
  user_roles: new Set(['id','user_id','role'])
};

const UPLOAD_COLUMN_MAPPINGS: Record<string, Record<string, string>> = {
  employees: { status: 'employment_status' }
};

const cleanRowForUpload = (table: string, row: any) => {
  const cleaned = { ...row };
  LOCAL_ONLY_UPLOAD_FIELDS.forEach((f) => delete cleaned[f]);
  const mapping = UPLOAD_COLUMN_MAPPINGS[table];
  if (mapping) {
    for (const [localKey, remoteKey] of Object.entries(mapping)) {
      if (localKey in cleaned) {
        cleaned[remoteKey] = cleaned[localKey];
        delete cleaned[localKey];
      }
    }
  }
  const allowed = ALLOWED_COLUMNS[table];
  if (allowed) {
    const filtered: Record<string, any> = {};
    for (const [k, v] of Object.entries(cleaned)) {
      if (allowed.has(k)) filtered[k] = v;
    }
    return filtered;
  }
  return cleaned;
};

const getLastSyncTime = async (): Promise<string | null> => {
  const rows = await offlineQuery("SELECT last_sync_date, created_at FROM sync_logs WHERE status = 'success' ORDER BY id DESC LIMIT 1");
  if (!rows || rows.length === 0) return null;
  return rows[0].last_sync_date || rows[0].created_at || null;
};

export const syncAllData = async (): Promise<{ success: boolean; details: string }> => {
  const syncTime = new Date().toISOString();
  const lastSyncTime = await getLastSyncTime();
  let totalUploaded = 0;
  let totalDownloaded = 0;
  let failedCount = 0;
  let errorDetails = '';

  try {
    for (const table of TABLES_TO_SYNC) {
      try {
        const allowedColumns = (await offlineQuery(`PRAGMA table_info(${table})`)).map((c: any) => c.name);

        // upload pending
        const pendingRows = await offlineQuery(`SELECT * FROM ${table} WHERE sync_status = 'pending'`);
        for (const row of pendingRows) {
          try {
            const localUpdatedAt = new Date(row.updated_at || row.created_at || 0).getTime();
            let remoteRow: any = null;
            if (row.id) {
              const { data: existingRemote, error: existingErr } = await supabase.from(table as any).select('id, updated_at').eq('id', row.id).maybeSingle();
              if (!existingErr && existingRemote) remoteRow = existingRemote;
            }

            if (remoteRow && remoteRow.updated_at) {
              const remoteUpdatedAt = new Date(remoteRow.updated_at).getTime();
              if (remoteUpdatedAt > localUpdatedAt) {
                const downloadResult = await supabase.from(table as any).select('*').eq('id', row.id).single();
                if (downloadResult.data) {
                  const filteredRemote = { ...downloadResult.data, sync_status: 'synced', synced_at: syncTime };
                  const keys = Object.keys(filteredRemote).filter(k => allowedColumns.includes(k));
                  const placeholders = keys.map(() => '?').join(', ');
                  const insertSql = `INSERT OR REPLACE INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
                  await offlineExecute(insertSql, keys.map(k => (filteredRemote as any)[k]));
                  totalDownloaded++;
                  continue;
                }
              }
            }

            const uploadObj = cleanRowForUpload(table, row);
            const { data: upserted, error: uploadErr } = await supabase.from(table as any).upsert(uploadObj, { returning: 'representation' });
            if (uploadErr) {
              console.error(`[SyncEngine] Upload error for ${table} row ${row.id}:`, uploadErr.message);
              errorDetails += `${table} upload err: ${uploadErr.message}; `;
              failedCount++;
              continue;
            }

            await offlineExecute(`UPDATE ${table} SET sync_status = 'synced', synced_at = ? WHERE id = ?`, [syncTime, row.id]);
            totalUploaded++;
          } catch (uploadErr: any) {
            console.error(`[SyncEngine] Failed uploading ${table} row ${row.id}:`, uploadErr.message);
            errorDetails += `${table} upload row err: ${uploadErr.message}; `;
            failedCount++;
          }
        }

        // download remote updates
        let query = supabase.from(table as any).select('*');
        if (lastSyncTime) {
          const timestampColumn = TABLE_TIMESTAMP_FILTERS[table] || 'updated_at';
          query = query.or(`${timestampColumn}.gt.${lastSyncTime}`);
        }
        const { data: remoteRows, error: downloadErr } = await query;
        if (downloadErr) {
          console.error(`[SyncEngine] Download error for table ${table}:`, downloadErr.message);
          errorDetails += `${table} download err: ${downloadErr.message}; `;
          continue;
        }

        if (!remoteRows || remoteRows.length === 0) continue;

        for (const remoteRow of remoteRows) {
          try {
            const localRows = await offlineQuery(`SELECT * FROM ${table} WHERE id = ?`, [remoteRow.id]);
            const filteredRemote = { ...remoteRow, sync_status: 'synced', synced_at: syncTime };

            if (localRows.length === 0) {
              const keys = Object.keys(filteredRemote).filter(k => allowedColumns.includes(k));
              const placeholders = keys.map(() => '?').join(', ');
              const insertSql = `INSERT OR REPLACE INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
              await offlineExecute(insertSql, keys.map(k => (filteredRemote as any)[k]));
              totalDownloaded++;
              continue;
            }

            const localRow = localRows[0];
            const localTs = new Date(localRow.updated_at || localRow.created_at || 0).getTime();
            const remoteTs = new Date(remoteRow.updated_at || remoteRow.created_at || 0).getTime();

            if (remoteTs > localTs) {
              const keys = Object.keys(filteredRemote).filter(k => allowedColumns.includes(k) && k !== 'id');
              const sets = keys.map(k => `${k} = ?`).join(', ');
              const values = keys.map(k => (filteredRemote as any)[k]);
              values.push(remoteRow.id);
              const updateSql = `UPDATE ${table} SET ${sets} WHERE id = ?`;
              await offlineExecute(updateSql, values);
              totalDownloaded++;
            }
          } catch (rowErr: any) {
            console.error(`[SyncEngine] Failed downloading ${table} row ${remoteRow.id}:`, rowErr.message);
            errorDetails += `${table} remote row err: ${rowErr.message}; `;
            failedCount++;
          }
        }
      } catch (tableErr: any) {
        console.error(`Failed to sync table ${table}:`, tableErr.message);
        errorDetails += `${table} sync err: ${tableErr.message}; `;
      }
    }

    const details = `Uploaded: ${totalUploaded}, Downloaded: ${totalDownloaded}, Failed: ${failedCount}. ${errorDetails ? 'Errors: ' + errorDetails : 'Success'}`;
    const statusVal = failedCount > 0 ? 'failed' : 'success';

    await offlineExecute(
      "INSERT INTO sync_logs (direction, status, records_synced, uploaded_records, downloaded_records, failed_records, last_sync_date, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ['both', statusVal, totalUploaded + totalDownloaded, totalUploaded, totalDownloaded, failedCount, syncTime, details, syncTime]
    );

    return { success: failedCount === 0, details };
  } catch (err: any) {
    const errorMsg = `Sync failed: ${err.message}`;
    await offlineExecute(
      "INSERT INTO sync_logs (direction, status, records_synced, uploaded_records, downloaded_records, failed_records, last_sync_date, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ['both', 'failed', 0, 0, 0, 1, syncTime, errorMsg, syncTime]
    ).catch(() => {});
    return { success: false, details: errorMsg };
  }
};
