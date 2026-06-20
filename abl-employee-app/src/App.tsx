import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { LogIn, User, Clock, History, LogOut, RefreshCw, AlertTriangle, CheckCircle, Wifi, WifiOff, Settings, ArrowLeft, Camera as CameraIcon } from 'lucide-react';
import { initDB, saveRecord, getAllRecords, getRecordCountByDateAndType } from './lib/db';
import { startSyncListener, triggerSync } from './lib/sync';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Network } from '@capacitor/network';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'landing' | 'punch' | 'login' | 'dashboard' | 'history' | 'sync' | 'profile'>('landing');
  const [isOnline, setIsOnline] = useState(true);
  const [punchMode, setPunchMode] = useState<'in'|'out'>('in');

  useEffect(() => {
    initDB().then(() => {
      startSyncListener();
    });

    Network.getStatus().then(status => setIsOnline(status.connected));
    Network.addListener('networkStatusChange', status => {
      setIsOnline(status.connected);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      // If logged in, maybe still show landing? Let's just stay on the view they select.
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="min-h-[100dvh] flex items-center justify-center bg-[#050d1a] text-white">Loading...</div>;

  const navigateToPunch = (mode: 'in' | 'out') => {
    setPunchMode(mode);
    setView('punch');
  };

  return (
    <div className="min-h-[100dvh] bg-[#050d1a] text-white flex flex-col font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden selection:bg-indigo-500/30">
      {/* Network indicator float */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-bold tracking-widest uppercase">
        {isOnline ? <><Wifi className="w-3.5 h-3.5 text-emerald-400" /> <span className="text-emerald-400">Online</span></> : <><WifiOff className="w-3.5 h-3.5 text-rose-400" /> <span className="text-rose-400">Offline</span></>}
      </div>

      {view === 'landing' && <LandingView onPunch={navigateToPunch} onAdmin={() => setView(session ? 'sync' : 'login')} />}
      {view === 'punch' && <OfflinePunchView mode={punchMode} onBack={() => setView('landing')} isOnline={isOnline} />}
      {view === 'login' && <Login onBack={() => setView('landing')} onSuccess={() => setView('sync')} />}
      
      {/* Logged in views */}
      {(view === 'sync' || view === 'history' || view === 'profile') && session && (
        <div className="flex flex-col h-full bg-slate-900">
          <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center shadow-md">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-lg">A</div>
              <span className="font-bold tracking-wider">Admin Portal</span>
            </div>
            <button onClick={() => { supabase.auth.signOut(); setView('landing'); }} className="text-slate-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-24">
            {view === 'sync' && <SyncMonitor />}
            {view === 'history' && <AttendanceHistory user={session.user} />}
            {view === 'profile' && <Profile user={session.user} />}
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around p-3 z-50">
            <NavButton icon={<RefreshCw />} label="Sync" active={view === 'sync'} onClick={() => setView('sync')} />
            <NavButton icon={<History />} label="History" active={view === 'history'} onClick={() => setView('history')} />
            <NavButton icon={<User />} label="Profile" active={view === 'profile'} onClick={() => setView('profile')} />
            <NavButton icon={<LogOut />} label="Exit" active={false} onClick={() => setView('landing')} />
          </div>
        </div>
      )}
    </div>
  );
}

function LandingView({ onPunch, onAdmin }: { onPunch: (m: 'in'|'out') => void, onAdmin: () => void }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      setNow(new Date());
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const timeStr = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="flex-1 w-full flex flex-col items-center justify-between px-6 py-10 bg-gradient-to-b from-[#050d1a] to-[#0a1628] relative">
      {/* Ambient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] aspect-square rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute top-[-10%] right-[-10%] w-[60%] aspect-square rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[60%] aspect-square rounded-full bg-rose-500/10 blur-[100px] pointer-events-none" />

      <div className="flex flex-col items-center gap-5 w-full pt-6 relative z-10">
        <div className="text-center">
          <h1 className="text-[1.15rem] font-black text-white tracking-widest uppercase drop-shadow-md">ABL PAYROLL SOLUTIONS</h1>
          <p className="text-[0.65rem] font-bold text-indigo-300 tracking-[0.25em] mt-1.5 uppercase">Payroll & Attendance</p>
        </div>
      </div>

      {/* Digital Clock Card */}
      <div className="w-full relative mt-8 mb-8 group z-10">
        <div className="absolute inset-0 bg-white/[0.02] rounded-3xl border border-white/10 backdrop-blur-md overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '16px 16px' }} />
        </div>
        <div className="relative px-4 py-8 flex flex-col items-center justify-center text-center">
          <div className="text-[2.75rem] font-black text-white tracking-tight tabular-nums drop-shadow-lg leading-none">
            {timeStr}
          </div>
          <div className="text-xs font-semibold text-slate-400 mt-3 uppercase tracking-[0.15em]">
            {dateStr}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full flex flex-col gap-4 flex-1 justify-center z-10">
        <button
          onClick={() => onPunch('in')}
          className="group relative w-full rounded-[2rem] border border-emerald-500/30 bg-black/40 p-4 overflow-hidden active:scale-[0.98] transition-all duration-300 hover:bg-emerald-500/[0.05] hover:border-emerald-500/50 hover:shadow-[0_0_40px_rgba(16,185,129,0.15)] flex items-center text-left"
        >
          <AnalogClock time={now} color="emerald" />
          <div className="ml-5 flex-1 flex flex-col justify-center py-1">
            <h2 className="text-[1.35rem] font-black text-emerald-400 tracking-wider leading-none">TIME IN</h2>
            <p className="text-[0.7rem] font-semibold text-slate-400 uppercase tracking-widest mt-1.5">Start your shift</p>
            
            <div className="mt-4 flex items-center gap-2.5">
              <div className="h-1 flex-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-600/0 to-emerald-400 w-1/3 group-hover:w-full transition-all duration-500 ease-out" />
              </div>
              <span className="text-[0.65rem] font-bold text-emerald-500/80 uppercase tracking-wider whitespace-nowrap">Tap to check in →</span>
            </div>
          </div>
        </button>

        <button
          onClick={() => onPunch('out')}
          className="group relative w-full rounded-[2rem] border border-rose-500/30 bg-black/40 p-4 overflow-hidden active:scale-[0.98] transition-all duration-300 hover:bg-rose-500/[0.05] hover:border-rose-500/50 hover:shadow-[0_0_40px_rgba(225,29,72,0.15)] flex items-center text-left"
        >
          <AnalogClock time={now} color="rose" />
          <div className="ml-5 flex-1 flex flex-col justify-center py-1">
            <h2 className="text-[1.35rem] font-black text-rose-400 tracking-wider leading-none">TIME OUT</h2>
            <p className="text-[0.7rem] font-semibold text-slate-400 uppercase tracking-widest mt-1.5">End your shift</p>
            
            <div className="mt-4 flex items-center gap-2.5">
              <div className="h-1 flex-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-rose-600/0 to-rose-400 w-1/3 group-hover:w-full transition-all duration-500 ease-out" />
              </div>
              <span className="text-[0.65rem] font-bold text-rose-500/80 uppercase tracking-wider whitespace-nowrap">Tap to check out →</span>
            </div>
          </div>
        </button>
      </div>

      {/* Admin Login Bottom Pill */}
      <div className="mt-8 pt-4 w-full flex justify-center pb-2 z-10">
        <button 
          onClick={onAdmin}
          className="group flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/[0.02] border border-white/[0.04] hover:bg-purple-500/[0.08] hover:border-purple-500/30 transition-all active:scale-95"
        >
          <div className="w-6 h-6 rounded-[0.4rem] bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
            <Settings className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <span className="text-[0.65rem] font-bold text-slate-500 group-hover:text-purple-300 uppercase tracking-[0.15em] transition-colors">Admin</span>
        </button>
      </div>
    </div>
  );
}

function AnalogClock({ time, color }: { time: Date, color: "emerald" | "rose" }) {
  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  const ms = time.getMilliseconds();
  
  const secDeg = (seconds + ms / 1000) * 6;
  const minDeg = (minutes + seconds / 60) * 6;
  const hrDeg = (hours % 12 + minutes / 60) * 30;

  const isGreen = color === "emerald";
  const glowColor = isGreen ? "rgba(16, 185, 129, 0.25)" : "rgba(225, 29, 72, 0.25)";
  const borderColor = isGreen ? "#10b981" : "#e11d48";
  
  return (
    <div className="relative w-24 h-24 rounded-full bg-black/60 border border-white/10 shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] overflow-hidden flex items-center justify-center shrink-0">
      <div 
        className="absolute inset-0 rounded-full opacity-50 transition-all duration-75"
        style={{ background: `conic-gradient(from ${secDeg}deg, transparent 0deg, transparent 270deg, ${borderColor} 360deg)` }}
      />
      <div className="absolute inset-[3px] rounded-full bg-gradient-to-br from-[#1a2333] to-[#0a101a] border border-white/5 shadow-inner" style={{ boxShadow: `inset 0 0 20px ${glowColor}` }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="absolute w-[1.5px] h-2 bg-white/20 rounded-full" style={{
            top: 3, left: "calc(50% - 0.75px)", transformOrigin: "0.75px 42px", transform: `rotate(${i * 30}deg)`
          }} />
        ))}
        <div className="absolute left-1/2 bottom-1/2 w-[3px] h-6 bg-white rounded-full origin-bottom -translate-x-1/2 drop-shadow-md" style={{ transform: `rotate(${hrDeg}deg)` }} />
        <div className="absolute left-1/2 bottom-1/2 w-0.5 h-9 bg-white/80 rounded-full origin-bottom -translate-x-1/2 drop-shadow-md" style={{ transform: `rotate(${minDeg}deg)` }} />
        <div className="absolute left-1/2 bottom-1/2 w-[1.5px] h-10 rounded-full origin-bottom -translate-x-1/2" style={{ backgroundColor: borderColor, transform: `rotate(${secDeg}deg)` }} />
        <div className="absolute top-1/2 left-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" style={{ backgroundColor: borderColor, boxShadow: `0 0 8px ${borderColor}` }} />
      </div>
    </div>
  )
}

function OfflinePunchView({ mode, onBack, isOnline }: { mode: 'in'|'out', onBack: () => void, isOnline: boolean }) {
  const [employeeCode, setEmployeeCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isGreen = mode === 'in';

  const handlePunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeCode) return;
    setLoading(true);
    setError('');

    try {
      // Offline mode: We must trust the employee code, or if online, we verify it.
      // Ideally we should sync employee database locally, but for now we just save the code.
      // If we are online, we can verify employee exists.
      let empName = "Employee";
      let empId = employeeCode;

      if (isOnline) {
        const { data: emp, error: empErr } = await supabase.from('employees').select('id, first_name, last_name, employee_code').eq('employee_code', employeeCode).maybeSingle();
        if (empErr || !emp) throw new Error("Employee Code not found in database.");
        empName = `${emp.first_name} ${emp.last_name}`;
        empId = emp.id;
      }

      // Check double punch locally
      const todayStr = new Date().toISOString().split('T')[0];
      const count = await getRecordCountByDateAndType(empId, todayStr, mode);
      
      if (count > 0) {
        alert(`You have already timed ${mode} today. Saving as a duplicate record. Please inform HR if this is a mistake.`);
      }

      // Capture GPS
      let latitude = null, longitude = null;
      try {
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 5000 });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch (e) {
        console.warn("GPS failed");
      }

      // Capture Selfie
      let localImagePath = null;
      try {
        const image = await Camera.getPhoto({
          quality: 50,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
        });

        if (image.base64String) {
          const fileName = `selfie_${Date.now()}.jpeg`;
          await Filesystem.writeFile({
            path: fileName,
            data: image.base64String,
            directory: Directory.Data
          });
          localImagePath = fileName;
        }
      } catch (e) {
        throw new Error("Selfie is required to Time " + mode.toUpperCase());
      }

      // Save Offline
      const isoTime = new Date().toISOString();
      await saveRecord({
        employee_id: empId,
        employee_name: empName,
        employee_code: employeeCode,
        attendance_date: todayStr,
        attendance_type: mode,
        time_in: mode === 'in' ? isoTime : null,
        time_out: mode === 'out' ? isoTime : null,
        selfie_image_path: localImagePath,
        latitude,
        longitude
      });

      alert(`Successfully Timed ${mode.toUpperCase()}! Record saved.`);
      
      if (isOnline) triggerSync();
      onBack();
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 animate-in fade-in slide-in-from-right-8 duration-300">
      <div className="p-4 flex items-center gap-4 border-b border-white/5">
        <button onClick={onBack} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <h2 className="text-lg font-bold tracking-widest uppercase">Take Attendance</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl ${isGreen ? 'bg-emerald-500/20 text-emerald-400 shadow-emerald-500/20' : 'bg-rose-500/20 text-rose-400 shadow-rose-500/20'}`}>
          <CameraIcon className="w-10 h-10" />
        </div>
        
        <h1 className={`text-3xl font-black mb-2 uppercase tracking-widest ${isGreen ? 'text-emerald-400' : 'text-rose-400'}`}>
          TIME {mode}
        </h1>
        <p className="text-slate-400 text-sm text-center mb-8">Enter your Employee Code and take a selfie.</p>

        <form onSubmit={handlePunch} className="w-full max-w-sm space-y-4">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/50 text-rose-400 rounded-lg text-sm text-center">{error}</div>}
          
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Employee Code</label>
            <input 
              type="text" 
              value={employeeCode}
              onChange={e => setEmployeeCode(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-4 text-center text-2xl font-mono tracking-widest text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
              placeholder="EMP-001"
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full font-black py-4 rounded-xl transition-all tracking-widest text-lg mt-4 shadow-lg ${isGreen ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-emerald-500/20' : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'} disabled:opacity-50 flex justify-center items-center gap-2`}
          >
            {loading ? 'PROCESSING...' : `CONFIRM TIME ${mode.toUpperCase()}`}
          </button>
        </form>
      </div>
    </div>
  );
}

