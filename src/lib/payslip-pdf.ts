import jsPDF from "jspdf";
import { formatCurrency } from "./payroll-utils";

export interface PayslipData {
  companyName: string;
  paymentDate: string;
  periodStart: string;
  periodEnd: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  location?: string;
  bankAccount?: string;
  basicSalary: number;
  daysWorked: number;
  hoursWorked: number;
  straightTime: number;
  holidayPay: number;
  totalTaxable: number;
  hdmf: number;
  phic: number;
  sss: number;
  netTaxable: number;
  otherDeductions: number;
  totalDeductions: number;
  riceAllowance?: number;
  riceAllowance2?: number;
  totalNonTaxable: number;
  netPay: number;
  ytdIncomeTxNtx: number;
  ytdIncomeTx: number;
  ytdIncomeNtx: number;
  ytd13thMonth: number;
  workDetails: { date: string; hours: number }[];
}

function fmt(n: number): string {
  if (!n) return "";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

// Render ONE payslip into the doc at vertical offset y (letter, half-page = ~5.5in)
function renderPayslip(doc: jsPDF, p: PayslipData, y: number) {
  const left = 0.4;
  const width = 7.7;
  const right = left + width;

  // Header
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text(p.companyName, left + width / 2, y + 0.3, { align: "center" });
  doc.setFontSize(10).setFont("helvetica", "normal");
  doc.text("PAYSLIP", left + width / 2, y + 0.5, { align: "center" });

  // Meta row 1
  let ly = y + 0.85;
  doc.setFontSize(8).setFont("helvetica", "bold");
  doc.text("Payment Date:", left, ly);
  doc.setFont("helvetica", "normal").text(p.paymentDate, left + 0.85, ly);
  doc.setFont("helvetica", "bold").text("Payroll Period:", left + 2.8, ly);
  doc.setFont("helvetica", "normal").text(`${p.periodStart} - ${p.periodEnd}`, left + 3.75, ly);
  doc.setFont("helvetica", "bold").text("Bank Account Number:", right - 1.7, ly);
  doc.setFont("helvetica", "normal").text(p.bankAccount || "", right - 0.2, ly, { align: "right" });

  ly += 0.18;
  doc.setFont("helvetica", "bold").text("Employee ID:", left, ly);
  doc.setFont("helvetica", "normal").text(p.employeeCode, left + 0.85, ly);
  doc.setFont("helvetica", "bold").text("Location:", left + 2.8, ly);
  doc.setFont("helvetica", "normal").text(p.location || "Office", left + 3.5, ly);

  ly += 0.18;
  doc.setFont("helvetica", "bold").text("Employee Name:", left, ly);
  doc.setFont("helvetica", "bold").setFontSize(9).text(p.employeeName.toUpperCase(), left + 1.05, ly);
  doc.setFontSize(8).setFont("helvetica", "bold").text("Department:", left + 2.8, ly);
  doc.setFont("helvetica", "normal").text(p.department.toUpperCase(), left + 3.55, ly);

  // Divider
  ly += 0.12;
  doc.setLineWidth(0.01).line(left, ly, right, ly);

  // Two-column body + work-detail table on right
  const bodyY = ly + 0.18;
  const colA = left;
  const colB = left + 2.9;
  const wdX = left + 5.5;
  const wdW = 2.2;

  // Column A header
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("Description", colA, bodyY);
  doc.text("Hours", colA + 1.5, bodyY, { align: "right" });
  doc.text("Amount", colA + 2.5, bodyY, { align: "right" });
  doc.text("Description", colB, bodyY);
  doc.text("Amount", colB + 2.4, bodyY, { align: "right" });
  doc.text("WORK DETAIL COSTING", wdX + wdW / 2, bodyY, { align: "center" });

  // Underline headers (col A only & B only)
  doc.line(colA, bodyY + 0.04, colA + 2.6, bodyY + 0.04);
  doc.line(colB, bodyY + 0.04, colB + 2.4, bodyY + 0.04);
  // Work detail table box
  doc.rect(wdX, bodyY + 0.08, wdW, 2.4);
  doc.line(wdX + wdW / 2, bodyY + 0.08, wdX + wdW / 2, bodyY + 0.08 + 2.4);
  doc.setFont("helvetica", "bold").text("Date", wdX + wdW / 4, bodyY + 0.22, { align: "center" });
  doc.text("ST", wdX + (3 * wdW) / 4, bodyY + 0.22, { align: "center" });
  doc.line(wdX, bodyY + 0.26, wdX + wdW, bodyY + 0.26);

  // Column A content
  doc.setFont("helvetica", "normal");
  let ay = bodyY + 0.2;
  doc.text(`Basic Salary - (${fmt(p.basicSalary)})`, colA, ay);
  ay += 0.16;
  doc.setFont("helvetica", "bold").text("TAXABLE INCOME", colA, ay);
  ay += 0.15;
  doc.setFont("helvetica", "normal");
  doc.text("Straight Time", colA + 0.1, ay);
  doc.text(fmt(p.straightTime), colA + 2.5, ay, { align: "right" });
  ay += 0.14;
  doc.text("Holiday Pay", colA + 0.1, ay);
  doc.text(`${p.hoursWorked.toFixed(2)} hr(s)`, colA + 1.5, ay, { align: "right" });
  doc.text(fmt(p.holidayPay), colA + 2.5, ay, { align: "right" });
  ay += 0.16;
  doc.setFont("helvetica", "bold").text("TOTAL TAXABLE INCOME", colA, ay);
  doc.text(fmt(p.totalTaxable), colA + 2.5, ay, { align: "right" });
  ay += 0.16;
  doc.text("LESS", colA, ay);
  ay += 0.14;
  doc.setFont("helvetica", "normal");
  doc.text("HDMF", colA + 0.1, ay); doc.text(fmt(p.hdmf), colA + 2.5, ay, { align: "right" }); ay += 0.14;
  doc.text("PHIC", colA + 0.1, ay); doc.text(fmt(p.phic), colA + 2.5, ay, { align: "right" }); ay += 0.14;
  doc.text("SSS", colA + 0.1, ay); doc.text(fmt(p.sss), colA + 2.5, ay, { align: "right" }); ay += 0.18;
  doc.setFont("helvetica", "bold").text("NET TAXABLE INCOME", colA, ay);
  doc.text(fmt(p.netTaxable), colA + 2.5, ay, { align: "right" });

  // Column B content
  let by = bodyY + 0.2;
  doc.setFont("helvetica", "bold").text("DEDUCTIONS", colB, by); by += 0.14;
  doc.setFont("helvetica", "normal").text("   Other Deductions", colB, by); by += 0.14;
  doc.setFont("helvetica", "bold").text("TOTAL DEDUCTIONS", colB, by);
  doc.text(fmt(p.totalDeductions), colB + 2.4, by, { align: "right" });
  by += 0.16;
  doc.setFont("helvetica", "bold").text("ADD", colB, by); by += 0.14;
  doc.setFont("helvetica", "normal");
  if (p.riceAllowance) { doc.text("   Rice Allowance", colB, by); doc.text(fmt(p.riceAllowance), colB + 2.4, by, { align: "right" }); by += 0.14; }
  if (p.riceAllowance2) { doc.text("   Rice Allowance 2", colB, by); doc.text(fmt(p.riceAllowance2), colB + 2.4, by, { align: "right" }); by += 0.14; }
  doc.setFont("helvetica", "bold").text("TOTAL NON-TAXABLE INCOME", colB, by);
  doc.text(fmt(p.totalNonTaxable), colB + 2.4, by, { align: "right" });
  by += 0.18;
  doc.setFont("helvetica", "bold").text("NET TAXABLE & NON-TAXABLE", colB, by); by += 0.12;
  doc.text("INCOME", colB, by);
  doc.text(fmt(p.netTaxable + p.totalNonTaxable), colB + 2.4, by, { align: "right" });
  by += 0.2;
  doc.setFontSize(10).text("NET PAY", colB, by);
  doc.text(fmt(p.netPay), colB + 2.4, by, { align: "right" });
  by += 0.2;
  doc.setFontSize(7).setFont("helvetica", "normal");
  doc.text("YTD Income (TX + NTX)", colB, by); doc.text(fmt(p.ytdIncomeTxNtx), colB + 2.4, by, { align: "right" }); by += 0.12;
  doc.text("YTD Income (TX)", colB, by); doc.text(fmt(p.ytdIncomeTx), colB + 2.4, by, { align: "right" }); by += 0.12;
  doc.text("YTD Income (NTX)", colB, by); doc.text(fmt(p.ytdIncomeNtx), colB + 2.4, by, { align: "right" }); by += 0.12;
  doc.text("YTD 13th month", colB, by); doc.text(fmt(p.ytd13thMonth), colB + 2.4, by, { align: "right" });

  // Work detail rows
  doc.setFontSize(7).setFont("helvetica", "normal");
  let wdY = bodyY + 0.38;
  let totalST = 0;
  for (const w of p.workDetails.slice(0, 16)) {
    doc.text(w.date, wdX + wdW / 4, wdY, { align: "center" });
    doc.text(w.hours.toFixed(2), wdX + (3 * wdW) / 4, wdY, { align: "center" });
    totalST += w.hours;
    wdY += 0.13;
  }
  // Total row
  doc.line(wdX, bodyY + 0.08 + 2.4 - 0.18, wdX + wdW, bodyY + 0.08 + 2.4 - 0.18);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL:", wdX + 0.1, bodyY + 0.08 + 2.4 - 0.05);
  doc.text(totalST.toFixed(2), wdX + wdW - 0.1, bodyY + 0.08 + 2.4 - 0.05, { align: "right" });
}

export function generatePayslipsPDF(payslips: PayslipData[]): jsPDF {
  // Letter portrait: 8.5 x 11. Two payslips per page (top + bottom).
  const doc = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });
  for (let i = 0; i < payslips.length; i++) {
    const slotOnPage = i % 2;
    if (i > 0 && slotOnPage === 0) doc.addPage();
    const y = slotOnPage === 0 ? 0.3 : 5.6;
    renderPayslip(doc, payslips[i], y);
    // Cut line between slots
    if (slotOnPage === 0) {
      doc.setLineDashPattern([0.05, 0.05], 0);
      doc.line(0.3, 5.5, 8.2, 5.5);
      doc.setLineDashPattern([], 0);
    }
  }
  return doc;
}
