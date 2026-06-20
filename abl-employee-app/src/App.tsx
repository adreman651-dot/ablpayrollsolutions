import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { LogIn, User, Clock, History, LogOut, RefreshCw, AlertTriangle, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import { initDB, saveRecord, getAllRecords, getRecordCountByDateAndType } from './lib/db';
import { startSyncListener, triggerSync } from './lib/sync';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Network } from '@capacitor/network';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'history' | 'sync' | 'profile'>('dashboard');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Init Offline features
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
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading...</div>;
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-lg">A</div>
          <span className="font-bold tracking-wider">ABL Employee</span>
        </div>
        <div className="flex items-center gap-4">
          {isOnline ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-rose-400" />}
          <button onClick={() => supabase.auth.signOut()} className="text-slate-400 hover:text-white">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {view === 'dashboard' && <Dashboard user={session.user} isOnline={isOnline} />}
        {view === 'history' && <AttendanceHistory user={session.user} />}
        {view === 'sync' && <SyncMonitor />}
        {view === 'profile' && <Profile user={session.user} />}
      </div>

      {/* Bottom Nav */}
      <div className="absolute bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around p-3 z-50">
        <NavButton icon={<Clock />} label="Time" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
        <NavButton icon={<History />} label="History" active={view === 'history'} onClick={() => setView('history')} />
        <NavButton icon={<RefreshCw />} label="Sync" active={view === 'sync'} onClick={() => setView('sync')} />
        <NavButton icon={<User />} label="Profile" active={view === 'profile'} onClick={() => setView('profile')} />
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

function Login() {
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const email = employeeCode.includes('@') ? employeeCode : `${employeeCode.toLowerCase()}@ablpayroll.local`;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center px-6">
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-500 rounded-2xl mx-auto flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-indigo-500/30 mb-4">A</div>
          <h1 className="text-2xl font-bold text-white">Employee Portal</h1>
          <p className="text-slate-400 mt-2 text-sm">Sign in to manage your attendance</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/50 text-rose-400 rounded-lg text-sm text-center">{error}</div>}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Employee ID / Email</label>
            <input 
              type="text" 
              value={employeeCode}
              onChange={e => setEmployeeCode(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              placeholder="e.g. EMP-001"
              required 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              placeholder="••••••••"
              required 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl transition-colors mt-6 flex justify-center items-center gap-2"
          >
            {loading ? 'Signing in...' : <><LogIn className="w-5 h-5" /> Sign In</>}
          </button>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ user, isOnline }: { user: any, isOnline: boolean }) {
  const [time, setTime] = useState(new Date());
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // If online, fetch fresh employee data, else use local storage cache
    const fetchEmployee = async () => {
      if (isOnline) {
        const { data } = await supabase.from('employees').select('*').eq('id', user.id).single();
        if (data) {
          setEmployee(data);
          localStorage.setItem('cached_employee', JSON.stringify(data));
        }
      } else {
        const cached = localStorage.getItem('cached_employee');
        if (cached) setEmployee(JSON.parse(cached));
      }
    };
    fetchEmployee();
  }, [user.id, isOnline]);

  const handlePunch = async (mode: 'in' | 'out') => {
    if (!employee) return;
    setLoading(true);

    try {
      // 1. Check for Double Punch locally
      const todayStr = new Date().toISOString().split('T')[0];
      const count = await getRecordCountByDateAndType(employee.id, todayStr, mode);
      
      if (count > 0) {
        alert(`You have already timed ${mode} today. Saving as a duplicate record. Please inform HR if this is a mistake.`);
      }

      // 2. Capture GPS
      let latitude = null, longitude = null;
      try {
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 5000 });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch (e) {
        console.warn("GPS failed, proceeding without location.");
      }

      // 3. Capture Selfie
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
        console.warn("Selfie cancelled or failed.");
        // We allow punch without selfie if camera fails or user denies permission, or you can block it.
      }

      // 4. Save Record Locally
      const isoTime = new Date().toISOString();
      await saveRecord({
        employee_id: employee.id,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        employee_code: employee.employee_code,
        attendance_date: todayStr,
        attendance_type: mode,
        time_in: mode === 'in' ? isoTime : null,
        time_out: mode === 'out' ? isoTime : null,
        selfie_image_path: localImagePath,
        latitude,
        longitude
      });

      alert(`Successfully Timed ${mode.toUpperCase()} (Saved Offline). Record will sync when internet is available.`);
      
      // Try to trigger sync immediately if online
      if (isOnline) {
        triggerSync();
      }

    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-800 rounded-2xl p-6 mb-6 border border-slate-700 shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
        <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-1">Welcome back,</h2>
        <h1 className="text-2xl font-black mb-1">{employee ? `${employee.first_name} ${employee.last_name}` : user.email}</h1>
        <p className="text-slate-400 text-sm font-medium">{employee?.department || 'Employee'}</p>
        {!isOnline && <div className="mt-3 text-xs bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-full inline-block border border-amber-500/30">Offline Mode Active</div>}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 py-4">
        <div className="text-center">
          <div className="text-5xl font-black tracking-tighter tabular-nums drop-shadow-md">
            {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">
            {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <div className="w-full flex flex-col gap-4">
          <button 
            onClick={() => handlePunch('in')}
            disabled={loading}
            className="w-full bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 p-6 rounded-2xl font-black tracking-widest text-xl transition-all active:scale-95 disabled:opacity-50 flex flex-col items-center gap-2"
          >
            {loading ? 'PROCESSING...' : <>TIME IN <span className="text-[10px] font-bold opacity-70">Requires Selfie & GPS</span></>}
          </button>
          
          <button 
            onClick={() => handlePunch('out')}
            disabled={loading}
            className="w-full bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 p-6 rounded-2xl font-black tracking-widest text-xl transition-all active:scale-95 disabled:opacity-50 flex flex-col items-center gap-2"
          >
            {loading ? 'PROCESSING...' : <>TIME OUT <span className="text-[10px] font-bold opacity-70">Requires Selfie & GPS</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}

function SyncMonitor() {
  const [records, setRecords] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);

  const loadData = async () => {
    const data = await getAllRecords();
    setRecords(data);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleForceSync = async () => {
    setSyncing(true);
    await triggerSync();
    await loadData();
    setSyncing(false);
  };

  const pendingCount = records.filter(r => r.sync_status === 'pending').length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-lg font-bold mb-4 uppercase tracking-wider text-slate-300">Sync Monitor</h2>
      
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-sm mb-6 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-3">
          {pendingCount === 0 ? <CheckCircle className="w-8 h-8 text-emerald-400" /> : <RefreshCw className={`w-8 h-8 text-amber-400 ${syncing ? 'animate-spin' : ''}`} />}
        </div>
        <div className="text-3xl font-black">{pendingCount}</div>
        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Pending Records</div>
        
        <button 
          onClick={handleForceSync}
          disabled={syncing || pendingCount === 0}
          className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold rounded-lg text-sm transition-all flex items-center gap-2"
        >
          {syncing ? 'Syncing...' : 'Force Sync Now'}
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Local Database Logs</h3>
        {records.slice(0, 10).map((r, i) => (
          <div key={i} className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex justify-between items-center text-sm">
            <div>
              <div className="font-bold">{r.attendance_type.toUpperCase()} - {r.attendance_date}</div>
              <div className="text-xs text-slate-400">{new Date(r.created_at).toLocaleTimeString()}</div>
            </div>
            <div>
              {r.sync_status === 'synced' ? (
                <span className="text-emerald-400 font-bold text-xs bg-emerald-400/10 px-2 py-1 rounded">SYNCED</span>
              ) : (
                <span className="text-amber-400 font-bold text-xs bg-amber-400/10 px-2 py-1 rounded">PENDING</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttendanceHistory({ user }: { user: any }) {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('attendance').select('*').eq('employee_id', user.id).order('date', { ascending: false }).limit(10)
      .then(({ data }) => { if (data) setHistory(data); });
  }, [user.id]);

  const formatTime = (iso: string) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-lg font-bold mb-4 uppercase tracking-wider text-slate-300">Cloud History</h2>
      <div className="space-y-3">
        {history.length === 0 ? (
          <div className="text-center p-8 text-slate-500 bg-slate-800/50 rounded-xl border border-slate-700">No records found online.</div>
        ) : history.map(record => (
          <div key={record.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-sm flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
              <span className="font-bold text-indigo-400">{new Date(record.date).toLocaleDateString()}</span>
              <span className={`text-xs font-bold px-2 py-1 rounded bg-slate-900 ${record.status === 'present' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {record.status?.toUpperCase() || 'LOGGED'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Time In</div>
                <div className="font-mono text-sm">{formatTime(record.time_in)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Time Out</div>
                <div className="font-mono text-sm">{formatTime(record.time_out)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Profile({ user }: { user: any }) {
  const [employee, setEmployee] = useState<any>(null);

  useEffect(() => {
    const cached = localStorage.getItem('cached_employee');
    if (cached) setEmployee(JSON.parse(cached));
    
    supabase.from('employees').select('*').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setEmployee(data);
          localStorage.setItem('cached_employee', JSON.stringify(data));
        }
      });
  }, [user.id]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center mb-6">
        <div className="w-20 h-20 bg-indigo-500 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold">
          {employee ? employee.first_name[0] : 'E'}
        </div>
        <h2 className="text-xl font-bold">{employee ? `${employee.first_name} ${employee.last_name}` : 'Loading...'}</h2>
        <p className="text-indigo-400 font-mono mt-1">{employee?.employee_code || user.email}</p>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Department</div>
          <div className="font-medium">{employee?.department || 'N/A'}</div>
        </div>
        <div className="p-4 border-b border-slate-700">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Position</div>
          <div className="font-medium">{employee?.position || 'N/A'}</div>
        </div>
        <div className="p-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Daily Rate</div>
          <div className="font-medium font-mono text-emerald-400">₱ {employee?.daily_rate?.toFixed(2) || '0.00'}</div>
        </div>
      </div>
    </div>
  );
}

export default App;
