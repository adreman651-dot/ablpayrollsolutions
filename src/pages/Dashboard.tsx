import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Clock, AlertTriangle, UserX, Gift, Award, Landmark } from "lucide-react";
import { formatCurrency } from "@/lib/payroll-utils";

interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  activeLoans: number;
  upcomingAnniversaries: { name: string; date: string; years: number }[];
  topPunctual: { name: string; onTimeCount: number }[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0, presentToday: 0, lateToday: 0, absentToday: 0,
    activeLoans: 0, upcomingAnniversaries: [], topPunctual: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const today = new Date().toISOString().split("T")[0];

        const [empRes, attRes, loanRes] = await Promise.all([
          supabase.from("employees").select("id, first_name, last_name, hire_date").eq("employment_status", "active"),
          supabase.from("attendance").select("employee_id, late_minutes, status").eq("date", today),
          supabase.from("loans").select("id").eq("status", "approved"),
        ]);

        const employees = empRes.data || [];
        const attendance = attRes.data || [];

        const presentIds = new Set(attendance.map(a => a.employee_id));
        const lateCount = attendance.filter(a => (a.late_minutes || 0) > 0).length;

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
          topPunctual: [],
        });
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const statCards = [
    { label: "Total Employees", value: stats.totalEmployees, icon: Users, color: "text-primary" },
    { label: "Present Today", value: stats.presentToday, icon: Clock, color: "text-success" },
    { label: "Late Today", value: stats.lateToday, icon: AlertTriangle, color: "text-warning" },
    { label: "Absent Today", value: stats.absentToday, icon: UserX, color: "text-destructive" },
    { label: "Active Loans", value: stats.activeLoans, icon: Landmark, color: "text-accent" },
  ];

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">Welcome to ABL Payroll System</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map(card => (
          <div key={card.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</span>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-3xl font-display font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Anniversaries */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">Upcoming Anniversaries</h3>
          </div>
          {stats.upcomingAnniversaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming anniversaries</p>
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

        {/* Quick Info */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-accent" />
            <h3 className="font-display font-semibold">System Overview</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Attendance Rate</span>
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
              <span className="text-muted-foreground">Active Loans</span>
              <span className="font-medium">{stats.activeLoans}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
