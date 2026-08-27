import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260825210000_hr_sequential_codes_and_device_api.sql",
  "utf8",
);
const page = readFileSync("src/routes/_authenticated/hr/attendance/index.tsx", "utf8");
const api = readFileSync("src/routes/api/public/hr/attendance-ingest.ts", "utf8");

for (const prefix of ["SITE-", "SHIFT-", "DEV-"]) assert.match(migration, new RegExp(prefix));
assert.match(migration, /CREATE SEQUENCE IF NOT EXISTS public\.hr_work_site_code_seq/);
assert.match(migration, /hr_attendance_create_site/);
assert.match(migration, /hr_attendance_create_shift_group/);
assert.match(
  migration,
  /REVOKE INSERT ON public\.hr_work_sites,public\.hr_shift_groups,public\.hr_biometric_devices/,
);
assert.match(page, /rpc\("hr_attendance_create_site"/);
assert.match(page, /rpc\("hr_attendance_create_shift_group"/);
assert.doesNotMatch(page, /id="site-code"/);
assert.doesNotMatch(page, /id="group-code"/);
assert.doesNotMatch(page, /id="device-code"/);
assert.match(api, /GET: \(\{ request \}\) => capabilities\(request\)/);
assert.match(api, /idempotency: "external_event_id"/);

console.log("HR sequential codes and biometric device API checks passed.");
