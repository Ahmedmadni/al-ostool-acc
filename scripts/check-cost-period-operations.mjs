import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260825190000_cost_period_audit_and_dimensions.sql",
  "utf8",
);
const page = readFileSync("src/routes/_authenticated/costs/index.tsx", "utf8");

assert.match(migration, /CREATE TABLE public\.cost_period_status_events/);
assert.match(migration, /INSERT INTO public\.cost_period_status_events/);
assert.match(migration, /SELECT name INTO v_project FROM public\.projects/);
assert.match(migration, /SELECT name_ar INTO v_department FROM public\.departments/);
assert.match(page, /rpc\("cost_period_set_status"/);
assert.match(page, /الفترات وسجل العمليات/);
assert.match(page, /cost_entry_status_events/);
assert.match(page, /projectId/);
assert.match(page, /departmentId/);

console.log("Cost period management, dimensions, and audit checks passed.");
