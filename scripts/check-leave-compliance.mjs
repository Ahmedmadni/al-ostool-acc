import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260824120000_versioned_leave_compliance.sql", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../src/routes/_authenticated/hr/leaves/index.tsx", import.meta.url),
  "utf8",
);

for (const invariant of [
  "CREATE TABLE public.hr_leave_rules",
  "effective_from DATE NOT NULL",
  "balance_mode IN ('annual', 'rolling_year', 'per_event', 'uncapped')",
  "('maternity', 'وضع', '2025-02-19', NULL, 84, 84",
  "('sibling_bereavement', 'وفاة أخ أو أخت', '2025-02-19', NULL, 3, 3",
  "NEW.days_count := NEW.to_date - NEW.from_date + 1",
  "توجد إجازة أخرى متداخلة",
  "إجازة الحج تمنح مرة واحدة طوال الخدمة",
  "hr_leave_decide",
  "hr.leaves', 'approve'",
]) {
  assert.ok(migration.includes(invariant), `Leave compliance migration is missing: ${invariant}`);
}

assert.ok(
  page.includes('.rpc("hr_leave_decide"'),
  "Leave decisions must use the permission-checked RPC",
);
assert.ok(
  !page.includes(".update({ status,"),
  "The browser must not approve leave with a direct status update",
);
for (const leaveType of ["marriage", "bereavement", "sibling_bereavement"]) {
  assert.ok(page.includes(`v: "${leaveType}"`), `Leave UI is missing ${leaveType}`);
}

console.log("Versioned leave-compliance checks passed ✓");
