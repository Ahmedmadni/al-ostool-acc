import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260825200000_cost_budgets_and_variance.sql",
  "utf8",
);
const page = readFileSync("src/routes/_authenticated/costs/index.tsx", "utf8");

assert.match(migration, /CREATE TABLE public\.cost_budgets/);
assert.match(migration, /CREATE TABLE public\.cost_budget_events/);
assert.match(migration, /cost_budget_save/);
assert.match(migration, /cost_budget_approve/);
assert.match(migration, /لا يمكن تعديل موازنة فترة مقفلة/);
assert.match(migration, /event_type.*revised/);
assert.match(page, /الموازنات والانحراف/);
assert.match(page, /rpc\("cost_budget_save"/);
assert.match(page, /rpc\("cost_budget_approve"/);
assert.match(page, /utilization/);

console.log("Versioned cost budget and variance checks passed.");
