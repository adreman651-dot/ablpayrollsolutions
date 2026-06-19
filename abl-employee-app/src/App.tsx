import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { initDatabase, getDb } from './lib/db';
import { Device } from '@capacitor/device';
import { LogIn, User, Clock, History, RefreshCw, LogOut, Wifi, WifiOff, Coffee, Timer, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNetwork } from './hooks/useNetwork';
import SyncCenter from './components/SyncCenter';

type View = 'dashboard' | 'history' | 'sync' | 'profile';

interface LocalEmployee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  department: string;
  position: string;
  daily_rate: number;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  attendance_date: string;
  time_in: string | null;
  time_out: string | null;
  break_out: string | null;
  break_in: string | null;
  sync_status: 'PENDING' | 'SYNCED';
  created_at: string;
}

function App() {
  const [dbReady, setDbReady] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<LocalEmployee | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const { isOnline } = useNetwork();

  // Initialize the SQLite database on startup
  useEffect(() => {
    initDatabase()
      .then(async () => {
        // Check if a user is already "logged in" locally
        const db = await getDb();
        const result = await db.query('SELECT * FROM settings WHERE key = ?', ['active_employee_id']);
        if (result.values && result.values.length > 0) {
          const empId = result.values[0].value;
          const empResult = await db.query('SELECT * FROM employees WHERE id = ?', [empId]);
          if (empResult.values && empResult.values.length > 0) {
            setCurrentEmployee(empResult.values[0] as LocalEmployee);
          }
        }
        setDbReady(true);
      })
      .catch(err => {
        console.error('DB init error:', err);
        // Fallback: still allow login if DB fails to init (will use sessionStorage)
        setDbReady(true);
      });
  }, []);

  const handleLogin = async (employee: LocalEmployee) => {
    setCurrentEmployee(employee);
    setView('dashboard');
  };

  const handleLogout = async () => {
    try {
      const db = await getDb();
      await db.run("DELETE FROM settings WHERE key = 'active_employee_id'", []);
    } catch (_) {}
    await supabase.auth.signOut();
    setCurrentEmployee(null);
  };

  if (!dbReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg shadow-indigo-600/30 mb-6 animate-pulse">A</div>
        <p className="text-slate-400 text-sm font-medium tracking-widest uppercase">Initializing...</p>
      </div>
    );
  }

  if (!currentEmployee) {
    return <Login onLogin={handleLogin} isOnline={isOnline} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 px-4 pt-10 pb-3 border-b border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-lg shadow-lg shadow-indigo-600/40">A</div>
          <div>
            <span className="font-black tracking-wider text-sm">ABL Employee</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isOnline
                ? <><Wifi className="w-3 h-3 text-emerald-400" /><span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Online</span></>
                : <><WifiOff className="w-3 h-3 text-amber-400" /><span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest">Offline</span></>
              }
            </div>
          </div>
        </div>
        <button onClick={handleLogout} className="text-slate-500 hover:text-rose-400 p-2 transition-colors" id="btn-logout">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {view === 'dashboard' && <Dashboard employee={currentEmployee} isOnline={isOnline} />}
        {view === 'history' && <AttendanceHistory employee={currentEmployee} />}
        {view === 'sync' && <SyncCenter employee={currentEmployee} isOnline={isOnline} />}
        {view === 'profile' && <ProfileView employee={currentEmployee} />}
      </div>

      {/* Bottom Nav */}
      <div className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around px-2 py-2 z-50 safe-area-bottom">
        <NavButton id="nav-dashboard" icon={<Clock className="w-5 h-5" />} label="Time" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
        <NavButton id="nav-history" icon={<History className="w-5 h-5" />} label="History" active={view === 'history'} onClick={() => setView('history')} />
        <NavButton id="nav-sync" icon={<RefreshCw className="w-5 h-5" />} label="Sync" active={view === 'sync'} onClick={() => setView('sync')} badge={isOnline ? undefined : '!'} />
        <NavButton id="nav-profile" icon={<User className="w-5 h-5" />} label="Profile" active={view === 'profile'} onClick={() => setView('profile')} />
      </div>
    </div>
  );
}

