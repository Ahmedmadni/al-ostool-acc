import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql = readFileSync(
  new URL("../supabase/migrations/20260825130000_zakat_history_and_reopen.sql", import.meta.url),
  "utf8",
);
const form = readFileSync(
  new URL("../src/components/tax/zakat-return-form.tsx", import.meta.url),
  "utf8",
);
for (const value of [
  "zakat_return_status_events",
  "zakat_log_status_transition",
  "zakat_reopen_return",
  "10 أحرف",
  "approved','submitted",
])
  assert.ok(sql.includes(value), `Zakat history missing: ${value}`);
assert.ok(form.includes("السجل الزمني للإقرار"));
assert.ok(form.includes("إعادة فتح رقابية"));
assert.ok(form.includes('.rpc("zakat_reopen_return"'));
assert.ok(form.includes("returnHistory.map"));
console.log("Zakat history and controlled reopen checks passed ✓");
