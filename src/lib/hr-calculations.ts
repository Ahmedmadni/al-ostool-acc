// Saudi Labor Law compliant HR calculations.
// Mirror of the SQL helpers in supabase (hr_calc_end_of_service, hr_calc_gosi).
// Keep in sync when regulations change.

export type TerminationReason =
  | "resignation" | "end_of_contract" | "dismissal"
  | "mutual_agreement" | "retirement" | "death" | "other"
  | "probation" | "arbitrary_dismissal" | "unlawful_resignation";

/** End of Service (Article 84/85) — half month for first 5 years, full month after.
 *  Resignation factor: <2y = 0, 2-5y = 1/3, 5-10y = 2/3, ≥10y = full.
 *  unlawful_resignation gets the same reduced schedule — it is a
 *  resignation in substance (employee-initiated departure); the Article
 *  74/75 compensation the employee separately owes the company for
 *  leaving without notice/cause is on top of this, not instead of it.
 *  Other reasons (including arbitrary_dismissal and probation, both
 *  employer-side or neutral separations): full base. */
export function calcEndOfService(monthlyWage: number, serviceYears: number, reason: TerminationReason): number {
  if (!monthlyWage || !serviceYears || serviceYears <= 0) return 0;
  const first5 = Math.min(serviceYears, 5) * (monthlyWage / 2);
  const rest = Math.max(serviceYears - 5, 0) * monthlyWage;
  const base = first5 + rest;
  let factor = 1;
  if (reason === "resignation" || reason === "unlawful_resignation") {
    if (serviceYears < 2) factor = 0;
    else if (serviceYears < 5) factor = 1 / 3;
    else if (serviceYears < 10) factor = 2 / 3;
    else factor = 1;
  }
  return Math.round(base * factor * 100) / 100;
}

// GOSI contributory wage ceiling/floor (Annuities branch, Saudi employees).
// Applying it here — not just leaving the raw gross wage — matters most for
// higher earners: without a cap the system overstates both the employee
// deduction and the employer cost above SAR 45,000/month.
export const GOSI_MIN_SUBJECT_WAGE = 1500;
export const GOSI_MAX_SUBJECT_WAGE = 45000;

/** GOSI shares. Saudis: 9.75% employee / 11.75% employer. Expats: 2% employer only.
 *  Contributory wage is capped to [GOSI_MIN_SUBJECT_WAGE, GOSI_MAX_SUBJECT_WAGE]
 *  for Saudis; expats' hazard-only contribution is capped at the same ceiling. */
export function calcGosi(grossWage: number, isSaudi: boolean): { employee: number; employer: number } {
  const g = grossWage || 0;
  if (g <= 0) return { employee: 0, employer: 0 };
  const subjectWage = isSaudi
    ? Math.min(Math.max(g, GOSI_MIN_SUBJECT_WAGE), GOSI_MAX_SUBJECT_WAGE)
    : Math.min(g, GOSI_MAX_SUBJECT_WAGE);
  return isSaudi
    ? { employee: Math.round(subjectWage * 0.0975 * 100) / 100, employer: Math.round(subjectWage * 0.1175 * 100) / 100 }
    : { employee: 0, employer: Math.round(subjectWage * 0.02 * 100) / 100 };
}

/** Overtime pay (Labor Law Art. 107): hourly wage × 1.5 × hours.
 *  Hourly wage = basic monthly wage ÷ (30 × 8) — the standard 240-hour month
 *  used for Saudi payroll wage-rate conversions. */
export function calcOvertimePay(basicSalary: number, hours: number): number {
  if (!basicSalary || !hours || hours <= 0) return 0;
  const hourlyWage = basicSalary / 240;
  return Math.round(hourlyWage * 1.5 * hours * 100) / 100;
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
