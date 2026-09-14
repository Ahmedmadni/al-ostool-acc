import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const preflight = readFileSync("supabase/migrations/20260914120000_gate15_real_estate_preflight.sql", "utf8");
const foundation = readFileSync("supabase/migrations/20260914120100_gate15_real_estate_foundation.sql", "utf8");
const runtime = readFileSync("supabase/migrations/20260914120200_gate15_real_estate_runtime.sql", "utf8");
const hardening = readFileSync("supabase/migrations/20260914120300_gate15_real_estate_integrity_hardening.sql", "utf8");
const reporting = readFileSync("supabase/migrations/20260914120400_gate15_real_estate_reporting_billing.sql", "utf8");
const ui = readFileSync("src/routes/_authenticated/real-estate.tsx", "utf8");
const sql = `${foundation}\n${runtime}\n${hardening}\n${reporting}`;

for (const table of [
  "re_properties",
  "re_buildings",
  "re_floors",
  "re_units",
  "re_master_leases",
  "re_tenant_leases",
  "re_lease_schedules",
  "re_occupancy_events",
  "re_facility_links",
  "re_property_cost_links",
  "re_status_events",
]) {
  assert.ok(foundation.includes(`CREATE TABLE public.${table}`), `${table} missing`);
  assert.ok(foundation.includes(`ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY`), "Gate 15 RLS loop missing");
}

for (const dependency of [
  "public.customers",
  "public.vendors",
  "public.contracts",
  "public.invoices",
  "public.cost_entries",
  "public.fixed_assets",
  "public.ops_sites",
  "public.ops_assets",
]) {
  assert.ok(foundation.includes(`to_regclass('${dependency}')`), `dependency preflight missing: ${dependency}`);
}

assert.ok(preflight.includes("v_expected constant integer := 16"), "full partial-application marker count missing");
assert.ok(preflight.includes("re_portfolio_snapshot()"), "reporting-layer partial marker missing");
assert.ok(preflight.includes("appears partially applied"), "partial-application stop missing");
assert.ok(foundation.includes("c.code='RE'") && foundation.includes("group_has_module_access(c.code,'real_estate')"), "RE/real_estate isolation missing");
assert.match(foundation, /SECURITY DEFINER\s+SET search_path=''/s, "security-definer search_path hardening missing");
assert.ok(foundation.includes("REVOKE INSERT,UPDATE,DELETE"), "authenticated direct-write revoke missing");
assert.ok(foundation.includes("GRANT SELECT ON"), "authenticated read grant missing");

for (const rpc of [
  "re_create_property",
  "re_create_building",
  "re_create_floor",
  "re_create_unit",
  "re_create_master_lease",
  "re_create_tenant_lease",
  "re_set_tenant_lease_status",
  "re_set_master_lease_status",
  "re_link_schedule_invoice",
  "re_link_facility",
  "re_link_property_cost",
  "re_property_profitability",
]) {
  assert.ok(runtime.includes(`FUNCTION public.${rpc}`), `${rpc} RPC missing`);
}
for (const rpc of ["re_mark_schedule_paid","re_waive_schedule","re_portfolio_snapshot"]) {
  assert.ok(reporting.includes(`FUNCTION public.${rpc}`), `${rpc} reporting/billing RPC missing`);
}

assert.ok(runtime.includes("pg_advisory_xact_lock") && hardening.includes("pg_advisory_xact_lock"), "concurrent overlap/allocation locks missing");
assert.ok(runtime.includes("tenant lease overlaps another approved/active lease"), "tenant overlap rejection missing");
assert.ok(runtime.includes("master lease overlaps another approved/active lease"), "master lease overlap rejection missing");
assert.ok(hardening.includes("trg_re_tenant_overlap") && hardening.includes("trg_re_master_overlap"), "database overlap triggers missing");
assert.ok(hardening.includes("floor does not belong to unit building"), "unit hierarchy protection missing");
assert.ok(hardening.includes("invoice customer does not match tenant"), "tenant invoice integrity trigger missing");
assert.ok(runtime.includes("real-estate allocations exceed cost entry amount") && hardening.includes("real-estate allocations exceed cost entry amount"), "cost allocation cap missing");
assert.ok(runtime.includes("maintenance site is not an OM site") && runtime.includes("maintenance asset is not an OM asset"), "Gate 14 facility link isolation missing");
assert.ok(sql.includes("ML-") && sql.includes("TL-"), "lease sequential numbering missing");
assert.ok(runtime.includes("invalid tenant lease transition") && runtime.includes("invalid master lease transition"), "lease state machines missing");
assert.ok(runtime.includes("re_generate_rent_schedule") && foundation.includes("re_lease_schedules"), "rent schedule engine missing");
assert.ok(reporting.includes("re_schedule_invoice_required") && reporting.includes("re_schedule_waiver_audit_required"), "rent billing integrity constraints missing");
assert.ok(runtime.includes("scheduled_revenue") && runtime.includes("operating_margin") && runtime.includes("occupancy_rate"), "property profitability metrics missing");
assert.ok(reporting.includes("monthly_rent_roll") && reporting.includes("receivables_90_days") && reporting.includes("facility_links"), "portfolio snapshot metrics missing");

assert.ok(ui.includes('companyCode="RE"') && ui.includes('moduleKey="real_estate"'), "real-estate UI must remain behind ModuleAccessGuard");
for (const table of ["re_properties","re_tenant_leases","re_master_leases","re_lease_schedules"]) {
  assert.ok(ui.includes(`from(\"${table}\")`), `dashboard integration missing: ${table}`);
}
assert.ok(ui.includes("محرك العقارات والمرافق جاهز في الكود"), "safe not-yet-migrated UI fallback missing");

for (const text of [foundation,runtime,hardening,reporting]) {
  assert.ok(!/GRANT\s+(?:ALL|EXECUTE|SELECT).*\sTO\s+anon\b/is.test(text), "anon must not receive Gate 15 grants");
}

console.log("Gate 15 real estate & facilities static checks passed ✓");
