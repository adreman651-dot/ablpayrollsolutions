// Philippine Payroll Computation Utilities (2025 Rates)

export const WORKING_DAYS_PER_MONTH = 26;
export const WORKING_HOURS_PER_DAY = 8;

export function computeDailyRate(basicSalary: number): number {
  return basicSalary / WORKING_DAYS_PER_MONTH;
}

export function computeHourlyRate(basicSalary: number): number {
  return computeDailyRate(basicSalary) / WORKING_HOURS_PER_DAY;
}

export function computeLateDeduction(lateMinutes: number, basicSalary: number): number {
  return (lateMinutes / 60) * computeHourlyRate(basicSalary);
}

export function computeAbsenceDeduction(absences: number, basicSalary: number): number {
  return absences * computeDailyRate(basicSalary);
}

// SSS 2025: 14% total (4.5% EE, 9.5% ER), MSC range 4000–30000
function roundToNearestMSC(salary: number): number {
  if (salary < 4000) return 4000;
  if (salary > 30000) return 30000;
  return Math.round(salary / 500) * 500;
}

export function computeSSS(monthlySalary: number): { employee: number; employer: number } {
  const msc = roundToNearestMSC(monthlySalary);
  return {
    employee: parseFloat((msc * 0.045).toFixed(2)),
    employer: parseFloat((msc * 0.095).toFixed(2)),
  };
}

// PhilHealth 2025: 5% premium rate, cap at 100,000
export function computePhilHealth(monthlySalary: number): { employee: number; employer: number } {
  const base = Math.min(monthlySalary, 100000);
  const total = base * 0.05;
  return {
    employee: parseFloat((total / 2).toFixed(2)),
    employer: parseFloat((total / 2).toFixed(2)),
  };
}

// Pag-IBIG: EE 1% if ≤1500, else 2% capped at 100; ER matches
export function computePagIBIG(monthlySalary: number): { employee: number; employer: number } {
  let ee: number;
  if (monthlySalary <= 1500) {
    ee = monthlySalary * 0.01;
  } else {
    ee = Math.min(monthlySalary * 0.02, 100);
  }
  const er = Math.min(monthlySalary <= 1500 ? monthlySalary * 0.02 : monthlySalary * 0.02, 100);
  return {
    employee: parseFloat(ee.toFixed(2)),
    employer: parseFloat(er.toFixed(2)),
  };
}

// TRAIN Law 2025 Withholding Tax (annual-based, returned as monthly)
export function computeWithholdingTax(monthlyTaxableIncome: number): number {
  const annual = monthlyTaxableIncome * 12;
  let annualTax = 0;

  if (annual <= 250000) {
    annualTax = 0;
  } else if (annual <= 400000) {
    annualTax = (annual - 250000) * 0.15;
  } else if (annual <= 800000) {
    annualTax = 22500 + (annual - 400000) * 0.20;
  } else if (annual <= 2000000) {
    annualTax = 102500 + (annual - 800000) * 0.25;
  } else if (annual <= 8000000) {
    annualTax = 402500 + (annual - 2000000) * 0.30;
  } else {
    annualTax = 2202500 + (annual - 8000000) * 0.35;
  }

  return parseFloat((annualTax / 12).toFixed(2));
}

export function compute13thMonthPay(totalBasicEarned: number): number {
  return totalBasicEarned / 12;
}

export function computeGrossPay(params: {
  basicPay: number;
  overtimePay: number;
  holidayPay: number;
  allowances: number;
}): number {
  return params.basicPay + params.overtimePay + params.holidayPay + params.allowances;
}

export function computeNetPay(grossPay: number, totalDeductions: number): number {
  return grossPay - totalDeductions;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

// Compute all government deductions at once
export function computeAllDeductions(monthlySalary: number) {
  const sss = computeSSS(monthlySalary);
  const philhealth = computePhilHealth(monthlySalary);
  const pagibig = computePagIBIG(monthlySalary);
  const taxableIncome = monthlySalary - sss.employee - philhealth.employee - pagibig.employee;
  const withholdingTax = computeWithholdingTax(taxableIncome);
  
  return {
    sss,
    philhealth,
    pagibig,
    withholdingTax,
    totalEmployeeDeductions: parseFloat(
      (sss.employee + philhealth.employee + pagibig.employee + withholdingTax).toFixed(2)
    ),
    totalEmployerContributions: parseFloat(
      (sss.employer + philhealth.employer + pagibig.employer).toFixed(2)
    ),
  };
}
