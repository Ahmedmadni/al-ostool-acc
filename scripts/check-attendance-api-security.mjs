import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync("src/routes/api/public/hr/attendance-ingest.ts", "utf8");
const maintenance = readFileSync("src/routes/api/public/hr/attendance-maintenance.ts", "utf8");
const foundation = readFileSync(
  "supabase/migrations/20260824181000_biometric_api_security_foundation.sql",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20260825220000_biometric_api_security.sql",
  "utf8",
);
const reviewFixes = readFileSync(
  "supabase/migrations/20260825230000_gate5_security_review_fixes.sql",
  "utf8",
);
const attendanceUi = readFileSync("src/routes/_authenticated/hr/attendance/index.tsx", "utf8");
const all = `${foundation}\n${migration}\n${reviewFixes}`;
const has = (source, token) =>
  assert.ok(source.includes(token), `Missing Gate 5 invariant: ${token}`);

// Executable model for signature integrity/freshness and both idempotency layers.
const encoder = new TextEncoder();
const secret = "device-secret-with-sufficient-entropy";
const timestamp = new Date().toISOString();
const nonce = "12345678-1234-4234-9234-123456789abc";
const bodyHash = "a".repeat(64);
const canonical = `POST\n/api/public/hr/attendance-ingest\n${timestamp}\n${nonce}\n${bodyHash}`;
const hmacKey = await crypto.subtle.importKey(
  "raw",
  encoder.encode(secret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);
const signature = await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(canonical));
assert.equal(
  await crypto.subtle.verify("HMAC", hmacKey, signature, encoder.encode(canonical)),
  true,
);
assert.equal(
  await crypto.subtle.verify("HMAC", hmacKey, signature, encoder.encode(`${canonical}-tampered`)),
  false,
);
const fresh = (candidate, now = Date.now()) => {
  const value = Date.parse(candidate);
  return value >= now - 5 * 60_000 && value <= now + 2 * 60_000;
};
assert.equal(fresh(timestamp), true);
assert.equal(fresh(new Date(Date.now() - 6 * 60_000).toISOString()), false);
assert.equal(fresh(new Date(Date.now() + 3 * 60_000).toISOString()), false);
const requests = new Map();
const claim = (key, hash) => {
  if (!requests.has(key)) {
    requests.set(key, hash);
    return "claimed";
  }
  return requests.get(key) === hash ? "replay" : "conflict";
};
assert.equal(claim(nonce, bodyHash), "claimed");
assert.equal(claim(nonce, bodyHash), "replay");
assert.equal(claim(nonce, "b".repeat(64)), "conflict");
const events = new Map();
const persist = (key, hash) => {
  if (!events.has(key)) {
    events.set(key, hash);
    return "created";
  }
  return events.get(key) === hash ? "duplicate" : "conflict";
};
assert.equal(persist("device:event-1", "payload-1"), "created");
assert.equal(persist("device:event-1", "payload-1"), "duplicate");
assert.equal(persist("device:event-1", "payload-2"), "conflict");

// Effective-dated scope model: inclusive assignment bounds and prior work date
// preserve delayed/historical and overnight attribution independently of current state.
const effective = (assignment, workDate) =>
  assignment.from <= workDate && (assignment.to === null || assignment.to >= workDate);
const historicalDate = "2026-08-01";
const oldSiteAssignment = { from: "2026-01-01", to: "2026-08-15", site: "A" };
const laterSiteAssignment = { from: "2026-08-16", to: null, site: "B" };
assert.equal(effective(oldSiteAssignment, historicalDate) && oldSiteAssignment.site === "A", true);
assert.equal(effective(laterSiteAssignment, historicalDate), false);
assert.equal(effective(oldSiteAssignment, "2026-08-15"), true);
assert.equal(effective(laterSiteAssignment, "2026-08-16"), true);
const overnightCandidates = ["2026-08-02", "2026-08-01"];
assert.equal(overnightCandidates.includes("2026-08-01"), true);

