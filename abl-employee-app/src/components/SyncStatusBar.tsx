import { useState, useEffect, useCallback } from 'react';
import { manualSync } from '../lib/sync';
import { Network } from '@capacitor/network';

type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export function SyncStatusBar() {
  const [state, setState] = useState<SyncState>('idle');
  const [message, setMessage] = useState('Tap to sync attendance records');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    Network.getStatus().then((s) => setIsOnline(s.connected));
    const listener = Network.addListener('networkStatusChange', (s) => setIsOnline(s.connected));
    return () => {
      listener.then(h => h.remove());
    };
  }, []);

  const handleSync = useCallback(async () => {
    if (state === 'syncing') return;
    if (!isOnline) {
      setState('error');
      setMessage('No internet connection');
      setTimeout(() => { setState('idle'); setMessage('Tap to sync attendance records'); }, 3000);
      return;
    }

    setState('syncing');
    setMessage('Syncing...');

    const result = await manualSync();

    if (result.failed === 0) {
      setState('success');
      setMessage(result.message);
      setTimeout(() => { setState('idle'); setMessage('Tap to sync attendance records'); }, 4000);
    } else {
      setState('error');
      setMessage(result.message);
      setTimeout(() => { setState('idle'); setMessage('Tap to sync attendance records'); }, 5000);
    }
  }, [state, isOnline]);

  const bgColor = {
    idle: 'bg-slate-800 border-slate-600',
    syncing: 'bg-blue-900 border-blue-500',
    success: 'bg-green-900 border-green-500',
    error: 'bg-red-900 border-red-500',
  }[state];

  const icon = {
    idle: '🔄',
    syncing: '⏳',
    success: '✅',
    error: '❌',
  }[state];

  const networkBadge = isOnline
    ? <span className="text-xs text-green-400 font-medium">● Online</span>
    : <span className="text-xs text-red-400 font-medium">● Offline</span>;

  return (
    <button
      onClick={handleSync}
      disabled={state === 'syncing'}
      className={`
        w-full flex items-center justify-between px-4 py-3 rounded-xl border
        transition-all duration-300 active:scale-95 select-none
        ${bgColor}
      `}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div className="text-left">
          <p className="text-white text-sm font-semibold">
            {state === 'syncing' ? 'Syncing to Server...' : 'Sync Attendance'}
          </p>
          <p className="text-slate-300 text-xs mt-0.5">{message}</p>
        </div>
      </div>
      <div className="text-right">
        {networkBadge}
      </div>
    </button>
  );
}
