import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL(
    "../supabase/migrations/20260824180000_attendance_operations_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);
const has = (value, message = value) => assert.ok(sql.includes(value), message);
const lacks = (value, message = value) => assert.ok(!sql.includes(value), message);

// Structural model, supported operational taxonomy, and resolution audit.
for (const token of [
  "attendance_day_id UUID",
  "work_date DATE",
  "occurred_at TIMESTAMPTZ",
  "detection_source TEXT",
  "description TEXT",
  "fingerprint TEXT",
  "occurrence_count BIGINT",
  "acknowledged_by UUID",
  "resolved_by UUID",
  "resolution_reason TEXT",
  "unexpected_absence",
  "incomplete_punch",
  "off_schedule_event",
  "future_event",
  "stale_event",
])
  has(token);

// Exact identity is enforced by the foundation; near duplicates remain evidence and become anomalies.
const foundation = readFileSync(
  new URL(
    "../supabase/migrations/20260824140000_flexible_attendance_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);
assert.match(foundation, /UNIQUE\(device_id, external_event_id\)/);
has("near_duplicate_seconds");
has("near-duplicate:");
lacks("DELETE FROM public.hr_attendance_events");

// Repeated/concurrent detection uses a partial unique invariant and atomic upsert.
const activePredicate = "status IN ('open','acknowledged')";
assert.match(
  sql,
  new RegExp(
    "CREATE UNIQUE INDEX uq_hr_attendance_anomalies_active_fingerprint[\\s\\S]*?ON public\\.hr_attendance_anomalies\\(fingerprint\\)[\\s\\S]*?WHERE status IN \\(\\'open\\',\\'acknowledged\\'\\)",
  ),
);
has(`ON CONFLICT (fingerprint) WHERE ${activePredicate} DO UPDATE`);
has(`WHERE public.hr_attendance_anomalies.${activePredicate}`);
has("occurrence_count=public.hr_attendance_anomalies.occurrence_count+1");
has("EXIT WHEN v_row.id IS NOT NULL");
const upsert = sql.slice(
  sql.indexOf("INSERT INTO public.hr_attendance_anomalies"),
  sql.indexOf("RETURNING * INTO v_row") + "RETURNING * INTO v_row".length,
);
for (const immutableResolutionField of [
  "status=",
  "resolved_by=",
  "resolved_at=",
  "resolution_reason=",
])
  assert.ok(
    !upsert.includes(immutableResolutionField),
    `Detector must not overwrite ${immutableResolutionField}`,
  );
has("Resolved and");
has("ignored rows are outside its predicate");

// Expected absence derives from Gate 1 rows and explicitly excludes leave; rest days have no row.
has("d.status IN ('absent','incomplete')");
has("l.status IN ('approved','taken')");
has("v_day.work_date BETWEEN l.from_date AND l.to_date");

// Time/off-schedule detections preserve raw evidence.
for (const token of [
  "future_grace_minutes",
  "stale_after_hours",
  "v_event.validation_status='out_of_window'",
  "v_event.validation_status='unassigned'",
])
  has(token);
lacks("UPDATE public.hr_attendance_events");
lacks("DELETE FROM public.hr_attendance_days");

// Unknown devices and unmapped employee numbers are rejected before persistence.
assert.match(foundation, /employee_id UUID NOT NULL REFERENCES public\.hr_employees/);
assert.match(foundation, /device_id UUID REFERENCES public\.hr_biometric_devices/);
const biometricIngest = foundation.slice(
  foundation.indexOf("CREATE OR REPLACE FUNCTION public.hr_attendance_biometric_ingest"),
  foundation.indexOf("REVOKE ALL ON FUNCTION public.hr_attendance_mobile_punch"),
);
const eventInsertAt = biometricIngest.indexOf("INSERT INTO public.hr_attendance_events");
for (const rejection of [
  "RAISE EXCEPTION 'unknown or inactive device'",
  "RAISE EXCEPTION 'unknown employee'",
]) {
  assert.ok(biometricIngest.includes(rejection));
  assert.ok(
    biometricIngest.indexOf(rejection) < eventInsertAt,
    `${rejection} must precede event persistence`,
  );
}
lacks("'unknown_device'");
lacks("'employee_not_mapped'");
lacks("mapping_error");

// Closed periods are observed only; resolution cannot mutate facts or bypass Gate 3.
has("'closed_period',public.hr_attendance_period_is_closed");
const resolution = sql.slice(
  sql.indexOf("CREATE FUNCTION public.hr_attendance_resolve_anomaly"),
  sql.indexOf("CREATE FUNCTION public.hr_attendance_run_maintenance"),
);
assert.ok(!/hr_attendance_(events|days|periods|correction_requests)/.test(resolution));
has("status NOT IN ('open','acknowledged')");
has("FOR UPDATE");

// Clients cannot forge detections/audit, and every definer has an empty search path.
has(
  "REVOKE INSERT,UPDATE,DELETE ON public.hr_attendance_anomaly_settings,public.hr_attendance_anomalies FROM authenticated",
);
has("حقول هوية اكتشاف الشذوذ غير قابلة للتعديل");
for (const match of sql.matchAll(
  /CREATE FUNCTION[\s\S]*?LANGUAGE plpgsql SECURITY DEFINER SET search_path=([^ ]+) AS/g,
))
  assert.equal(match[1], "''");
has("GRANT EXECUTE ON FUNCTION public.hr_attendance_record_anomaly");
has("TO service_role;");

// Bounded maintenance, preserved lock ordering, rollback-aware failure semantics, and preflight.
has("_work_date<CURRENT_DATE-31");
has("maximum_scan_days");
has("hr_attendance_refresh_days(_work_date,_work_date,NULL)");
assert.ok(
  sql.indexOf("hr_attendance_refresh_days(_work_date,_work_date,NULL)") <
    sql.indexOf("hr_attendance_scan_anomalies(v_from,v_to)"),
);
has("no durable processing-failure row path");
has("Do not claim processing-failure persistence");
lacks("'processing_failure'");
has("RAISE;");
has("already or partially applied");
has("requires the verified Gate 1, Gate 2, and Gate 3 objects");
lacks("IF NOT EXISTS");
lacks("create_notification");

console.log("Gate 4 attendance operational-hardening static checks passed ✓");
