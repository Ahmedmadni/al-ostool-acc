import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260906100000_gate11_cost_accounting_engine.sql",
  "utf8",
);

for (const invariant of [
  "BEGIN;",
  "COMMIT;",
  "cost_gate11_period_lock",
  "request_fingerprint",
  "cost_entry_guard",
  "SECURITY INVOKER",
  "SET search_path=''",
  "لا يمكن إقفال فترة تحتوي قيود تكلفة غير مرحّلة",
  "INSERT INTO public.cost_period_status_events",
  "cost-import:general:",
  "cost-import:'||v_key",
  "مفتاح الاستيراد مستخدم مسبقاً بمحتوى مختلف",
  "'posted','manual_import'",
  "'cost-budget:'",
  "REVOKE ALL ON FUNCTION public.cost_gate11_period_lock(TEXT)",
]) {
  assert.ok(migration.includes(invariant), `Gate 11 invariant missing: ${invariant}`);
}

assert.ok(
  !migration.includes("SET search_path=public") && !migration.includes("SET search_path = public"),
  "Gate 11 SECURITY DEFINER/trigger functions must not use public search_path",
);

const periodFn = migration.indexOf("CREATE OR REPLACE FUNCTION public.cost_period_set_status");
const periodLock = migration.indexOf("PERFORM public.cost_gate11_period_lock(_period);", periodFn);
const periodAudit = migration.indexOf("INSERT INTO public.cost_period_status_events", periodFn);
assert.ok(periodFn >= 0 && periodLock > periodFn && periodAudit > periodLock,
  "period close/reopen must lock first and persist its audit event");

const manualFn = migration.indexOf("CREATE OR REPLACE FUNCTION public.cost_entry_create_manual");
const manualLock = migration.indexOf("PERFORM public.cost_gate11_period_lock(v_period);", manualFn);
const manualInsert = migration.indexOf("INSERT INTO public.cost_entries", manualFn);
assert.ok(manualLock > manualFn && manualInsert > manualLock,
  "manual cost creation must acquire the cost-period lock before posting data");

const importFn = migration.indexOf("CREATE OR REPLACE FUNCTION public.cost_import_post");
const importKeyLock = migration.indexOf("cost-import:general:", importFn);
const importPeriodLoop = migration.indexOf("FOR v_lock_period IN", importFn);
const importBatchInsert = migration.indexOf("INSERT INTO public.cost_import_batches", importFn);
assert.ok(importKeyLock > importFn && importPeriodLoop > importKeyLock && importBatchInsert > importPeriodLoop,
  "general cost imports must serialize idempotency and periods before durable batch creation");

const auxFn = migration.indexOf("CREATE OR REPLACE FUNCTION public.cost_aux_import_post");
const auxKeyLock = migration.indexOf("cost-import:'||v_key", auxFn);
const auxPeriodLoop = migration.indexOf("FOR v_lock_period IN", auxFn);
const auxBatchInsert = migration.indexOf("INSERT INTO public.cost_import_batches", auxFn);
assert.ok(auxKeyLock > auxFn && auxPeriodLoop > auxKeyLock && auxBatchInsert > auxPeriodLoop,
  "auxiliary cost imports must serialize idempotency and periods before durable batch creation");

const budgetFn = migration.indexOf("CREATE OR REPLACE FUNCTION public.cost_budget_save");
const budgetPeriodLock = migration.indexOf("PERFORM public.cost_gate11_period_lock(_period);", budgetFn);
const budgetDimensionLock = migration.indexOf("'cost-budget:'", budgetFn);
assert.ok(budgetPeriodLock > budgetFn && budgetDimensionLock > budgetPeriodLock,
  "budget saves must follow period-lock then dimension-lock ordering");

for (const fn of [
  "cost_entry_create_manual",
  "cost_entry_approve",
  "cost_entry_reverse",
  "cost_period_set_status",
  "cost_import_post",
  "cost_aux_import_post",
  "cost_budget_save",
  "cost_budget_approve",
]) {
  const start = migration.indexOf(`FUNCTION public.${fn}`);
  const end = migration.indexOf("$$;", start);
  const body = migration.slice(start, end);
  assert.ok(start >= 0 && body.includes("SET search_path=''"), `${fn} must use an empty search_path`);
}

assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.cost_entry_guard\(\) FROM PUBLIC,anon,authenticated,service_role/,
  "trigger helper must not remain an executable RPC surface",
);

console.log("Gate 11 cost accounting engine hardening checks passed ✓");
