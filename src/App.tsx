import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import TimeIn from "./pages/TimeIn";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import Payroll from "./pages/Payroll";
import Payslips from "./pages/Payslips";
import Leaves from "./pages/Leaves";
import Loans from "./pages/Loans";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import BackupRestore from "./pages/BackupRestore";
import SyncCenter from "./pages/SyncCenter";
import GovernmentContributions from "./pages/GovernmentContributions";
import UserManagement from "./pages/UserManagement";
import RolePermissions from "./pages/RolePermissions";
import AuditLogs from "./pages/AuditLogs";
import NotFound from "./pages/NotFound";
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import SplashScreen from "@/components/SplashScreen";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function SplashGate() {
  const [show, setShow] = useState(() => !sessionStorage.getItem("abl_splash_shown"));
  useEffect(() => { if (!show) sessionStorage.setItem("abl_splash_shown", "1"); }, [show]);
  if (!show) return null;
  return <SplashScreen onDone={() => setShow(false)} />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <SplashGate />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Landing Page — always shown first, no auth required */}
            <Route path="/" element={<Landing />} />

            {/* Kiosk routes — no auth required */}
            <Route path="/time-in" element={<TimeIn />} />
            <Route path="/time-out" element={<TimeIn />} />
            {/* Legacy /timein route still works */}
            <Route path="/timein" element={<TimeIn />} />

            {/* Admin Login */}
            <Route path="/auth" element={<Auth />} />

            {/* Protected Admin Routes */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/payslips" element={<Payslips />} />
              <Route path="/leaves" element={<Leaves />} />
              <Route path="/loans" element={<Loans />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/backup-restore" element={<BackupRestore />} />
              <Route path="/sync-center" element={<SyncCenter />} />
              <Route path="/government-contributions" element={<GovernmentContributions />} />
              <Route path="/user-management" element={<UserManagement />} />
              <Route path="/role-permissions" element={<RolePermissions />} />
              <Route path="/audit-logs" element={<AuditLogs />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
