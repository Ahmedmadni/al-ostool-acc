// Saudi Labor Law compliant HR calculations.
// Mirror of the SQL helpers in supabase (hr_calc_end_of_service, hr_calc_gosi).
// Keep in sync when regulations change.

export type TerminationReason =
  | "resignation" | "end_of_contract" | "dismissal"
  | "mutual_agreement" | "retirement" | "death" | "other";

/** End of Service (Article 84/85) — half month for first 5 years, full month after.
 *  Resignation factor: <2y = 0, 2-5y = 1/3, 5-10y = 2/3, ≥10y = full.
 *  Other reasons: full base. */
export function calcEndOfService(monthlyWage: number, serviceYears: number, reason: TerminationReason): number {
  if (!monthlyWage || !serviceYears || serviceYears <= 0) return 0;
  const first5 = Math.min(serviceYears, 5) * (monthlyWage / 2);
  const rest = Math.max(serviceYears - 5, 0) * monthlyWage;
  const base = first5 + rest;
  let factor = 1;
  if (reason === "resignation") {
    if (serviceYears < 2) factor = 0;
    else if (serviceYears < 5) factor = 1 / 3;
    else if (serviceYears < 10) factor = 2 / 3;
    else factor = 1;
  }
  return Math.round(base * factor * 100) / 100;
}

/** GOSI shares. Saudis: 9.75% employee / 11.75% employer. Expats: 2% employer only. */
export function calcGosi(grossWage: number, isSaudi: boolean): { employee: number; employer: number } {
  const g = grossWage || 0;
  return isSaudi
    ? { employee: Math.round(g * 0.0975 * 100) / 100, employer: Math.round(g * 0.1175 * 100) / 100 }
    : { employee: 0, employer: Math.round(g * 0.02 * 100) / 100 };
}

/** Annual leave accrual (default 21 days for first 5 years, 30 after). */
export function calcAnnualLeaveEntitlement(serviceYears: number, contractDays?: number | null): number {
  const base = contractDays ?? (serviceYears >= 5 ? 30 : 21);
  return base;
}

/** Years between two dates (fractional). */
export function serviceYears(from: string | Date, to: string | Date = new Date()): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (!a || !b || b < a) return 0;
  return Math.round(((b - a) / (1000 * 60 * 60 * 24 * 365.25)) * 100) / 100;
}

export interface PayrollLineInput {
  basic: number;
  housing?: number;
  transport?: number;
  otherAllowances?: number;
  overtime?: number;
  bonuses?: number;
  isSaudi: boolean;
  loanDeduction?: number;
  absenceDeduction?: number;
  lateDeduction?: number;
  unpaidLeaveDeduction?: number;
  otherDeductions?: number;
}

export function calcPayrollLine(i: PayrollLineInput) {
  const basic = i.basic || 0;
  const housing = i.housing || 0;
  const transport = i.transport || 0;
  const otherAllow = i.otherAllowances || 0;
  const overtime = i.overtime || 0;
  const bonuses = i.bonuses || 0;
  const gross = basic + housing + transport + otherAllow + overtime + bonuses;
  const gosi = calcGosi(basic + housing, i.isSaudi); // GOSI base = basic + housing per SANED rules
  const deductions =
    gosi.employee + (i.loanDeduction || 0) + (i.absenceDeduction || 0)
    + (i.lateDeduction || 0) + (i.unpaidLeaveDeduction || 0) + (i.otherDeductions || 0);
  const net = gross - deductions;
  return {
    gross: r2(gross),
    gosiEmployee: gosi.employee,
    gosiEmployer: gosi.employer,
    totalDeductions: r2(deductions),
    net: r2(net),
  };
}

function r2(n: number) { return Math.round(n * 100) / 100; }
