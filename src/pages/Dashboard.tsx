import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Clock, AlertTriangle, UserX, Landmark, DollarSign, TrendingDown, TrendingUp, ClipboardList, Sparkles } from "lucide-react";
import { formatCurrency } from "@/lib/payroll-utils";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  activeLoans: number;
  perfectAttendance: number;
  lastPayrollProcessed: number;
  totalGrossPayroll: number;
  totalDeductions: number;
  totalNetPay: number;
  payrollStatus: string;
  monthly: { month: string; gross: number; deductions: number; net: number }[];
}

const PIE_COLORS = { present: "#10B981", late: "#F59E0B", absent: "#F43F5E", perfect: "#A855F7" };

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0, presentToday: 0, lateToday: 0, absentToday: 0,
    activeLoans: 0, perfectAttendance: 0,
    lastPayrollProcessed: 0, totalGrossPayroll: 0, totalDeductions: 0,
    totalNetPay: 0, payrollStatus: "None", monthly: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split("T")[0];

        const [empRes, attRes, loanRes, payrollRunRes, monthlyRunsRes] = await Promise.all([
          supabase.from("employees").select("id").eq("employment_status", "active"),
          supabase.from("attendance").select("employee_id, late_minutes").eq("date", today),
          supabase.from("loans").select("id").eq("status", "approved"),
          supabase.from("payroll_runs").select("id, status").order("created_at", { ascending: false }).limit(1),
          supabase.from("payroll_runs").select("id, period_end").order("period_end", { ascending: false }).limit(6),
        ]);

        const employees = empRes.data || [];
        const attendance = attRes.data || [];
        const latestRun = payrollRunRes.data?.[0];

        const presentIds = new Set(attendance.map(a => a.employee_id));
        const lateCount = attendance.filter(a => (a.late_minutes || 0) > 0).length;
        const onTime = presentIds.size - lateCount;

        let totalGross = 0, totalDed = 0, totalNet = 0, processedCount = 0;
        if (latestRun) {
          const { data: items } = await supabase.from("payroll_items")
            .select("gross_pay, total_deductions, net_pay")
            .eq("payroll_run_id", latestRun.id);
          (items || []).forEach(i => {
            totalGross += i.gross_pay || 0;
            totalDed += i.total_deductions || 0;
            totalNet += i.net_pay || 0;
          });
          processedCount = (items || []).length;
        }

        // Monthly chart
        const monthly: DashboardStats["monthly"] = [];
        const runs = (monthlyRunsRes.data || []).slice().reverse();
        for (const r of runs) {
          const { data: items } = await supabase.from("payroll_items")
            .select("gross_pay, total_deductions, net_pay")
            .eq("payroll_run_id", r.id);
          const g = (items || []).reduce((s, i) => s + (i.gross_pay || 0), 0);
          const d = (items || []).reduce((s, i) => s + (i.total_deductions || 0), 0);
          const n = (items || []).reduce((s, i) => s + (i.net_pay || 0), 0);
          monthly.push({
            month: r.period_end ? new Date(r.period_end).toLocaleDateString("en-PH", { month: "short" }) : "—",
            gross: g, deductions: d, net: n,
          });
        }

        setStats({
          totalEmployees: employees.length,
          presentToday: presentIds.size,
          lateToday: lateCount,
          absentToday: Math.max(0, employees.length - presentIds.size),
          activeLoans: loanRes.data?.length || 0,
          perfectAttendance: Math.max(0, onTime),
          lastPayrollProcessed: processedCount,
          totalGrossPayroll: totalGross,
          totalDeductions: totalDed,
          totalNetPay: totalNet,
          payrollStatus: latestRun?.status || "None",
          monthly,
        });
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="animate-spin w-10 h-10 border-4 border-[#A855F7] border-t-transparent rounded-full" />
    </div>
  );

  const pieData = [
    { name: "Present", value: stats.presentToday, color: PIE_COLORS.present },
    { name: "Late", value: stats.lateToday, color: PIE_COLORS.late },
    { name: "Absent", value: stats.absentToday, color: PIE_COLORS.absent },
    { name: "Perfect", value: stats.perfectAttendance, color: PIE_COLORS.perfect },
  ];
  const pieTotal = pieData.reduce((s, p) => s + p.value, 0) || 1;

  const kpis = [
    { label: "Total Employees", value: stats.totalEmployees, icon: Users, tone: "violet", border: "#A855F7" },
    { label: "Present Today", value: stats.presentToday, icon: Clock, tone: "emerald", border: "#10B981" },
    { label: "Late Today", value: stats.lateToday, icon: AlertTriangle, tone: "amber", border: "#F59E0B" },
    { label: "Absent Today", value: stats.absentToday, icon: UserX, tone: "rose", border: "#F43F5E" },
    { label: "Active Loans", value: stats.activeLoans, icon: Landmark, tone: "blue", border: "#2563EB" },
  ];

  const payrollCards = [
    { label: "Employees Processed", value: stats.lastPayrollProcessed, icon: ClipboardList, tone: "blue", isNum: true },
    { label: "Total Gross Payroll", value: formatCurrency(stats.totalGrossPayroll), icon: DollarSign, tone: "emerald" },
    { label: "Total Deductions", value: formatCurrency(stats.totalDeductions), icon: TrendingDown, tone: "rose" },
    { label: "Total Net Pay", value: formatCurrency(stats.totalNetPay), icon: TrendingUp, tone: "violet" },
  ];

  const deductionRatio = stats.totalGrossPayroll > 0
    ? Math.round((stats.totalDeductions / stats.totalGrossPayroll) * 100)
    : 0;

  return (
    <div className="space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-[34px] font-display font-extrabold text-white tracking-tight">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Philippine Payroll Management System — {new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <span className="live-badge">
          <Sparkles className="w-3.5 h-3.5" /> Live • {stats.payrollStatus}
        </span>
      </div>

      {/* Two-column grid: charts (60%) + KPIs (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Charts */}
        <div className="lg:col-span-3 space-y-6">
          {/* Attendance Pie */}
          <div className="glass-card p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-white text-lg">Today's Attendance Breakdown</h3>
              <span className="text-xs text-slate-400">{pieTotal} records</span>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={3} animationDuration={900}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} stroke="rgba(15,15,26,0.8)" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: d.color, boxShadow: `0 0 8px ${d.color}` }} />
                  <div className="text-xs">
                    <div className="text-slate-300 font-medium">{d.name}</div>
                    <div className="text-slate-500">{d.value} ({Math.round((d.value / pieTotal) * 100)}%)</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Payroll */}
          <div className="glass-card p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-white text-lg">Monthly Payroll Overview</h3>
              <span className="text-xs text-slate-400">Last {stats.monthly.length} runs</span>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthly} barGap={4}>
                  <defs>
                    <linearGradient id="gGross" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C4B5FD" />
                      <stop offset="100%" stopColor="#7C3AED" />
                    </linearGradient>
                    <linearGradient id="gDed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FCA5A5" />
                      <stop offset="100%" stopColor="#E11D48" />
                    </linearGradient>
                    <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6EE7B7" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff" }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 12 }} />
                  <Bar dataKey="gross" name="Gross Pay" fill="url(#gGross)" radius={[8,8,0,0]} animationDuration={900} />
                  <Bar dataKey="deductions" name="Deductions" fill="url(#gDed)" radius={[8,8,0,0]} animationDuration={900} />
                  <Bar dataKey="net" name="Net Pay" fill="url(#gNet)" radius={[8,8,0,0]} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right: KPI cards */}
        <div className="lg:col-span-2 space-y-4">
          {kpis.map((k, idx) => (
            <div
              key={k.label}
              className="glass-card p-5 flex items-center gap-4"
              style={{ borderLeft: `3px solid ${k.border}`, animation: `fade-in 0.5s ease-out ${idx * 100}ms both` }}
            >
              <span className={`icon-3d ${k.tone}`}>
                <k.icon size={20} color="#fff" strokeWidth={2.2} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{k.label}</div>
                <div className="text-3xl font-display font-bold text-white leading-tight">{k.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Latest Payroll Summary */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Latest Payroll Summary</h2>
          <span className="text-xs text-slate-500 capitalize">Status: {stats.payrollStatus}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {payrollCards.map((c, i) => (
            <div key={c.label} className="glass-card p-5" style={{ animation: `fade-in 0.5s ease-out ${i*80}ms both` }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{c.label}</span>
                <span className={`icon-3d sm ${c.tone}`}>
                  <c.icon size={16} color="#fff" strokeWidth={2.2} />
                </span>
              </div>
              <div className={`font-display font-bold text-white ${c.isNum ? "text-3xl" : "text-2xl"}`}>{c.value}</div>
              {c.label === "Total Net Pay" && (
                <div className="mt-4">
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Deduction Ratio</span><span>{deductionRatio}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${deductionRatio}%`, background: "linear-gradient(90deg,#A855F7,#7C3AED)" }} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
