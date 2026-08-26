import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const migration = readFileSync(
  new URL("../supabase/migrations/20260825090000_flexible_vat_sources.sql", import.meta.url),
  "utf8",
);
const form = readFileSync(
  new URL("../src/components/tax/vat-return-form.tsx", import.meta.url),
  "utf8",
);
for (const invariant of [
  "CREATE TABLE public.vat_return_sources",
  "CREATE TABLE public.vat_return_adjustments",
  "vat_calculate_return_flexible",
  "vat_return_stored_fingerprint",
  "_sales_ids UUID[]",
  "_purchase_ids UUID[]",
  "التصنيف اليدوي غير متوافق",
  "source_selection",
  "selected-invoice-ledger",
  "REVOKE INSERT,UPDATE,DELETE ON public.vat_return_sources,public.vat_return_adjustments FROM authenticated",
])
  assert.ok(migration.includes(invariant), `Flexible VAT engine missing: ${invariant}`);
assert.ok(form.includes('.rpc("vat_calculate_return_flexible"'));
assert.ok(form.includes("تحديد الكل") && form.includes("إلغاء الكل"));
assert.ok(form.includes("قيم وتعديلات يدوية") && form.includes("manualAdjustments"));
console.log("Flexible VAT source-selection checks passed ✓");
