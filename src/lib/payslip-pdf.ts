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

// jsPDF's built-in helvetica font lacks the ₱ (U+20B1) glyph.
// Use "PHP " prefix so amounts always render in the exported PDF.
function peso(n: number): string {
  const v = Number(n) || 0;
  return "₱" + new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

export function generatePayslipsPDF(payslips: PayslipData[]): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PAGE_W = 210;
  const slipsPerPage = 2;
  const slipHeight = 140;

  payslips.forEach((p, index) => {
    if (index > 0 && index % slipsPerPage === 0) doc.addPage();
    const y = (index % slipsPerPage) * slipHeight + 12;

    const grossPay = p.grossPay ?? p.totalTaxable;
    const tax = p.withholdingTax ?? Math.max(
      0,
      p.totalDeductions - (p.sss + p.phic + p.hdmf + (p.cashAdvance || 0) + (p.otherDeductions || 0))
    );

    // ── Header ──
    doc.setFont("helvetica", "bold").setFontSize(14);
    doc.text(p.companyName, PAGE_W / 2, y, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(10);
    doc.text("PAYSLIP", PAGE_W / 2, y + 5, { align: "center" });

    // ── Meta ──
    doc.setFontSize(9);
    doc.text(`Payroll Period: ${p.periodStart} - ${p.periodEnd}`, 15, y + 12);
    doc.text(`Payment Date: ${p.paymentDate}`, 15, y + 17);
    doc.text(`Employee ID: ${p.employeeCode}`, 115, y + 12);
    doc.text(`Department: ${p.department}`, 115, y + 17);
    doc.setFont("helvetica", "bold");
    doc.text(`Employee: ${p.employeeName}`, 15, y + 22);
    doc.setFont("helvetica", "normal");

    // Divider
    doc.setDrawColor(180);
    doc.line(15, y + 25, 195, y + 25);

    // ── Two columns: EARNINGS (left) / DEDUCTIONS (right) ──
    const leftX = 15;
    const leftAmtX = 95;
    const rightX = 110;
    const rightAmtX = 195;
    let ly = y + 32;
    let ry = y + 32;

    // EARNINGS header
    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.text("EARNINGS", leftX, ly);
    doc.text("DEDUCTIONS", rightX, ry);
    ly += 6; ry += 6;
    doc.setFont("helvetica", "normal").setFontSize(9);

    const earnings: Array<[string, number]> = [
      ["Basic Salary", p.basicSalary],
      ["Daily Rate", p.dailyRate || 0],
      [`No. of days worked: ${p.daysWorked}`, 0], // The value is 0 here so we format differently later or just leave it
    ];
    if (p.holidayPay) earnings.push(["Holiday Pay", p.holidayPay]);
    if (p.riceAllowance) earnings.push(["Rice Allowance", p.riceAllowance]);
    if (p.riceAllowance2) earnings.push(["Rice Allowance 2", p.riceAllowance2]);
    if (p.totalNonTaxable && !p.riceAllowance && !p.riceAllowance2) {
      earnings.push(["Non-Taxable Allowances", p.totalNonTaxable]);
    }
    for (const [label, amount] of earnings) {
      doc.text(label, leftX, ly);
      if (label.startsWith("No. of days worked")) {
         // Just the text
      } else {
         doc.text(peso(amount), leftAmtX, ly, { align: "right" });
      }
      ly += 5;
    }

    const deductions: Array<[string, number]> = [
      ["SSS Contribution", p.sss],
      ["PhilHealth Contribution", p.phic],
      ["Pag-IBIG (HDMF) Contribution", p.hdmf],
      ["Withholding Tax", tax],
    ];
    if (p.cashAdvance) deductions.push(["Cash Advance / Loan", p.cashAdvance]);
    if (p.otherDeductions) deductions.push(["Other Deductions", p.otherDeductions]);
    for (const [label, amount] of deductions) {
      doc.text(label, rightX, ry);
      doc.text(peso(amount), rightAmtX, ry, { align: "right" });
      ry += 5;
    }

    // ── Subtotals ──
    const subY = Math.max(ly, ry) + 2;
    doc.setDrawColor(200);
    doc.line(leftX, subY, leftAmtX, subY);
    doc.line(rightX, subY, rightAmtX, subY);

    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.text("GROSS PAY", leftX, subY + 5);
    doc.text(peso(grossPay), leftAmtX, subY + 5, { align: "right" });
    doc.text("TOTAL DEDUCTIONS", rightX, subY + 5);
    doc.text(peso(p.totalDeductions), rightAmtX, subY + 5, { align: "right" });

    // ── NET PAY band ──
    const netY = subY + 12;
    doc.setFillColor(15, 52, 96);
    doc.rect(15, netY, 180, 11, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold").setFontSize(12);
    doc.text("NET PAY", 20, netY + 7.5);
    doc.text(peso(Math.max(0, p.netPay)), 190, netY + 7.5, { align: "right" });
    doc.setTextColor(0, 0, 0);

    // ── Footer summary ──
    const footY = netY + 17;
    doc.setFont("helvetica", "normal").setFontSize(8);
    doc.text(`Days Worked: ${p.daysWorked}    Hours: ${p.hoursWorked.toFixed(2)}`, 15, footY);
    doc.text(`Daily Rate: ${peso(p.dailyRate || 0)}`, 115, footY);

    // Signatures
    const sigY = footY + 10;
    doc.setFontSize(8);
    doc.line(20, sigY + 6, 75, sigY + 6);
    doc.text("Prepared By", 47.5, sigY + 10, { align: "center" });
    doc.line(85, sigY + 6, 135, sigY + 6);
    doc.text("Approved By", 110, sigY + 10, { align: "center" });
    doc.line(145, sigY + 6, 195, sigY + 6);
    doc.text("Received By (Employee)", 170, sigY + 10, { align: "center" });

    // Cut line between slips
    if (index % slipsPerPage === 0 && index < payslips.length - 1) {
      doc.setDrawColor(140);
      try { (doc as any).setLineDashPattern([2, 2], 0); } catch {}
      doc.line(10, y + slipHeight - 4, 200, y + slipHeight - 4);
      try { (doc as any).setLineDashPattern([], 0); } catch {}
    }
  });

  return doc;
}
