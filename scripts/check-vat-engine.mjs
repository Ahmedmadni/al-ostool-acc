import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const migration = readFileSync(
  new URL("../supabase/migrations/20260824190000_server_authoritative_vat.sql", import.meta.url),
  "utf8",
);
const form = readFileSync(
  new URL("../src/components/tax/vat-return-form.tsx", import.meta.url),
  "utf8",
);
for (const invariant of [
  "CREATE TABLE public.tax_rate_rules",
  "tax_category TEXT",
  "vat_calculate_return",
  "vat_approve_return",
  "vat_source_fingerprint",
  "يوجد % فاتورة بلا تصنيف ضريبي",
  "reverse_charge_output_vat",
  "trg_invoices_vat_guard",
  "trg_purchase_invoices_vat_guard",
  "REVOKE INSERT,UPDATE ON public.vat_returns FROM authenticated",
])
  assert.ok(migration.includes(invariant), `VAT engine missing: ${invariant}`);
assert.ok(
  form.includes('.rpc("vat_calculate_return"') ||
    form.includes('.rpc("vat_calculate_return_flexible"'),
  "VAT form must calculate on server",
);
assert.ok(form.includes('.rpc("vat_approve_return"'), "VAT form must approve on server");
assert.ok(
  !form.includes('.upsert(payload, { onConflict: "period_from,period_to" })'),
  "Client must not persist calculated VAT totals",
);
assert.ok(form.includes("disabled") && form.includes("تُقرأ من الفواتير"));
console.log("Server-authoritative VAT checks passed ✓");
