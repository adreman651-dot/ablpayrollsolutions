import { Network } from '@capacitor/network';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { supabase } from './supabase';
import { getPendingRecords, markAsSynced } from './db';

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

        // Call kiosk_punch_v2 RPC to insert attendance into Supabase
        const { error: insertErr } = await supabase.rpc('kiosk_punch_v2', {
          _employee_code: record.employee_code,
          _employee_id: record.employee_id,
          _employee_name: record.employee_name,
          _mode: record.attendance_type,
          _latitude: record.latitude ? Number(record.latitude) : null,
          _longitude: record.longitude ? Number(record.longitude) : null,
          _photo_url: photoUrl,
          _address: null,
          _device_type: 'android_kiosk_offline',
          _device_timestamp:
            record.attendance_type === 'in' ? record.time_in : record.time_out,
        });

        if (insertErr) {
          // If already exists (already timed in/out), mark as synced to avoid retries
          if (
            insertErr.message?.toLowerCase().includes('already timed') ||
            insertErr.message?.toLowerCase().includes('duplicate')
          ) {
            await markAsSynced(record.id);
          } else {
            console.error('[Sync] Insert error:', insertErr.message);
            failed++;
          }
        } else {
          await markAsSynced(record.id);
          uploaded++;
        }
      } catch (recordErr) {
        console.error(`[Sync] Failed record id=${record.id}:`, recordErr);
        failed++;
      }
    }

    return {
      uploaded,
      failed,
      message: `Synced ${uploaded} records${failed > 0 ? `, ${failed} failed` : ''}`,
    };
  } catch (err: any) {
    console.error('[Sync] Process failed:', err);
    return { uploaded, failed, message: `Sync error: ${err.message}` };
  } finally {
    isSyncing = false;
  }
};
