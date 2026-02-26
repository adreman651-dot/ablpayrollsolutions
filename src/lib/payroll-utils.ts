// Philippine Payroll Computation Utilities (2025–2026 Rates)

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

// ─── SSS Contribution Table 2025–2026 ────────────────────────────────
// Based on official SSS schedule: MSC, ER (10%), EE (5%), EC
export interface SSSBracket {
  msc: number;
  employerShare: number;
  employeeShare: number;
  totalSSS: number;
  ecContribution: number;
  totalEmployer: number;
  totalContribution: number;
}

export const SSS_TABLE: SSSBracket[] = [
  { msc: 5000, employerShare: 500, employeeShare: 250, totalSSS: 750, ecContribution: 10, totalEmployer: 510, totalContribution: 760 },
  { msc: 5500, employerShare: 550, employeeShare: 275, totalSSS: 825, ecContribution: 10, totalEmployer: 560, totalContribution: 835 },
  { msc: 6000, employerShare: 600, employeeShare: 300, totalSSS: 900, ecContribution: 10, totalEmployer: 610, totalContribution: 910 },
  { msc: 6500, employerShare: 650, employeeShare: 325, totalSSS: 975, ecContribution: 10, totalEmployer: 660, totalContribution: 985 },
  { msc: 7000, employerShare: 700, employeeShare: 350, totalSSS: 1050, ecContribution: 10, totalEmployer: 710, totalContribution: 1060 },
  { msc: 7500, employerShare: 750, employeeShare: 375, totalSSS: 1125, ecContribution: 10, totalEmployer: 760, totalContribution: 1135 },
  { msc: 8000, employerShare: 800, employeeShare: 400, totalSSS: 1200, ecContribution: 10, totalEmployer: 810, totalContribution: 1210 },
  { msc: 8500, employerShare: 850, employeeShare: 425, totalSSS: 1275, ecContribution: 10, totalEmployer: 860, totalContribution: 1285 },
  { msc: 9000, employerShare: 900, employeeShare: 450, totalSSS: 1350, ecContribution: 10, totalEmployer: 910, totalContribution: 1360 },
  { msc: 9500, employerShare: 950, employeeShare: 475, totalSSS: 1425, ecContribution: 10, totalEmployer: 960, totalContribution: 1435 },
  { msc: 10000, employerShare: 1000, employeeShare: 500, totalSSS: 1500, ecContribution: 10, totalEmployer: 1010, totalContribution: 1510 },
  { msc: 10500, employerShare: 1050, employeeShare: 525, totalSSS: 1575, ecContribution: 10, totalEmployer: 1060, totalContribution: 1585 },
  { msc: 11000, employerShare: 1100, employeeShare: 550, totalSSS: 1650, ecContribution: 10, totalEmployer: 1110, totalContribution: 1660 },
  { msc: 11500, employerShare: 1150, employeeShare: 575, totalSSS: 1725, ecContribution: 10, totalEmployer: 1160, totalContribution: 1735 },
  { msc: 12000, employerShare: 1200, employeeShare: 600, totalSSS: 1800, ecContribution: 10, totalEmployer: 1210, totalContribution: 1810 },
  { msc: 12500, employerShare: 1250, employeeShare: 625, totalSSS: 1875, ecContribution: 10, totalEmployer: 1260, totalContribution: 1885 },
  { msc: 13000, employerShare: 1300, employeeShare: 650, totalSSS: 1950, ecContribution: 10, totalEmployer: 1310, totalContribution: 1960 },
  { msc: 13500, employerShare: 1350, employeeShare: 675, totalSSS: 2025, ecContribution: 10, totalEmployer: 1360, totalContribution: 2035 },
  { msc: 14000, employerShare: 1400, employeeShare: 700, totalSSS: 2100, ecContribution: 10, totalEmployer: 1410, totalContribution: 2110 },
  { msc: 14500, employerShare: 1450, employeeShare: 725, totalSSS: 2175, ecContribution: 10, totalEmployer: 1460, totalContribution: 2185 },
  { msc: 15000, employerShare: 1500, employeeShare: 750, totalSSS: 2250, ecContribution: 30, totalEmployer: 1530, totalContribution: 2280 },
  { msc: 15500, employerShare: 1550, employeeShare: 775, totalSSS: 2325, ecContribution: 30, totalEmployer: 1580, totalContribution: 2355 },
  { msc: 16000, employerShare: 1600, employeeShare: 800, totalSSS: 2400, ecContribution: 30, totalEmployer: 1630, totalContribution: 2430 },
  { msc: 16500, employerShare: 1650, employeeShare: 825, totalSSS: 2475, ecContribution: 30, totalEmployer: 1680, totalContribution: 2505 },
  { msc: 17000, employerShare: 1700, employeeShare: 850, totalSSS: 2550, ecContribution: 30, totalEmployer: 1730, totalContribution: 2580 },
  { msc: 17500, employerShare: 1750, employeeShare: 875, totalSSS: 2625, ecContribution: 30, totalEmployer: 1780, totalContribution: 2655 },
  { msc: 18000, employerShare: 1800, employeeShare: 900, totalSSS: 2700, ecContribution: 30, totalEmployer: 1830, totalContribution: 2730 },
  { msc: 18500, employerShare: 1850, employeeShare: 925, totalSSS: 2775, ecContribution: 30, totalEmployer: 1880, totalContribution: 2805 },
  { msc: 19000, employerShare: 1900, employeeShare: 950, totalSSS: 2850, ecContribution: 30, totalEmployer: 1930, totalContribution: 2880 },
  { msc: 19500, employerShare: 1950, employeeShare: 975, totalSSS: 2925, ecContribution: 30, totalEmployer: 1980, totalContribution: 2955 },
  { msc: 20000, employerShare: 2000, employeeShare: 1000, totalSSS: 3000, ecContribution: 30, totalEmployer: 2030, totalContribution: 3030 },
  { msc: 20500, employerShare: 2050, employeeShare: 1025, totalSSS: 3075, ecContribution: 30, totalEmployer: 2080, totalContribution: 3105 },
  { msc: 21000, employerShare: 2100, employeeShare: 1050, totalSSS: 3150, ecContribution: 30, totalEmployer: 2130, totalContribution: 3180 },
  { msc: 21500, employerShare: 2150, employeeShare: 1075, totalSSS: 3225, ecContribution: 30, totalEmployer: 2180, totalContribution: 3255 },
  { msc: 22000, employerShare: 2200, employeeShare: 1100, totalSSS: 3300, ecContribution: 30, totalEmployer: 2230, totalContribution: 3330 },
  { msc: 22500, employerShare: 2250, employeeShare: 1125, totalSSS: 3375, ecContribution: 30, totalEmployer: 2280, totalContribution: 3405 },
  { msc: 23000, employerShare: 2300, employeeShare: 1150, totalSSS: 3450, ecContribution: 30, totalEmployer: 2330, totalContribution: 3480 },
  { msc: 23500, employerShare: 2350, employeeShare: 1175, totalSSS: 3525, ecContribution: 30, totalEmployer: 2380, totalContribution: 3555 },
  { msc: 24000, employerShare: 2400, employeeShare: 1200, totalSSS: 3600, ecContribution: 30, totalEmployer: 2430, totalContribution: 3630 },
  { msc: 24500, employerShare: 2450, employeeShare: 1225, totalSSS: 3675, ecContribution: 30, totalEmployer: 2480, totalContribution: 3705 },
  { msc: 25000, employerShare: 2500, employeeShare: 1250, totalSSS: 3750, ecContribution: 30, totalEmployer: 2530, totalContribution: 3780 },
  { msc: 25500, employerShare: 2550, employeeShare: 1275, totalSSS: 3825, ecContribution: 30, totalEmployer: 2580, totalContribution: 3855 },
  { msc: 26000, employerShare: 2600, employeeShare: 1300, totalSSS: 3900, ecContribution: 30, totalEmployer: 2630, totalContribution: 3930 },
  { msc: 26500, employerShare: 2650, employeeShare: 1325, totalSSS: 3975, ecContribution: 30, totalEmployer: 2680, totalContribution: 4005 },
  { msc: 27000, employerShare: 2700, employeeShare: 1350, totalSSS: 4050, ecContribution: 30, totalEmployer: 2730, totalContribution: 4080 },
  { msc: 27500, employerShare: 2750, employeeShare: 1375, totalSSS: 4125, ecContribution: 30, totalEmployer: 2780, totalContribution: 4155 },
  { msc: 28000, employerShare: 2800, employeeShare: 1400, totalSSS: 4200, ecContribution: 30, totalEmployer: 2830, totalContribution: 4230 },
  { msc: 28500, employerShare: 2850, employeeShare: 1425, totalSSS: 4275, ecContribution: 30, totalEmployer: 2880, totalContribution: 4305 },
  { msc: 29000, employerShare: 2900, employeeShare: 1450, totalSSS: 4350, ecContribution: 30, totalEmployer: 2930, totalContribution: 4380 },
  { msc: 29500, employerShare: 2950, employeeShare: 1475, totalSSS: 4425, ecContribution: 30, totalEmployer: 2980, totalContribution: 4455 },
  { msc: 30000, employerShare: 3000, employeeShare: 1500, totalSSS: 4500, ecContribution: 30, totalEmployer: 3030, totalContribution: 4530 },
  { msc: 30500, employerShare: 3050, employeeShare: 1525, totalSSS: 4575, ecContribution: 30, totalEmployer: 3080, totalContribution: 4605 },
  { msc: 31000, employerShare: 3100, employeeShare: 1550, totalSSS: 4650, ecContribution: 30, totalEmployer: 3130, totalContribution: 4680 },
  { msc: 31500, employerShare: 3150, employeeShare: 1575, totalSSS: 4725, ecContribution: 30, totalEmployer: 3180, totalContribution: 4755 },
  { msc: 32000, employerShare: 3200, employeeShare: 1600, totalSSS: 4800, ecContribution: 30, totalEmployer: 3230, totalContribution: 4830 },
  { msc: 32500, employerShare: 3250, employeeShare: 1625, totalSSS: 4875, ecContribution: 30, totalEmployer: 3280, totalContribution: 4905 },
  { msc: 33000, employerShare: 3300, employeeShare: 1650, totalSSS: 4950, ecContribution: 30, totalEmployer: 3330, totalContribution: 4980 },
  { msc: 33500, employerShare: 3350, employeeShare: 1675, totalSSS: 5025, ecContribution: 30, totalEmployer: 3380, totalContribution: 5055 },
  { msc: 34000, employerShare: 3400, employeeShare: 1700, totalSSS: 5100, ecContribution: 30, totalEmployer: 3430, totalContribution: 5130 },
  { msc: 34500, employerShare: 3450, employeeShare: 1725, totalSSS: 5175, ecContribution: 30, totalEmployer: 3480, totalContribution: 5205 },
  { msc: 35000, employerShare: 3500, employeeShare: 1750, totalSSS: 5250, ecContribution: 30, totalEmployer: 3530, totalContribution: 5280 },
];

