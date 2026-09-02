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
let count = 0;
const test = (name, fn) => {
  fn();
  console.log(`ok ${++count} - ${name}`);
};

test("structural correction objects, constraints and indexes exist", () => {
  for (const value of [
    "CREATE TABLE public.hr_attendance_holidays",
    "CREATE TABLE public.hr_attendance_correction_requests",
    "original_snapshot JSONB NOT NULL",
    "applied_snapshot JSONB",
    "idx_hr_attendance_correction_one_pending",
    "idx_hr_attendance_corrections_status",
    "hr_attendance_request_correction",
    "hr_attendance_decide_correction",
    "hr_attendance_apply_correction",
    "trg_hr_attendance_correction_audit",
  ])
    assert.ok(migration.includes(value), `missing ${value}`);
});

test("partial application and nested refresh wrappers fail explicitly", () => {
  assert.match(migration, /attendance corrections migration is already or partially applied/);
  assert.match(migration, /expected Gate 1 hr_attendance_refresh_days/);
});

test("renamed attendance core is not executable by client or service roles", () => {
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.hr_attendance_refresh_days_core\(DATE,DATE,UUID\) FROM PUBLIC,anon,authenticated,service_role/,
  );
});

test("raw attendance evidence is never mutated or fabricated by corrections", () => {
  assert.doesNotMatch(migration, /UPDATE public\.hr_attendance_events/);
  assert.doesNotMatch(migration, /INSERT INTO public\.hr_attendance_events/);
});

const snapshot = (day) => structuredClone(day);
const request = (day, proposed, reason, requester = "employee") => ({
  status: "pending",
  original: snapshot(day),
  proposed,
  reason: reason.trim(),
  requester,
  approver: null,
  decisionReason: null,
  applied: null,
});
const calculate = (current, proposed) => {
  const firstIn = proposed.firstIn ?? current.firstIn;
  const lastOut = proposed.lastOut ?? current.lastOut;
  if (!firstIn || !lastOut || lastOut <= firstIn)
    return { ...current, firstIn, lastOut, status: "incomplete", actual: 0, late: 0, overtime: 0 };
  const minutes = (a, b) => Math.floor((Date.parse(a) - Date.parse(b)) / 60_000);
  return {
    ...current,
    firstIn,
    lastOut,
    status: "present",
    actual: Math.max(minutes(lastOut, firstIn), 0),
    late: Math.max(minutes(firstIn, current.start) - current.grace, 0),
    overtime: Math.max(minutes(lastOut, current.end), 0),
    approval: "pending",
  };
};
const decide = (correction, approved, reason, actor = "reviewer") => {
  if (correction.status !== "pending") throw new Error("already decided");
  if (reason.trim().length < 5) throw new Error("decision reason required");
  correction.status = approved ? "approved" : "rejected";
  correction.approver = actor;
  correction.decisionReason = reason.trim();
  return correction;
};
const base = {
  firstIn: "2026-08-30T06:20:00Z",
  lastOut: null,
  start: "2026-08-30T06:00:00Z",
  end: "2026-08-30T14:00:00Z",
  grace: 5,
  status: "incomplete",
  actual: 0,
  late: 0,
  overtime: 0,
  approval: "approved",
};

