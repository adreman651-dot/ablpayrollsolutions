import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, XCircle, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { syncAllData, getSyncStatus } from '@/lib/syncEngine';
import { toast } from 'sonner';

type SyncState = 'idle' | 'syncing' | 'success' | 'failed';

export function SyncButton() {
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Load last sync status
    getSyncStatus().then(status => {
      setLastSync(status.lastSyncDate);
      setSyncState(status.status === 'syncing' ? 'idle' : status.status);
    });

    // Count pending attendance records
    if ((window as any).electronAPI) {
      (window as any).electronAPI.dbQuery(
        "SELECT COUNT(*) as cnt FROM attendance WHERE sync_status = 'pending'"
      ).then((rows: any) => setPendingCount(rows[0]?.cnt || 0)).catch(() => {});
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleSync = async () => {
    if (!isOnline) {
      toast.error('No internet connection. Connect to sync.');
      return;
    }
    if (syncState === 'syncing') return;

    setSyncState('syncing');
    toast.info('Syncing attendance data with Supabase...');

    try {
      const result = await syncAllData();
      if (result.success) {
        setSyncState('success');
        setLastSync(new Date().toISOString());
        setPendingCount(0);
        toast.success(`Sync complete! ${result.details}`);
        setTimeout(() => setSyncState('idle'), 3000);
      } else {
        setSyncState('failed');
        toast.error(`Sync failed: ${result.details}`);
        setTimeout(() => setSyncState('idle'), 5000);
      }
    } catch (err: any) {
      setSyncState('failed');
      toast.error(`Sync error: ${err.message}`);
      setTimeout(() => setSyncState('idle'), 5000);
    }
  };

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return 'Never synced';
    const d = new Date(dateStr);
    return `Last sync: ${d.toLocaleDateString('en-PH')} ${d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const stateIcon = {
    idle: <RefreshCw className="h-4 w-4" />,
    syncing: <RefreshCw className="h-4 w-4 animate-spin" />,
    success: <CheckCircle2 className="h-4 w-4 text-green-400" />,
    failed: <XCircle className="h-4 w-4 text-red-400" />,
  }[syncState];

  const stateLabel = {
    idle: 'Sync Attendance',
    syncing: 'Syncing...',
    success: 'Synced!',
    failed: 'Retry Sync',
  }[syncState];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
              {pendingCount} pending
            </Badge>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {isOnline
              ? <Wifi className="h-3 w-3 text-green-400" />
              : <WifiOff className="h-3 w-3 text-red-400" />
            }
          </div>
          <Button
            variant={syncState === 'failed' ? 'destructive' : 'outline'}
            size="sm"
            onClick={handleSync}
            disabled={syncState === 'syncing'}
            className="gap-2 h-8 text-xs font-medium"
          >
            {stateIcon}
            {stateLabel}
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <p>{formatLastSync(lastSync)}</p>
        {!isOnline && <p className="text-red-400">Offline — connect to internet to sync</p>}
        {pendingCount > 0 && <p className="text-yellow-400">{pendingCount} attendance records waiting to sync</p>}
      </TooltipContent>
    </Tooltip>
  );
}
