import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql = readFileSync(
  new URL("../supabase/migrations/20260825150000_tax_return_immutability.sql", import.meta.url),
  "utf8",
);
const vat = readFileSync(
  new URL("../src/components/tax/vat-return-form.tsx", import.meta.url),
  "utf8",
);
for (const value of [
  "tax_return_delete_guard",
  "approved','filed','submitted",
  "trg_vat_return_delete_guard",
  "trg_zakat_return_delete_guard",
  "REVOKE DELETE ON public.vat_returns,public.zakat_returns",
])
  assert.ok(sql.includes(value), `Tax immutability missing: ${value}`);
for (const value of [
  "ملخص تدقيق مصادر VAT",
  "تدقيق المصادر",
  "سجل الحالات",
  "المبيعات المختارة",
  "المشتريات المختارة",
])
  assert.ok(vat.includes(value), `VAT audit missing: ${value}`);
assert.ok(vat.includes("eligibleSales.forEach") && vat.includes("eligiblePurchases.forEach"));
console.log("Tax audit export and immutable-delete checks passed ✓");
