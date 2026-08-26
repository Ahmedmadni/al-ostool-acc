import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260824130000_leave_aware_payroll_engine.sql", import.meta.url),
  "utf8",
);
const payrollPage = readFileSync(
  new URL("../src/routes/_authenticated/hr/payroll/index.tsx", import.meta.url),
  "utf8",
);

for (const invariant of [
  "sick_cycle_start",
  "pg_advisory_xact_lock",
  "hr_sick_leave_pay_breakdown",
  "CASE WHEN ordinal <= 30 THEN 100 WHEN ordinal <= 90 THEN 75 ELSE 0 END",
  "hr_payroll_create_run",
  "leave_type = 'unpaid'",
  "v_contract_gross * v_payable_days / 30.0",
  "LEAST(v_gross, v_unpaid_deduction + v_sick_deduction)",
  "REVOKE INSERT ON public.hr_payroll_runs FROM authenticated",
  "REVOKE INSERT ON public.hr_payroll_lines FROM authenticated",
  "- COALESCE(v_line.unpaid_leave_deduction, 0)",
  "- COALESCE(v_line.sick_leave_deduction, 0)",
]) {
  assert.ok(migration.includes(invariant), `Payroll engine is missing invariant: ${invariant}`);
}

assert.ok(
  payrollPage.includes('.rpc("hr_payroll_create_run"'),
  "Payroll creation must use the authoritative RPC",
);
assert.ok(
  !payrollPage.includes('.from("hr_payroll_runs").insert('),
  "The browser must not insert payroll runs directly",
);
assert.ok(
  !payrollPage.includes('.from("hr_payroll_lines").insert('),
  "The browser must not insert calculated payroll lines directly",
);

const payPercent = (cycleDay) => (cycleDay <= 30 ? 100 : cycleDay <= 90 ? 75 : 0);
assert.equal(payPercent(30), 100);
assert.equal(payPercent(31), 75);
assert.equal(payPercent(90), 75);
assert.equal(payPercent(91), 0);
assert.equal(payPercent(120), 0);

console.log("Leave-aware payroll-engine checks passed ✓");
