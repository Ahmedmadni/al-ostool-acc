import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql = readFileSync(
  new URL("../supabase/migrations/20260825170000_cost_workflow_and_periods.sql", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../src/routes/_authenticated/costs/index.tsx", import.meta.url),
  "utf8",
);
for (const value of [
  "cost_periods",
  "cost_entry_status_events",
  "cost_entry_create_manual",
  "cost_entry_approve",
  "cost_entry_reverse",
  "cost_period_set_status",
  "فترة التكلفة مقفلة",
  "لا يمكن تعديل قيد مرحل أو معكوس",
])
  assert.ok(sql.includes(value), `Cost workflow invariant missing: ${value}`);
assert.ok(page.includes("إضافة تكلفة يدوية كمسودة"));
assert.ok(page.includes('.rpc("cost_entry_approve"'));
assert.ok(page.includes('.rpc("cost_entry_reverse"'));
console.log("Cost approval, reversal, and period-lock checks passed ✓");
