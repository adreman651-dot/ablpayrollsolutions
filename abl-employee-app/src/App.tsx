import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { LogIn, User, Clock, History, LogOut } from 'lucide-react';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'history' | 'profile'>('dashboard');

  useEffect(() => {
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
        <button onClick={() => supabase.auth.signOut()} className="text-slate-400 hover:text-white p-2">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {view === 'dashboard' && <Dashboard user={session.user} />}
        {view === 'history' && <AttendanceHistory user={session.user} />}
        {view === 'profile' && <Profile user={session.user} />}
      </div>

      {/* Bottom Nav */}
      <div className="absolute bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around p-3 z-50">
        <NavButton icon={<Clock />} label="Time" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
        <NavButton icon={<History />} label="History" active={view === 'history'} onClick={() => setView('history')} />
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
    
    // We expect the employee to log in with their email. Since the prompt says "Employee ID", 
    // we assume the system maps Employee ID to email (e.g. EMP-001@abl.com) or they just use their email.
    // Let's use email directly for Supabase auth for simplicity, or append a dummy domain if it's just an ID.
    const email = employeeCode.includes('@') ? employeeCode : `${employeeCode.toLowerCase()}@ablpayroll.local`;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

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

function Dashboard({ user }: { user: any }) {
  const [time, setTime] = useState(new Date());
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supabase.from('employees').select('*').eq('id', user.id).single()
      .then(({ data }) => setEmployee(data));
  }, [user.id]);

  const handlePunch = async (mode: 'in' | 'out') => {
    if (!employee) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('kiosk_punch_v2', {
        _employee_code: employee.employee_code,
        _employee_id: employee.id,
        _employee_name: `${employee.first_name} ${employee.last_name}`,
        _mode: mode,
        _latitude: null,
        _longitude: null,
        _photo_url: null,
        _address: null,
        _device_type: 'android_app',
        _device_timestamp: new Date().toISOString()
      });

      if (error) throw error;
      alert(`Successfully Timed ${mode.toUpperCase()} at ${new Date().toLocaleTimeString()}`);
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
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 py-8">
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
            className="w-full bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 p-6 rounded-2xl font-black tracking-widest text-xl transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'PROCESSING...' : 'TIME IN'}
          </button>
          
          <button 
            onClick={() => handlePunch('out')}
            disabled={loading}
            className="w-full bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 p-6 rounded-2xl font-black tracking-widest text-xl transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'PROCESSING...' : 'TIME OUT'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AttendanceHistory({ user }: { user: any }) {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('attendance')
      .select('*')
      .eq('employee_id', user.id)
      .order('date', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setHistory(data);
      });
  }, [user.id]);

  const formatTime = (isoString: string) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-lg font-bold mb-4 uppercase tracking-wider text-slate-300">Recent Logs</h2>
      <div className="space-y-3">
        {history.length === 0 ? (
          <div className="text-center p-8 text-slate-500 bg-slate-800/50 rounded-xl border border-slate-700">No attendance records found.</div>
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
    supabase.from('employees').select('*').eq('id', user.id).single()
      .then(({ data }) => setEmployee(data));
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