// Credential possession, signature integrity, native constant-time verification, and freshness.
for (const token of [
  'request.headers.get("authorization")',
  'request.headers.get("x-attendance-timestamp")',
  'request.headers.get("x-attendance-nonce")',
  'request.headers.get("x-attendance-signature")',
  "crypto.subtle.importKey(",
  "crypto.subtle.verify(",
  "POST\\n${INGEST_PATH}\\n${requestTimestamp}\\n${nonce}\\n${bodyHash}",
  "REQUEST_PAST_MS",
  "REQUEST_FUTURE_MS",
])
  has(api, token);
has(migration, "extensions.crypt(coalesce(_token,''),v_device.token_hash)<>v_device.token_hash");
has(migration, "extensions.gen_salt('bf',12)");
assert.ok(!all.includes("digest(v_token,'sha256')"));
for (const wording of [
  "Bearer authentication + signed request binding + replay",
  "not an independent",
  "theft of the Bearer secret also permits forging signatures",
  "TLS is a PRODUCTION SECURITY",
])
  has(api, wording);

// Request replay and nonce/payload conflicts are serialized by a database unique constraint.
has(foundation, "UNIQUE(device_id,nonce)");
has(migration, "ON CONFLICT(device_id,nonce) DO NOTHING");
has(migration, "v_request.body_hash<>_body_hash");
has(migration, "'request_status','replay'");
has(api, 'claim.request_status === "conflict"');
has(api, 'claim.request_status === "replay"');

// Event identity uses the existing exact key atomically and rejects key reuse with changed facts.
has(migration, "ON CONFLICT(device_id,external_event_id) DO NOTHING");
has(migration, "v_row.employee_id<>v_employee");
has(migration, "v_row.ingest_payload_hash<>_payload_hash");
has(migration, "'status',CASE WHEN v_inserted THEN 'created' ELSE 'duplicate' END");
for (const contract of ["201", "200", "400", "401", "409", "413", "207"]) has(api, contract);

// Unknown/inactive devices and unknown/out-of-scope employees are durable rejections, never fake events.
for (const reason of [
  "'unknown_device'",
  "'inactive_device'",
  "'invalid_credentials'",
  "'unknown_employee'",
  "'employee_out_of_scope'",
  "'event_identity_conflict'",
])
  has(migration, reason);
has(foundation, "CREATE TABLE public.hr_biometric_ingest_rejections");
has(migration, "hr_attendance_log_ingest_rejection");
assert.ok(
  !migration.includes("INSERT INTO public.hr_attendance_events") ||
    migration.indexOf("unknown_employee") <
      migration.indexOf("INSERT INTO public.hr_attendance_events"),
);
has(migration, "gs.group_id=g.id AND gs.site_id=v_device.site_id");
has(migration, "v_device.site_id");
for (const effectiveScope of [
  "a.effective_from<=days.work_date",
  "a.effective_to>=days.work_date",
  "((_occurred_at AT TIME ZONE g.timezone)::date-1)",
  "v_local BETWEEN v_open AND v_close",
  "Device site itself is current-state",
  "no effective-dated history",
])
  has(migration, effectiveScope);

// Strict canonical payload, bounded streaming body/batch, and event/request time policies.
for (const token of [
  ".strict()",
  "MAX_BODY_BYTES",
  "MAX_EVENTS = 100",
  "request.body.getReader()",
  "reader.cancel()",
  "MAX_EVENT_AGE_MS",
  "MAX_EVENT_FUTURE_MS",
  'z.enum(["check_in", "check_out"])',
])
  has(api, token);
has(api, "one_device_per_batch_required");
has(api, 'status: "failed", reason: "ingest_failed"');
for (const requirement of [
  "PRODUCTION SECURITY REQUIREMENT",
  "globally, per device after identification",
  "by IP as an additional abuse signal",
  "HTTP 429 is not",
])
  has(api, requirement);
const claimFunction = migration.slice(
  migration.indexOf("CREATE FUNCTION public.hr_attendance_claim_biometric_request"),
  migration.indexOf("CREATE FUNCTION public.hr_attendance_biometric_ingest_secure"),
);
assert.ok(
  claimFunction.indexOf("IF v_device.id IS NULL") < claimFunction.indexOf("extensions.crypt("),
  "Unknown devices must be rejected before bcrypt",
);

