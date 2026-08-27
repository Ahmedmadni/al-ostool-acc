import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql = readFileSync(
  new URL("../supabase/migrations/20260825160000_authoritative_cost_imports.sql", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../src/routes/_authenticated/costs/index.tsx", import.meta.url),
  "utf8",
);
for (const value of [
  "cost_import_batches",
  "cost_import_lines",
  "cost_import_post",
  "import_line_key",
  "REVOKE INSERT ON public.cost_entries FROM authenticated",
  "1 إلى 5000 صف",
])
  assert.ok(sql.includes(value), `Cost import invariant missing: ${value}`);
assert.ok(page.includes('.rpc("cost_import_post"'));
assert.ok(page.includes("crypto.subtle.digest") && page.includes('"SHA-256"'));
assert.ok(page.includes("دفعات الاستيراد"));
assert.ok(!page.includes('.from("cost_entries")\n      .insert'));
console.log("Authoritative and idempotent cost-import checks passed ✓");