function NavButton({ id, icon, label, active, onClick, badge }: { id: string; icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: string }) {
  return (
    <button id={id} onClick={onClick} className={`relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all ${active ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500 hover:text-slate-300'}`}>
      {badge && <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[9px] font-black text-black flex items-center justify-center">{badge}</span>}
      <div className={`${active ? 'scale-110' : ''} transition-transform`}>{icon}</div>
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin, isOnline }: { onLogin: (emp: LocalEmployee) => void; isOnline: boolean }) {
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const db = await getDb();

      // Try offline login first (check local cached profile)
      const localEmpResult = await db.query(
        'SELECT * FROM employees WHERE employee_code = ?',
        [employeeCode.toUpperCase()]
      );

      if (!isOnline) {
        // Offline login: verify against locally stored profile
        if (!localEmpResult.values || localEmpResult.values.length === 0) {
          throw new Error('No local profile found. Please connect to internet for first-time login.');
        }
        // In a real app, you'd hash and compare password stored locally.
        // For now, we trust the cached session token in settings.
        const settingsResult = await db.query(
          "SELECT * FROM settings WHERE key = 'cached_password'",
          []
        );
        const cachedPw = settingsResult.values?.[0]?.value;
        if (cachedPw !== password) {
          throw new Error('Incorrect password for offline login.');
        }
        const emp = localEmpResult.values![0] as LocalEmployee;
        await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('active_employee_id', ?)", [emp.id]);
        onLogin(emp);
        return;
      }

      // Online login via Supabase
      const email = employeeCode.includes('@') ? employeeCode : `${employeeCode.toLowerCase()}@ablpayroll.local`;
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw new Error('Invalid Employee ID or Password.');

      // Fetch employee profile
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('id, employee_code, first_name, last_name, department, position, daily_rate')
        .eq('employee_code', employeeCode.toUpperCase())
        .single();

      if (empError || !empData) {
        // Try by auth user email link
        const { data: { user } } = await supabase.auth.getUser();
        const { data: empByUser } = await supabase
          .from('employees')
          .select('id, employee_code, first_name, last_name, department, position, daily_rate')
          .eq('id', user?.id)
          .single();

        if (!empByUser) throw new Error('Employee profile not found on server.');
        await cacheEmployee(db, empByUser as LocalEmployee, password);
        onLogin(empByUser as LocalEmployee);
        return;
      }

      await cacheEmployee(db, empData as LocalEmployee, password);
      onLogin(empData as LocalEmployee);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cacheEmployee = async (db: any, emp: LocalEmployee, password: string) => {
    await db.run(
      `INSERT OR REPLACE INTO employees (id, employee_code, first_name, last_name, department, position, daily_rate, last_synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [emp.id, emp.employee_code, emp.first_name, emp.last_name, emp.department, emp.position, emp.daily_rate]
    );
    await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('active_employee_id', ?)", [emp.id]);
    await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('cached_password', ?)", [password]);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center px-6">
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center text-4xl font-black text-white shadow-2xl shadow-indigo-600/40 mb-6">A</div>
          <h1 className="text-3xl font-black text-white">Employee Portal</h1>
          <p className="text-slate-500 mt-2 text-sm">ABL Payroll Solutions</p>
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {isOnline
              ? <><Wifi className="w-3.5 h-3.5 text-emerald-400" /><span className="text-xs text-emerald-400 font-bold">Online</span></>
              : <><WifiOff className="w-3.5 h-3.5 text-amber-400" /><span className="text-xs text-amber-400 font-bold">Offline Mode</span></>
            }
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-sm text-center flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Employee ID</label>
            <input
              id="input-employee-id"
              type="text"
              value={employeeCode}
              onChange={e => setEmployeeCode(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
              placeholder="e.g. EMP-001"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <input
              id="input-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            id="btn-login"
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black py-4 px-4 rounded-xl transition-all mt-4 flex justify-center items-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-60"
          >
            {loading ? 'Signing in...' : <><LogIn className="w-5 h-5" /> SIGN IN</>}
          </button>
        </form>
        {!isOnline && (
          <p className="text-center text-slate-600 text-xs mt-6">Offline mode: uses locally cached credentials from your last online login.</p>
        )}
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
type PunchType = 'TIME_IN' | 'TIME_OUT' | 'BREAK_OUT' | 'BREAK_IN';

function Dashboard({ employee }: { employee: LocalEmployee; isOnline?: boolean }) {
  const [time, setTime] = useState(new Date());
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState<PunchType | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchTodayRecord = useCallback(async () => {
    try {
      const db = await getDb();
      const today = new Date().toISOString().split('T')[0];
      const result = await db.query(
        'SELECT * FROM attendance WHERE employee_id = ? AND attendance_date = ?',
        [employee.id, today]
      );
      if (result.values && result.values.length > 0) {
        setTodayRecord(result.values[0] as AttendanceRecord);
      } else {
        setTodayRecord(null);
      }
    } catch (err) { console.error(err); }
  }, [employee.id]);

  useEffect(() => { fetchTodayRecord(); }, [fetchTodayRecord]);

  const getAttendanceStatus = () => {
    if (!todayRecord) return { label: 'Not Timed In', color: 'text-slate-400', bg: 'bg-slate-800' };
    if (todayRecord.time_out) return { label: 'Timed Out', color: 'text-rose-400', bg: 'bg-rose-500/10' };
    if (todayRecord.break_out && !todayRecord.break_in) return { label: 'On Break', color: 'text-amber-400', bg: 'bg-amber-500/10' };
    if (todayRecord.time_in) return { label: 'Timed In', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    return { label: 'Not Timed In', color: 'text-slate-400', bg: 'bg-slate-800' };
  };

  const handlePunch = async (type: PunchType) => {
    setLoading(type);
    setMessage(null);
    try {
      const db = await getDb();
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      await Device.getId(); // capture device ID for audit trail (future use)

      let existingRecord = todayRecord;

      if (!existingRecord) {
        if (type !== 'TIME_IN') {
          setMessage({ text: 'Please Time In first.', type: 'error' });
          setLoading(null);
          return;
        }
        // Create new attendance record
        const newId = `${employee.id}-${today}-${Date.now()}`;
        await db.run(
          `INSERT INTO attendance (id, employee_id, attendance_date, time_in, sync_status, created_at)
           VALUES (?, ?, ?, ?, 'PENDING', ?)`,
          [newId, employee.id, today, now, now]
        );
        setMessage({ text: `✓ Time In recorded at ${new Date(now).toLocaleTimeString()}`, type: 'success' });
      } else {
        // Update existing record
        const fieldMap: Record<PunchType, string> = {
          TIME_IN: 'time_in',
          TIME_OUT: 'time_out',
          BREAK_OUT: 'break_out',
          BREAK_IN: 'break_in',
        };
        const field = fieldMap[type];

        if (type === 'TIME_IN' && existingRecord.time_in) {
          setMessage({ text: 'Already Timed In today.', type: 'error' });
          setLoading(null);
          return;
        }
        if (type === 'TIME_OUT' && !existingRecord.time_in) {
          setMessage({ text: 'Please Time In first.', type: 'error' });
          setLoading(null);
          return;
        }
        if (type === 'BREAK_OUT' && existingRecord.break_out) {
          setMessage({ text: 'Break already started.', type: 'error' });
          setLoading(null);
          return;
        }
        if (type === 'BREAK_IN' && !existingRecord.break_out) {
          setMessage({ text: 'Start your break first.', type: 'error' });
          setLoading(null);
          return;
        }

        await db.run(
          `UPDATE attendance SET ${field} = ?, sync_status = 'PENDING' WHERE id = ?`,
          [now, existingRecord.id]
        );
        const labels: Record<PunchType, string> = {
          TIME_IN: 'Time In', TIME_OUT: 'Time Out', BREAK_OUT: 'Break Out', BREAK_IN: 'Break In'
        };
        setMessage({ text: `✓ ${labels[type]} recorded at ${new Date(now).toLocaleTimeString()}`, type: 'success' });
      }

      await fetchTodayRecord();
    } catch (err: any) {
      setMessage({ text: `Error: ${err.message}`, type: 'error' });
    } finally {
      setLoading(null);
    }
  };

  const status = getAttendanceStatus();

  return (
    <div className="flex flex-col p-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Employee Card */}
      <div className="bg-gradient-to-br from-indigo-600/30 to-slate-800/80 rounded-2xl p-5 border border-indigo-500/20 shadow-lg">
        <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Welcome back</p>
        <h1 className="text-2xl font-black">{employee.first_name} {employee.last_name}</h1>
        <p className="text-slate-400 text-sm mt-0.5">{employee.employee_code} · {employee.department || 'N/A'}</p>
        <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-bold ${status.bg} ${status.color}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {status.label}
        </div>
      </div>

      {/* Clock */}
      <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 text-center">
        <div className="text-5xl font-black tracking-tighter tabular-nums drop-shadow-md text-white">
          {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">
          {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium border ${
          message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Attendance Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <PunchButton id="btn-time-in" label="TIME IN" icon={<Clock className="w-6 h-6" />} color="emerald" disabled={!!todayRecord?.time_in} loading={loading === 'TIME_IN'} onClick={() => handlePunch('TIME_IN')} />
        <PunchButton id="btn-time-out" label="TIME OUT" icon={<LogOut className="w-6 h-6" />} color="rose" disabled={!todayRecord?.time_in || !!todayRecord?.time_out} loading={loading === 'TIME_OUT'} onClick={() => handlePunch('TIME_OUT')} />
        <PunchButton id="btn-break-out" label="BREAK OUT" icon={<Coffee className="w-6 h-6" />} color="amber" disabled={!todayRecord?.time_in || !!todayRecord?.break_out} loading={loading === 'BREAK_OUT'} onClick={() => handlePunch('BREAK_OUT')} />
        <PunchButton id="btn-break-in" label="BREAK IN" icon={<Timer className="w-6 h-6" />} color="sky" disabled={!todayRecord?.break_out || !!todayRecord?.break_in} loading={loading === 'BREAK_IN'} onClick={() => handlePunch('BREAK_IN')} />
      </div>

      {/* Today Summary */}
      {todayRecord && (
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Today's Log</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Time In', value: todayRecord.time_in },
              { label: 'Time Out', value: todayRecord.time_out },
              { label: 'Break Out', value: todayRecord.break_out },
              { label: 'Break In', value: todayRecord.break_in },
            ].map(item => (
              <div key={item.label} className="bg-slate-800 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.label}</p>
                <p className="font-mono text-sm text-white mt-1">
                  {item.value ? new Date(item.value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-1.5 mt-3">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${todayRecord.sync_status === 'SYNCED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              {todayRecord.sync_status === 'SYNCED' ? '✓ Synced' : '⏳ Pending Sync'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function PunchButton({ id, label, icon, color, disabled, loading, onClick }: {
  id: string; label: string; icon: React.ReactNode; color: string; disabled: boolean; loading: boolean; onClick: () => void;
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 shadow-emerald-500/10',
    rose: 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 disabled:opacity-40 shadow-rose-500/10',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 disabled:opacity-40 shadow-amber-500/10',
    sky: 'bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20 disabled:opacity-40 shadow-sky-500/10',
  };
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border font-black text-sm tracking-widest transition-all active:scale-95 shadow-lg ${colors[color]}`}
    >
      {loading ? <RefreshCw className="w-6 h-6 animate-spin" /> : icon}
      {label}
    </button>
  );
}

// ─── ATTENDANCE HISTORY ───────────────────────────────────────────────────────
function AttendanceHistory({ employee }: { employee: LocalEmployee }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const db = await getDb();
        const result = await db.query(
          'SELECT * FROM attendance WHERE employee_id = ? ORDER BY attendance_date DESC LIMIT 30',
          [employee.id]
        );
        setRecords(result.values as AttendanceRecord[] || []);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    fetch();
  }, [employee.id]);

  const fmt = (iso: string | null) => {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <h2 className="text-base font-black uppercase tracking-widest text-slate-300 mb-4">Attendance History</h2>
      {loading ? (
        <div className="text-center py-16 text-slate-500">Loading...</div>
      ) : records.length === 0 ? (
        <div className="text-center p-10 text-slate-600 bg-slate-900 rounded-2xl border border-slate-800">No records yet.</div>
      ) : (
        <div className="space-y-3">
          {records.map(record => (
            <div key={record.id} className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-sm text-white">
                  {new Date(record.attendance_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  record.sync_status === 'SYNCED'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}>
                  {record.sync_status === 'SYNCED' ? '✓ Synced' : '⏳ Pending'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'In', value: record.time_in },
                  { label: 'Out', value: record.time_out },
                  { label: 'Brk↑', value: record.break_out },
                  { label: 'Brk↓', value: record.break_in },
                ].map(item => (
                  <div key={item.label} className="bg-slate-800 rounded-xl p-2 text-center">
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">{item.label}</p>
                    <p className="font-mono text-xs text-white mt-1">{fmt(item.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function ProfileView({ employee }: { employee: LocalEmployee }) {
  const fields = [
    { label: 'Employee ID', value: employee.employee_code },
    { label: 'Department', value: employee.department },
    { label: 'Position', value: employee.position },
    { label: 'Daily Rate', value: `₱ ${(employee.daily_rate || 0).toFixed(2)}` },
  ];
  return (
    <div className="p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-gradient-to-br from-indigo-600/20 to-slate-900 rounded-2xl p-6 border border-indigo-500/20 text-center mb-4">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl mx-auto mb-4 flex items-center justify-center text-4xl font-black shadow-xl shadow-indigo-600/30">
          {employee.first_name?.[0] || 'E'}
        </div>
        <h2 className="text-xl font-black">{employee.first_name} {employee.last_name}</h2>
        <p className="text-indigo-400 font-mono text-sm mt-1">{employee.employee_code}</p>
      </div>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        {fields.map((field, i) => (
          <div key={field.label} className={`flex justify-between items-center p-4 ${i < fields.length - 1 ? 'border-b border-slate-800' : ''}`}>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{field.label}</span>
            <span className="font-medium text-sm text-white">{field.value || 'N/A'}</span>
            <ChevronRight className="w-4 h-4 text-slate-700" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
