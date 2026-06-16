import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Clock, AlertTriangle, UserX, Gift, Landmark, DollarSign, TrendingDown, TrendingUp, ClipboardList, CalendarOff, CalendarCheck } from "lucide-react";
import { formatCurrency } from "@/lib/payroll-utils";

interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  activeLoans: number;
  upcomingAnniversaries: { name: string; date: string; years: number }[];
  // Payroll widgets
  lastPayrollProcessed: number;
  totalGrossPayroll: number;
  totalDeductions: number;
  totalNetPay: number;
  employeesWithAbsences: number;
  employeesOnLeave: number;
  payrollStatus: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0, presentToday: 0, lateToday: 0, absentToday: 0,
    activeLoans: 0, upcomingAnniversaries: [],
    lastPayrollProcessed: 0, totalGrossPayroll: 0, totalDeductions: 0,
    totalNetPay: 0, employeesWithAbsences: 0, employeesOnLeave: 0,
    payrollStatus: "None",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const today = new Date().toISOString().split("T")[0];

        const [empRes, attRes, loanRes, payrollRunRes, leaveRes] = await Promise.all([
          supabase.from("employees").select("id, first_name, last_name, hire_date").eq("employment_status", "active"),
          supabase.from("attendance").select("employee_id, late_minutes, status").eq("date", today),
          supabase.from("loans").select("id").eq("status", "approved"),
          supabase.from("payroll_runs").select("id, status, period_start, period_end").order("created_at", { ascending: false }).limit(1),
          supabase.from("leaves").select("employee_id").eq("status", "approved").gte("start_date", today).lte("end_date", today),
        ]);

        const employees = empRes.data || [];
        const attendance = attRes.data || [];
        const latestRun = payrollRunRes.data?.[0];

        const presentIds = new Set(attendance.map(a => a.employee_id));
        const lateCount = attendance.filter(a => (a.late_minutes || 0) > 0).length;
        const employeesOnLeaveCount = (leaveRes.data || []).length;

        // Count employees with absences (today)
        const employeesWithAbsences = Math.max(0, employees.length - presentIds.size - employeesOnLeaveCount);

        // Fetch payroll summary for latest run
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

        // Upcoming anniversaries (next 30 days)
        const now = new Date();
        const anniversaries = employees
          .filter(e => e.hire_date)
          .map(e => {
            const hireDate = new Date(e.hire_date);
            const thisYearAnniv = new Date(now.getFullYear(), hireDate.getMonth(), hireDate.getDate());
            if (thisYearAnniv < now) thisYearAnniv.setFullYear(thisYearAnniv.getFullYear() + 1);
            const diffDays = Math.ceil((thisYearAnniv.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const years = thisYearAnniv.getFullYear() - hireDate.getFullYear();
            return { name: `${e.first_name} ${e.last_name}`, date: thisYearAnniv.toLocaleDateString(), years, diffDays };
          })
          .filter(a => a.diffDays <= 30 && a.diffDays >= 0)
          .sort((a, b) => a.diffDays - b.diffDays)
          .slice(0, 5);

        setStats({
          totalEmployees: employees.length,
          presentToday: presentIds.size,
          lateToday: lateCount,
          absentToday: Math.max(0, employees.length - presentIds.size),
          activeLoans: loanRes.data?.length || 0,
          upcomingAnniversaries: anniversaries,
          lastPayrollProcessed: processedCount,
          totalGrossPayroll: totalGross,
          totalDeductions: totalDed,
          totalNetPay: totalNet,
          employeesWithAbsences,
          employeesOnLeave: employeesOnLeaveCount,
          payrollStatus: latestRun?.status || "None",
        });
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const attendanceCards = [
    { label: "Total Employees", value: stats.totalEmployees, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Present Today", value: stats.presentToday, icon: Clock, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Late Today", value: stats.lateToday, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Absent Today", value: stats.absentToday, icon: UserX, color: "text-rose-500", bg: "bg-rose-500/10" },
    { label: "Active Loans", value: stats.activeLoans, icon: Landmark, color: "text-violet-500", bg: "bg-violet-500/10" },
  ];

  const payrollCards = [
    { label: "Employees Processed", value: stats.lastPayrollProcessed, icon: ClipboardList, color: "text-blue-500", bg: "bg-blue-500/10", isNum: true },
    { label: "Total Gross Payroll", value: formatCurrency(stats.totalGrossPayroll), icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10", isNum: false },
    { label: "Total Deductions", value: formatCurrency(stats.totalDeductions), icon: TrendingDown, color: "text-rose-500", bg: "bg-rose-500/10", isNum: false },
    { label: "Total Net Pay", value: formatCurrency(stats.totalNetPay), icon: TrendingUp, color: "text-primary", bg: "bg-primary/10", isNum: false },
    { label: "With Absences", value: stats.employeesWithAbsences, icon: CalendarOff, color: "text-amber-500", bg: "bg-amber-500/10", isNum: true },
    { label: "On Leave Today", value: stats.employeesOnLeave, icon: CalendarCheck, color: "text-violet-500", bg: "bg-violet-500/10", isNum: true },
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">Philippine Payroll Management System — {new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      {/* Attendance Stats */}
      <div className="mb-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today's Attendance</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {attendanceCards.map(card => (
          <div key={card.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</span>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-3xl font-display font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Payroll Summary */}
      <div className="mb-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Latest Payroll Summary
          <span className={`ml-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${stats.payrollStatus === "completed" ? "bg-emerald-500/15 text-emerald-600" : stats.payrollStatus === "draft" ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground"}`}>
            {stats.payrollStatus}
          </span>
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {payrollCards.map(card => (
          <div key={card.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</span>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <p className={`font-display font-bold ${card.isNum ? "text-3xl" : "text-xl"}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Anniversaries */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">Upcoming Work Anniversaries</h3>
          </div>
          {stats.upcomingAnniversaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming anniversaries in the next 30 days</p>
          ) : (
            <div className="space-y-3">
              {stats.upcomingAnniversaries.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-muted-foreground">{a.years} year{a.years !== 1 ? "s" : ""} — {a.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Overview */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-5 h-5 text-accent" />
            <h3 className="font-display font-semibold">Payroll Overview</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Attendance Rate Today</span>
              <span className="font-medium">
                {stats.totalEmployees > 0 ? Math.round((stats.presentToday / stats.totalEmployees) * 100) : 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tardiness Rate</span>
              <span className="font-medium">
                {stats.presentToday > 0 ? Math.round((stats.lateToday / stats.presentToday) * 100) : 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Average Net Pay (Last Run)</span>
              <span className="font-medium">
                {stats.lastPayrollProcessed > 0 ? formatCurrency(stats.totalNetPay / stats.lastPayrollProcessed) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deduction Rate</span>
              <span className="font-medium">
                {stats.totalGrossPayroll > 0 ? Math.round((stats.totalDeductions / stats.totalGrossPayroll) * 100) : 0}%
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-3 mt-3">
              <span className="text-muted-foreground font-medium">Last Payroll Status</span>
              <span className={`font-semibold capitalize ${stats.payrollStatus === "completed" ? "text-emerald-500" : "text-amber-500"}`}>
                {stats.payrollStatus}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
