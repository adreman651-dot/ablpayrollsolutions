import { Network } from '@capacitor/network';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { supabase } from './supabase';
import { getPendingRecords, markAsSynced, offlineExecute } from './db';
import { syncAllData } from './syncEngine';
import { Capacitor } from '@capacitor/core';

let isSyncing = false;

export const startSyncListener = () => {
  Network.addListener('networkStatusChange', (status) => {
    if (status.connected) triggerSync();
  });

  Network.getStatus().then((status) => {
    if (status.connected) triggerSync();
  });
};

// Called by the Sync Button in the UI
export const manualSync = async (): Promise<{ uploaded: number; failed: number; message: string }> => {
  if (isSyncing) return { uploaded: 0, failed: 0, message: 'Sync already in progress' };
  return triggerSync();
};

const triggerSync = async (): Promise<{ uploaded: number; failed: number; message: string }> => {
  if (isSyncing) return { uploaded: 0, failed: 0, message: 'Already syncing' };
  isSyncing = true;

  let uploaded = 0;
  let failed = 0;

  try {
    const pendingRecords = await getPendingRecords();

    for (const record of pendingRecords) {
      try {
        let photoUrl: string | null = null;

        // Upload selfie if it exists locally
        if (record.selfie_image_path) {
          try {
            const file = await Filesystem.readFile({
              path: record.selfie_image_path,
              directory: Directory.Data,
            });

            const fileName = `selfie_${record.employee_id}_${record.id}_${Date.now()}.jpeg`;
            const fileBlob = await fetch(
              `data:image/jpeg;base64,${file.data}`
            ).then((r) => r.blob());

            const { data: uploadData, error: uploadErr } = await supabase.storage
              .from('attendance-selfies')
              .upload(fileName, fileBlob, { contentType: 'image/jpeg' });

            if (!uploadErr && uploadData) {
              const { data: pubUrl } = supabase.storage
                .from('attendance-selfies')
                .getPublicUrl(uploadData.path);
              photoUrl = pubUrl.publicUrl;

              // Delete local selfie to save Android storage
              await Filesystem.deleteFile({
                path: record.selfie_image_path,
                directory: Directory.Data,
              }).catch(() => {});
            }
          } catch (photoErr) {
            console.error('[Sync] Selfie upload failed:', photoErr);
          }
        }

        // Reverse-geocode location if available
        let locationLabel: string | null = null;
        if (record.latitude && record.longitude) {
          try {
            const lat = Number(record.latitude);
            const lng = Number(record.longitude);
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`
            );
            const data = await response.json();
            const address = data.address || {};
            const parts = [
              address.road || address.street,
              address.suburb || address.neighbourhood,
              address.city || address.town || address.municipality,
              address.province || address.county,
            ].filter(Boolean);
            locationLabel = parts.join(', ') || null;
          } catch (geoErr) {
            console.warn('[Sync] Reverse geocode failed:', geoErr);
          }
        }

        // Prepare attendance row compatible with Desktop schema and insert into local `attendance` table
        try {
          const generatedId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `local-${Date.now()}-${record.id}`;
          const attendanceRow = {
            id: generatedId,
            employee_id: record.employee_id,
            employee_code: record.employee_code,
            employee_name: record.employee_name,
            date: record.attendance_date,
            time_in: record.time_in || null,
            time_out: record.time_out || null,
            selfie_url: photoUrl,
            latitude: record.latitude ? Number(record.latitude) : null,
            longitude: record.longitude ? Number(record.longitude) : null,
            location_label_in: record.attendance_type === 'in' ? locationLabel : null,
            location_label_out: record.attendance_type === 'out' ? locationLabel : null,
            device_type: 'android_kiosk_offline',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            sync_status: 'pending'
          };

          const keys = Object.keys(attendanceRow);
          const placeholders = keys.map(() => '?').join(',');
          const sql = `INSERT OR REPLACE INTO attendance (${keys.join(',')}) VALUES (${placeholders})`;
          await offlineExecute(sql, keys.map(k => (attendanceRow as any)[k]));

          // mark original attendance_records entry as synced to avoid duplicate local processing
          await markAsSynced(record.id);
          uploaded++;
        } catch (localInsertErr) {
          console.error('[Sync] Failed inserting local attendance row:', localInsertErr);
          failed++;
        }
      } catch (recordErr) {
        console.error(`[Sync] Failed record id=${record.id}:`, recordErr);
        failed++;
      }
    }

    // Trigger full sync engine to sync all tables bidirectionally
    const syncResult = await syncAllData();
    return {
      uploaded,
      failed: failed + (syncResult.success ? 0 : 1),
      message: `Local uploads: ${uploaded}. Sync engine: ${syncResult.details}`,
    };
  } catch (err: any) {
    console.error('[Sync] Process failed:', err);
    return { uploaded, failed, message: `Sync error: ${err.message}` };
  } finally {
    isSyncing = false;
  }
};
