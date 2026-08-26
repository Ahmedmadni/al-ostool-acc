import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260824110000_server_authoritative_termination.sql",
    import.meta.url,
  ),
  "utf8",
);
const createPage = readFileSync(
  new URL("../src/routes/_authenticated/hr/termination/new.tsx", import.meta.url),
  "utf8",
);

for (const invariant of [
  "hr_termination_create_draft",
  "hr_termination_refresh_components",
  "hr_calculate_service_period",
  "hr_calc_end_of_service",
  "hr_leave_accrued_for_settlement",
  "calculation_version",
  "FOR UPDATE",
  "loans_settled_by_final_settlement",
  "REVOKE INSERT ON public.hr_terminations FROM authenticated",
]) {
  assert.ok(migration.includes(invariant), `Termination engine is missing invariant: ${invariant}`);
}

assert.ok(
  createPage.includes('.rpc("hr_termination_create_draft"'),
  "Termination creation must use the authoritative database RPC",
);
assert.ok(
  !createPage.includes('.from("hr_terminations").insert('),
  "The browser must not insert calculated termination amounts directly",
);
assert.ok(
  createPage.includes("servicePeriodLoading || !servicePeriod || !!servicePeriodError"),
  "Saving must remain disabled until server-side service calculation succeeds",
);

console.log("Authoritative termination-engine checks passed ✓");