// Secrets are one-time provisioning responses only, are never persisted/logged raw, and verifier reads are denied.
has(foundation, "REVOKE SELECT ON public.hr_biometric_devices FROM authenticated");
assert.ok(!foundation.match(/GRANT SELECT\s+ON public\.hr_biometric_devices/));
assert.ok(!api.includes("console."));
assert.ok(!migration.includes("_token,jsonb") && !migration.includes("'token',_token"));
has(api, '"cache-control": "no-store"');

// Provisioning is an authenticated UI operation, explicitly denied to every
// implicit/default or unnecessary role, and still authorized inside each RPC.
for (const signature of [
  "hr_attendance_register_device(TEXT,TEXT,UUID,TEXT)",
  "hr_attendance_rotate_device_token(UUID)",
]) {
  has(reviewFixes, `REVOKE ALL ON FUNCTION public.${signature}`);
  const revoke = reviewFixes.slice(
    reviewFixes.indexOf(`REVOKE ALL ON FUNCTION public.${signature}`),
  );
  assert.match(revoke.split(";")[0], /FROM PUBLIC,anon,authenticated,service_role/);
  has(reviewFixes, `GRANT EXECUTE ON FUNCTION public.${signature}`);
}
for (const functionName of ["hr_attendance_register_device", "hr_attendance_rotate_device_token"]) {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`);
  const body = migration.slice(start, migration.indexOf("$$;", start));
  has(
    body,
    "public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid())",
  );
}
assert.ok(!reviewFixes.match(/GRANT EXECUTE[\s\S]*?\bTO\s+(?:PUBLIC|anon|service_role)\b/));

// The authenticated device screen requests exactly its granted safe columns.
const deviceQuery = attendanceUi.slice(
  attendanceUi.indexOf('queryKey: ["hr_biometric_devices"]'),
  attendanceUi.indexOf('queryKey: ["hr_attendance_anomalies"]'),
);
assert.ok(!deviceQuery.includes('.select("*'));
for (const field of ["id", "device_code", "name_ar", "last_seen_at", "auth_failures"])
  has(deviceQuery, field);
for (const secret of ["token_hash", "raw_token", "credential_verifier"])
  assert.ok(!deviceQuery.includes(secret));
has(deviceQuery, "hr_work_sites(name_ar)");

// Raw bytes are hashed and HMAC-verified before parsing or durable audit work.
assert.ok(api.indexOf("await verifyHmac(") < api.indexOf("JSON.parse("));
assert.ok(api.indexOf("await verifyHmac(") < api.indexOf('await audit("'));
has(api, "Accepted timing/enumeration trade-off");
has(reviewFixes, "Medium / Deferred operational integrity limitation");

// Public clients cannot execute the service-role trust-boundary functions or legacy ingest.
for (const signature of [
  "hr_attendance_claim_biometric_request",
  "hr_attendance_biometric_ingest_secure",
  "hr_attendance_log_ingest_rejection",
]) {
  has(migration, `REVOKE ALL ON FUNCTION public.${signature}`);
  has(migration, `GRANT EXECUTE ON FUNCTION public.${signature}`);
}
has(migration, "REVOKE ALL ON FUNCTION public.hr_attendance_biometric_ingest");
for (const match of migration.matchAll(/SECURITY DEFINER SET search_path=([^ ]+) AS/g))
  assert.equal(match[1], "''");

// Maintenance uses a separate service credential, constant-work comparison, and normalized errors.
has(maintenance, "process.env.CRON_SECRET");
has(maintenance, 'crypto.subtle.digest("SHA-256"');
assert.ok(!maintenance.includes("x-attendance-signature"));
assert.ok(!maintenance.includes("error.message"));
assert.ok(!api.includes("CRON_SECRET"));

// No fake distributed limiter claim and no GET/query-string device secret surface.
assert.ok(!api.includes("GET:"));
assert.ok(!api.includes('searchParams.get("token")'));
assert.ok(!api.includes("Map<string"));

// Replay state and security-investigation audit have deliberately separate retention semantics.
for (const retention of [
  "Replay-security state",
  "request_timestamp + the five-minute acceptance window",
  "clock/processing safety margin",
  "Security investigation audit, not replay state",
  "separate, longer organizational audit policy",
])
  has(foundation, retention);

console.log("Gate 5 biometric API security checks passed ✓");