// ... Login, NavButton, SyncMonitor, AttendanceHistory, Profile components remain from previous ...
// Only copying Login, NavButton, SyncMonitor, AttendanceHistory, Profile so file is complete

function Login({ onBack, onSuccess }: { onBack: () => void, onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Offline Hardcoded Admin Access
    if (email.toLowerCase() === 'admin' && password === '1111') {
      onSuccess();
    } else {
      setError('Invalid admin credentials.');
    }
    
    setLoading(false);
  };

  return (
    <div className="flex-1 bg-[#050d1a] flex flex-col px-6 relative animate-in fade-in slide-in-from-bottom-8 duration-300">
      <button onClick={onBack} className="absolute top-6 left-6 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors z-10">
        <ArrowLeft className="w-5 h-5 text-slate-300" />
      </button>
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-center">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-purple-500/20 rounded-2xl mx-auto flex items-center justify-center mb-4 border border-purple-500/30">
            <Settings className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Access</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/50 text-rose-400 rounded-lg text-sm text-center">{error}</div>}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Admin Email</label>
            <input type="text" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500" required />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 rounded-xl mt-6">
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
      <div className={`${active ? 'scale-110' : ''} transition-transform`}>{icon}</div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function SyncMonitor() {
  const [records, setRecords] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const loadData = async () => { const data = await getAllRecords(); setRecords(data); };
  useEffect(() => { loadData(); const interval = setInterval(loadData, 5000); return () => clearInterval(interval); }, []);
  const handleForceSync = async () => { setSyncing(true); await triggerSync(); await loadData(); setSyncing(false); };
  const pendingCount = records.filter(r => r.sync_status === 'pending').length;

  return (
    <div className="animate-in fade-in duration-300">
      <h2 className="text-lg font-bold mb-4 uppercase tracking-wider text-slate-300">Sync Monitor</h2>
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-sm mb-6 flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-3">
          {pendingCount === 0 ? <CheckCircle className="w-8 h-8 text-emerald-400" /> : <RefreshCw className={`w-8 h-8 text-amber-400 ${syncing ? 'animate-spin' : ''}`} />}
        </div>
        <div className="text-3xl font-black">{pendingCount}</div>
        <div className="text-xs font-bold text-slate-500 uppercase mt-1">Pending Records</div>
        <button onClick={handleForceSync} disabled={syncing || pendingCount === 0} className="mt-6 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold rounded-lg text-sm transition-all">
          {syncing ? 'Syncing...' : 'Force Sync Now'}
        </button>
      </div>
      <div className="space-y-3">
        {records.slice(0, 10).map((r, i) => (
          <div key={i} className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex justify-between items-center text-sm">
            <div>
              <div className="font-bold">{r.attendance_type.toUpperCase()} - {r.attendance_date}</div>
              <div className="text-xs text-slate-400">{r.employee_code} | {new Date(r.created_at).toLocaleTimeString()}</div>
            </div>
            <div>
              {r.sync_status === 'synced' ? <span className="text-emerald-400 font-bold text-[10px] bg-emerald-400/10 px-2 py-1 rounded">SYNCED</span> : <span className="text-amber-400 font-bold text-[10px] bg-amber-400/10 px-2 py-1 rounded">PENDING</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttendanceHistory({ user }: { user: any }) { return <div className="p-4 text-center text-slate-400">History View</div>; }
function Profile({ user }: { user: any }) { return <div className="p-4 text-center text-slate-400">Profile View</div>; }

export default App;
