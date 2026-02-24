// Philippine Payroll Computation Utilities

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

// SSS Contribution Table (2024 schedule)
const SSS_TABLE: { min: number; max: number; ee: number; er: number }[] = [
  { min: 0, max: 4249.99, ee: 180, er: 390 },
  { min: 4250, max: 4749.99, ee: 202.50, er: 437.50 },
  { min: 4750, max: 5249.99, ee: 225, er: 485 },
  { min: 5250, max: 5749.99, ee: 247.50, er: 532.50 },
  { min: 5750, max: 6249.99, ee: 270, er: 580 },
  { min: 6250, max: 6749.99, ee: 292.50, er: 627.50 },
  { min: 6750, max: 7249.99, ee: 315, er: 675 },
  { min: 7250, max: 7749.99, ee: 337.50, er: 722.50 },
  { min: 7750, max: 8249.99, ee: 360, er: 770 },
  { min: 8250, max: 8749.99, ee: 382.50, er: 817.50 },
  { min: 8750, max: 9249.99, ee: 405, er: 865 },
  { min: 9250, max: 9749.99, ee: 427.50, er: 912.50 },
  { min: 9750, max: 10249.99, ee: 450, er: 960 },
  { min: 10250, max: 10749.99, ee: 472.50, er: 1007.50 },
  { min: 10750, max: 11249.99, ee: 495, er: 1055 },
  { min: 11250, max: 11749.99, ee: 517.50, er: 1102.50 },
  { min: 11750, max: 12249.99, ee: 540, er: 1150 },
  { min: 12250, max: 12749.99, ee: 562.50, er: 1197.50 },
  { min: 12750, max: 13249.99, ee: 585, er: 1245 },
  { min: 13250, max: 13749.99, ee: 607.50, er: 1292.50 },
  { min: 13750, max: 14249.99, ee: 630, er: 1340 },
  { min: 14250, max: 14749.99, ee: 652.50, er: 1387.50 },
  { min: 14750, max: 15249.99, ee: 675, er: 1435 },
  { min: 15250, max: 15749.99, ee: 697.50, er: 1482.50 },
  { min: 15750, max: 16249.99, ee: 720, er: 1530 },
  { min: 16250, max: 16749.99, ee: 742.50, er: 1577.50 },
  { min: 16750, max: 17249.99, ee: 765, er: 1625 },
  { min: 17250, max: 17749.99, ee: 787.50, er: 1672.50 },
  { min: 17750, max: 18249.99, ee: 810, er: 1720 },
  { min: 18250, max: 18749.99, ee: 832.50, er: 1767.50 },
  { min: 18750, max: 19249.99, ee: 855, er: 1815 },
  { min: 19250, max: 19749.99, ee: 877.50, er: 1862.50 },
  { min: 19750, max: 20249.99, ee: 900, er: 1910 },
  { min: 20250, max: 24749.99, ee: 1125, er: 2375 },
  { min: 24750, max: 29249.99, ee: 1350, er: 2850 },
  { min: 29250, max: 99999999, ee: 1350, er: 2850 },
];

export function computeSSS(monthlySalary: number): { employee: number; employer: number } {
  const bracket = SSS_TABLE.find(b => monthlySalary >= b.min && monthlySalary <= b.max);
  if (!bracket) return { employee: 1350, employer: 2850 };
  return { employee: bracket.ee, employer: bracket.er };
}

export function computePhilHealth(monthlySalary: number): { employee: number; employer: number } {
  const rate = 0.05;
  const cap = 100000;
  const base = Math.min(monthlySalary, cap);
  const total = base * rate;
  return { employee: total / 2, employer: total / 2 };
}

export function computePagIBIG(monthlySalary: number): { employee: number; employer: number } {
  if (monthlySalary <= 1500) {
    return { employee: monthlySalary * 0.01, employer: monthlySalary * 0.02 };
  }
  const eeCap = Math.min(monthlySalary * 0.02, 200);
  return { employee: eeCap, employer: Math.min(monthlySalary * 0.02, 200) };
}

// Simplified TRAIN law withholding tax (monthly)
export function computeWithholdingTax(taxableIncome: number): number {
  if (taxableIncome <= 20833) return 0;
  if (taxableIncome <= 33333) return (taxableIncome - 20833) * 0.15;
  if (taxableIncome <= 66667) return 1875 + (taxableIncome - 33333) * 0.20;
  if (taxableIncome <= 166667) return 8541.80 + (taxableIncome - 66667) * 0.25;
  if (taxableIncome <= 666667) return 33541.80 + (taxableIncome - 166667) * 0.30;
  return 183541.80 + (taxableIncome - 666667) * 0.35;
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
