import jsPDF from "jspdf";

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
  dailyRate?: number;
  daysWorked: number;
  hoursWorked: number;
  straightTime: number;
  holidayPay: number;
  totalTaxable: number;
  hdmf: number;
  phic: number;
  sss: number;
  netTaxable: number;
  cashAdvance?: number;
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
  // optional extras
  withholdingTax?: number;
  grossPay?: number;
}

// jsPDF's built-in Helvetica cannot render ₱ (U+20B1).
// Use "PHP " prefix so amounts always render correctly in the exported PDF.
function peso(n: number): string {
  const v = Number(n) || 0;
  return "PHP " + new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

// Draw a single payslip copy at a given Y offset (in mm)
function drawSlip(
  doc: jsPDF,
  p: PayslipData,
  yStart: number,
  copyLabel: string,
  slipHeight: number
) {
  const PAGE_W = 215.9; // Letter width in mm
  const leftX = 12;
  const rightX = 112;
  const leftAmtX = 102;
  const rightAmtX = 203;

  const grossPay = p.grossPay ?? p.totalTaxable;
  const tax = p.withholdingTax ?? 0;
  const dailyRate = p.dailyRate || 0;

  let y = yStart;

  // ── Copy Label Banner ──────────────────────────────────────────────
  doc.setFillColor(230, 230, 230);
  doc.rect(leftX, y, PAGE_W - 24, 5, "F");
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(80, 80, 80);
  doc.text(copyLabel, PAGE_W / 2, y + 3.5, { align: "center" });
  y += 7;

  // ── Header ──────────────────────────────────────────────────────────
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold").setFontSize(13);
  doc.text(p.companyName, PAGE_W / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text("PAYSLIP", PAGE_W / 2, y, { align: "center" });
  y += 7;

  // ── Meta Grid ───────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.text(`Payroll Period: ${p.periodStart} to ${p.periodEnd}`, leftX, y);
  doc.text(`Payment Date: ${p.paymentDate}`, rightX, y);
  y += 5;
  doc.text(`Employee Code: ${p.employeeCode}`, leftX, y);
  doc.text(`Department: ${p.department}`, rightX, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text(`Employee: ${p.employeeName}`, leftX, y);
  doc.setFont("helvetica", "normal");
  y += 4;

  // ── Divider ──────────────────────────────────────────────────────────
  doc.setDrawColor(120, 120, 120);
  doc.line(leftX, y, PAGE_W - 12, y);
  y += 5;

  // ── Column Headers ───────────────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("EARNINGS", leftX, y);
  doc.text("DEDUCTIONS", rightX, y);
  y += 5;
  doc.setFont("helvetica", "normal").setFontSize(8);

  // ── Build Rows ──────────────────────────────────────────────────────
  const earnings: Array<[string, number | null, boolean]> = [
    [`No. of Days Worked: ${p.daysWorked}`, null, false],
    [`Daily Rate`, dailyRate, true],
    [`Basic Pay (${p.daysWorked} days × ${peso(dailyRate)})`, grossPay, true],
  ];
  if (p.holidayPay > 0) earnings.push(["Holiday Pay", p.holidayPay, true]);
  if (p.riceAllowance && p.riceAllowance > 0) earnings.push(["Rice Allowance", p.riceAllowance, true]);
  if (p.riceAllowance2 && p.riceAllowance2 > 0) earnings.push(["Rice Allowance 2", p.riceAllowance2, true]);
  if (p.totalNonTaxable > 0 && !p.riceAllowance && !p.riceAllowance2) {
    earnings.push(["Non-Taxable Allowances", p.totalNonTaxable, true]);
  }

  const deductions: Array<[string, number]> = [];
  if (p.sss > 0)  deductions.push(["SSS Contribution", p.sss]);
  if (p.phic > 0) deductions.push(["PhilHealth (PHIC)", p.phic]);
  if (p.hdmf > 0) deductions.push(["Pag-IBIG (HDMF)", p.hdmf]);
  if (tax > 0)    deductions.push(["Withholding Tax", tax]);
  if ((p.cashAdvance || 0) > 0) deductions.push(["Cash Advance / Loan", p.cashAdvance!]);
  if (p.otherDeductions > 0) deductions.push(["Other Deductions", p.otherDeductions]);

  const startY = y;
  let ly = startY;
  let ry = startY;

  for (const [label, amount, showAmt] of earnings) {
    doc.text(label, leftX, ly);
    if (showAmt && amount !== null) {
      doc.text(peso(amount), leftAmtX, ly, { align: "right" });
    }
    ly += 5;
  }

  for (const [label, amount] of deductions) {
    doc.text(label, rightX, ry);
    doc.text(peso(amount), rightAmtX, ry, { align: "right" });
    ry += 5;
  }

  // ── Subtotal Lines ───────────────────────────────────────────────────
  const subY = Math.max(ly, ry) + 2;
  doc.setDrawColor(180, 180, 180);
  doc.line(leftX, subY, leftAmtX, subY);
  doc.line(rightX, subY, rightAmtX, subY);

  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("GROSS PAY", leftX, subY + 5);
  doc.text(peso(grossPay), leftAmtX, subY + 5, { align: "right" });
  doc.text("TOTAL DEDUCTIONS", rightX, subY + 5);
  doc.text(peso(p.totalDeductions), rightAmtX, subY + 5, { align: "right" });

  // ── NET PAY band ─────────────────────────────────────────────────────
  const netY = subY + 10;
  doc.setFillColor(15, 52, 96);
  doc.rect(leftX, netY, PAGE_W - 24, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("NET PAY", leftX + 4, netY + 7);
  doc.text(peso(Math.max(0, p.netPay)), rightAmtX, netY + 7, { align: "right" });
  doc.setTextColor(0, 0, 0);

  // ── Signatures ───────────────────────────────────────────────────────
  const sigY = netY + 17;
  doc.setFont("helvetica", "normal").setFontSize(7);
  doc.setDrawColor(100, 100, 100);
  doc.line(leftX, sigY + 5, leftX + 50, sigY + 5);
  doc.text("Prepared By", leftX + 25, sigY + 9, { align: "center" });
  doc.line(leftX + 60, sigY + 5, leftX + 110, sigY + 5);
  doc.text("Approved By", leftX + 85, sigY + 9, { align: "center" });
  doc.line(leftX + 120, sigY + 5, leftX + 180, sigY + 5);
  doc.text("Received By (Employee Signature over Printed Name)", leftX + 150, sigY + 9, { align: "center" });
}

export function generatePayslipsPDF(payslips: PayslipData[]): jsPDF {
  // Letter: 215.9 mm x 279.4 mm
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const PAGE_H = 279.4;
  const SLIP_H = (PAGE_H / 2) - 4; // half-page height with small margin

  payslips.forEach((p, index) => {
    if (index > 0) doc.addPage();

    // ── TOP HALF: HR COPY ─────────────────────────────────────────────
    drawSlip(doc, p, 4, "HR COPY", SLIP_H);

    // ── CUT LINE ─────────────────────────────────────────────────────
    const cutY = PAGE_H / 2;
    doc.setDrawColor(100, 100, 100);
    doc.setLineDashPattern([3, 2], 0);
    doc.line(6, cutY, 210, cutY);
    doc.setLineDashPattern([], 0);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(120, 120, 120);
    doc.text("✂  CUT HERE", 108, cutY - 1, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // ── BOTTOM HALF: EMPLOYEE COPY ────────────────────────────────────
    drawSlip(doc, p, cutY + 3, "EMPLOYEE COPY", SLIP_H);
  });

  return doc;
}
