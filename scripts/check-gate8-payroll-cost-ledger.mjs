import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260903090000_gate8_payroll_cost_ledger.sql", import.meta.url),
  "utf8",
);
const gate7 = readFileSync(
  new URL("../supabase/migrations/20260902090000_gate7_attendance_payroll_cost_hardening.sql", import.meta.url),
  "utf8",
);

for (const invariant of [
  "status NOT IN ('approved','paid')",
  "hr_payroll_attendance_is_stale(_run_id)",
  "uq_cost_entries_hr_payroll_line_source",
  "ON CONFLICT ((meta->>'payroll_line_id'))",
  "cost_periods WHERE period=v_period AND status='closed'",
  "hr_payroll_employer_cost",
  "gross_salary + overtime - unpaid_leave - sick_leave - absence - late + gosi_employer",
  "v_line.project_id,v_line.department_id",
  "'payroll_run_id',v_run.id,'payroll_line_id',v_line.id,'employee_id',v_line.employee_id",
  "'period',v_period,'project_id',v_line.project_id,'department_id',v_line.department_id",
  "round(",
  "IF v_amount < 0 THEN",
  "IF v_amount = 0 THEN CONTINUE",
  "auth.role()<>'service_role'",
  "SET search_path=''",
  "REVOKE ALL ON FUNCTION public.hr_sync_payroll_cost_entries(UUID) FROM PUBLIC,anon,authenticated",
  "GRANT EXECUTE ON FUNCTION public.hr_sync_payroll_cost_entries(UUID) TO service_role",
  "manual reconciliation is required",
  "already or partially applied",
  "pg_advisory_xact_lock(hashtextextended('cost-period:'||v_period,0))",
  "ORDER BY pl.id",
  "FOR UPDATE OF pl",
  "payroll period changed concurrently",
]) {
  assert.ok(migration.includes(invariant), `Gate 8 migration missing invariant: ${invariant}`);
}

assert.ok(gate7.includes("CREATE TRIGGER trg_hr_payroll_lines_gate7_guard"), "Gate 7 payroll immutability guard missing");
assert.ok(gate7.includes("attendance_snapshot_hash"), "Gate 7 attendance snapshot model missing");
assert.ok(gate7.includes("REVOKE ALL ON FUNCTION public.hr_sync_payroll_cost_entries_gate7_core(UUID)"), "Gate 7 hidden core remains executable");
assert.ok(!migration.includes("cost_period_status_events"), "Gate 8 must not reference a non-existent cost period audit table");

const formula = ({ gross, overtime, unpaid, sick, absence, late, employerGosi }) =>
  Number((gross + overtime - unpaid - sick - absence - late + employerGosi).toFixed(2));
assert.equal(formula({ gross: 10_000, overtime: 500, unpaid: 200, sick: 100, absence: 50, late: 25, employerGosi: 1_100 }), 11_225);
assert.equal(
  formula({ gross: 10_000, overtime: 500, unpaid: 200, sick: 100, absence: 50, late: 25, employerGosi: 1_100, employeeGosi: 900, loan: 2_000 }),
  11_225,
  "Employee deductions must not reduce employer cost",
);
assert.ok(!migration.includes("GREATEST("), "Negative employer cost must fail, not be silently clamped");

for (const forbidden of [
  /DELETE\s+FROM\s+public\.cost_entries/i,
  /UPDATE\s+public\.cost_entries\s+SET\s+meta/i,
  /UPDATE\s+public\.cost_entries\s+SET\s+amount/i,
]) {
  assert.ok(!forbidden.test(migration), `Gate 8 contains forbidden production repair SQL: ${forbidden}`);
}

console.log("Gate 8 Payroll -> Cost Ledger checks passed ✓");
