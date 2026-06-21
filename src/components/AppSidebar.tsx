import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Users, Clock, DollarSign, CalendarDays,
  Landmark, FileText, Receipt, Settings, LogOut, ChevronLeft, ChevronRight,
  Database, RefreshCw, Shield, ScrollText, UserCheck
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const allNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", roles: ["admin", "hr", "payroll_officer", "employee"] },
  { label: "Employees", icon: Users, path: "/employees", roles: ["admin", "hr", "payroll_officer"] },
  { label: "Attendance", icon: Clock, path: "/attendance", roles: ["admin", "hr", "payroll_officer", "employee"] },
  { label: "Payroll", icon: DollarSign, path: "/payroll", roles: ["admin", "payroll_officer"] },
  { label: "Payslips", icon: Receipt, path: "/payslips", roles: ["admin", "hr", "payroll_officer", "employee"] },
  { label: "Leaves", icon: CalendarDays, path: "/leaves", roles: ["admin", "hr", "employee"] },
  { label: "Loans", icon: Landmark, path: "/loans", roles: ["admin", "payroll_officer", "employee"] },
  { label: "Reports", icon: FileText, path: "/reports", roles: ["admin", "hr", "payroll_officer"] },
  { label: "Settings", icon: Settings, path: "/settings", roles: ["admin", "hr"] },
  { label: "Backup & Restore", icon: Database, path: "/backup-restore", roles: ["admin"] },
  { label: "Sync Center", icon: RefreshCw, path: "/sync-center", roles: ["admin", "hr", "payroll_officer"] },
  { label: "Government Contributions", icon: Landmark, path: "/government-contributions", roles: ["admin", "payroll_officer"] },
  { label: "User Management", icon: UserCheck, path: "/user-management", roles: ["admin"] },
  { label: "Role Permissions", icon: Shield, path: "/role-permissions", roles: ["admin"] },
  { label: "Audit Logs", icon: ScrollText, path: "/audit-logs", roles: ["admin"] },
];

export default function AppSidebar() {
  const { roles, signOut, user } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = allNavItems.filter(item =>
    roles.length === 0 || item.roles.some(r => roles.includes(r as any))
  );

  return (
    <aside className={cn(
      "flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 h-screen sticky top-0 z-30",
      collapsed ? "w-[72px]" : "w-[240px]"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(262_83%_62%)] to-[hsl(280_85%_55%)] flex items-center justify-center font-display font-extrabold text-white text-base shrink-0 shadow-lg shadow-primary/30">
          A
        </div>
        {!collapsed && (
          <span className="font-display font-bold text-white text-[15px] tracking-tight">
            ABL <span className="text-sidebar-foreground font-medium">Payroll</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {visibleItems.map(item => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 h-11 rounded-xl text-[13px] font-medium transition-all duration-150",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-lg shadow-primary/20"
                  : "text-sidebar-foreground hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 space-y-1 border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="px-3 py-2 text-[11px] text-sidebar-muted truncate">
            {user.email}
          </div>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 h-11 rounded-xl text-[13px] font-medium text-sidebar-foreground hover:bg-white/5 hover:text-white transition-all w-full"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 text-sidebar-muted hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
