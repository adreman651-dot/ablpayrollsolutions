import { Network } from '@capacitor/network';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { supabase } from './supabase';
import { getPendingRecords, markAsSynced } from './db';

let isSyncing = false;

export const startSyncListener = () => {
  // Listen for network changes
  Network.addListener('networkStatusChange', status => {
    console.log('Network status changed', status);
    if (status.connected) {
      triggerSync();
    }
  });

  // Also try to sync on startup if online
  Network.getStatus().then(status => {
    if (status.connected) {
      triggerSync();
    }
  });
};

export const triggerSync = async () => {
  if (isSyncing) return;
  isSyncing = true;
  console.log("Starting sync...");

  try {
    const pendingRecords = await getPendingRecords();
    
    for (const record of pendingRecords) {
      try {
        // 1. Check for duplicates in Supabase
        const { data: existing, error: errExist } = await supabase
          .from('attendance')
          .select('id')
          .eq('employee_id', record.employee_id)
          .eq('date', record.attendance_date)
          .eq(record.attendance_type === 'in' ? 'time_in' : 'time_out', record[record.attendance_type === 'in' ? 'time_in' : 'time_out'])
          .limit(1);

        if (errExist) throw errExist;

        // If it exists exactly, just mark as synced
        // Wait, the user asked for a duplicate warning, but that's for the UI at the time of punching.
        // For sync, if the record already exists in Supabase (maybe synced previously but DB failed to update), just mark as synced.

        let photoUrl = null;

        // 2. Upload Selfie if exists
        if (record.selfie_image_path) {
          try {
            const file = await Filesystem.readFile({
              path: record.selfie_image_path,
              directory: Directory.Data
            });

            const fileName = `selfie_${record.employee_id}_${Date.now()}.jpeg`;
            const fileData = await fetch(`data:image/jpeg;base64,${file.data}`).then(res => res.blob());

            const { data: uploadData, error: uploadErr } = await supabase.storage
              .from('attendance-selfies') // Assuming this bucket exists, fallback to null if fails
              .upload(fileName, fileData, { contentType: 'image/jpeg' });

            if (!uploadErr && uploadData) {
              const { data: publicUrl } = supabase.storage.from('attendance-selfies').getPublicUrl(uploadData.path);
              photoUrl = publicUrl.publicUrl;
              
              // Delete local selfie to save space as requested
              await Filesystem.deleteFile({
                path: record.selfie_image_path,
                directory: Directory.Data
              });
            }
          } catch (e) {
            console.error("Selfie upload failed:", e);
          }
        }

        // 3. RPC call to insert into Supabase
        // We use kiosk_punch_v2 or a similar generic insertion logic.
        const { error: insertErr } = await supabase.rpc('kiosk_punch_v2', {
          _employee_code: record.employee_code,
          _employee_id: record.employee_id,
          _employee_name: record.employee_name,
          _mode: record.attendance_type,
          _latitude: record.latitude || null,
          _longitude: record.longitude || null,
          _photo_url: photoUrl,
          _address: null,
          _device_type: 'android_app_offline_sync',
          _device_timestamp: record.attendance_type === 'in' ? record.time_in : record.time_out
        });

        if (insertErr) {
          console.error("Insert error:", insertErr);
          // If the error is literally "already timed in", we might just mark as synced anyway to avoid infinite retries.
          if (insertErr.message.toLowerCase().includes('already timed')) {
            await markAsSynced(record.id);
          }
        } else {
          // Success!
          await markAsSynced(record.id);
        }

      } catch (err) {
        console.error(`Failed to sync record ${record.id}:`, err);
      }
    }
  } catch (err) {
    console.error("Sync process failed:", err);
  } finally {
    isSyncing = false;
    console.log("Sync finished.");
  }
};
