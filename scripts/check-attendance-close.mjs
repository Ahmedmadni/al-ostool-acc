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
const workspace = readFileSync(
  new URL("../src/components/hr/attendance/attendance-workspace.tsx", import.meta.url),
  "utf8",
);
const attendanceUi = `${page}\n${workspace}`;
const hrSchema = readFileSync(
  new URL("../supabase/migrations/20260702115337_78b28f2b-db80-4ea2-904a-e74cc5438ab3.sql", import.meta.url),
  "utf8",
);
const daily = readFileSync(
  new URL("../supabase/migrations/20260824150000_attendance_daily_processing.sql", import.meta.url),
  "utf8",
);
for (const invariant of [
  "CREATE TABLE public.hr_attendance_periods",
  "CREATE TABLE public.hr_attendance_period_audit",
  "attendance monthly-close migration is already or partially applied",
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
  "trg_hr_attendance_period_audit_immutable",
  "t.status IN ('approved','paid')",
  "t.last_working_day<days.work_date::DATE",
  "trg_hr_shift_assignments_closed_config",
  "trg_hr_shift_schedules_closed_config",
  "trg_hr_shift_groups_closed_config",
  "trg_hr_attendance_policies_closed_config",
  "hr-attendance-period:%s:%s",
  "hr_attendance_lock_periods",
  "calendar period -> employee/day -> correction row",
  "hr_attendance_refresh_days_period_core",
  "hr_attendance_decide_day_period_core",
  "hr_attendance_request_correction_period_core",
  "hr_attendance_decide_correction_period_core",
  "hr_attendance_apply_correction_period_core",
  "hr_apply_attendance_to_payroll_period_core",
  "يجب إقفال فترة الحضور قبل تطبيقها على مسير الرواتب",
  "ALTER FUNCTION public.hr_payroll_create_run(INTEGER,INTEGER) RENAME TO hr_payroll_create_run_attendance_core",
  "يجب إقفال فترة الحضور قبل إنشاء مسير الرواتب",
  "REVOKE INSERT,UPDATE,DELETE ON public.hr_attendance_periods,public.hr_attendance_period_audit FROM authenticated",
])
  assert.ok(migration.includes(invariant), `Attendance close is missing: ${invariant}`);
assert.ok(
  (migration.match(/SECURITY DEFINER SET search_path=''/g) ?? []).length >= 15,
  "all privileged Gate 3 functions must use an empty search_path",
);
assert.ok(
  migration.includes("IF v_period.status<>'closed' THEN RAISE EXCEPTION 'فترة الحضور غير مقفلة'"),
  "reopen must reject a repeated transition",
);
assert.ok(
  migration.includes("WHERE hr_attendance_periods.status='open'") &&
    migration.includes("IF v_period.id IS NULL THEN RAISE EXCEPTION 'الفترة مقفلة مسبقاً'"),
  "close must reject a repeated transition without another audit row",
);
assert.ok(attendanceUi.includes('.rpc("hr_attendance_close_period"'));
assert.ok(attendanceUi.includes('.rpc("hr_attendance_reopen_period"'));
assert.ok(
  attendanceUi.includes("exportAttendanceReport") && attendanceUi.includes("تصدير Excel"),
  "Attendance UI must retain monthly export controls after refactors",
);

const expectedEmploymentDays = ({ from, to, hireDate, lastWorkingDay }) => {
  const result = [];
  for (let day = new Date(`${from}T00:00:00Z`); day <= new Date(`${to}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + 1)) {
    const iso = day.toISOString().slice(0, 10);
    if (iso >= hireDate && (!lastWorkingDay || iso <= lastWorkingDay)) result.push(iso);
  }
  return result;
};
assert.deepEqual(expectedEmploymentDays({ from: "2026-08-01", to: "2026-08-31", hireDate: "2026-08-15" })[0], "2026-08-15");
assert.equal(expectedEmploymentDays({ from: "2026-08-01", to: "2026-08-31", hireDate: "2020-01-01", lastWorkingDay: "2026-08-17" }).at(-1), "2026-08-17");
assert.equal(expectedEmploymentDays({ from: "2026-08-01", to: "2026-08-31", hireDate: "2020-01-01", lastWorkingDay: "2026-08-17" }).length, 17);
assert.deepEqual(expectedEmploymentDays({ from: "2026-08-01", to: "2026-08-31", hireDate: "2026-09-01" }), []);

assert.ok(daily.includes("'scheduled_start',v_start") && daily.includes("'scheduled_end',v_end") && daily.includes("'timezone',v_assignment.timezone"));
assert.ok(migration.includes("لا يمكن تعديل مصدر احتساب مستخدم في فترة حضور مقفلة"));
assert.ok(migration.includes("لا يمكن تعديل تكليف وردية يتقاطع مع فترة حضور مقفلة"));
assert.ok(migration.includes("لا يمكن إضافة مصدر احتساب بأثر رجعي إلى فترة حضور مقفلة"));
assert.ok(hrSchema.includes("CREATE TYPE public.hr_payroll_status AS ENUM ('draft','pending_approval','approved','paid','cancelled')"));
assert.ok(migration.includes("status IN ('approved','paid')"), "every terminal payroll state must block reopen");
console.log("Attendance monthly-close checks passed ✓");
