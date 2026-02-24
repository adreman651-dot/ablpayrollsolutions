import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/payroll-utils";

const reportTypes = [
  { value: "payroll_detail", label: "Payroll Detailed Report" },
  { value: "tardiness", label: "Tardiness Report" },
  { value: "absences", label: "Absences Report" },
  { value: "loans", label: "Salary Loan Report" },
  { value: "contributions", label: "Government Contribution Summary" },
  { value: "anniversary", label: "Employee Anniversary Report" },
];

export default function Reports() {
  const [reportType, setReportType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    if (!reportType) { toast.error("Select a report type"); return; }
    setLoading(true);
    try {
      switch (reportType) {
        case "payroll_detail": {
          let q = supabase.from("payroll_items")
            .select("*, employees(first_name, last_name, employee_code), payroll_runs(period_start, period_end)")
            .order("created_at", { ascending: false });
          const { data: items } = await q;
          setColumns(["Employee", "Code", "Period", "Basic", "Gross", "SSS", "PhilHealth", "Pag-IBIG", "Tax", "Net Pay"]);
          setData((items || []).map(i => ({
            Employee: i.employees ? `${i.employees.first_name} ${i.employees.last_name}` : "—",
            Code: i.employees?.employee_code || "—",
            Period: i.payroll_runs ? `${i.payroll_runs.period_start} to ${i.payroll_runs.period_end}` : "—",
            Basic: formatCurrency(i.basic_pay),
            Gross: formatCurrency(i.gross_pay),
            SSS: formatCurrency(i.sss_contribution),
            PhilHealth: formatCurrency(i.philhealth_contribution),
            "Pag-IBIG": formatCurrency(i.pagibig_contribution),
            Tax: formatCurrency(i.withholding_tax),
            "Net Pay": formatCurrency(i.net_pay),
          })));
          break;
        }
        case "tardiness": {
          let q = supabase.from("attendance")
            .select("*, employees(first_name, last_name, employee_code)")
            .gt("late_minutes", 0).order("date", { ascending: false });
          if (dateFrom) q = q.gte("date", dateFrom);
          if (dateTo) q = q.lte("date", dateTo);
          const { data: records } = await q;
          setColumns(["Employee", "Code", "Date", "Time In", "Late Minutes"]);
          setData((records || []).map(r => ({
            Employee: r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : "—",
            Code: r.employees?.employee_code || "—",
            Date: r.date,
            "Time In": r.time_in ? new Date(r.time_in).toLocaleTimeString() : "—",
            "Late Minutes": r.late_minutes,
          })));
          break;
        }
        case "loans": {
          const { data: loans } = await supabase.from("loans")
            .select("*, employees(first_name, last_name, employee_code)")
            .order("created_at", { ascending: false });
          setColumns(["Employee", "Type", "Principal", "Monthly", "Paid", "Balance", "Status"]);
          setData((loans || []).map(l => ({
            Employee: l.employees ? `${l.employees.first_name} ${l.employees.last_name}` : "—",
            Type: l.loan_type,
            Principal: formatCurrency(l.principal_amount),
            Monthly: formatCurrency(l.monthly_amortization),
            Paid: formatCurrency(l.total_paid),
            Balance: formatCurrency(l.remaining_balance),
            Status: l.status,
          })));
          break;
        }
        case "contributions": {
          const { data: items } = await supabase.from("payroll_items")
            .select("employee_id, sss_contribution, philhealth_contribution, pagibig_contribution, withholding_tax, employees(first_name, last_name, employee_code)")
            .order("created_at", { ascending: false });
          setColumns(["Employee", "SSS", "PhilHealth", "Pag-IBIG", "Tax"]);
          setData((items || []).map(i => ({
            Employee: i.employees ? `${i.employees.first_name} ${i.employees.last_name}` : "—",
            SSS: formatCurrency(i.sss_contribution),
            PhilHealth: formatCurrency(i.philhealth_contribution),
            "Pag-IBIG": formatCurrency(i.pagibig_contribution),
            Tax: formatCurrency(i.withholding_tax),
          })));
          break;
        }
        case "anniversary": {
          const { data: emps } = await supabase.from("employees")
            .select("first_name, last_name, employee_code, hire_date")
            .eq("employment_status", "active")
            .order("hire_date");
          const now = new Date();
          setColumns(["Employee", "Code", "Hire Date", "Years of Service"]);
          setData((emps || []).map(e => {
            const years = Math.floor((now.getTime() - new Date(e.hire_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
            return { Employee: `${e.first_name} ${e.last_name}`, Code: e.employee_code, "Hire Date": e.hire_date, "Years of Service": years };
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
    const csv = [columns.join(","), ...data.map(row => columns.map(c => `"${row[c] || ""}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-description">Generate and export payroll reports</p>
      </div>

      <div className="stat-card mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-64">
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger><SelectValue placeholder="Select report type" /></SelectTrigger>
              <SelectContent>
                {reportTypes.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-44" placeholder="From" />
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-44" placeholder="To" />
          <Button onClick={generateReport} disabled={loading}>
            <FileText className="w-4 h-4 mr-2" />{loading ? "Generating..." : "Generate"}
          </Button>
          {data.length > 0 && (
            <Button variant="outline" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-2" />Export CSV
            </Button>
          )}
        </div>
      </div>

      {data.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
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
