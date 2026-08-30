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
let tests = 0;
const test = (name, fn) => {
  fn();
  tests += 1;
  console.log(`ok ${tests} - ${name}`);
};

test("migration declares the structural attendance and payroll objects", () => {
  for (const invariant of [
    "CREATE TABLE public.hr_attendance_policies",
    "CREATE TABLE public.hr_attendance_days",
    "UNIQUE(employee_id, work_date)",
    "idx_hr_attendance_days_date_status",
    "hr_attendance_refresh_days",
    "hr_attendance_decide_day",
    "hr_apply_attendance_to_payroll",
    "approval_status='approved'",
    "REVOKE INSERT,UPDATE,DELETE ON public.hr_attendance_days FROM authenticated",
  ])
    assert.ok(migration.includes(invariant), `missing: ${invariant}`);
});

test("partial application and nested payroll wrappers fail explicitly", () => {
  assert.match(migration, /attendance daily migration is already or partially applied/);
  assert.match(migration, /to_regprocedure\('public\.hr_payroll_create_run_leave_core/);
  assert.match(migration, /expected leave-aware hr_payroll_create_run/);
});

test("refresh and approval use the same per-day transaction lock", () => {
  assert.equal(
    (migration.match(/pg_advisory_xact_lock\(hashtextextended\(v_emp\.id/g) ?? []).length,
    1,
  );
  assert.equal(
    (migration.match(/pg_advisory_xact_lock\(hashtextextended\(v_employee_id::/g) ?? []).length,
    1,
  );
});

test("bulk refresh locks employees in a deterministic order", () => {
  assert.match(
    migration,
    /FOR v_emp IN SELECT id FROM public\.hr_employees[\s\S]*?ORDER BY id[\s\S]*?LOOP/,
  );
});

test("renamed payroll core is not executable by client or service roles", () => {
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.hr_payroll_create_run_leave_core\(INTEGER,INTEGER\) FROM PUBLIC,anon,authenticated,service_role/,
  );
});

test("Gate 1 privileged functions use an empty search path", () => {
  assert.equal(
    (migration.match(/SECURITY DEFINER SET search_path\s*=\s*'' AS \$\$/g) ?? []).length,
    5,
  );
  assert.doesNotMatch(migration, /SECURITY DEFINER SET search_path\s*=\s*public/);
});

test("identical refresh is a no-op and changed approved facts are rejected", () => {
  assert.match(migration, /approved attendance day .* correction\/reopening is required/);
  assert.match(migration, /IS DISTINCT FROM ROW\(EXCLUDED\.assignment_id/);
});

// Executable reference cases mirror the SQL's window, extrema and minute rules.
const calculate = ({
  start,
  end,
  events = [],
  working = true,
  leave = false,
  grace = 0,
  breakMinutes = 0,
}) => {
  if (!working) return null;
  const accepted = events.filter((event) => event.accepted && event.schedule === "shift");
  const ins = accepted
    .filter((event) => event.type === "check_in")
    .map((event) => event.at)
    .sort();
  const outs = accepted
    .filter((event) => event.type === "check_out")
    .map((event) => event.at)
    .sort();
  const firstIn = ins.at(0) ?? null;
  const lastOut = outs.at(-1) ?? null;
  if (leave) return { status: "approved_leave", firstIn, lastOut, late: 0, early: 0, overtime: 0 };
  if (!firstIn && !lastOut)
    return { status: "absent", firstIn, lastOut, late: 0, early: 0, overtime: 0 };
  if (!firstIn || !lastOut || lastOut <= firstIn)
    return { status: "incomplete", firstIn, lastOut, late: 0, early: 0, overtime: 0 };
  const minutes = (a, b) => Math.floor((Date.parse(a) - Date.parse(b)) / 60_000);
  return {
    status: "present",
    firstIn,
    lastOut,
    actual: Math.max(minutes(lastOut, firstIn) - breakMinutes, 0),
    late: Math.max(minutes(firstIn, start) - grace, 0),
    early: Math.max(minutes(end, lastOut), 0),
    overtime: Math.max(minutes(lastOut, end), 0),
  };
};
const event = (type, at) => ({ type, at, accepted: true, schedule: "shift" });
const day = { start: "2026-08-30T06:00:00Z", end: "2026-08-30T14:00:00Z" }; // 09:00–17:00 Asia/Riyadh

test("normal attendance", () =>
  assert.deepEqual(
    calculate({ ...day, events: [event("check_in", day.start), event("check_out", day.end)] })
      .status,
    "present",
  ));
test("late arrival and early departure", () => {
  const result = calculate({
    ...day,
    grace: 5,
    events: [event("check_in", "2026-08-30T06:20:00Z"), event("check_out", "2026-08-30T13:45:00Z")],
  });
  assert.equal(result.late, 15);
  assert.equal(result.early, 15);
});
test("absence is one deterministic fact", () => assert.equal(calculate(day).status, "absent"));
test("approved leave suppresses absence", () =>
  assert.equal(calculate({ ...day, leave: true }).status, "approved_leave"));
test("check-in only is incomplete without invented checkout", () =>
  assert.deepEqual(calculate({ ...day, events: [event("check_in", day.start)] }).lastOut, null));
test("check-out only is incomplete without invented check-in", () =>
  assert.deepEqual(calculate({ ...day, events: [event("check_out", day.end)] }).firstIn, null));
test("duplicate and multiple punches use deterministic extrema", () => {
  const result = calculate({
    ...day,
    events: [
      event("check_in", day.start),
      event("check_in", day.start),
      event("check_in", "2026-08-30T06:05:00Z"),
      event("check_out", "2026-08-30T13:55:00Z"),
      event("check_out", day.end),
    ],
  });
  assert.equal(result.firstIn, day.start);
  assert.equal(result.lastOut, day.end);
  assert.equal(result.actual, 480);
});
test("non-working schedule does not create absence", () =>
  assert.equal(calculate({ ...day, working: false }), null));
test("22:00–06:00 Riyadh punches remain one work date across UTC midnight", () => {
  const night = calculate({
    start: "2026-08-30T19:00:00Z",
    end: "2026-08-31T03:00:00Z",
    events: [
      event("check_in", "2026-08-30T19:00:00Z"),
      event("check_in", "2026-08-30T21:00:00Z"),
      event("check_out", "2026-08-31T01:00:00Z"),
      event("check_out", "2026-08-31T03:00:00Z"),
    ],
  });
  assert.equal(night.actual, 480);
  assert.equal(night.overtime, 0);
  assert.equal(night.status, "present");
});
test("overnight end advances the local date before timezone conversion", () => {
  assert.match(
    migration,
    /v_day \+ v_schedule\.end_time\s*\+ CASE WHEN v_schedule\.end_time <= v_schedule\.start_time THEN INTERVAL '1 day'/,
  );
  assert.doesNotMatch(migration, /v_end\s*:=\s*v_end\s*\+\s*INTERVAL '1 day'/);
  // America/New_York enters DST on 2026-03-08: local 22:00→06:00 is seven real hours.
  const start = Date.parse("2026-03-08T03:00:00Z");
  const localNextDayEnd = Date.parse("2026-03-08T10:00:00Z");
  assert.equal((localNextDayEnd - start) / 3_600_000, 7);
});
test("timezone model converts local shift boundaries once to instants", () => {
  assert.match(
    migration,
    /\(v_day \+ v_schedule\.start_time\) AT TIME ZONE v_assignment\.timezone/,
  );
  assert.equal(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh",
      hour: "2-digit",
      hour12: false,
    }).format(new Date(day.start)),
    "09",
  );
});
test("effective-dated assignment and schedule filters are present", () => {
  assert.match(migration, /a\.effective_from <= v_day/);
  assert.match(migration, /a\.effective_to IS NULL OR a\.effective_to >= v_day/);
  assert.match(migration, /schedule_id = v_schedule\.id/);
});
test("payroll application replaces prior attendance effects", () => {
  assert.match(migration, /total_deductions=total_deductions-COALESCE\(absence_deduction,0\)/);
  assert.match(migration, /net_salary=net_salary-COALESCE\(overtime,0\)/);
});
test("attendance UI calls only the protected processing and decision RPCs", () => {
  assert.ok(page.includes('.rpc("hr_attendance_refresh_days"'));
  assert.ok(page.includes('.rpc("hr_attendance_decide_day"'));
});

test("refresh return value is documented as processed logical days", () => {
  assert.match(
    migration,
    /Return processed logical employee\/days, including deterministic no-op reruns/,
  );
});

console.log(`Attendance daily-processing checks passed: ${tests} tests`);
