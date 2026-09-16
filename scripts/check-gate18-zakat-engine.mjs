import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260916120000_gate18_zakat_engine_hardening.sql", import.meta.url),
  "utf8",
);
const form = readFileSync(
  new URL("../src/components/tax/zakat-return-form.tsx", import.meta.url),
  "utf8",
);
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

for (const marker of [
  "Gate 18 is already or partially applied",
  "zakat_gate18_lock",
  "pg_advisory_xact_lock",
  "zakat_gate18_assert_no_overlap",
  "trg_zakat_gate18_period_guard",
  "zakat_gate18_assert_sources_current",
  "source_snapshot->>'account_code'",
  "source_snapshot->>'account_name'",
  "source_snapshot->>'debit'",
  "source_snapshot->>'credit'",
  "source_snapshot->>'balance'",
  "zakat_gate18_detail_write_guard",
  "trg_zakat_gate18_sources_write",
  "trg_zakat_gate18_adjustments_write",
  "zakat_gate18_return_write_guard",
  "zakat_gate18_mapping_write_guard",
  "zakat_account_mapping_events",
  "trg_zakat_gate18_mapping_audit",
  "version=public.zakat_account_mappings.version+1",
  "approved_by",
  "approved_at",
  "uq_zakat_submission_reference",
  "zakat-v3-gate18",
  "من 10 إلى 1000 حرف",
  "zakat_returns_read_gate18",
  "REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER",
  "REVOKE ALL ON FUNCTION public.zakat_calculate_return_flexible",
]) {
  assert.ok(migration.includes(marker), `Gate 18 Zakat hardening missing: ${marker}`);
}

assert.ok(
  (migration.match(/SECURITY DEFINER/g) ?? []).length >= 14,
  "Gate 18 must harden every privileged Zakat function",
);
assert.ok(
  (migration.match(/SET search_path=''/g) ?? []).length >= 14,
  "Gate 18 privileged functions must use an empty search_path",
);
assert.ok(!migration.includes("SET search_path=public"), "Gate 18 must not trust public search_path");
assert.ok(
  migration.includes("PERFORM public.zakat_gate18_assert_sources_current(_return_id);"),
  "approval/submission source drift checks are missing",
);
assert.ok(
  migration.split("PERFORM public.zakat_gate18_assert_sources_current(_return_id);").length - 1 >= 2,
  "both approval and submission must reject source drift",
);
assert.ok(form.includes('.rpc("zakat_calculate_return_mapped"'));
assert.ok(!form.includes('.rpc("zakat_calculate_return_flexible"'));
assert.ok(pkg.scripts["check:gate18-zakat"] === "node scripts/check-gate18-zakat-engine.mjs");
assert.ok(pkg.scripts.verify.includes("check:gate18-zakat"));

console.log("Gate 18 Zakat engine hardening checks passed ✓");
