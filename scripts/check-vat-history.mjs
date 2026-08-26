import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql = readFileSync(
  new URL("../supabase/migrations/20260825140000_vat_history_and_reopen.sql", import.meta.url),
  "utf8",
);
const form = readFileSync(
  new URL("../src/components/tax/vat-return-form.tsx", import.meta.url),
  "utf8",
);
for (const value of [
  "vat_return_status_events",
  "vat_log_status_transition",
  "vat_file_return",
  "vat_reopen_return",
  "approved','filed",
  "10 أحرف",
])
  assert.ok(sql.includes(value), `VAT history missing: ${value}`);
assert.ok(form.includes("السجل الزمني للإقرار"));
assert.ok(form.includes("إعادة فتح رقابية"));
assert.ok(form.includes('.rpc("vat_file_return"'));
assert.ok(form.includes('.rpc("vat_reopen_return"'));
assert.ok(form.includes("returnHistory.map"));
console.log("VAT history, filing, and controlled reopen checks passed ✓");
