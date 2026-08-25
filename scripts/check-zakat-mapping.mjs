import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql = readFileSync(
  new URL("../supabase/migrations/20260825110000_zakat_mapping_and_approval.sql", import.meta.url),
  "utf8",
);
const form = readFileSync(
  new URL("../src/components/tax/zakat-return-form.tsx", import.meta.url),
  "utf8",
);
for (const value of [
  "zakat_return_adjustments",
  "zakat_calculate_return_mapped",
  "zakat_approve_return",
  "zakat_source_fingerprint",
  "تغير مصدر أو تعديل بعد الاحتساب",
])
  assert.ok(sql.includes(value), `Mapped Zakat engine missing: ${value}`);
assert.ok(form.includes("اختر بند الإقرار"));
assert.ok(form.includes("التعديلات اليدوية المسببة"));
assert.ok(form.includes('.rpc("zakat_approve_return"'));
console.log("Mapped Zakat and approval checks passed ✓");
