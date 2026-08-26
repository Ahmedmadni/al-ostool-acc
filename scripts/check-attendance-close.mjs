import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const migration = readFileSync(
  new URL("../supabase/migrations/20260824170000_attendance_monthly_close.sql", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../src/routes/_authenticated/hr/attendance/index.tsx", import.meta.url),
  "utf8",
);
for (const invariant of [
  "CREATE TABLE public.hr_attendance_periods",
  "CREATE TABLE public.hr_attendance_period_audit",
  "hr_attendance_close_period",
  "hr_attendance_reopen_period",
  "hr_attendance_period_is_closed",
  "يوم دوام لم تتم معالجته",
  "سجل يومي غير معتمد",
  "طلب تصحيح معلق",
  "trg_hr_attendance_days_closed_guard",
  "trg_hr_attendance_events_closed_guard",
  "trg_hr_attendance_corrections_closed_guard",
  "trg_hr_attendance_holidays_closed_guard",
  "ALTER FUNCTION public.hr_payroll_create_run(INTEGER,INTEGER) RENAME TO hr_payroll_create_run_attendance_core",
  "يجب إقفال فترة الحضور قبل إنشاء مسير الرواتب",
  "REVOKE INSERT,UPDATE,DELETE ON public.hr_attendance_periods,public.hr_attendance_period_audit FROM authenticated",
])
  assert.ok(migration.includes(invariant), `Attendance close is missing: ${invariant}`);
assert.ok(page.includes('.rpc("hr_attendance_close_period"'));
assert.ok(page.includes('.rpc("hr_attendance_reopen_period"'));
assert.ok(page.includes("exportAttendanceReport") && page.includes("تصدير Excel"));
console.log("Attendance monthly-close checks passed ✓");
