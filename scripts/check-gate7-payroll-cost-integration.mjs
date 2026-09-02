import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260902090000_gate7_attendance_payroll_cost_hardening.sql", import.meta.url),
  "utf8",
);
const gate1 = readFileSync(
  new URL("../supabase/migrations/20260824150000_attendance_daily_processing.sql", import.meta.url),
  "utf8",
);
const gate3 = readFileSync(
  new URL("../supabase/migrations/20260824170000_attendance_monthly_close.sql", import.meta.url),
  "utf8",
);
const leavePayroll = readFileSync(
  new URL("../supabase/migrations/20260824130000_leave_aware_payroll_engine.sql", import.meta.url),
  "utf8",
);
const costPeriods = readFileSync(
  new URL("../supabase/migrations/20260825170000_cost_workflow_and_periods.sql", import.meta.url),
  "utf8",
);

const mustContain = [
  "attendance_period_id",
  "attendance_snapshot_hash",
  "attendance_applied_at",
  "attendance_applied_by",
  "attendance_apply_count",
  "hr_attendance_payroll_snapshot_hash",
  "hr_payroll_attendance_is_stale",
  "hr_apply_attendance_to_payroll_gate7_core",
  "status='closed'",
  "FOR SHARE",
  "status<>'draft'",
  "attendance_apply_count=attendance_apply_count+1",
  "pending_approval",
  "approved",
  "paid",
  "hr_payroll_attendance_status_guard",
  "hr_payroll_line_gate7_guard",
  "current_user IN ('anon','authenticated','service_role')",
  "uq_cost_entries_hr_payroll_line_source",
  "ON CONFLICT ((meta->>'payroll_line_id'))",
  "source_type",
  "'hr_payroll'",
  "cost_periods",
  "ORDER BY pl.id",
  "FOR UPDATE OF pl",
  "ROUND(",
  "SECURITY DEFINER",
  "SET search_path=''",
  "REVOKE ALL ON FUNCTION public.hr_apply_attendance_to_payroll_gate7_core(UUID)",
  "REVOKE ALL ON FUNCTION public.hr_sync_payroll_cost_entries_gate7_core(UUID)",
  "GRANT EXECUTE ON FUNCTION public.hr_sync_payroll_cost_entries(UUID) TO service_role",
  "manual reconciliation is required before migration",
];
for (const invariant of mustContain) {
  assert.ok(migration.includes(invariant), `Gate 7 migration missing invariant: ${invariant}`);
}

for (const sourceInvariant of [
  "FROM public.hr_attendance_days",
  "approval_status='approved'",
  "attendance_absence_days",
  "attendance_late_minutes",
  "attendance_overtime_minutes",
  "absence_deduction",
  "late_deduction",
  "overtime",
]) {
  assert.ok(gate1.includes(sourceInvariant), `Gate 1 payroll source invariant missing: ${sourceInvariant}`);
}
assert.ok(!migration.includes("hr_attendance_events d"), "Gate 7 must not recalculate payroll from raw attendance events");

assert.ok(gate3.includes("PERFORM public.hr_attendance_lock_periods(d,d)"), "Gate 3 attendance apply must retain period locking");
assert.ok(gate3.includes("يجب إقفال فترة الحضور قبل تطبيقها على مسير الرواتب"), "Gate 3 close prerequisite must remain present");
assert.ok(gate3.includes("status IN ('approved','paid')"), "Gate 3 must keep approved/paid payroll reopen protection");

for (const leaveEngineInvariant of [
  "unpaid_leave_deduction",
  "sick_leave_deduction",
  "LEAST(v_gross, v_unpaid_deduction + v_sick_deduction)",
]) {
  assert.ok(leavePayroll.includes(leaveEngineInvariant), `Leave-aware payroll invariant missing: ${leaveEngineInvariant}`);
}
for (const leaveHandoffInvariant of ["unpaid_leave_deduction", "sick_leave_deduction"]) {
  assert.ok(migration.includes(leaveHandoffInvariant), `Gate 7 cost handoff dropped leave value: ${leaveHandoffInvariant}`);
}
assert.ok(
  !migration.includes("LEAST(v_gross, v_unpaid_deduction + v_sick_deduction)"),
  "Gate 7 must consume the already-calculated leave deductions instead of recalculating leave policy",
);

assert.ok(costPeriods.includes("CREATE TABLE public.cost_periods"), "Cost periods foundation missing");
assert.ok(costPeriods.includes("فترة التكلفة مقفلة"), "Cost closed-period guard missing");

assert.ok(
  gate1.includes("total_deductions=total_deductions-COALESCE(absence_deduction,0)-COALESCE(late_deduction,0)+v_abs_ded+v_late_ded"),
  "Attendance reapply must replace the previous attendance-derived deduction contribution",
);
assert.ok(
  gate1.includes("net_salary=net_salary-COALESCE(overtime,0)+v_ot_pay+COALESCE(absence_deduction,0)+COALESCE(late_deduction,0)-v_abs_ded-v_late_ded"),
  "Attendance reapply must replace the previous overtime/deduction contribution in net salary",
);
assert.ok(
  migration.includes("meta->>'payroll_line_id'=v_line.id::TEXT"),
  "Concurrent cost sync must resolve an existing durable payroll-line source",
);

assert.ok(
  migration.includes("jsonb_agg(x.payload ORDER BY x.employee_id,x.work_date,x.id)"),
  "Attendance snapshot must aggregate approved facts in a deterministic order",
);
assert.ok(migration.includes("v_period.closed_at"), "Attendance snapshot must invalidate across reopen/reclose generations");
assert.ok(migration.includes("v_period.summary_snapshot::TEXT"), "Attendance close summary must participate in the snapshot");

const forbiddenRepairPatterns = [
  /DELETE\s+FROM\s+public\.cost_entries/i,
  /UPDATE\s+public\.cost_entries\s+SET\s+meta/i,
  /UPDATE\s+public\.hr_payroll_runs\s+SET\s+attendance_period_id\s*=\s*\(/i,
];
for (const pattern of forbiddenRepairPatterns) {
  assert.ok(!pattern.test(migration), `Gate 7 migration contains forbidden production repair pattern: ${pattern}`);
}

const applyAttendance = (line, next) => ({
  ...line,
  absence: next.absence,
  late: next.late,
  overtime: next.overtime,
  totalDeductions: Number(((line.totalDeductions ?? 0) - (line.absence ?? 0) - (line.late ?? 0)
    + next.absence + next.late).toFixed(2)),
  net: Number(((line.net ?? 0) - (line.overtime ?? 0) + next.overtime
    + (line.absence ?? 0) + (line.late ?? 0) - next.absence - next.late).toFixed(2)),
});
const original = {
  totalDeductions: 1500,
  net: 8500,
  absence: 0,
  late: 0,
  overtime: 0,
};
const first = applyAttendance(original, { absence: 250, late: 50, overtime: 125 });
const second = applyAttendance(first, { absence: 250, late: 50, overtime: 125 });
assert.deepEqual(second, first, "Applying the same attendance snapshot twice must be value-idempotent");
const corrected = applyAttendance(second, { absence: 100, late: 25, overtime: 200 });
assert.equal(corrected.totalDeductions, 1625);
assert.equal(corrected.net, 8575);

console.log("Gate 7 attendance -> payroll/cost integration checks passed ✓");
