import { Outlet, useLocation, Link } from "react-router-dom";
import {
  Bell, Search, LayoutDashboard, Users, Clock, DollarSign, CalendarDays,
  Landmark, FileText, Receipt, Settings, LogOut, AlertTriangle, ChevronLeft, ChevronRight,
  Database, RefreshCw, Shield, ScrollText, UserCheck
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { SyncButton } from "@/components/SyncButton";
import { useState, useEffect, useRef } from "react";
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
  "/backup-restore": "Backup & Restore",
  "/sync-center": "Sync Center",
  "/government-contributions": "Government Contributions",
  "/user-management": "User Management",
  "/role-permissions": "Role Permissions",
  "/audit-logs": "Audit Logs",
};

const navigationItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", tone: "violet", roles: ["admin", "hr", "payroll_officer", "employee"] },
  { label: "Employees", icon: Users, path: "/employees", tone: "blue", roles: ["admin", "hr", "payroll_officer"] },
  { label: "Attendance", icon: Clock, path: "/attendance", tone: "emerald", roles: ["admin", "hr", "payroll_officer", "employee"] },
  { label: "Payroll", icon: DollarSign, path: "/payroll", tone: "amber", roles: ["admin", "payroll_officer"] },
  { label: "Payslips", icon: Receipt, path: "/payslips", tone: "violet", roles: ["admin", "hr", "payroll_officer", "employee"] },
  { label: "Leaves", icon: CalendarDays, path: "/leaves", tone: "blue", roles: ["admin", "hr", "employee"] },
  { label: "Loans", icon: Landmark, path: "/loans", tone: "rose", roles: ["admin", "payroll_officer", "employee"] },
  { label: "Reports", icon: FileText, path: "/reports", tone: "emerald", roles: ["admin", "hr", "payroll_officer"] },
  { label: "Settings", icon: Settings, path: "/settings", tone: "violet", roles: ["admin", "hr"] },
  { label: "Government Contributions", icon: Landmark, path: "/government-contributions", tone: "rose", roles: ["admin", "payroll_officer"] },
  { label: "Backup & Restore", icon: Database, path: "/backup-restore", tone: "blue", roles: ["admin"] },
  { label: "Sync Center", icon: RefreshCw, path: "/sync-center", tone: "emerald", roles: ["admin", "hr", "payroll_officer"] },
  { label: "User Management", icon: UserCheck, path: "/user-management", tone: "violet", roles: ["admin"] },
  { label: "Audit Logs", icon: ScrollText, path: "/audit-logs", tone: "amber", roles: ["admin"] },
];

export default function AppLayout() {
  const { pathname } = useLocation();
  const { user, roles, signOut } = useAuth();
  const title = titles[pathname] || "ABL Payroll";
  const initial = (user?.email?.[0] || "A").toUpperCase();

  const visible = navigationItems.filter(i => roles.length === 0 || i.roles.some(r => roles.includes(r as any)));

  const [dbVersion, setDbVersion] = useState<string | null>(null);
  const [width, setWidth] = useState(window.innerWidth);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("abl_sidebar_collapsed") === "true";
  });

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("abl_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Auto-sync app_version in system_settings to current APP_VERSION (no user prompt)
  useEffect(() => {
    supabase.from('system_settings').select('value').eq('key', 'app_version').maybeSingle()
      .then(({ data }) => {
        if (!data || data.value !== APP_VERSION) {
          supabase.from('system_settings').upsert(
            { key: 'app_version', value: APP_VERSION, description: 'Application version (auto-synced).' },
            { onConflict: 'key' }
          ).then(() => {});
        }
      });

    // Check for updates on startup if in Electron
    if (window.electronAPI) {
      import("@/lib/syncEngine").then(({ checkForNewUpdates, syncAllData }) => {
        checkForNewUpdates().then(hasUpdates => {
          if (hasUpdates) {
            const yes = window.confirm("New data available. Sync now?");
            if (yes) {
              syncAllData().then(res => {
                if (res.success) {
                  window.location.reload();
                }
              });
            }
          }
        });
      });
    }
  }, []);

  const isPhone = width < 768;
  const isTablet = width >= 768 && width <= 1024;
  const isDesktop = width > 1024;

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

      {/* Main Body */}
      <div className="flex flex-1 relative">
        {/* Fixed Desktop Sidebar Navigation */}
        {isDesktop && (
          <aside
            className={cn(
              "flex flex-col bg-[#111122]/90 border-r border-white/5 text-sidebar-foreground transition-all duration-300 sticky top-16 z-20 shrink-0",
              collapsed ? "w-[72px]" : "w-[260px]"
            )}
            style={{ height: "calc(100vh - 64px)" }}
          >
            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-none">
              {visible.map(item => {
                const active = pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-3 h-11 rounded-xl text-[13px] font-medium transition-all duration-150 relative group",
                      active
                        ? "bg-primary text-white shadow-lg shadow-primary/30"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <span className={cn("flex items-center justify-center shrink-0 w-[18px] h-[18px]")}>
                      <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                    </span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {collapsed && (
                      <span className="absolute left-[80px] bg-[#1a1a2e] border border-white/10 text-white text-xs py-1.5 px-3 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-xl whitespace-nowrap z-50">
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 space-y-1 border-t border-white/5">
              <button
                onClick={toggleSidebar}
                className="flex items-center justify-center w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>
          </aside>
        )}

        {/* Content Wrapper */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tablet responsive two-row grid (shown only on Tablet breakpoints) */}
          {isTablet && (
            <div className="px-6 md:px-8 pt-4">
              <div className="grid grid-cols-3 gap-3">
                {visible.map(item => {
                  const active = pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-sm font-medium",
                        active
                          ? "bg-primary/20 border-primary text-white shadow-md shadow-primary/10"
                          : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <item.icon className="w-5 h-5 text-primary shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Android Phone horizontal swipe menu */}
          {isPhone && (
            <div className="w-full px-4 pt-4 overflow-hidden">
              <div
                className="flex gap-2 overflow-x-auto py-2 scroll-smooth select-none scrollbar-none"
                style={{
                  WebkitOverflowScrolling: "touch",
                  scrollbarWidth: "none",
                }}
              >
                {visible.map(item => {
                  const active = pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-full shrink-0 text-sm font-semibold border transition-all",
                        active
                          ? "bg-primary text-white border-primary shadow-md shadow-primary/30"
                          : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <main className="flex-1 px-6 md:px-8 pt-6 pb-24 animate-fade-in overflow-y-auto">
            <div className="max-w-[1400px] mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Page title accessible (hidden, used by SR) */}
      <span className="sr-only">{title}</span>
    </div>
  );
}
