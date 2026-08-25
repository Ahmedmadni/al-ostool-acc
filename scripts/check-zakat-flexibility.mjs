import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const migration = readFileSync(
  new URL("../supabase/migrations/20260825100000_flexible_zakat_sources.sql", import.meta.url),
  "utf8",
);
const form = readFileSync(
  new URL("../src/components/tax/zakat-return-form.tsx", import.meta.url),
  "utf8",
);
for (const invariant of [
  "CREATE TABLE public.zakat_return_sources",
  "zakat_calculate_return_flexible",
  "source_snapshot",
  "selected-trial-balance",
  "REVOKE INSERT,UPDATE ON public.zakat_returns FROM authenticated",
])
  assert.ok(migration.includes(invariant), `Flexible Zakat engine missing: ${invariant}`);
assert.ok(
  form.includes('.rpc("zakat_calculate_return_flexible"') ||
    form.includes('.rpc("zakat_calculate_return_mapped"'),
);
assert.ok(form.includes("مصادر ميزان المراجعة الفعلية"));
assert.ok(form.includes("تحديد الكل") && form.includes("إلغاء الكل"));
console.log("Flexible Zakat source-selection checks passed ✓");
