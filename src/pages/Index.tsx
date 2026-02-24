import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  return <Navigate to={user ? "/dashboard" : "/auth"} replace />;
}
