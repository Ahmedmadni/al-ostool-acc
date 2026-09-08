import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260906110000_gate12_vat_engine.sql",
  "utf8",
);
const vatForm = readFileSync("src/components/tax/vat-return-form.tsx", "utf8");

for (const invariant of [
  "vat_gate12_lock",
  "tax:vat-ledger",
  "vat_gate12_assert_no_overlap",
  "الفترة الضريبية تتداخل مع إقرار ضريبة قيمة مضافة موجود",
  "vat_gate12_assert_sources_current",
  "invoice_number",
  "currency",
  "vat_return_period_guard",
  "vat_invoice_tax_guard",
  "v_old_qualifies",
  "v_new_qualifies",
  "vat_tax_rate_rule_guard",
  "فترات نسب ضريبة القيمة المضافة لا يجوز أن تتداخل",
  "vat_calculate_return_flexible",
  "vat-v3-gate12",
  "vat_approve_return",
  "vat_file_return",
  "vat_reopen_return",
  "SET search_path=''",
  "REVOKE ALL ON FUNCTION public.vat_calculate_return(date,date,numeric,jsonb) FROM PUBLIC,anon,authenticated,service_role",
]) {
  assert.ok(migration.includes(invariant), `Gate 12 VAT invariant missing: ${invariant}`);
}

for (const fn of [
  "vat_gate12_lock()",
  "vat_gate12_assert_no_overlap(date,date,uuid)",
  "vat_gate12_assert_sources_current(uuid)",
  "vat_return_period_guard()",
  "vat_invoice_tax_guard()",
  "vat_tax_rate_rule_guard()",
  "vat_log_status_transition()",
]) {
  assert.ok(
    migration.includes(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC,anon,authenticated,service_role`),
    `Gate 12 internal helper remains exposed: ${fn}`,
  );
}

assert.match(
  migration,
  /r\.status IN \('approved','filed'\).*v_old_date BETWEEN r\.period_from AND r\.period_to/s,
  "OLD VAT source date must remain protected after finalization",
);
assert.match(
  migration,
  /r\.status IN \('approved','filed'\).*v_new_date BETWEEN r\.period_from AND r\.period_to/s,
  "NEW VAT source date must remain protected after finalization",
);
assert.match(
  migration,
  /TG_TABLE_NAME='purchase_invoices'.*currency.*IS DISTINCT FROM/s,
  "Purchase currency changes must be tax-relevant",
);
assert.match(
  migration,
  /vat_gate12_assert_sources_current\(_return_id\).*UPDATE public\.vat_returns SET status='approved'/s,
  "Approval must verify current source snapshots",
);
assert.match(
  migration,
  /vat_gate12_assert_sources_current\(_return_id\).*status='filed'/s,
  "Filing must verify current source snapshots",
);
assert.doesNotMatch(
  migration,
  /SECURITY DEFINER\s+SET search_path=public/,
  "Gate 12 SECURITY DEFINER functions must not use public search_path",
);

assert.ok(vatForm.includes('.rpc("vat_calculate_return_flexible"'));
assert.ok(vatForm.includes('.rpc("vat_approve_return"'));
assert.ok(vatForm.includes('.rpc("vat_file_return"'));
assert.ok(vatForm.includes('.rpc("vat_reopen_return"'));
assert.ok(!vatForm.includes('.rpc("vat_calculate_return"'));

console.log("Gate 12 VAT engine hardening checks passed ✓");
