import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Play, Eye, FileSpreadsheet, FileText, Printer, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  formatCurrency, computeSSS, computePhilHealth, computePagIBIG,
  computeWithholdingTax, computeDailyRate, computeHourlyRate, WORKING_DAYS_PER_MONTH,
} from "@/lib/payroll-utils";
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
  leave_days?: number;
  employees?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_code: string;
    basic_salary: number;
    department: string | null;
    payroll_type: string | null;
  };
}

// Overridable deduction row used in manual adjustments
interface ManualOverride {
  employee_id: string;
  cash_advance: number;
  other_deductions: number;
}

export default function Payroll() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewItems, setViewItems] = useState<PayrollItem[]>([]);
  const [viewingRun, setViewingRun] = useState<PayrollRun | null>(null);
  const [form, setForm] = useState({ period_start: "", period_end: "", run_date: "", cutoff_type: "15th" });
  const [autoGen, setAutoGen] = useState({ month: new Date().toISOString().slice(0, 7), cycle: "1st" });
  const [cutoffSettings, setCutoffSettings] = useState({ daysBefore: 3, skipWeekends: false });
  const [processing, setProcessing] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, ManualOverride>>({});
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { time_in?: string; time_out?: string; days: number }>>({});
  const [savingOverrides, setSavingOverrides] = useState(false);

  const fetchRuns = async () => {
    const { data, error } = await supabase.from("payroll_runs").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRuns(data || []);
    setLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from("system_settings").select("key, value").in("key", ["cutoff_days_before_payout", "cutoff_skip_weekends"]);
    if (data) {
      const db = parseInt(data.find(d => d.key === "cutoff_days_before_payout")?.value || "3", 10);
      const sw = data.find(d => d.key === "cutoff_skip_weekends")?.value === "true";
      setCutoffSettings({ daysBefore: db, skipWeekends: sw });
    }
  };

  useEffect(() => { fetchRuns(); fetchSettings(); }, []);

  // Compute Auto Dates
  useEffect(() => {
    if (!autoGen.month) return;
    const [yearStr, monthStr] = autoGen.month.split("-");
    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10) - 1;

    let releaseDate: Date;
    let startDate: Date;
    let endDate: Date;

    const adjustForWeekend = (d: Date) => {
      if (!cutoffSettings.skipWeekends) return d;
      const day = d.getDay();
      if (day === 6) d.setDate(d.getDate() - 1); // Sat -> Fri
      else if (day === 0) d.setDate(d.getDate() - 2); // Sun -> Fri
      return d;
    };

    if (autoGen.cycle === "1st") {
      releaseDate = new Date(y, m, 15);
      startDate = new Date(y, m, 1);
      endDate = new Date(y, m, 15 - cutoffSettings.daysBefore);
      endDate = adjustForWeekend(endDate);
    } else {
      // Last day of month
      releaseDate = new Date(y, m + 1, 0); 
      // Start date is day after 1st cycle end date. We must recalculate 1st cycle end date.
      let firstCycleEnd = new Date(y, m, 15 - cutoffSettings.daysBefore);
      firstCycleEnd = adjustForWeekend(firstCycleEnd);
      startDate = new Date(firstCycleEnd);
      startDate.setDate(startDate.getDate() + 1);
      endDate = new Date(y, m + 1, 0);
      endDate.setDate(endDate.getDate() - cutoffSettings.daysBefore);
      endDate = adjustForWeekend(endDate);
    }

    setForm({
      period_start: startDate.toISOString().split("T")[0],
      period_end: endDate.toISOString().split("T")[0],
      run_date: releaseDate.toISOString().split("T")[0],
      cutoff_type: autoGen.cycle === "1st" ? "15th" : "30th"
    });
  }, [autoGen.month, autoGen.cycle, cutoffSettings]);

  const createRun = async () => {
    if (!form.period_start || !form.period_end || !form.run_date) { toast.error("Select period dates"); return; }
    const dup = runs.find(r => r.period_start === form.period_start && r.period_end === form.period_end);
    if (dup) { toast.error("A payroll run for this exact period already exists"); return; }
    const { error } = await supabase.from("payroll_runs").insert({
      period_start: form.period_start, period_end: form.period_end, run_date: form.run_date,
      created_by: user?.id, cutoff_type: form.cutoff_type
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Payroll run created");
      setDialogOpen(false);
      fetchRuns();
    }
  };

  function getEffectiveDailyRate(basicSalary: number, payrollType: string | null): number {
    if (payrollType === "daily_rate") return basicSalary;
    if (payrollType === "hourly_rate") return basicSalary * 8;
    return computeDailyRate(basicSalary);
  }

  const processRun = async (run: PayrollRun & { cutoff_type?: string }) => {
    if (run.status === "completed") {
      if (!confirm("This run is already completed. Re-process and overwrite?")) return;
    }
    setProcessing(true);
    try {
      const { data: pagibigData } = await supabase.from("system_settings").select("key, value").in("key", ["pagibig_employee", "pagibig_employer"]);
      const pagibigMap = Object.fromEntries((pagibigData || []).map(d => [d.key, parseFloat(d.value)]));
      const pagibigOverrides = { employee: pagibigMap.pagibig_employee || 400, employer: pagibigMap.pagibig_employer || 400 };

      const { data: employees, error: empErr } = await supabase.from("employees")
        .select("id, basic_salary, employee_code, payroll_type, sss_schedule, phic_schedule, hdmf_schedule").eq("employment_status", "active");
      if (empErr) throw empErr;
      if (!employees?.length) { toast.error("No active employees"); return; }

      const start = new Date(run.period_start), end = new Date(run.period_end);
      const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      const workingDaysInPeriod = Math.min(totalDays, WORKING_DAYS_PER_MONTH);
      const cycleFactor = totalDays < 20 ? 0.5 : 1;
      const currentCutoff = run.cutoff_type || "both"; // '15th', '30th', or 'both'

      const items = [];

      for (const emp of employees) {
        const { data: attendance } = await supabase.from("attendance")
          .select("late_minutes, status, date")
          .eq("employee_id", emp.id)
          .gte("date", run.period_start)
          .lte("date", run.period_end);

        const totalLateMinutes = (attendance || []).reduce((sum, a) => sum + (a.late_minutes || 0), 0);
        const daysPresent = (attendance || []).filter(a => a.status === "present" || a.status === "late").length;
        const absences = Math.max(0, workingDaysInPeriod - daysPresent);

        const { data: leaveData } = await supabase.from("leaves")
          .select("duration")
          .eq("employee_id", emp.id)
          .eq("status", "approved")
          .gte("start_date", run.period_start)
          .lte("end_date", run.period_end);
        const leaveDays = (leaveData || []).reduce((sum, l) => sum + (l.duration || 0), 0);

        const dailyRate = getEffectiveDailyRate(emp.basic_salary, emp.payroll_type);
        const hourlyRate = dailyRate / 8;

        const effectiveDays = daysPresent + leaveDays;
        
        let basicPay = dailyRate * effectiveDays;
        let absenceDeductions = 0;
        let lateDeductions = 0;

        if (emp.payroll_type === "daily_rate" || emp.payroll_type === "hourly_rate") {
            // No time in means basic pay naturally 0
            if (daysPresent === 0 && leaveDays === 0) {
                basicPay = 0;
            }
        } else {
            // Monthly rate logic
            const unpaidAbsences = Math.max(0, absences - leaveDays);
            absenceDeductions = unpaidAbsences * dailyRate;
            lateDeductions = (totalLateMinutes / 60) * hourlyRate;
            basicPay = (emp.basic_salary * cycleFactor);
        }

        const grossPay = +basicPay.toFixed(2);

        const monthlySalary = emp.payroll_type === "daily_rate"
          ? emp.basic_salary * WORKING_DAYS_PER_MONTH
          : emp.payroll_type === "hourly_rate"
          ? emp.basic_salary * 8 * WORKING_DAYS_PER_MONTH
          : emp.basic_salary;

        // Check if deduction schedules match current run cutoff
        const shouldDeductSSS = emp.sss_schedule === "both" || emp.sss_schedule === currentCutoff;
        const shouldDeductPHIC = emp.phic_schedule === "both" || emp.phic_schedule === currentCutoff;
        const shouldDeductHDMF = emp.hdmf_schedule === "both" || emp.hdmf_schedule === currentCutoff;

        const sss = computeSSS(monthlySalary);
        const ph = computePhilHealth(monthlySalary);
        const pi = computePagIBIG(monthlySalary, pagibigOverrides);

        const sssEE = shouldDeductSSS ? +(sss.employee * cycleFactor).toFixed(2) : 0;
        const phEE = shouldDeductPHIC ? +(ph.employee * cycleFactor).toFixed(2) : 0;
        const piEE = shouldDeductHDMF ? +(pi.employee * cycleFactor).toFixed(2) : 0;

        const taxableIncome = Math.max(0, grossPay - absenceDeductions - lateDeductions - sssEE - phEE - piEE);
        const tax = computeWithholdingTax(taxableIncome);

        const { data: loans } = await supabase.from("loans")
          .select("per_cutoff_amortization").eq("employee_id", emp.id).eq("status", "approved");
        const loanDeductions = +((loans || []).reduce((sum, l) => sum + (l.per_cutoff_amortization || 0), 0)).toFixed(2);

        const totalDeductions = +(lateDeductions + absenceDeductions + sssEE + phEE + piEE + tax + loanDeductions).toFixed(2);
        const netPay = Math.max(0, grossPay - totalDeductions);

        items.push({
          payroll_run_id: run.id,
          employee_id: emp.id,
          basic_pay: grossPay,
          gross_pay: grossPay,
          late_deductions: +lateDeductions.toFixed(2),
          absence_deductions: +absenceDeductions.toFixed(2),
          sss_contribution: sssEE,
          philhealth_contribution: phEE,
          pagibig_contribution: piEE,
          withholding_tax: +tax.toFixed(2),
          loan_deductions: 0, // Using cash advance instead for loans
          cash_advance: loanDeductions,
          other_deductions: 0,
          total_deductions: totalDeductions,
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
      .select("*, employees(id, first_name, last_name, employee_code, basic_salary, department, payroll_type)")
      .eq("payroll_run_id", run.id);
    if (error) { toast.error(error.message); return; }
    const items = (data as any) || [];
    setViewItems(items);
    setViewingRun(run);

    const initOverrides: Record<string, ManualOverride> = {};
    items.forEach((item: PayrollItem) => {
      initOverrides[item.employee_id] = {
        employee_id: item.employee_id,
        cash_advance: item.cash_advance || 0,
        other_deductions: item.other_deductions || 0,
      };
    });
    setOverrides(initOverrides);

    const empIds = items.map((d: any) => d.employee_id);
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

  const saveOverrides = async () => {
    if (!viewingRun) return;
    setSavingOverrides(true);
    try {
      for (const item of viewItems) {
        const ov = overrides[item.employee_id];
        if (!ov) continue;
        const ca = ov.cash_advance || 0;
        const od = ov.other_deductions || 0;
        const baseDed = item.sss_contribution + item.philhealth_contribution + item.pagibig_contribution +
          item.withholding_tax + item.late_deductions + item.absence_deductions;
        const totalDed = +(baseDed + ca + od).toFixed(2);
        const netPay = Math.max(0, item.gross_pay - totalDed);
        await supabase.from("payroll_items").update({
          cash_advance: ca,
          other_deductions: od,
          total_deductions: totalDed,
          net_pay: +netPay.toFixed(2),
        }).eq("id", item.id);
      }
      toast.success("Manual deductions saved. Refreshing...");
      await viewRun(viewingRun);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingOverrides(false);
    }
  };

  const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

  const exportExcel = () => {
    if (!viewingRun) return;
    const rows = viewItems.map(item => {
      const att = attendanceMap[item.employee_id] || { days: 0 };
      const e = item.employees;
      const monthly = e?.payroll_type === "daily_rate" ? (e.basic_salary * WORKING_DAYS_PER_MONTH) :
        e?.payroll_type === "hourly_rate" ? (e.basic_salary * 8 * WORKING_DAYS_PER_MONTH) : (e?.basic_salary || 0);
      const daily = monthly / WORKING_DAYS_PER_MONTH;
      return {
        employee_id: e?.employee_code || "",
        employee_name: e ? `${e.last_name}, ${e.first_name}` : "",
        time_in: fmtTime(att.time_in),
        time_out: fmtTime(att.time_out),
        days_worked: att.days,
        leave_days: item.leave_days || 0,
        basic_monthly_rate: monthly,
        basic_daily_rate: +daily.toFixed(2),
        gross_income: item.gross_pay,
        sss: item.sss_contribution,
        philhealth: item.philhealth_contribution,
        hdmf: item.pagibig_contribution,
        tax: item.withholding_tax,
        cash_advance: item.cash_advance || 0,
        other_deductions: (item.other_deductions || 0) + (item.late_deductions || 0) + (item.absence_deductions || 0),
        net_pay: item.net_pay,
      };
    });
    exportPayrollExcel(rows, `payroll_${viewingRun.period_start}_to_${viewingRun.period_end}.xlsx`);
    toast.success("Excel exported");
  };

  const exportPayslipsPDF = async () => {
    if (!viewingRun) return;
    const { data: cn } = await supabase.from("system_settings").select("value").eq("key", "company_name").maybeSingle();
    const companyName = cn?.value || "ABL PAYROLL SOLUTIONS";

    const payslips: PayslipData[] = viewItems.map(item => {
      const e = item.employees!;
      const attInfo = attendanceMap[item.employee_id] || { days: 0 };
      const dailyRate = getEffectiveDailyRate(e.basic_salary, e.payroll_type);
      return {
        companyName,
        paymentDate: new Date(viewingRun.run_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        periodStart: new Date(viewingRun.period_start).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        periodEnd: new Date(viewingRun.period_end).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        employeeCode: e.employee_code,
        employeeName: `${e.last_name}, ${e.first_name}`,
        department: e.department || "—",
        basicSalary: e.basic_salary,
        dailyRate: dailyRate,
        daysWorked: attInfo.days,
        hoursWorked: attInfo.days * 8,
        straightTime: item.basic_pay,
        holidayPay: item.holiday_pay || 0,
        totalTaxable: item.gross_pay,
        hdmf: item.pagibig_contribution,
        phic: item.philhealth_contribution,
        sss: item.sss_contribution,
        netTaxable: item.gross_pay - item.pagibig_contribution - item.philhealth_contribution - item.sss_contribution - item.withholding_tax,
        otherDeductions: (item.other_deductions || 0),
        totalDeductions: item.total_deductions,
        cashAdvance: item.cash_advance || 0,
        totalNonTaxable: item.allowances || 0,
        netPay: item.net_pay,
        ytdIncomeTxNtx: 0, ytdIncomeTx: 0, ytdIncomeNtx: 0, ytd13thMonth: 0,
        workDetails: [],
      };
    });

    const doc = generatePayslipsPDF(payslips);
    doc.save(`payslips_${viewingRun.period_start}_to_${viewingRun.period_end}.pdf`);
    toast.success("Payslips PDF generated");
  };

  const totals = viewItems.reduce((acc, item) => ({
    gross: acc.gross + item.gross_pay,
    sss: acc.sss + item.sss_contribution,
    ph: acc.ph + item.philhealth_contribution,
    hdmf: acc.hdmf + item.pagibig_contribution,
    tax: acc.tax + item.withholding_tax,
    ca: acc.ca + (item.cash_advance || 0),
    other: acc.other + (item.other_deductions || 0) + (item.late_deductions || 0) + (item.absence_deductions || 0),
    net: acc.net + item.net_pay,
  }), { gross: 0, sss: 0, ph: 0, hdmf: 0, tax: 0, ca: 0, other: 0, net: 0 });

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
            <DialogHeader><DialogTitle>Create Auto Payroll Run</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Input type="month" value={autoGen.month} onChange={e => setAutoGen({ ...autoGen, month: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Cycle</Label>
                  <Select value={autoGen.cycle} onValueChange={v => setAutoGen({ ...autoGen, cycle: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1st">1st Period (15th Payout)</SelectItem>
                      <SelectItem value="2nd">2nd Period (End of Month)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                <p><strong>Cut-off rule:</strong> {cutoffSettings.daysBefore} days before payout</p>
                <p><strong>Skip weekends:</strong> {cutoffSettings.skipWeekends ? "Yes" : "No"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <div className="space-y-2"><Label>Period Start</Label>
                  <Input type="date" value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })} /></div>
                <div className="space-y-2"><Label>Period End</Label>
                  <Input type="date" value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })} /></div>
                <div className="space-y-2"><Label>Release/Run Date</Label>
                  <Input type="date" value={form.run_date} onChange={e => setForm({ ...form, run_date: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Cut-off Deduction Sync</Label>
                  <Select value={form.cutoff_type} onValueChange={v => setForm({ ...form, cutoff_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15th">15th Deductions</SelectItem>
                      <SelectItem value="30th">30th Deductions</SelectItem>
                      <SelectItem value="both">Both Deductions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={createRun} className="w-full mt-2">Generate Payroll Run</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payroll Runs List */}
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
                <TableCell className="font-medium">{run.period_start} — {run.period_end}</TableCell>
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

      {/* Payroll Detail View */}
      {viewingRun && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-display font-semibold">Payroll Details: {viewingRun.period_start} to {viewingRun.period_end}</h3>
              <p className="text-xs text-muted-foreground mt-1">{viewItems.length} employees · Status: {viewingRun.status}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={exportExcel}><FileSpreadsheet className="w-4 h-4 mr-1" />Excel</Button>
              <Button size="sm" variant="outline" onClick={exportPayslipsPDF}><FileText className="w-4 h-4 mr-1" />Payslips PDF</Button>
              <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" />Print</Button>
              <Button variant="ghost" size="sm" onClick={() => setViewingRun(null)}>Close</Button>
            </div>
          </div>

          {/* Manual Deductions Notice */}
          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              You can manually enter <strong>Cash Advance</strong> and <strong>Other Deductions</strong> below.
              Click <strong>Save Deductions</strong> to recalculate Net Pay. Net Pay will never go below ₱0.
            </p>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Time In</TableHead>
                <TableHead>Time Out</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Monthly Rate</TableHead>
                <TableHead className="text-right">Daily Rate</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">SSS</TableHead>
                <TableHead className="text-right">PHIC</TableHead>
                <TableHead className="text-right">HDMF</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right min-w-[110px]">Cash Advance</TableHead>
                <TableHead className="text-right min-w-[110px]">Other Ded.</TableHead>
                <TableHead className="text-right font-bold">Net Pay</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {viewItems.map(item => {
                  const e = item.employees;
                  const att = attendanceMap[item.employee_id] || { days: 0 };
                  const monthly = e?.payroll_type === "daily_rate"
                    ? (e.basic_salary * WORKING_DAYS_PER_MONTH)
                    : e?.payroll_type === "hourly_rate"
                    ? (e.basic_salary * 8 * WORKING_DAYS_PER_MONTH)
                    : (e?.basic_salary || 0);
                  const daily = +(monthly / WORKING_DAYS_PER_MONTH).toFixed(2);
                  const ov = overrides[item.employee_id] || { cash_advance: 0, other_deductions: 0 };
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium whitespace-nowrap">{e ? `${e.last_name}, ${e.first_name}` : "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{e?.employee_code}</TableCell>
                      <TableCell className="text-xs">{fmtTime(att.time_in)}</TableCell>
                      <TableCell className="text-xs">{fmtTime(att.time_out)}</TableCell>
                      <TableCell className="text-right">{att.days}</TableCell>
                      <TableCell className="text-right">{formatCurrency(monthly)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(daily)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.gross_pay)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.sss_contribution)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.philhealth_contribution)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.pagibig_contribution)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.withholding_tax)}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-24 text-right h-7 text-xs"
                          value={ov.cash_advance}
                          onChange={e2 => setOverrides(prev => ({
                            ...prev,
                            [item.employee_id]: { employee_id: item.employee_id, other_deductions: ov.other_deductions, cash_advance: parseFloat(e2.target.value) || 0 },
                          }))}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-24 text-right h-7 text-xs"
                          value={ov.other_deductions}
                          onChange={e2 => setOverrides(prev => ({
                            ...prev,
                            [item.employee_id]: { employee_id: item.employee_id, cash_advance: ov.cash_advance, other_deductions: parseFloat(e2.target.value) || 0 },
                          }))}
                        />
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">{formatCurrency(item.net_pay)}</TableCell>
                    </TableRow>
                  );
                })}
                {/* Totals Row */}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell colSpan={7} className="text-right text-sm text-muted-foreground">TOTALS</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.gross)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.sss)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.ph)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.hdmf)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.tax)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.ca)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.other)}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{formatCurrency(totals.net)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="p-4 border-t border-border flex justify-end">
            <Button onClick={saveOverrides} disabled={savingOverrides}>
              {savingOverrides ? "Saving..." : "Save Deductions & Recalculate"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
