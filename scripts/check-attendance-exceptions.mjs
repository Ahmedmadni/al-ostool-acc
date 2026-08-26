import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260824160000_attendance_exceptions_and_corrections.sql",
    import.meta.url,
  ),
  "utf8",
);
const page = readFileSync(
  new URL("../src/routes/_authenticated/hr/attendance/index.tsx", import.meta.url),
  "utf8",
);
for (const invariant of [
  "CREATE TABLE public.hr_attendance_holidays",
  "CREATE TABLE public.hr_attendance_correction_requests",
  "original_snapshot JSONB NOT NULL",
  "idx_hr_attendance_correction_one_pending",
  "hr_attendance_request_correction",
  "hr_attendance_decide_correction",
  "correction_request_id",
  "superseded_by_correction",
  "ALTER FUNCTION public.hr_attendance_refresh_days(DATE,DATE,UUID) RENAME TO hr_attendance_refresh_days_core",
  "status='rest_day'",
  "approval_status='pending'",
  "REVOKE INSERT,UPDATE,DELETE ON public.hr_attendance_correction_requests FROM authenticated",
])
  assert.ok(migration.includes(invariant), `Attendance exception flow is missing: ${invariant}`);
assert.ok(page.includes('.rpc("hr_attendance_request_correction"'));
assert.ok(page.includes('.rpc("hr_attendance_decide_correction"'));
assert.ok(page.includes("التصحيحات والعطلات"));
console.log("Attendance exception and correction checks passed ✓");
