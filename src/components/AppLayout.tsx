import { Outlet, useLocation } from "react-router-dom";
import { Bell, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AppSidebar from "./AppSidebar";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/employees": "Employees",
  "/attendance": "Attendance",
  "/payroll": "Payroll",
  "/leaves": "Leaves",
  "/loans": "Loans",
  "/reports": "Reports",
  "/settings": "Settings",
};

export default function AppLayout() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const title = titles[pathname] || "ABL Payroll";
  const initial = (user?.email?.[0] || "A").toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-20 h-16 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6 md:px-8">
          <h1 className="font-display font-bold text-[20px] tracking-tight">{title}</h1>
          <div className="hidden md:flex items-center gap-2 bg-muted rounded-full px-4 h-10 w-[320px]">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search now..."
              className="bg-transparent border-0 outline-none text-sm flex-1 placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-secondary transition-colors">
              <Bell className="w-[18px] h-[18px] text-foreground" />
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-[hsl(280_85%_55%)] flex items-center justify-center text-white font-semibold text-sm shadow-md shadow-primary/30">
              {initial}
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto p-6 md:p-8 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