// Find the SSS bracket by matching salary to nearest MSC
function findSSSBracket(monthlySalary: number): SSSBracket {
  if (monthlySalary <= SSS_TABLE[0].msc) return SSS_TABLE[0];
  if (monthlySalary >= SSS_TABLE[SSS_TABLE.length - 1].msc) return SSS_TABLE[SSS_TABLE.length - 1];

  // Round salary to nearest 500 to find MSC
  const roundedMSC = Math.round(monthlySalary / 500) * 500;
  const bracket = SSS_TABLE.find(b => b.msc === roundedMSC);
  if (bracket) return bracket;

  // Fallback: find closest bracket
  let closest = SSS_TABLE[0];
  let minDiff = Math.abs(monthlySalary - closest.msc);
  for (const b of SSS_TABLE) {
    const diff = Math.abs(monthlySalary - b.msc);
    if (diff < minDiff) { closest = b; minDiff = diff; }
  }
  return closest;
}

export function computeSSS(monthlySalary: number): { employee: number; employer: number; ec: number } {
  const bracket = findSSSBracket(monthlySalary);
  return {
    employee: bracket.employeeShare,
    employer: bracket.employerShare,
    ec: bracket.ecContribution,
  };
}

// ─── PhilHealth 2025–2026 ────────────────────────────────────────────
// 5% premium rate, floor ₱10,000, ceiling ₱100,000, split 50/50
export const PHILHEALTH_RATE = 0.05;
export const PHILHEALTH_FLOOR = 10000;
export const PHILHEALTH_CEILING = 100000;

