import { Outlet, useLocation, Link } from "react-router-dom";
import { Bell, Search, LayoutDashboard, Users, Clock, DollarSign, CalendarDays, Landmark, FileText, Receipt, Settings, LogOut, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { SyncButton } from "@/components/SyncButton";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const APP_VERSION = '1.0.0';

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/employees": "Employees",
  "/attendance": "Attendance",
  "/payroll": "Payroll",
  "/payslips": "Payslips",
  "/leaves": "Leaves",
  "/loans": "Loans",
  "/reports": "Reports",
  "/settings": "Settings",
};

const dockItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", tone: "violet", roles: ["admin","hr","payroll_officer","employee"] },
  { label: "Employees", icon: Users, path: "/employees", tone: "blue", roles: ["admin","hr","payroll_officer"] },
  { label: "Attendance", icon: Clock, path: "/attendance", tone: "emerald", roles: ["admin","hr","payroll_officer","employee"] },
  { label: "Payroll", icon: DollarSign, path: "/payroll", tone: "amber", roles: ["admin","payroll_officer"] },
  { label: "Payslips", icon: Receipt, path: "/payslips", tone: "violet", roles: ["admin","hr","payroll_officer","employee"] },
  { label: "Leaves", icon: CalendarDays, path: "/leaves", tone: "blue", roles: ["admin","hr","employee"] },
  { label: "Loans", icon: Landmark, path: "/loans", tone: "rose", roles: ["admin","payroll_officer","employee"] },
  { label: "Reports", icon: FileText, path: "/reports", tone: "emerald", roles: ["admin","hr","payroll_officer"] },
  { label: "Settings", icon: Settings, path: "/settings", tone: "violet", roles: ["admin","hr"] },
];

export default function AppLayout() {
  const { pathname } = useLocation();
  const { user, roles, signOut } = useAuth();
  const title = titles[pathname] || "ABL Payroll";
  const initial = (user?.email?.[0] || "A").toUpperCase();

  const visible = dockItems.filter(i => roles.length === 0 || i.roles.some(r => roles.includes(r as any)));

  const [dbVersion, setDbVersion] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('system_settings').select('value').eq('key', 'app_version').single()
      .then(({ data }) => {
        if (data && data.value) setDbVersion(data.value);
      });
  }, []);

  return (
    <div className="dark dashboard-shell flex flex-col min-h-screen">
      {dbVersion && dbVersion !== APP_VERSION && (
        <div className="bg-amber-500/90 text-amber-950 px-4 py-2 text-center text-sm font-semibold flex items-center justify-center gap-2 relative z-50">
          <AlertTriangle className="w-4 h-4" />
          New application version available ({dbVersion}). Please contact your administrator to update.
        </div>
      )}
      {/* Top Navbar */}
      <header className="glass-nav sticky top-0 z-30 h-16 flex items-center justify-between px-6 md:px-8">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="icon-3d sm violet" aria-hidden>
            <span className="font-display font-extrabold text-sm">A</span>
          </div>
          <span className="font-display font-bold text-white text-[15px] tracking-tight">
            ABL <span className="text-slate-400 font-medium">Payroll</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 h-10 w-[380px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search employees, payroll, reports..."
            className="bg-transparent border-0 outline-none text-sm flex-1 text-white placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <SyncButton />
          <button className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
            <Bell className="w-[18px] h-[18px] text-slate-200" />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#A78BFA] to-[#7C3AED] flex items-center justify-center text-white font-semibold text-sm shadow-lg shadow-primary/30">
            {initial}
          </div>
          <button onClick={signOut} title="Sign Out" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
            <LogOut className="w-[16px] h-[16px] text-slate-200" />
          </button>
        </div>
      </header>

      {/* Page */}
      <main className="flex-1 px-4 md:px-8 pt-6 pb-32 animate-fade-in">
        <div className="max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Bottom Dock */}
      <nav className="fixed left-1/2 -translate-x-1/2 bottom-5 z-40 glass-dock px-3 py-2">
        <ul className="flex items-end gap-1">
          {visible.map(item => {
            const active = pathname === item.path;
            return (
              <li key={item.path}>
                <Link to={item.path} className={cn("dock-item", active && "active")} title={item.label}>
                  <span className={cn("icon-3d sm", item.tone)}>
                    <item.icon size={18} color="#fff" strokeWidth={2.2} />
                  </span>
                  <span className="hidden sm:block">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Page title accessible (hidden, used by SR) */}
      <span className="sr-only">{title}</span>
    </div>
  );
}
