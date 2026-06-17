import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, BarChart3, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, WORKING_DAYS_PER_MONTH } from "@/lib/payroll-utils";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const reportTypes = [
  { value: "payroll_detail", label: "Payroll Detailed Report" },
  { value: "payroll_summary", label: "Payroll Summary (Gross / Deductions / Net)" },
  { value: "contributions", label: "Government Contribution Summary" },
  { value: "tardiness", label: "Tardiness Report" },
  { value: "absences", label: "Absences Report" },
  { value: "attendance_summary", label: "Attendance Summary" },
  { value: "leaves", label: "Leave Utilization Report" },
  { value: "loans", label: "Salary Loan Report" },
  { value: "anniversary", label: "Employee Anniversary Report" },
];

export default function Reports() {
  const [reportType, setReportType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ label: string; value: string }[]>([]);

  const generateReport = async () => {
    if (!reportType) { toast.error("Select a report type"); return; }
    setLoading(true);
    setSummary([]);
    try {
      switch (reportType) {

        case "payroll_detail": {
          let q = supabase.from("payroll_items")
            .select("*, employees(first_name, last_name, employee_code, payroll_type, basic_salary), payroll_runs(period_start, period_end, run_date)")
            .order("created_at", { ascending: false });
          if (dateFrom) q = (q as any).gte("payroll_runs.period_start", dateFrom);
          const { data: items } = await q;
          setColumns(["Employee", "ID", "Period", "Payroll Type", "Daily Rate", "Gross", "SSS", "PhilHealth", "Pag-IBIG", "Tax", "Cash Advance", "Other Ded.", "Net Pay"]);
          setData((items || []).map(i => {
            const monthly = i.employees?.payroll_type === "daily_rate"
              ? (i.employees.basic_salary * WORKING_DAYS_PER_MONTH)
              : i.employees?.payroll_type === "hourly_rate"
              ? (i.employees.basic_salary * 8 * WORKING_DAYS_PER_MONTH)
              : (i.employees?.basic_salary || 0);
            const daily = +(monthly / WORKING_DAYS_PER_MONTH).toFixed(2);
            return {
              Employee: i.employees ? `${i.employees.last_name}, ${i.employees.first_name}` : "—",
              ID: i.employees?.employee_code || "—",
              Period: i.payroll_runs ? `${i.payroll_runs.period_start} to ${i.payroll_runs.period_end}` : "—",
              "Payroll Type": (i.employees?.payroll_type || "monthly_rate").replace(/_/g, " "),
              "Daily Rate": formatCurrency(daily),
              Gross: formatCurrency(i.gross_pay),
              SSS: formatCurrency(i.sss_contribution),
              PhilHealth: formatCurrency(i.philhealth_contribution),
              "Pag-IBIG": formatCurrency(i.pagibig_contribution),
              Tax: formatCurrency(i.withholding_tax),
              "Cash Advance": formatCurrency(i.cash_advance || 0),
              "Other Ded.": formatCurrency((i.other_deductions || 0) + (i.loan_deductions || 0) + (i.late_deductions || 0) + (i.absence_deductions || 0)),
              "Net Pay": formatCurrency(i.net_pay),
            };
          }));
          break;
        }

        case "payroll_summary": {
          const { data: items } = await supabase.from("payroll_items")
            .select("gross_pay, total_deductions, net_pay, sss_contribution, philhealth_contribution, pagibig_contribution, withholding_tax")
            .order("created_at", { ascending: false });
          const totGross = (items || []).reduce((s, i) => s + i.gross_pay, 0);
          const totNet = (items || []).reduce((s, i) => s + i.net_pay, 0);
          const totSSS = (items || []).reduce((s, i) => s + i.sss_contribution, 0);
          const totPH = (items || []).reduce((s, i) => s + i.philhealth_contribution, 0);
          const totPI = (items || []).reduce((s, i) => s + i.pagibig_contribution, 0);
          const totTax = (items || []).reduce((s, i) => s + i.withholding_tax, 0);
          setSummary([
            { label: "Total Gross Payroll", value: formatCurrency(totGross) },
            { label: "Total SSS (EE)", value: formatCurrency(totSSS) },
            { label: "Total PhilHealth (EE)", value: formatCurrency(totPH) },
            { label: "Total Pag-IBIG (EE)", value: formatCurrency(totPI) },
            { label: "Total Withholding Tax", value: formatCurrency(totTax) },
            { label: "Total Net Pay Disbursed", value: formatCurrency(totNet) },
          ]);
          setColumns([]);
          setData([]);
          break;
        }

        case "contributions": {
          const { data: items } = await supabase.from("payroll_items")
            .select("employee_id, sss_contribution, philhealth_contribution, pagibig_contribution, withholding_tax, employees(first_name, last_name, employee_code)")
            .order("created_at", { ascending: false });
          setColumns(["Employee", "SSS (EE)", "PhilHealth (EE)", "Pag-IBIG (EE)", "Withholding Tax", "Total Deductions"]);
          setData((items || []).map(i => ({
            Employee: i.employees ? `${i.employees.last_name}, ${i.employees.first_name}` : "—",
            "SSS (EE)": formatCurrency(i.sss_contribution),
            "PhilHealth (EE)": formatCurrency(i.philhealth_contribution),
            "Pag-IBIG (EE)": formatCurrency(i.pagibig_contribution),
            "Withholding Tax": formatCurrency(i.withholding_tax),
            "Total Deductions": formatCurrency(i.sss_contribution + i.philhealth_contribution + i.pagibig_contribution + i.withholding_tax),
          })));
          break;
        }

        case "tardiness": {
          let q = supabase.from("attendance")
            .select("*, employees(first_name, last_name, employee_code)")
            .gt("late_minutes", 0)
            .order("date", { ascending: false });
          if (dateFrom) q = q.gte("date", dateFrom);
          if (dateTo) q = q.lte("date", dateTo);
          const { data: records } = await q;
          setColumns(["Employee", "Code", "Date", "Time In", "Late Minutes", "Status"]);
          setData((records || []).map(r => ({
            Employee: r.employees ? `${r.employees.last_name}, ${r.employees.first_name}` : "—",
            Code: r.employees?.employee_code || "—",
            Date: r.date,
            "Time In": r.time_in ? new Date(r.time_in).toLocaleTimeString() : "—",
            "Late Minutes": r.late_minutes,
            Status: r.status,
          })));
          break;
        }

        case "absences": {
          const { data: emps } = await supabase.from("employees")
            .select("id, first_name, last_name, employee_code").eq("employment_status", "active");
          if (!dateFrom || !dateTo) { toast.error("Please select date range for absences report"); break; }
          const start = new Date(dateFrom), end = new Date(dateTo);
          const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
          const rows: any[] = [];
          for (const emp of (emps || [])) {
            const { data: att } = await supabase.from("attendance")
              .select("status").eq("employee_id", emp.id).gte("date", dateFrom).lte("date", dateTo);
            const present = (att || []).filter(a => a.status === "present" || a.status === "late").length;
            const absent = Math.max(0, totalDays - present);
            if (absent > 0) rows.push({
              Employee: `${emp.last_name}, ${emp.first_name}`,
              Code: emp.employee_code,
              "Period": `${dateFrom} to ${dateTo}`,
              "Days Present": present,
              "Days Absent": absent,
              "Attendance Rate": `${Math.round((present / totalDays) * 100)}%`,
            });
          }
          setColumns(["Employee", "Code", "Period", "Days Present", "Days Absent", "Attendance Rate"]);
          setData(rows);
          break;
        }

        case "attendance_summary": {
          let q = supabase.from("attendance")
            .select("*, employees(first_name, last_name, employee_code)")
            .order("date", { ascending: false });
          if (dateFrom) q = q.gte("date", dateFrom);
          if (dateTo) q = q.lte("date", dateTo);
          const { data: records } = await q;
          setColumns(["Employee", "Code", "Date", "Time In", "Time Out", "Hours", "Late Min", "Status"]);
          setData((records || []).map(r => {
            let hours = "—";
            if (r.time_in && r.time_out) {
              const h = (new Date(r.time_out).getTime() - new Date(r.time_in).getTime()) / 3600000;
              hours = h.toFixed(2);
            }
            return {
              Employee: r.employees ? `${r.employees.last_name}, ${r.employees.first_name}` : "—",
              Code: r.employees?.employee_code || "—",
              Date: r.date,
              "Time In": r.time_in ? new Date(r.time_in).toLocaleTimeString() : "—",
              "Time Out": r.time_out ? new Date(r.time_out).toLocaleTimeString() : "—",
              Hours: hours,
              "Late Min": r.late_minutes || 0,
              Status: r.status,
            };
          }));
          break;
        }

        case "leaves": {
          const { data: leavesData } = await supabase.from("leaves")
            .select("*, employees(first_name, last_name, employee_code), leave_types(name, credits_per_year)")
            .order("created_at", { ascending: false });
          setColumns(["Employee", "Code", "Leave Type", "Credits/Yr", "Days Used", "Start", "End", "Status"]);
          setData((leavesData || []).map(l => ({
            Employee: l.employees ? `${l.employees.last_name}, ${l.employees.first_name}` : "—",
            Code: l.employees?.employee_code || "—",
            "Leave Type": l.leave_types?.name || "—",
            "Credits/Yr": l.leave_types?.credits_per_year || "—",
            "Days Used": l.duration,
            Start: l.start_date,
            End: l.end_date,
            Status: l.status,
          })));
          break;
        }

        case "loans": {
          const { data: loans } = await supabase.from("loans")
            .select("*, employees(first_name, last_name, employee_code)")
            .order("created_at", { ascending: false });
          setColumns(["Employee", "Code", "Type", "Principal", "Monthly Amort.", "Total Paid", "Balance", "Status"]);
          setData((loans || []).map(l => ({
            Employee: l.employees ? `${l.employees.last_name}, ${l.employees.first_name}` : "—",
            Code: l.employees?.employee_code || "—",
            Type: l.loan_type,
            Principal: formatCurrency(l.principal_amount),
            "Monthly Amort.": formatCurrency(l.monthly_amortization),
            "Total Paid": formatCurrency(l.total_paid),
            Balance: formatCurrency(l.remaining_balance),
            Status: l.status,
          })));
          break;
        }

        case "anniversary": {
          const { data: emps } = await supabase.from("employees")
            .select("first_name, last_name, employee_code, hire_date, department, job_title")
            .eq("employment_status", "active")
            .order("hire_date");
          const now = new Date();
          setColumns(["Employee", "Code", "Department", "Position", "Hire Date", "Years of Service", "Next Anniversary"]);
          setData((emps || []).map(e => {
            const hireDate = new Date(e.hire_date);
            const years = Math.floor((now.getTime() - hireDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
            const nextAnniv = new Date(now.getFullYear(), hireDate.getMonth(), hireDate.getDate());
            if (nextAnniv < now) nextAnniv.setFullYear(nextAnniv.getFullYear() + 1);
            return {
              Employee: `${e.last_name}, ${e.first_name}`,
              Code: e.employee_code,
              Department: e.department || "—",
              Position: e.job_title || "—",
              "Hire Date": e.hire_date,
              "Years of Service": years,
              "Next Anniversary": nextAnniv.toLocaleDateString("en-PH"),
            };
          }));
          break;
        }

        default: {
          setColumns([]);
          setData([]);
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!data.length) return;
    const csv = [columns.join(","), ...data.map(row => columns.map(c => `"${row[c] ?? ""}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${reportType}_report.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcelReport = () => {
    if (!data.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${reportType}_report.xlsx`);
    toast.success("Excel report exported");
  };

  const exportPDFReport = () => {
    if (!data.length) return;
    const doc = new jsPDF("landscape");
    doc.text(`${reportType.replace(/_/g, " ").toUpperCase()} REPORT`, 14, 15);
    
    const head = [columns];
    const body = data.map(row => columns.map(c => row[c] ?? ""));
    
    autoTable(doc, {
      startY: 20,
      head: head,
      body: body,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185] },
    });
    
    doc.save(`${reportType}_report.pdf`);
    toast.success("PDF report exported");
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-description">Generate and export payroll, attendance, and HR reports</p>
      </div>

      <div className="stat-card mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-72">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Report Type</label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger><SelectValue placeholder="Select report type" /></SelectTrigger>
              <SelectContent>
                {reportTypes.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Date From</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-44" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Date To</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-44" />
          </div>
          <Button onClick={generateReport} disabled={loading}>
            <BarChart3 className="w-4 h-4 mr-2" />{loading ? "Generating..." : "Generate Report"}
          </Button>
          {data.length > 0 && (
            <>
              <Button variant="outline" onClick={exportCSV}>
                <Download className="w-4 h-4 mr-2" />CSV
              </Button>
              <Button variant="outline" onClick={exportExcelReport}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />Excel
              </Button>
              <Button variant="outline" onClick={exportPDFReport}>
                <FileText className="w-4 h-4 mr-2" />PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {summary.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {summary.map(s => (
            <div key={s.label} className="stat-card">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{s.label}</p>
              <p className="text-2xl font-display font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {data.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{data.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(c => <TableHead key={c}>{c}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, i) => (
                  <TableRow key={i}>
                    {columns.map(c => <TableCell key={c}>{row[c]}</TableCell>)}
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
