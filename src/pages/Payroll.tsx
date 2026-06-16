import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Eye, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, computeSSS, computePhilHealth, computePagIBIG, computeWithholdingTax, computeDailyRate, computeHourlyRate, WORKING_DAYS_PER_MONTH } from "@/lib/payroll-utils";
import { useAuth } from "@/hooks/useAuth";
import { exportPayrollExcel } from "@/lib/payroll-export";
import { generatePayslipsPDF, PayslipData } from "@/lib/payslip-pdf";

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
  cash_advance: number;
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
  employees?: { id: string; first_name: string; last_name: string; employee_code: string; basic_salary: number; department: string | null };
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
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { time_in?: string; time_out?: string; days: number }>>({});

  const fetchRuns = async () => {
    const { data, error } = await supabase.from("payroll_runs").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRuns(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchRuns(); }, []);

  const createRun = async () => {
    if (!form.period_start || !form.period_end) { toast.error("Select period dates"); return; }
    // Prevent duplicate processing for same period
    const dup = runs.find(r => r.period_start === form.period_start && r.period_end === form.period_end);
    if (dup) { toast.error("A payroll run for this exact period already exists"); return; }
    const { error } = await supabase.from("payroll_runs").insert({
      period_start: form.period_start, period_end: form.period_end, created_by: user?.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Payroll run created"); setDialogOpen(false); setForm({ period_start: "", period_end: "" }); fetchRuns(); }
  };

  const processRun = async (run: PayrollRun) => {
    if (run.status === "completed") {
      if (!confirm("This run is already completed. Re-process and overwrite?")) return;
    }
    setProcessing(true);
    try {
      const { data: pagibigData } = await supabase.from("system_settings").select("key, value").in("key", ["pagibig_employee", "pagibig_employer"]);
      const pagibigMap = Object.fromEntries((pagibigData || []).map(d => [d.key, parseFloat(d.value)]));
      const pagibigOverrides = { employee: pagibigMap.pagibig_employee || 400, employer: pagibigMap.pagibig_employer || 400 };

      const { data: employees, error: empErr } = await supabase.from("employees")
        .select("id, basic_salary, employee_code").eq("employment_status", "active");
      if (empErr) throw empErr;
      if (!employees?.length) { toast.error("No active employees"); return; }

      const items = [];
      // Calculate working days inside the period
      const start = new Date(run.period_start), end = new Date(run.period_end);
      const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      const workingDays = Math.min(totalDays, WORKING_DAYS_PER_MONTH);

      for (const emp of employees) {
        const { data: attendance } = await supabase.from("attendance")
          .select("late_minutes, status, date")
          .eq("employee_id", emp.id)
          .gte("date", run.period_start)
          .lte("date", run.period_end);

        const totalLateMinutes = (attendance || []).reduce((sum, a) => sum + (a.late_minutes || 0), 0);
        const daysPresent = (attendance || []).filter(a => a.status === "present" || a.status === "late").length;
        const absences = Math.max(0, workingDays - daysPresent);

        const dailyRate = computeDailyRate(emp.basic_salary);
        const hourlyRate = computeHourlyRate(emp.basic_salary);
        const basicPay = dailyRate * daysPresent;
        const lateDeductions = (totalLateMinutes / 60) * hourlyRate;
        const absenceDeductions = absences * dailyRate;

        const sss = computeSSS(emp.basic_salary);
        const ph = computePhilHealth(emp.basic_salary);
        const pi = computePagIBIG(emp.basic_salary, pagibigOverrides);

        // Pro-rate gov contributions to the cycle (half-month if period < 20 days)
        const cycleFactor = totalDays < 20 ? 0.5 : 1;
        const sssEE = sss.employee * cycleFactor;
        const phEE = ph.employee * cycleFactor;
        const piEE = pi.employee * cycleFactor;

        const grossPay = basicPay;
        const taxableIncome = grossPay - sssEE - phEE - piEE;
        const tax = computeWithholdingTax(Math.max(0, taxableIncome));

        const { data: loans } = await supabase.from("loans")
          .select("monthly_amortization").eq("employee_id", emp.id).eq("status", "approved");
        const loanDeductions = (loans || []).reduce((sum, l) => sum + (l.monthly_amortization || 0), 0) * cycleFactor;

        const totalDeductions = lateDeductions + absenceDeductions + sssEE + phEE + piEE + tax + loanDeductions;
        const netPay = Math.max(0, grossPay - totalDeductions); // prevent negative

        items.push({
          payroll_run_id: run.id,
          employee_id: emp.id,
          basic_pay: +basicPay.toFixed(2),
          gross_pay: +grossPay.toFixed(2),
          late_deductions: +lateDeductions.toFixed(2),
          absence_deductions: +absenceDeductions.toFixed(2),
          sss_contribution: +sssEE.toFixed(2),
          philhealth_contribution: +phEE.toFixed(2),
          pagibig_contribution: +piEE.toFixed(2),
          withholding_tax: +tax.toFixed(2),
          loan_deductions: +loanDeductions.toFixed(2),
          cash_advance: 0,
          other_deductions: 0,
          total_deductions: +totalDeductions.toFixed(2),
          net_pay: +netPay.toFixed(2),
        });
      }

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
      .select("*, employees(id, first_name, last_name, employee_code, basic_salary, department)")
      .eq("payroll_run_id", run.id);
    if (error) { toast.error(error.message); return; }
    setViewItems((data as any) || []);
    setViewingRun(run);

    // Fetch attendance for time-in/time-out + days_worked aggregation
    const empIds = (data || []).map((d: any) => d.employee_id);
    if (empIds.length) {
      const { data: att } = await supabase.from("attendance")
        .select("employee_id, time_in, time_out, status")
        .in("employee_id", empIds)
        .gte("date", run.period_start)
        .lte("date", run.period_end)
        .order("date", { ascending: true });
      const map: Record<string, { time_in?: string; time_out?: string; days: number }> = {};
      (att || []).forEach(a => {
        const cur = map[a.employee_id] || { days: 0 };
        if (!cur.time_in && a.time_in) cur.time_in = a.time_in;
        if (a.time_out) cur.time_out = a.time_out;
        if (a.status === "present" || a.status === "late") cur.days += 1;
        map[a.employee_id] = cur;
      });
      setAttendanceMap(map);
    }
  };

  const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

  const exportExcel = () => {
    if (!viewingRun) return;
    const rows = viewItems.map(item => {
      const att = attendanceMap[item.employee_id] || { days: 0 };
      return {
        employee_id: item.employees?.employee_code || "",
        employee_name: item.employees ? `${item.employees.last_name}, ${item.employees.first_name}` : "",
        time_in: fmtTime(att.time_in),
        time_out: fmtTime(att.time_out),
        days_worked: att.days,
        leave_days: 0,
        basic_monthly_rate: item.employees?.basic_salary || 0,
        basic_daily_rate: item.employees ? +(item.employees.basic_salary / WORKING_DAYS_PER_MONTH).toFixed(2) : 0,
        gross_income: item.gross_pay,
        sss: item.sss_contribution,
        philhealth: item.philhealth_contribution,
        hdmf: item.pagibig_contribution,
        tax: item.withholding_tax,
        cash_advance: item.cash_advance || 0,
        other_deductions: (item.other_deductions || 0) + (item.loan_deductions || 0) + (item.late_deductions || 0) + (item.absence_deductions || 0),
        net_pay: item.net_pay,
      };
    });
    exportPayrollExcel(rows, `payroll_${viewingRun.period_start}_to_${viewingRun.period_end}.xlsx`);
    toast.success("Excel exported");
  };

  const exportPayslipsPDF = async () => {
    if (!viewingRun) return;
    // Company name
    const { data: cn } = await supabase.from("system_settings").select("value").eq("key", "company_name").maybeSingle();
    const companyName = cn?.value || "JHAYMARTS INDUSTRIES INC.";

    // Fetch detailed attendance per employee for work-detail costing
    const empIds = viewItems.map(i => i.employee_id);
    const { data: att } = await supabase.from("attendance")
      .select("employee_id, date, time_in, time_out, status")
      .in("employee_id", empIds)
      .gte("date", viewingRun.period_start)
      .lte("date", viewingRun.period_end)
      .order("date", { ascending: true });

    const wdMap: Record<string, { date: string; hours: number }[]> = {};
    (att || []).forEach(a => {
      const arr = wdMap[a.employee_id] || [];
      let hours = 0;
      if (a.time_in && a.time_out) {
        hours = (new Date(a.time_out).getTime() - new Date(a.time_in).getTime()) / 3600000;
        hours = Math.max(0, Math.min(8, hours));
      } else if (a.status === "present" || a.status === "late") hours = 8;
      arr.push({ date: new Date(a.date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" }), hours });
      wdMap[a.employee_id] = arr;
    });

    const payslips: PayslipData[] = viewItems.map(item => {
      const e = item.employees!;
      const dailyRate = e.basic_salary / WORKING_DAYS_PER_MONTH;
      const att = attendanceMap[item.employee_id] || { days: 0 };
      const wd = wdMap[item.employee_id] || [];
      const hoursWorked = wd.reduce((s, w) => s + w.hours, 0);
      return {
        companyName,
        paymentDate: new Date(viewingRun.run_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        periodStart: new Date(viewingRun.period_start).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        periodEnd: new Date(viewingRun.period_end).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        employeeCode: e.employee_code,
        employeeName: `${e.last_name}, ${e.first_name}`,
        department: e.department || "—",
        location: "Office",
        basicSalary: e.basic_salary,
        daysWorked: att.days,
        hoursWorked,
        straightTime: item.basic_pay,
        holidayPay: item.holiday_pay || 0,
        totalTaxable: item.gross_pay,
        hdmf: item.pagibig_contribution,
        phic: item.philhealth_contribution,
        sss: item.sss_contribution,
        netTaxable: item.gross_pay - item.pagibig_contribution - item.philhealth_contribution - item.sss_contribution - item.withholding_tax,
        otherDeductions: (item.other_deductions || 0) + (item.loan_deductions || 0),
        totalDeductions: (item.other_deductions || 0) + (item.loan_deductions || 0) + (item.cash_advance || 0),
        riceAllowance: item.allowances ? item.allowances / 2 : 0,
        riceAllowance2: 0,
        totalNonTaxable: item.allowances || 0,
        netPay: item.net_pay,
        ytdIncomeTxNtx: 0,
        ytdIncomeTx: 0,
        ytdIncomeNtx: 0,
        ytd13thMonth: 0,
        workDetails: wd,
      };
    });

    const doc = generatePayslipsPDF(payslips);
    doc.save(`payslips_${viewingRun.period_start}_to_${viewingRun.period_end}.pdf`);
    toast.success("Payslips PDF generated");
  };

  const printPayroll = () => window.print();

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Payroll</h1>
          <p className="page-description">Process payroll, export Excel, and generate payslip PDFs</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />New Payroll Run</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Payroll Run</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2"><Label>Period Start</Label>
                <Input type="date" value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })} /></div>
              <div className="space-y-2"><Label>Period End</Label>
                <Input type="date" value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })} /></div>
              <Button onClick={createRun} className="w-full">Create Run</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Period</TableHead><TableHead>Run Date</TableHead>
            <TableHead>Status</TableHead><TableHead className="w-40">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : runs.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No payroll runs yet</TableCell></TableRow>
            ) : runs.map(run => (
              <TableRow key={run.id}>
                <TableCell className="font-medium">{run.period_start} to {run.period_end}</TableCell>
                <TableCell>{run.run_date}</TableCell>
                <TableCell><Badge variant={run.status === "completed" ? "default" : "secondary"}>{run.status}</Badge></TableCell>
                <TableCell><div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => processRun(run)} disabled={processing}>
                    <Play className="w-3 h-3 mr-1" />Process
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => viewRun(run)}>
                    <Eye className="w-3 h-3 mr-1" />View
                  </Button>
                </div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {viewingRun && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-display font-semibold">Payroll Details: {viewingRun.period_start} to {viewingRun.period_end}</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={exportExcel}><FileSpreadsheet className="w-4 h-4 mr-1" />Excel</Button>
              <Button size="sm" variant="outline" onClick={exportPayslipsPDF}><FileText className="w-4 h-4 mr-1" />Payslips PDF</Button>
              <Button size="sm" variant="outline" onClick={printPayroll}><Printer className="w-4 h-4 mr-1" />Print</Button>
              <Button variant="ghost" size="sm" onClick={() => setViewingRun(null)}>Close</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Employee</TableHead><TableHead>ID</TableHead>
                <TableHead>Time In</TableHead><TableHead>Time Out</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Monthly</TableHead><TableHead className="text-right">Daily</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">SSS</TableHead><TableHead className="text-right">PHIC</TableHead>
                <TableHead className="text-right">HDMF</TableHead><TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">CA</TableHead><TableHead className="text-right">Other</TableHead>
                <TableHead className="text-right font-bold">Net Pay</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {viewItems.map(item => {
                  const e = item.employees;
                  const att = attendanceMap[item.employee_id] || { days: 0 };
                  const daily = e ? e.basic_salary / WORKING_DAYS_PER_MONTH : 0;
                  const otherTotal = (item.other_deductions || 0) + (item.loan_deductions || 0) + (item.late_deductions || 0) + (item.absence_deductions || 0);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium whitespace-nowrap">{e ? `${e.last_name}, ${e.first_name}` : "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{e?.employee_code}</TableCell>
                      <TableCell className="text-xs">{fmtTime(att.time_in)}</TableCell>
                      <TableCell className="text-xs">{fmtTime(att.time_out)}</TableCell>
                      <TableCell className="text-right">{att.days}</TableCell>
                      <TableCell className="text-right">{formatCurrency(e?.basic_salary || 0)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(daily)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.gross_pay)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.sss_contribution)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.philhealth_contribution)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.pagibig_contribution)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.withholding_tax)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.cash_advance || 0)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(otherTotal)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(item.net_pay)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
