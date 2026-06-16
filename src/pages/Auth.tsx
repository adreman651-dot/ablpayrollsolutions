import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

// Hardcoded admin shortcut — maps "Admin" / "1111" to the real Lovable Cloud admin account.
const ADMIN_USERNAME = "Admin";
const ADMIN_PASSWORD = "1111";
const ADMIN_EMAIL = "adrian.llano79@gmail.com";
const ADMIN_REAL_PASSWORD = "111111";

export default function Auth() {
  const { user, loading, signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const { error } = await signIn(ADMIN_EMAIL, ADMIN_REAL_PASSWORD);
        if (error) toast.error(error.message);
      } else {
        toast.error("Invalid username or password");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <span className="font-display font-bold text-primary-foreground text-xl">A</span>
          </div>
          <h1 className="text-2xl font-display font-bold">ABL Payroll System</h1>
          <p className="text-muted-foreground text-sm mt-1">Administrator Sign In</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign In</CardTitle>
            <CardDescription>Enter your administrator credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="Admin" required autoComplete="username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••" required autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Please wait..." : "Sign In"}
              </Button>
            </form>
            <div className="mt-6 pt-4 border-t border-border text-center">
              <p className="text-sm text-muted-foreground mb-2">Are you an employee?</p>
              <Link to="/timein">
                <Button variant="outline" className="w-full">Go to Employee Time In / Out</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