export function computePhilHealth(monthlySalary: number): { employee: number; employer: number } {
  const base = Math.max(Math.min(monthlySalary, PHILHEALTH_CEILING), PHILHEALTH_FLOOR);
  const total = base * PHILHEALTH_RATE;
  return {
    employee: parseFloat((total / 2).toFixed(2)),
    employer: parseFloat((total / 2).toFixed(2)),
  };
}

// ─── Pag-IBIG ────────────────────────────────────────────────────────
// Default rates (fallback if settings not loaded)
export const PAGIBIG_DEFAULT_EMPLOYEE = 400;
export const PAGIBIG_DEFAULT_EMPLOYER = 400;

export function computePagIBIG(
  _monthlySalary: number,
  overrides?: { employee: number; employer: number }
): { employee: number; employer: number } {
  if (overrides) {
    return {
      employee: overrides.employee,
      employer: overrides.employer,
    };
  }
  // Fallback to defaults
  return {
    employee: PAGIBIG_DEFAULT_EMPLOYEE,
    employer: PAGIBIG_DEFAULT_EMPLOYER,
  };
}

// ─── TRAIN Law 2025 Withholding Tax ──────────────────────────────────
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
export function computeAllDeductions(
  monthlySalary: number,
  pagibigOverrides?: { employee: number; employer: number }
) {
  const sss = computeSSS(monthlySalary);
  const philhealth = computePhilHealth(monthlySalary);
  const pagibig = computePagIBIG(monthlySalary, pagibigOverrides);
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
      (sss.employer + philhealth.employer + pagibig.employer + sss.ec).toFixed(2)
    ),
  };
}
