import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getDb } from '../lib/db';
import { RefreshCw, Upload, Download, CheckCircle2, AlertCircle, Clock, Wifi, WifiOff } from 'lucide-react';

interface LocalEmployee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  department: string;
  position: string;
  daily_rate: number;
}

interface SyncLog {
  sync_date: string;
  records_synced: number;
  status: string;
}

interface SyncCenterProps {
  employee: LocalEmployee;
  isOnline: boolean;
}

const SyncCenter: React.FC<SyncCenterProps> = ({ employee, isOnline }) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<SyncLog | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [syncProgress, setSyncProgress] = useState<string[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const db = await getDb();
      const pendingResult = await db.query(
        "SELECT COUNT(*) as count FROM attendance WHERE employee_id = ? AND sync_status = 'PENDING'",
        [employee.id]
      );
      setPendingCount(pendingResult.values?.[0]?.count || 0);

      const logResult = await db.query(
        "SELECT * FROM sync_logs ORDER BY id DESC LIMIT 1",
        []
      );
      if (logResult.values && logResult.values.length > 0) {
        setLastSync(logResult.values[0] as SyncLog);
      }
    } catch (err) { console.error(err); }
  }, [employee.id]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const addProgress = (msg: string) => setSyncProgress(prev => [...prev, msg]);

  const handleSync = async () => {
    if (!isOnline) {
      setSyncMessage({ text: 'No internet connection. Please connect to sync.', type: 'error' });
      return;
    }

    setSyncing(true);
    setSyncMessage(null);
    setSyncProgress([]);
    let syncedCount = 0;

    try {
      const db = await getDb();
      addProgress('📡 Connecting to server...');

      // ── STEP 1: Upload pending attendance records ───────────────────────────
      addProgress('⬆️ Fetching pending attendance records...');
      const pendingResult = await db.query(
        "SELECT * FROM attendance WHERE employee_id = ? AND sync_status = 'PENDING'",
        [employee.id]
      );
      const pending = pendingResult.values || [];
      addProgress(`📋 Found ${pending.length} record(s) to upload.`);

      if (pending.length > 0) {
        for (const record of pending) {
          try {
            // Check if record exists in Supabase to prevent duplicates
            const { data: existing } = await supabase
              .from('attendance')
              .select('id')
              .eq('employee_id', record.employee_id)
              .eq('attendance_date', record.attendance_date)
              .maybeSingle();

            if (existing) {
              // Update existing record
              const { error: updateError } = await supabase
                .from('attendance')
                .update({
                  time_in: record.time_in,
                  time_out: record.time_out,
                  break_out: record.break_out,
                  break_in: record.break_in,
                  status: 'present',
                })
                .eq('id', existing.id);

              if (updateError) throw updateError;
            } else {
              // Insert new record
              const { error: insertError } = await supabase
                .from('attendance')
                .insert({
                  employee_id: record.employee_id,
                  attendance_date: record.attendance_date,
                  time_in: record.time_in,
                  time_out: record.time_out,
                  break_out: record.break_out,
                  break_in: record.break_in,
                  status: 'present',
                  created_at: record.created_at,
                });

              if (insertError) throw insertError;
            }

            // Mark as SYNCED locally
            await db.run(
              "UPDATE attendance SET sync_status = 'SYNCED' WHERE id = ?",
              [record.id]
            );
            syncedCount++;
            addProgress(`✅ Uploaded: ${record.attendance_date}`);
          } catch (recordErr: any) {
            addProgress(`⚠️ Failed for ${record.attendance_date}: ${recordErr.message}`);
          }
        }
      }

      // ── STEP 2: Download latest employee profile ────────────────────────────
      addProgress('⬇️ Downloading employee profile...');
      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .select('id, employee_code, first_name, last_name, department, position, daily_rate')
        .eq('id', employee.id)
        .single();

      if (!empErr && empData) {
        await db.run(
          `INSERT OR REPLACE INTO employees (id, employee_code, first_name, last_name, department, position, daily_rate, last_synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [empData.id, empData.employee_code, empData.first_name, empData.last_name, empData.department, empData.position, empData.daily_rate]
        );
        addProgress('✅ Employee profile updated.');
      } else {
        addProgress('⚠️ Could not fetch employee profile.');
      }

      // ── STEP 3: Log sync ───────────────────────────────────────────────────
      const syncDate = new Date().toISOString();
      await db.run(
        "INSERT INTO sync_logs (sync_date, records_synced, status) VALUES (?, ?, 'SUCCESS')",
        [syncDate, syncedCount]
      );
      addProgress(`🎉 Sync complete! ${syncedCount} record(s) synchronized.`);

      setSyncMessage({
        text: `Sync successful! ${syncedCount} record(s) uploaded to system.`,
        type: 'success'
      });
      await fetchStats();
    } catch (err: any) {
      addProgress(`❌ Sync failed: ${err.message}`);
      setSyncMessage({ text: `Sync failed: ${err.message}`, type: 'error' });
      try {
        const db = await getDb();
        await db.run(
          "INSERT INTO sync_logs (sync_date, records_synced, status) VALUES (?, 0, 'FAILED')",
          [new Date().toISOString()]
        );
      } catch (_) {}
    } finally {
      setSyncing(false);
    }
  };

  const formatSyncDate = (isoDate: string) => {
    const d = new Date(isoDate);
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  return (
    <div className="p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <h2 className="text-base font-black uppercase tracking-widest text-slate-300 mb-4">Sync Center</h2>

      {/* Network Status Banner */}
      <div className={`flex items-center gap-3 p-3 rounded-xl border mb-4 ${
        isOnline
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
      }`}>
        {isOnline ? <Wifi className="w-5 h-5 shrink-0" /> : <WifiOff className="w-5 h-5 shrink-0" />}
        <div>
          <p className="text-xs font-black uppercase tracking-widest">{isOnline ? 'Connected to Internet' : 'No Internet Connection'}</p>
          <p className="text-[10px] opacity-70 mt-0.5">{isOnline ? 'Ready to sync with Admin Payroll System' : 'Connect to sync attendance records'}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pending Records</p>
          <p className={`text-4xl font-black mt-1 ${pendingCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{pendingCount}</p>
          <p className="text-[10px] text-slate-600 mt-1">awaiting sync</p>
        </div>
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Last Sync</p>
          {lastSync ? (
            <>
              <p className="text-sm font-bold text-white mt-1">{formatSyncDate(lastSync.sync_date).date}</p>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3" />{formatSyncDate(lastSync.sync_date).time}</p>
            </>
          ) : (
            <p className="text-sm text-slate-600 mt-1">Never synced</p>
          )}
        </div>
      </div>

      {/* Message */}
      {syncMessage && (
        <div className={`flex items-start gap-2 p-3 rounded-xl text-sm font-medium border mb-4 ${
          syncMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : syncMessage.type === 'error'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
        }`}>
          {syncMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          {syncMessage.text}
        </div>
      )}

      {/* Big Sync Button */}
      <button
        id="btn-sync-now"
        onClick={handleSync}
        disabled={syncing || !isOnline}
        className={`w-full flex flex-col items-center justify-center gap-3 py-8 rounded-3xl border-2 font-black text-xl tracking-widest transition-all active:scale-95 shadow-2xl ${
          isOnline
            ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500 shadow-indigo-600/30 disabled:opacity-70'
            : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
        }`}
      >
        {syncing
          ? <><RefreshCw className="w-10 h-10 animate-spin" />SYNCING...</>
          : <><div className="flex gap-2"><Upload className="w-8 h-8" /><Download className="w-8 h-8" /></div>SYNC NOW</>
        }
        <span className="text-xs font-medium opacity-70">Upload to Admin Payroll System</span>
      </button>

      {/* Sync Progress Log */}
      {syncProgress.length > 0 && (
        <div className="mt-4 bg-slate-900 rounded-2xl border border-slate-800 p-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Sync Log</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {syncProgress.map((msg, i) => (
              <p key={i} className="text-xs text-slate-400 font-mono leading-relaxed">{msg}</p>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-4 bg-slate-900 rounded-2xl border border-slate-800 p-4">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">How Sync Works</p>
        <div className="space-y-2">
          {[
            { icon: '📱', text: 'Attendance is saved locally first, even without internet.' },
            { icon: '⬆️', text: 'Tap SYNC NOW while connected to upload records to the Admin Payroll System.' },
            { icon: '⬇️', text: 'Your employee profile is also refreshed from the server.' },
            { icon: '🔒', text: 'Records are never deleted locally until confirmed synced.' },
          ].map(item => (
            <div key={item.icon} className="flex gap-2 items-start">
              <span className="text-sm">{item.icon}</span>
              <p className="text-xs text-slate-500">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SyncCenter;
