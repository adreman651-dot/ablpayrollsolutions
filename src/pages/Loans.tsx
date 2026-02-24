import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/payroll-utils";
import { useAuth } from "@/hooks/useAuth";

interface Loan {
  id: string;
  employee_id: string;
  loan_type: string;
  principal_amount: number;
  monthly_amortization: number;
  total_paid: number;
  remaining_balance: number;
  status: string;
  start_date: string | null;
  created_at: string;
  employees?: { first_name: string; last_name: string; employee_code: string };
}

const loanTypes = ["Salary Loan", "Emergency Loan", "SSS Loan", "Pag-IBIG Loan", "Company Loan"];

export default function Loans() {
  const { hasRole, employeeId, user } = useAuth();
  const canApprove = hasRole("admin") || hasRole("payroll_officer");
  const [loans, setLoans] = useState<Loan[]>([]);
  const [employees, setEmployees] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", loan_type: "", principal_amount: 0, monthly_amortization: 0 });

  const fetchData = async () => {
    const [loansRes, empRes] = await Promise.all([
      supabase.from("loans").select("*, employees(first_name, last_name, employee_code)").order("created_at", { ascending: false }),
      supabase.from("employees").select("id, first_name, last_name").eq("employment_status", "active"),
    ]);
    setLoans(loansRes.data || []);
    setEmployees(empRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleApply = async () => {
    const empId = hasRole("employee") && employeeId ? employeeId : form.employee_id;
    if (!empId || !form.loan_type || !form.principal_amount) {
      toast.error("Please fill all required fields"); return;
    }
    const { error } = await supabase.from("loans").insert({
      employee_id: empId, loan_type: form.loan_type,
      principal_amount: form.principal_amount,
      monthly_amortization: form.monthly_amortization,
      remaining_balance: form.principal_amount,
    });
    if (error) toast.error(error.message);
    else { toast.success("Loan application submitted"); setDialogOpen(false); setForm({ employee_id: "", loan_type: "", principal_amount: 0, monthly_amortization: 0 }); fetchData(); }
  };

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status, approved_by: user?.id };
    if (status === "approved") updates.start_date = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("loans").update(updates).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Loan ${status}`); fetchData(); }
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Loan Management</h1>
          <p className="page-description">Track employee loans and deductions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Apply Loan</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Loan Application</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              {canApprove && (
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      {employees.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Loan Type</Label>
                <Select value={form.loan_type} onValueChange={v => setForm({ ...form, loan_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {loanTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Principal Amount (₱)</Label>
                <Input type="number" value={form.principal_amount} onChange={e => setForm({ ...form, principal_amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Monthly Amortization (₱)</Label>
                <Input type="number" value={form.monthly_amortization} onChange={e => setForm({ ...form, monthly_amortization: parseFloat(e.target.value) || 0 })} />
              </div>
              <Button onClick={handleApply} className="w-full">Submit Application</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Principal</TableHead>
              <TableHead>Monthly</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
              {canApprove && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : loans.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No loan records</TableCell></TableRow>
            ) : loans.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">
                  {l.employees ? `${l.employees.first_name} ${l.employees.last_name}` : "—"}
                </TableCell>
                <TableCell>{l.loan_type}</TableCell>
                <TableCell>{formatCurrency(l.principal_amount)}</TableCell>
                <TableCell>{formatCurrency(l.monthly_amortization)}</TableCell>
                <TableCell>{formatCurrency(l.total_paid)}</TableCell>
                <TableCell>{formatCurrency(l.remaining_balance)}</TableCell>
                <TableCell>
                  <Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"}>
                    {l.status}
                  </Badge>
                </TableCell>
                {canApprove && (
                  <TableCell>
                    {l.status === "pending" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => updateStatus(l.id, "approved")}>
                          <Check className="w-3 h-3 mr-1" />Approve
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(l.id, "rejected")}>
                          <X className="w-3 h-3 mr-1" />Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
