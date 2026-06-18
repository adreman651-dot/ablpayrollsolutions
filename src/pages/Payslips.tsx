import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, FileSpreadsheet, Search } from "lucide-react";
import { toast } from "sonner";
import { generatePayslipsPDF, PayslipData } from "@/lib/payslip-pdf";
import { exportPayrollExcel } from "@/lib/payroll-export";
import { computeDailyRate } from "@/lib/payroll-utils";

interface Row {
  id: string;
  employee_id: string;
  basic_pay: number;
  holiday_pay: number;
  allowances: number;
  gross_pay: number;
  sss_contribution: number;
  philhealth_contribution: number;
  pagibig_contribution: number;
  withholding_tax: number;
  cash_advance: number;
  other_deductions: number;
  late_deductions: number;
  absence_deductions: number;
  total_deductions: number;
  net_pay: number;
  leave_days?: number;
  employees: {
    employee_code: string;
    first_name: string;
    last_name: string;
    department: string | null;
    basic_salary: number;
    payroll_type: string | null;
  } | null;
  payroll_runs: {
    period_start: string;
    period_end: string;
    run_date: string;
    status: string;
  } | null;
}

export default function Payslips() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companyName, setCompanyName] = useState("ABL PAYROLL SOLUTIONS");

  useEffect(() => {
    load();
    supabase.from("system_settings").select("value").eq("key", "company_name").maybeSingle()
      .then(({ data }) => { if (data?.value) setCompanyName(String(data.value).replace(/^"|"$/g, "")); });
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payroll_items")
      .select("*, employees(employee_code, first_name, last_name, department, basic_salary, payroll_type), payroll_runs(period_start, period_end, run_date, status)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows((data as any) || []);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const e = r.employees;
      if (!e) return false;
      return (
        e.employee_code?.toLowerCase().includes(q) ||
        e.first_name?.toLowerCase().includes(q) ||
        e.last_name?.toLowerCase().includes(q) ||
        `${e.last_name}, ${e.first_name}`.toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const buildPayslip = (r: Row): PayslipData => {
    const e = r.employees!;
    const run = r.payroll_runs!;
    const dailyRate = computeDailyRate(e.basic_salary);
    const daysWorked = dailyRate > 0 ? +(r.basic_pay / dailyRate).toFixed(2) : 0;
    return {
      companyName,
      paymentDate: new Date(run.run_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      periodStart: new Date(run.period_start).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      periodEnd: new Date(run.period_end).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      employeeCode: e.employee_code,
      employeeName: `${e.last_name}, ${e.first_name}`,
      department: e.department || "—",
      basicSalary: e.basic_salary,
      dailyRate,
      daysWorked,
      hoursWorked: daysWorked * 8,
      straightTime: r.basic_pay,
      holidayPay: r.holiday_pay || 0,
      totalTaxable: r.gross_pay,
      hdmf: r.pagibig_contribution,
      phic: r.philhealth_contribution,
      sss: r.sss_contribution,
      netTaxable: r.gross_pay - r.pagibig_contribution - r.philhealth_contribution - r.sss_contribution - r.withholding_tax,
      otherDeductions: (r.other_deductions || 0) + (r.late_deductions || 0) + (r.absence_deductions || 0),
      totalDeductions: r.total_deductions,
      cashAdvance: r.cash_advance || 0,
      totalNonTaxable: r.allowances || 0,
      netPay: r.net_pay,
      grossPay: r.gross_pay,
      withholdingTax: r.withholding_tax,
      ytdIncomeTxNtx: 0, ytdIncomeTx: 0, ytdIncomeNtx: 0, ytd13thMonth: 0,
      workDetails: [],
    };
  };

  const exportRowPDF = (r: Row) => {
    const doc = generatePayslipsPDF([buildPayslip(r)]);
    const run = r.payroll_runs!;
    doc.save(`payslip_${r.employees?.employee_code}_${run.period_start}_to_${run.period_end}.pdf`);
    toast.success("Payslip PDF exported");
  };

  const exportRowExcel = (r: Row) => {
    const e = r.employees!;
    const run = r.payroll_runs!;
    const dailyRate = computeDailyRate(e.basic_salary);
    const daysWorked = dailyRate > 0 ? +(r.basic_pay / dailyRate).toFixed(2) : 0;
    exportPayrollExcel([{
      employee_id: e.employee_code,
      employee_name: `${e.last_name}, ${e.first_name}`,
      time_in: "", time_out: "",
      days_worked: daysWorked,
      leave_days: r.leave_days || 0,
      basic_monthly_rate: e.basic_salary,
      basic_daily_rate: +dailyRate.toFixed(2),
      gross_income: r.gross_pay,
      sss: r.sss_contribution,
      philhealth: r.philhealth_contribution,
      hdmf: r.pagibig_contribution,
      tax: r.withholding_tax,
      cash_advance: r.cash_advance || 0,
      other_deductions: (r.other_deductions || 0) + (r.late_deductions || 0) + (r.absence_deductions || 0),
      net_pay: r.net_pay,
    }] as any, `payslip_${e.employee_code}_${run.period_start}_to_${run.period_end}.xlsx`);
    toast.success("Payslip Excel exported");
  };

  const exportAllFilteredPDF = () => {
    if (!filtered.length) return toast.error("No payslips to export");
    const doc = generatePayslipsPDF(filtered.map(buildPayslip));
    doc.save(`payslips_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success(`Exported ${filtered.length} payslip(s)`);
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n || 0);

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Payslips</h1>
          <p className="text-sm text-muted-foreground">Search and export employee payslips</p>
        </div>
        <Button onClick={exportAllFilteredPDF} variant="default">
          <FileText className="w-4 h-4 mr-2" /> Export All ({filtered.length})
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by employee code or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net Pay</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No payslips found</TableCell></TableRow>
            ) : filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.employees?.employee_code}</TableCell>
                <TableCell>{r.employees ? `${r.employees.last_name}, ${r.employees.first_name}` : "—"}</TableCell>
                <TableCell className="text-xs">
                  {r.payroll_runs ? `${r.payroll_runs.period_start} → ${r.payroll_runs.period_end}` : "—"}
                </TableCell>
                <TableCell className="text-right">{fmt(r.gross_pay)}</TableCell>
                <TableCell className="text-right text-destructive">{fmt(r.total_deductions)}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(r.net_pay)}</TableCell>
                <TableCell>
                  <Badge variant={r.payroll_runs?.status === "completed" ? "default" : "secondary"}>
                    {r.payroll_runs?.status || "—"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => exportRowPDF(r)}>
                      <FileText className="w-3.5 h-3.5 mr-1" /> PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => exportRowExcel(r)}>
                      <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> Excel
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
