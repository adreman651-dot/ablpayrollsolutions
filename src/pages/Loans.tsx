import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, X, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/payroll-utils";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Loan {
  id: string;
  employee_id: string;
  loan_type: string;
  principal_amount: number;
  monthly_amortization: number;
  per_cutoff_amortization: number;
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
  const [form, setForm] = useState({ employee_id: "", loan_type: "", principal_amount: 0, monthly_amortization: 0, per_cutoff_amortization: 0 });

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
      per_cutoff_amortization: form.per_cutoff_amortization,
      remaining_balance: form.principal_amount,
    });
    if (error) toast.error(error.message);
    else { toast.success("Loan application submitted"); setDialogOpen(false); setForm({ employee_id: "", loan_type: "", principal_amount: 0, monthly_amortization: 0, per_cutoff_amortization: 0 }); fetchData(); }
  };

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status, approved_by: user?.id };
    if (status === "approved") updates.start_date = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("loans").update(updates).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Loan ${status}`); fetchData(); }
  };

  const exportExcel = () => {
    const data = loans.map(l => ({
      "Employee": l.employees ? `${l.employees.first_name} ${l.employees.last_name}` : "—",
      "Type": l.loan_type,
      "Principal": l.principal_amount,
      "Monthly Amort.": l.monthly_amortization,
      "Per Cut-off Amort.": l.per_cutoff_amortization,
      "Total Paid": l.total_paid,
      "Balance": l.remaining_balance,
      "Status": l.status
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Loans");
    XLSX.writeFile(wb, "loan_balances.xlsx");
    toast.success("Exported to Excel");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Loan Balances Report", 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [["Employee", "Type", "Principal", "Monthly", "Per Cut-off", "Paid", "Balance", "Status"]],
      body: loans.map(l => [
        l.employees ? `${l.employees.first_name} ${l.employees.last_name}` : "—",
        l.loan_type,
        l.principal_amount.toLocaleString(),
        l.monthly_amortization.toLocaleString(),
        l.per_cutoff_amortization.toLocaleString(),
        l.total_paid.toLocaleString(),
        l.remaining_balance.toLocaleString(),
        l.status.toUpperCase()
      ]),
    });
    doc.save("loan_balances.pdf");
    toast.success("Exported to PDF");
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Loan Management</h1>
          <p className="page-description">Track employee loans and deductions</p>
        </div>
        <div className="flex gap-2">
          {canApprove && (
            <>
              <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="w-4 h-4 mr-2" />Excel</Button>
              <Button variant="outline" size="sm" onClick={exportPDF}><FileText className="w-4 h-4 mr-2" />PDF</Button>
            </>
          )}
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Monthly Amortization (₱)</Label>
                    <Input type="number" value={form.monthly_amortization} onChange={e => {
                      const m = parseFloat(e.target.value) || 0;
                      setForm({ ...form, monthly_amortization: m, per_cutoff_amortization: +(m/2).toFixed(2) });
                    }} />
                  </div>
                  <div className="space-y-2">
                    <Label>Per Cut-off Amortization (₱)</Label>
                    <Input type="number" value={form.per_cutoff_amortization} onChange={e => setForm({ ...form, per_cutoff_amortization: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <Button onClick={handleApply} className="w-full">Submit Application</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Principal</TableHead>
              <TableHead>Monthly</TableHead>
              <TableHead>Per Cut-off</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
              {canApprove && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : loans.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No loan records</TableCell></TableRow>
            ) : loans.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">
                  {l.employees ? `${l.employees.first_name} ${l.employees.last_name}` : "—"}
                </TableCell>
                <TableCell>{l.loan_type}</TableCell>
                <TableCell>{formatCurrency(l.principal_amount)}</TableCell>
                <TableCell>{formatCurrency(l.monthly_amortization)}</TableCell>
                <TableCell>{formatCurrency(l.per_cutoff_amortization || 0)}</TableCell>
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
