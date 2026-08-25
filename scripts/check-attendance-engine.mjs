import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260824140000_flexible_attendance_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);
const page = readFileSync(
  new URL("../src/routes/_authenticated/hr/attendance/index.tsx", import.meta.url),
  "utf8",
);
const endpoint = readFileSync(
  new URL("../src/routes/api/public/hr/attendance-ingest.ts", import.meta.url),
  "utf8",
);

for (const invariant of [
  "CREATE TABLE public.hr_work_sites",
  "CREATE TABLE public.hr_shift_groups",
  "CREATE TABLE public.hr_shift_schedules",
  "CREATE TABLE public.hr_shift_group_sites",
  "CREATE TABLE public.hr_shift_assignments",
  "CREATE TABLE public.hr_biometric_devices",
  "CREATE TABLE public.hr_attendance_events",
  "hr_distance_meters",
  "hr_attendance_mobile_punch",
  "max_gps_accuracy_meters",
  "outside_geofence",
  "checkin_open_before_minutes",
  "checkout_close_after_minutes",
  "v_end := v_end + INTERVAL '1 day'",
  "pg_advisory_xact_lock",
  "hr_attendance_biometric_ingest",
  "UNIQUE(device_id, external_event_id)",
  "REVOKE INSERT, UPDATE, DELETE ON public.hr_attendance_events FROM authenticated",
])
  assert.ok(migration.includes(invariant), `Attendance engine is missing: ${invariant}`);

assert.ok(
  page.includes("navigator.geolocation.getCurrentPosition"),
  "Mobile punch must request a fresh GPS position",
);
assert.ok(
  page.includes('.rpc("hr_attendance_mobile_punch"'),
  "Mobile punch must use the validated RPC",
);
assert.ok(page.includes("8 ساعات + ساعة راحة"), "Shift UI must expose the 8+1 break model");
assert.ok(
  endpoint.includes("hr_attendance_authenticate_device"),
  "Biometric endpoint must authenticate the individual device token",
);
assert.ok(endpoint.includes("external_event_id"), "Biometric ingestion must be idempotent");

console.log("Flexible attendance-engine checks passed ✓");
