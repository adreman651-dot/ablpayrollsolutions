import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Settings } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [companyName, setCompanyName] = useState("ABL PAYROLL SOLUTIONS");

  useEffect(() => {
    // 60fps for smooth clock
    let animationFrameId: number;
    const animate = () => {
      setNow(new Date());
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Fetch company name from settings
  useEffect(() => {
    supabase.from("system_settings").select("value").eq("key", "company_name").maybeSingle()
      .then(({ data }) => { if (data?.value) setCompanyName(data.value); });
  }, []);

  const timeStr = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#050d1a] to-[#0a1628] font-sans relative selection:bg-indigo-500/30">
      {/* Ambient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] aspect-square rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute top-[-10%] right-[-10%] w-[60%] aspect-square rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[60%] aspect-square rounded-full bg-rose-500/10 blur-[100px] pointer-events-none" />

      {/* Main Container - Mobile First Max Width 420px */}
      <div className="relative z-10 w-full max-w-[420px] px-6 py-10 flex flex-col items-center justify-between min-h-[100dvh]">
        
        {/* Header */}
        <div className="flex flex-col items-center gap-5 w-full pt-2">
          <div className="w-16 h-16 rounded-[1.25rem] bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-purple-900/20 flex items-center justify-center border border-white/10">
            <span className="text-3xl font-bold text-white tracking-tight">A</span>
          </div>
          <div className="text-center">
            <h1 className="text-[1.15rem] font-black text-white tracking-widest uppercase drop-shadow-md">{companyName}</h1>
            <p className="text-[0.65rem] font-bold text-indigo-300 tracking-[0.25em] mt-1.5 uppercase">Payroll & Attendance</p>
          </div>
        </div>

        {/* Digital Clock Card */}
        <div className="w-full relative mt-10 mb-8 group">
          <div className="absolute inset-0 bg-white/[0.02] rounded-3xl border border-white/10 backdrop-blur-md overflow-hidden">
            {/* Subtle grid texture */}
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
        <div className="w-full flex flex-col gap-4 flex-1 justify-center">
          {/* TIME IN */}
          <button
            onClick={() => navigate("/time-in")}
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

          {/* TIME OUT */}
          <button
            onClick={() => navigate("/time-out")}
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
        <div className="mt-8 pt-4 w-full flex justify-center pb-2">
          <button 
            onClick={() => navigate("/auth")}
            className="group flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/[0.02] border border-white/[0.04] hover:bg-purple-500/[0.08] hover:border-purple-500/30 transition-all active:scale-95"
          >
            <div className="w-6 h-6 rounded-[0.4rem] bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
              <Settings className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <span className="text-[0.65rem] font-bold text-slate-500 group-hover:text-purple-300 uppercase tracking-[0.15em] transition-colors">Admin</span>
          </button>
        </div>
        
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
      {/* Outer glow ring conic gradient */}
      <div 
        className="absolute inset-0 rounded-full opacity-50 transition-all duration-75"
        style={{
          background: `conic-gradient(from ${secDeg}deg, transparent 0deg, transparent 270deg, ${borderColor} 360deg)`
        }}
      />
      
      {/* Inner dial */}
      <div className="absolute inset-[3px] rounded-full bg-gradient-to-br from-[#1a2333] to-[#0a101a] border border-white/5 shadow-inner" style={{ boxShadow: `inset 0 0 20px ${glowColor}` }}>
        {/* Ticks */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="absolute w-[1.5px] h-2 bg-white/20 rounded-full" style={{
            top: 3, left: "calc(50% - 0.75px)", transformOrigin: "0.75px 42px", transform: `rotate(${i * 30}deg)`
          }} />
        ))}
        {/* Hands */}
        <div className="absolute left-1/2 bottom-1/2 w-[3px] h-6 bg-white rounded-full origin-bottom -translate-x-1/2 drop-shadow-md" style={{ transform: `rotate(${hrDeg}deg)` }} />
        <div className="absolute left-1/2 bottom-1/2 w-0.5 h-9 bg-white/80 rounded-full origin-bottom -translate-x-1/2 drop-shadow-md" style={{ transform: `rotate(${minDeg}deg)` }} />
        <div className="absolute left-1/2 bottom-1/2 w-[1.5px] h-10 rounded-full origin-bottom -translate-x-1/2" style={{ backgroundColor: borderColor, transform: `rotate(${secDeg}deg)` }} />
        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" style={{ backgroundColor: borderColor, boxShadow: `0 0 8px ${borderColor}` }} />
      </div>
    </div>
  )
}
