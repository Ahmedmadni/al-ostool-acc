import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const migration = readFileSync(
  new URL("../supabase/migrations/20260824150000_attendance_daily_processing.sql", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../src/routes/_authenticated/hr/attendance/index.tsx", import.meta.url),
  "utf8",
);
for (const invariant of [
  "CREATE TABLE public.hr_attendance_policies",
  "CREATE TABLE public.hr_attendance_days",
  "hr_attendance_refresh_days",
  "hr_attendance_decide_day",
  "hr_apply_attendance_to_payroll",
  "approval_status='approved'",
  "approved_leave",
  "incomplete",
  "v_end := v_end + INTERVAL '1 day'",
  "deduct_absence BOOLEAN NOT NULL DEFAULT false",
  "pay_overtime BOOLEAN NOT NULL DEFAULT false",
  "ALTER FUNCTION public.hr_payroll_create_run(INTEGER,INTEGER) RENAME TO hr_payroll_create_run_leave_core",
  "attendance_absence_days",
  "attendance_overtime",
  "REVOKE INSERT,UPDATE,DELETE ON public.hr_attendance_days FROM authenticated",
])
  assert.ok(migration.includes(invariant), `Daily attendance engine is missing: ${invariant}`);
assert.ok(
  page.includes('.rpc("hr_attendance_refresh_days"'),
  "Daily processing must use the server RPC",
);
assert.ok(
  page.includes('.rpc("hr_attendance_decide_day"'),
  "Daily decisions must use the approval RPC",
);
assert.ok(page.includes("التأخير") && page.includes("الخروج المبكر") && page.includes("الإضافي"));
console.log("Attendance daily-processing checks passed ✓");
