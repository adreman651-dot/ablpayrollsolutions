import * as XLSX from "xlsx";

export interface PayrollRowExport {
  employee_id: string;
  employee_name: string;
  time_in: string;
  time_out: string;
  days_worked: number;
  leave_days: number;
  basic_monthly_rate: number;
  basic_daily_rate: number;
  gross_income: number;
  sss: number;
  philhealth: number;
  hdmf: number;
  tax: number;
  cash_advance: number;
  other_deductions: number;
  net_pay: number;
}

export function exportPayrollExcel(rows: PayrollRowExport[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
    "Employee ID": r.employee_id,
    "Employee Name": r.employee_name,
    "Time In": r.time_in,
    "Time Out": r.time_out,
    "Days Worked": r.days_worked,
    "Leave Days": r.leave_days,
    "Basic Monthly Rate": r.basic_monthly_rate,
    "Basic Daily Rate": r.basic_daily_rate,
    "Gross Income": r.gross_income,
    "SSS": r.sss,
    "PhilHealth": r.philhealth,
    "HDMF": r.hdmf,
    "Tax": r.tax,
    "Cash Advance": r.cash_advance,
    "Other Deductions": r.other_deductions,
    "Net Pay": r.net_pay,
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payroll");
  XLSX.writeFile(wb, filename);
}
