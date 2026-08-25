import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260824180000_attendance_operations_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);
const ingest = readFileSync(
  new URL("../src/routes/api/public/hr/attendance-ingest.ts", import.meta.url),
  "utf8",
);
const maintenance = readFileSync(
  new URL("../src/routes/api/public/hr/attendance-maintenance.ts", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../src/routes/_authenticated/hr/attendance/index.tsx", import.meta.url),
  "utf8",
);
for (const invariant of [
  "token_hash TEXT",
  "digest(v_token,'sha256')",
  "hr_attendance_authenticate_device",
  "CREATE TABLE public.hr_attendance_anomalies",
  "future_event",
  "stale_event",
  "rapid_duplicate",
  "impossible_travel",
  "excessive_corrections",
  "device_offline",
  "hr_attendance_run_maintenance",
  "create_notification",
  "REVOKE INSERT,UPDATE,DELETE ON public.hr_attendance_anomalies FROM authenticated",
])
  assert.ok(migration.includes(invariant), `Attendance operations missing: ${invariant}`);
assert.ok(
  ingest.includes("one_device_per_batch_required") &&
    ingest.includes("hr_attendance_authenticate_device"),
);
assert.ok(!ingest.includes("ATTENDANCE_INGEST_TOKEN"), "Global biometric token must not remain");
assert.ok(
  maintenance.includes("CRON_SECRET") && maintenance.includes("hr_attendance_run_maintenance"),
);
assert.ok(
  page.includes("تصدير PDF") &&
    page.includes("مراقبة الحالات الشاذة") &&
    page.includes("تدوير المفتاح"),
);
console.log("Attendance operational-hardening checks passed ✓");
