import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Eye } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, computeSSS, computePhilHealth, computePagIBIG, computeWithholdingTax, computeDailyRate, computeHourlyRate } from "@/lib/payroll-utils";
import { useAuth } from "@/hooks/useAuth";

interface PayrollRun {
  id: string;
  period_start: string;
  period_end: string;
  run_date: string;
  status: string;
  notes: string | null;
}

interface PayrollItem {
  id: string;
  employee_id: string;
  basic_pay: number;
  overtime_pay: number;
  holiday_pay: number;
  allowances: number;
  gross_pay: number;
  late_deductions: number;
  absence_deductions: number;
  sss_contribution: number;
  philhealth_contribution: number;
  pagibig_contribution: number;
  withholding_tax: number;
  loan_deductions: number;
  total_deductions: number;
  net_pay: number;
  employees?: { first_name: string; last_name: string; employee_code: string };
}

export default function Payroll() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewItems, setViewItems] = useState<PayrollItem[]>([]);
  const [viewingRun, setViewingRun] = useState<PayrollRun | null>(null);
  const [form, setForm] = useState({ period_start: "", period_end: "" });
  const [processing, setProcessing] = useState(false);

  const fetchRuns = async () => {
    const { data, error } = await supabase.from("payroll_runs").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRuns(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchRuns(); }, []);

  const createRun = async () => {
    if (!form.period_start || !form.period_end) { toast.error("Select period dates"); return; }
    const { data, error } = await supabase.from("payroll_runs").insert({
      period_start: form.period_start, period_end: form.period_end, created_by: user?.id,
    }).select().single();
    if (error) toast.error(error.message);
    else { toast.success("Payroll run created"); setDialogOpen(false); setForm({ period_start: "", period_end: "" }); fetchRuns(); }
  };

  const processRun = async (run: PayrollRun) => {
    setProcessing(true);
    try {
      // Get all active employees
      const { data: employees, error: empErr } = await supabase.from("employees")
        .select("id, basic_salary, employee_code").eq("employment_status", "active");
      if (empErr) throw empErr;
      if (!employees?.length) { toast.error("No active employees"); return; }

      const items = [];

      for (const emp of employees) {
        // Get attendance for period
        const { data: attendance } = await supabase.from("attendance")
          .select("late_minutes, status, date")
          .eq("employee_id", emp.id)
          .gte("date", run.period_start)
          .lte("date", run.period_end);

        const totalLateMinutes = (attendance || []).reduce((sum, a) => sum + (a.late_minutes || 0), 0);
        const workingDays = 13; // half-month
        const daysPresent = (attendance || []).filter(a => a.status === "present" || a.status === "late").length;
        const absences = Math.max(0, workingDays - daysPresent);

        const dailyRate = computeDailyRate(emp.basic_salary);
        const hourlyRate = computeHourlyRate(emp.basic_salary);
        const basicPay = dailyRate * daysPresent;
        const lateDeductions = (totalLateMinutes / 60) * hourlyRate;
        const absenceDeductions = absences * dailyRate;

        const sss = computeSSS(emp.basic_salary);
        const ph = computePhilHealth(emp.basic_salary);
        const pi = computePagIBIG(emp.basic_salary);

        const grossPay = basicPay;
        const taxableIncome = grossPay - sss.employee - ph.employee - pi.employee;
        const tax = computeWithholdingTax(taxableIncome);

        // Loan deductions
        const { data: loans } = await supabase.from("loans")
          .select("monthly_amortization").eq("employee_id", emp.id).eq("status", "approved");
        const loanDeductions = (loans || []).reduce((sum, l) => sum + (l.monthly_amortization || 0), 0) / 2; // half-month

        const totalDeductions = lateDeductions + absenceDeductions + sss.employee + ph.employee + pi.employee + tax + loanDeductions;
        const netPay = grossPay - totalDeductions;

        items.push({
          payroll_run_id: run.id,
          employee_id: emp.id,
          basic_pay: Math.round(basicPay * 100) / 100,
          gross_pay: Math.round(grossPay * 100) / 100,
          late_deductions: Math.round(lateDeductions * 100) / 100,
          absence_deductions: Math.round(absenceDeductions * 100) / 100,
          sss_contribution: Math.round(sss.employee * 100) / 100,
          philhealth_contribution: Math.round(ph.employee * 100) / 100,
          pagibig_contribution: Math.round(pi.employee * 100) / 100,
          withholding_tax: Math.round(tax * 100) / 100,
          loan_deductions: Math.round(loanDeductions * 100) / 100,
          total_deductions: Math.round(totalDeductions * 100) / 100,
          net_pay: Math.round(netPay * 100) / 100,
        });
      }

      // Delete existing items for re-processing
      await supabase.from("payroll_items").delete().eq("payroll_run_id", run.id);
      const { error: insertErr } = await supabase.from("payroll_items").insert(items);
      if (insertErr) throw insertErr;

      await supabase.from("payroll_runs").update({ status: "completed" }).eq("id", run.id);
      toast.success(`Payroll processed for ${items.length} employees`);
      fetchRuns();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const viewRun = async (run: PayrollRun) => {
    const { data, error } = await supabase.from("payroll_items")
      .select("*, employees(first_name, last_name, employee_code)")
      .eq("payroll_run_id", run.id);
    if (error) toast.error(error.message);
    else { setViewItems(data || []); setViewingRun(run); }
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Payroll</h1>
          <p className="page-description">Process and manage payroll runs</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />New Payroll Run</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Payroll Run</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Period Start</Label>
                <Input type="date" value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Period End</Label>
                <Input type="date" value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })} />
              </div>
              <Button onClick={createRun} className="w-full">Create Run</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payroll Runs List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Run Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : runs.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No payroll runs yet</TableCell></TableRow>
            ) : runs.map(run => (
              <TableRow key={run.id}>
                <TableCell className="font-medium">{run.period_start} to {run.period_end}</TableCell>
                <TableCell>{run.run_date}</TableCell>
                <TableCell>
                  <Badge variant={run.status === "completed" ? "default" : "secondary"}>{run.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {run.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => processRun(run)} disabled={processing}>
                        <Play className="w-3 h-3 mr-1" />Process
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => viewRun(run)}>
                      <Eye className="w-3 h-3 mr-1" />View
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Payroll Items View */}
      {viewingRun && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-display font-semibold">Payroll Details: {viewingRun.period_start} to {viewingRun.period_end}</h3>
            <Button variant="ghost" size="sm" onClick={() => setViewingRun(null)}>Close</Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Basic</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>SSS</TableHead>
                  <TableHead>PhilHealth</TableHead>
                  <TableHead>Pag-IBIG</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>Loans</TableHead>
                  <TableHead>Total Ded.</TableHead>
                  <TableHead>Net Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {item.employees ? `${item.employees.first_name} ${item.employees.last_name}` : "—"}
                    </TableCell>
                    <TableCell>{formatCurrency(item.basic_pay)}</TableCell>
                    <TableCell>{formatCurrency(item.gross_pay)}</TableCell>
                    <TableCell>{formatCurrency(item.sss_contribution)}</TableCell>
                    <TableCell>{formatCurrency(item.philhealth_contribution)}</TableCell>
                    <TableCell>{formatCurrency(item.pagibig_contribution)}</TableCell>
                    <TableCell>{formatCurrency(item.withholding_tax)}</TableCell>
                    <TableCell>{formatCurrency(item.late_deductions)}</TableCell>
                    <TableCell>{formatCurrency(item.loan_deductions)}</TableCell>
                    <TableCell className="font-medium text-destructive">{formatCurrency(item.total_deductions)}</TableCell>
                    <TableCell className="font-bold">{formatCurrency(item.net_pay)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