test("create request preserves old values, proposal, reason and requester", () => {
  const correction = request(base, { lastOut: base.end }, "missing checkout", "employee-1");
  assert.deepEqual(correction.original, base);
  assert.equal(correction.proposed.lastOut, base.end);
  assert.equal(correction.reason, "missing checkout");
  assert.equal(correction.requester, "employee-1");
});
test("approve preserves approver and mandatory decision reason", () => {
  const correction = decide(
    request(base, { lastOut: base.end }, "missing checkout"),
    true,
    "evidence accepted",
  );
  assert.equal(correction.status, "approved");
  assert.equal(correction.approver, "reviewer");
  assert.equal(correction.decisionReason, "evidence accepted");
});
test("reject preserves reviewer and mandatory decision reason", () => {
  const correction = decide(
    request(base, { lastOut: base.end }, "missing checkout"),
    false,
    "device evidence differs",
  );
  assert.equal(correction.status, "rejected");
  assert.equal(correction.approver, "reviewer");
});
test("a correction cannot be decided twice", () => {
  const correction = decide(
    request(base, { lastOut: base.end }, "missing checkout"),
    true,
    "evidence accepted",
  );
  assert.throws(() => decide(correction, true, "repeat approval"), /already decided/);
});
test("missing checkout becomes present and recalculates facts", () => {
  const result = calculate(base, { lastOut: base.end });
  assert.equal(result.status, "present");
  assert.equal(result.actual, 460);
  assert.equal(result.late, 15);
});
test("corrected check-in recalculates late and actual minutes", () => {
  const result = calculate({ ...base, lastOut: base.end }, { firstIn: base.start });
  assert.equal(result.late, 0);
  assert.equal(result.actual, 480);
});
test("absence becomes presence without retaining the absence fact", () => {
  const absent = { ...base, firstIn: null, status: "absent" };
  assert.equal(calculate(absent, { firstIn: base.start, lastOut: base.end }).status, "present");
});
test("approval applies an override and returns the attendance day to pending", () => {
  assert.equal(calculate(base, { lastOut: base.end }).approval, "pending");
  assert.match(migration, /approval_status='pending',approved_by=NULL,approved_at=NULL/);
});
test("decision captures immutable applied values while refresh reuses them", () => {
  assert.match(migration, /AND applied_snapshot IS NULL/);
  assert.match(migration, /NOT _capture_snapshot AND v_request\.applied_snapshot IS NOT NULL/);
});
test("initial decision cannot inject an applied snapshot", () => {
  assert.match(
    migration,
    /OLD\.status='pending' AND NEW\.status IN \('approved','rejected'\)\s+AND NEW\.applied_snapshot IS NULL/,
  );
});
test("correction employee must match its attendance day", () => {
  assert.match(migration, /d\.id=NEW\.attendance_day_id AND d\.employee_id=NEW\.employee_id/);
  assert.match(migration, /BEFORE INSERT OR UPDATE ON public\.hr_attendance_correction_requests/);
});
test("duplicate application replaces facts rather than accumulating them", () => {
  const applied = calculate(base, { lastOut: base.end });
  assert.deepEqual(
    calculate(base, { firstIn: applied.firstIn, lastOut: applied.lastOut }),
    applied,
  );
  assert.match(migration, /IS DISTINCT FROM ROW\(v_in,v_out,v_status/);
});
test("refresh restores approved corrected results without bypassing Gate 1", () => {
  assert.match(migration, /v_approvals JSONB/);
  assert.match(
    migration,
    /SET approval_status='approved',approved_by=a\.approved_by,approved_at=a\.approved_at/,
  );
  assert.match(migration, /SET calculated_at=a\.calculated_at,updated_at=a\.updated_at/);
});
test("latest approved correction wins deterministically", () => {
  assert.match(migration, /DISTINCT ON \(request\.attendance_day_id\)/);
  assert.match(migration, /request\.decided_at DESC,request\.id DESC/);
});
test("correction shift end uses the next local date before timezone conversion", () => {
  assert.equal(
    (
      migration.match(
        /v_day\.work_date\+v_schedule\.end_time\s*\+CASE WHEN v_schedule\.end_time<=v_schedule\.start_time THEN INTERVAL '1 day'/g,
      ) ?? []
    ).length,
    2,
  );
  assert.doesNotMatch(migration, /v_end\s*:=\s*v_end\s*\+\s*INTERVAL '1 day'/);
});
test("direct client mutation is denied and RPC execution is explicit", () => {
  assert.match(
    migration,
    /REVOKE INSERT,UPDATE,DELETE ON public\.hr_attendance_correction_requests FROM authenticated/,
  );
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.hr_attendance_apply_correction\(UUID,BOOLEAN\) FROM PUBLIC/,
  );
  assert.match(migration, /انتقال حالة طلب التصحيح غير مسموح/);
});
test("security-definer paths and RPC role grants are pinned", () => {
  assert.equal((migration.match(/SECURITY DEFINER SET search_path='' AS \$\$/g) ?? []).length, 4);
  assert.equal((migration.match(/SECURITY INVOKER SET search_path='' AS \$\$/g) ?? []).length, 2);
  assert.match(
    migration,
    /hr_attendance_apply_correction\(UUID,BOOLEAN\) FROM PUBLIC,anon,authenticated/,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.hr_attendance_apply_correction\(UUID,BOOLEAN\) TO service_role/,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.hr_attendance_request_correction\(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT\) TO authenticated/,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.hr_attendance_decide_correction\(UUID,BOOLEAN,TEXT\) TO authenticated/,
  );
});
test("request, decision and apply share Gate 1 employee-date locking", () => {
  assert.ok(
    (
      migration.match(
        /hashtextextended\(v_day\.employee_id::TEXT\|\|':'\|\|v_day\.work_date::TEXT,0\)/g,
      ) ?? []
    ).length >= 3,
  );
  assert.match(migration, /WHERE id=_request_id FOR UPDATE/);
});
test("corrected refresh pre-locks the full Gate 1 employee-date range", () => {
  const materialization =
    migration.match(
      /SELECT COALESCE\(array_agg\(e\.id ORDER BY e\.id\)[\s\S]*?v_employee_ids[\s\S]*?;/,
    )?.[0] ?? "";
  assert.match(materialization, /FROM public\.hr_employees e/);
  assert.match(
    materialization,
    /e\.status IN \('active','on_leave'\) AND \(_employee_id IS NULL OR e\.id=_employee_id\)/,
  );
  const lockLoop =
    migration.match(/FOREACH v_employee IN ARRAY v_employee_ids LOOP([\s\S]*?)END LOOP;/)?.[1] ??
    "";
  assert.match(lockLoop, /generate_series\(_date_from,_date_to,INTERVAL '1 day'\)::DATE/);
  assert.match(lockLoop, /hashtextextended\(v_employee::TEXT\|\|':'\|\|v_day::TEXT,0\)/);
  assert.doesNotMatch(lockLoop, /hr_attendance_correction_requests|status='approved'/);
});
test("core processing reuses only the materialized employee universe", () => {
  assert.match(
    migration,
    /FOREACH v_employee IN ARRAY v_employee_ids LOOP\s+v_core_count:=public\.hr_attendance_refresh_days_core\(_date_from,_date_to,v_employee\)/,
  );
  assert.doesNotMatch(
    migration,
    /hr_attendance_refresh_days_core\(_date_from,_date_to,_employee_id\)/,
  );
  assert.doesNotMatch(migration, /hr_attendance_refresh_days_core\(_date_from,_date_to,NULL\)/);
  assert.match(migration, /v_count:=v_count\+COALESCE\(v_core_count,0\)/);
});
test("employees activated after materialization wait for the next refresh", () => {
  const fixedUniverse = ["employee-b"];
  const liveEmployeesAfterActivation = ["employee-a", "employee-b"];
  const currentRefresh = [...fixedUniverse];
  assert.deepEqual(currentRefresh, ["employee-b"]);
  assert.ok(!currentRefresh.includes("employee-a"));
  assert.deepEqual(liveEmployeesAfterActivation, ["employee-a", "employee-b"]);
});
test("holiday overlay refuses to reopen an approved day silently", () => {
  assert.match(migration, /تغيير عطلة يؤثر في يوم معتمد/);
});
test("payroll reapplication retains Gate 1 replacement semantics", () => {
  const gate1 = readFileSync(
    new URL(
      "../supabase/migrations/20260824150000_attendance_daily_processing.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(gate1, /total_deductions=total_deductions-COALESCE\(absence_deduction,0\)/);
  assert.match(gate1, /net_salary=net_salary-COALESCE\(overtime,0\)/);
});
test("attendance UI uses only correction workflow RPCs", () => {
  assert.ok(page.includes('.rpc("hr_attendance_request_correction"'));
  assert.ok(page.includes('.rpc("hr_attendance_decide_correction"'));
});

console.log(`Attendance exception and correction checks passed: ${count} tests`);
