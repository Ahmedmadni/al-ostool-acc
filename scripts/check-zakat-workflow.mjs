import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql = readFileSync(
  new URL(
    "../supabase/migrations/20260825120000_zakat_templates_and_submission.sql",
    import.meta.url,
  ),
  "utf8",
);
const form = readFileSync(
  new URL("../src/components/tax/zakat-return-form.tsx", import.meta.url),
  "utf8",
);
for (const value of [
  "zakat_account_mappings",
  "zakat_save_account_mappings",
  "zakat_submit_return",
  "submission_reference",
  "يجب اعتماد الإقرار قبل تسجيل تقديمه",
])
  assert.ok(sql.includes(value), `Zakat workflow missing: ${value}`);
assert.ok(form.includes('from("zakat_return_sources"'));
assert.ok(form.includes('from("zakat_return_adjustments"'));
assert.ok(form.includes('.rpc("zakat_save_account_mappings"'));
assert.ok(form.includes('.rpc("zakat_submit_return"'));
console.log("Zakat restoration, templates, and submission checks passed ✓");
