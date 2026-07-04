import React, { useState, useEffect } from 'react';
import { UpdateService, UpdateInfo } from '../services/UpdateService';
import { ArrowLeft, CheckCircle, Download, Smartphone } from 'lucide-react';

export function UpdateScreen({ onBack }: { onBack: () => void }) {
  const [currentVersion, setCurrentVersion] = useState('');
  const [latestInfo, setLatestInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    loadVersions();
  }, []);

  const loadVersions = async () => {
    setCurrentVersion(await UpdateService.getCurrentVersion());
    checkUpdates(true);
  };

  const checkUpdates = async (silent = false) => {
    if (!silent) setChecking(true);
    const update = await UpdateService.checkForUpdates();
    if (update) setLatestInfo(update);
    else if (!silent) alert('You are already on the latest version.');
    setChecking(false);
  };

  const doUpdate = async () => {
    if (!latestInfo) return;
    setDownloading(true);
    setProgress(0);
    try {
      await UpdateService.downloadAndInstall(latestInfo.apkUrl, (p) => {
        setProgress(Math.round(p));
      });
    } catch (e: any) {
      alert('Update failed: ' + e.message);
      setDownloading(false);
    }
  };

  return (
    <div className="flex-1 bg-[#050d1a] flex flex-col px-6 py-6 animate-in fade-in slide-in-from-right-8 duration-300">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <h2 className="text-xl font-bold tracking-widest uppercase">Application Update</h2>
      </div>

      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-slate-400 font-bold uppercase text-xs tracking-wider">Current Version</div>
          <div className="font-mono text-lg">{currentVersion}</div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-slate-400 font-bold uppercase text-xs tracking-wider">Latest Version</div>
          <div className="font-mono text-lg text-emerald-400">{latestInfo ? latestInfo.versionName : currentVersion}</div>
        </div>
        {latestInfo && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="text-slate-400 font-bold uppercase text-xs tracking-wider mb-2">Release Notes</div>
            <ul className="list-disc pl-5 text-sm space-y-1 text-slate-300">
              {latestInfo.releaseNotes.map((note, i) => <li key={i}>{note}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4 mt-auto">
        {!downloading && (
          <button 
            onClick={() => checkUpdates(false)}
            disabled={checking}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            {checking ? 'Checking...' : 'Check for Updates'}
          </button>
        )}

        {latestInfo && !downloading && (
          <button 
            onClick={doUpdate}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all animate-pulse"
          >
            <Download className="w-5 h-5" />
            Update Now
          </button>
        )}

        {downloading && (
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center">
            <div className="font-bold text-emerald-400 mb-2 uppercase tracking-wider">Downloading Update...</div>
            <div className="text-3xl font-black mb-4">{progress}%</div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function UpdateDialog({ info, onUpdate, onLater }: { info: UpdateInfo, onUpdate: () => void, onLater: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="bg-emerald-500/10 p-6 flex flex-col items-center border-b border-slate-700">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
            <Smartphone className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-black uppercase tracking-widest text-emerald-400">New Update Available</h2>
          <div className="font-mono mt-1 text-slate-300 text-sm">Version {info.versionName}</div>
        </div>
        <div className="p-6">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Release Notes</div>
          <ul className="space-y-2 mb-8">
            {info.releaseNotes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-200">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-3">
            <button onClick={onUpdate} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-600/20 transition-all uppercase tracking-wider">
              Update Now
            </button>
            {!info.mandatory && (
              <button onClick={onLater} className="w-full bg-transparent hover:bg-white/5 border border-slate-600 text-slate-300 font-bold py-3.5 rounded-xl transition-all uppercase tracking-wider">
                Later
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
