import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Users, Clock, DollarSign, CalendarDays,
  Landmark, FileText, Settings, LogOut, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const allNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", roles: ["admin", "hr", "payroll_officer", "employee"] },
  { label: "Employees", icon: Users, path: "/employees", roles: ["admin", "hr", "payroll_officer"] },
  { label: "Attendance", icon: Clock, path: "/attendance", roles: ["admin", "hr", "payroll_officer", "employee"] },
  { label: "Payroll", icon: DollarSign, path: "/payroll", roles: ["admin", "payroll_officer"] },
  { label: "Leaves", icon: CalendarDays, path: "/leaves", roles: ["admin", "hr", "employee"] },
  { label: "Loans", icon: Landmark, path: "/loans", roles: ["admin", "payroll_officer", "employee"] },
  { label: "Reports", icon: FileText, path: "/reports", roles: ["admin", "hr", "payroll_officer"] },
  { label: "Settings", icon: Settings, path: "/settings", roles: ["admin", "hr"] },
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
      "flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 h-screen sticky top-0 z-30",
      collapsed ? "w-[68px]" : "w-[240px]"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center font-display font-bold text-sidebar-primary-foreground text-sm shrink-0">
          A
        </div>
        {!collapsed && (
          <span className="font-display font-semibold text-sidebar-accent-foreground text-sm tracking-tight">
            ABL Payroll
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {visibleItems.map(item => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        {!collapsed && user && (
          <div className="px-3 py-2 text-xs text-sidebar-muted truncate">
            {user.email}
          </div>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-all w-full"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 text-sidebar-muted hover:text-sidebar-accent-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
