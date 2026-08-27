import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260825180000_authoritative_auxiliary_cost_imports.sql",
  "utf8",
);
const page = readFileSync("src/routes/_authenticated/costs/index.tsx", "utf8");

assert.match(migration, /cost_aux_import_post/);
assert.match(migration, /_source_type NOT IN \('hr','equipment'\)/);
assert.match(migration, /REVOKE INSERT,UPDATE,DELETE ON public\.hr_costs,public\.equipment_costs/);
assert.match(migration, /source_record_id/);
assert.match(migration, /cost_entries_import_line_unique|import_line_key/);
assert.match(page, /rpc\("cost_aux_import_post"/);
assert.doesNotMatch(page, /from\("hr_costs"\)\.insert/);
assert.doesNotMatch(page, /from\("equipment_costs"\)\.insert/);
assert.match(page, /تفاصيل الصفوف المرفوضة/);

console.log("Authoritative auxiliary cost import checks passed.");
