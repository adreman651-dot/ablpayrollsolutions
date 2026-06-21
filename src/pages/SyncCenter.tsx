import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { syncAllData, getSyncStatus } from '@/lib/syncEngine';
import { toast } from 'sonner';
import { RefreshCw, CheckCircle, AlertTriangle, Clock, History, FileText } from 'lucide-react';
import { offlineQuery } from '@/lib/offlineDb';

export default function SyncCenter() {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<any>({ lastSyncDate: null, status: 'idle', logs: [] });
  const [pendingCount, setPendingCount] = useState(0);

  const loadStatus = async () => {
    const s = await getSyncStatus();
    setStatus(s);

    try {
      const pending = await offlineQuery("SELECT COUNT(*) as count FROM attendance WHERE sync_status = 'pending'");
      setPendingCount(pending[0]?.count || 0);
    } catch (e) {
      setPendingCount(0);
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    toast.info("Synchronization started...");
    const res = await syncAllData();
    if (res.success) {
      toast.success(res.details);
    } else {
      toast.error(res.details);
    }
    await loadStatus();
    setSyncing(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sync Center</h1>
          <p className="text-muted-foreground">Manage offline data synchronizations with Supabase cloud database</p>
        </div>
        <Button onClick={handleSyncNow} disabled={syncing} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? "Syncing..." : "Sync Now"}
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Last Sync Connection</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status.lastSyncDate ? new Date(status.lastSyncDate).toLocaleTimeString() : "Never"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {status.lastSyncDate ? new Date(status.lastSyncDate).toLocaleDateString() : "Database not yet synchronized"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Pending Records</CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Attendance records saved locally waiting to sync</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
            {status.status === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : status.status === 'failed' ? (
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            ) : (
              <Clock className="w-4 h-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold uppercase tracking-wider text-primary">
              {status.status || 'IDLE'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Status of the last synchronization action</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            Sync Logs & Conflict Resolutions
          </CardTitle>
          <CardDescription>Historical synchronization logs containing conflict outcomes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-lg p-4 bg-muted/40 font-mono text-xs">
            {status.logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No sync logs found. Click 'Sync Now' to begin.</div>
            ) : (
              status.logs.map((log: string, idx: number) => (
                <div key={idx} className="py-1 border-b border-muted last:border-0 truncate">
                  {log}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
