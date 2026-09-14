import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const preflight = readFileSync("supabase/migrations/20260914105900_gate14_maintenance_preflight.sql", "utf8");
const foundation = readFileSync("supabase/migrations/20260914110000_gate14_maintenance_operations_engine.sql", "utf8");
const runtime = readFileSync("supabase/migrations/20260914110100_gate14_maintenance_runtime.sql", "utf8");
const authorization = readFileSync("supabase/migrations/20260914110200_gate14_maintenance_authorization_hardening.sql", "utf8");
const integrity = readFileSync("supabase/migrations/20260914110300_gate14_maintenance_integrity_hardening.sql", "utf8");
const allSql = [preflight, foundation, runtime, authorization, integrity].join("\n");
const maintenance = readFileSync("src/routes/_authenticated/maintenance.tsx", "utf8");

const tables = [
  "ops_sites",
  "ops_sla_policies",
  "ops_assets",
  "ops_service_requests",
  "ops_work_orders",
  "ops_work_order_assignments",
  "ops_work_visits",
  "ops_work_order_materials",
  "ops_subcontract_costs",
  "ops_work_acceptances",
  "ops_preventive_plans",
  "ops_status_events",
];
for (const table of tables) {
  assert.match(foundation, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`), `${table} missing`);
  assert.ok(preflight.includes(`to_regclass('public.${table}')`), `${table} missing from full partial-application preflight`);
}
assert.ok(preflight.includes("v_expected constant integer := 15"), "full Gate 14 partial-state marker count missing");
assert.ok(preflight.includes("ops_service_request_seq") && preflight.includes("ops_work_order_seq"), "sequence partial-state markers missing");
assert.ok(preflight.includes("ops_create_service_request(uuid,uuid,uuid,text,text,text,uuid)"), "RPC partial-state marker missing");

for (const dependency of [
  "public.customers",
  "public.contracts",
  "public.hr_employees",
  "public.vendors",
  "public.inventory_items",
  "public.cost_entries",
]) {
  assert.ok(foundation.includes(`to_regclass('${dependency}')`), `dependency preflight missing: ${dependency}`);
}

assert.ok(foundation.includes("group_has_module_access(c.code,'maintenance')"), "Gate 13 module access integration missing");
assert.ok(foundation.includes("c.code='OM'"), "maintenance company isolation missing");
assert.match(foundation, /SECURITY DEFINER\s+SET search_path=''/s, "security definer posture missing");
assert.ok(foundation.includes("REVOKE INSERT,UPDATE,DELETE"), "authenticated direct write revoke missing");
assert.ok(foundation.includes("GRANT SELECT ON"), "authenticated read grant missing");

for (const rpc of [
  "ops_create_service_request",
  "ops_create_work_order",
  "ops_transition_work_order",
  "ops_accept_work_order",
  "ops_work_order_cost",
  "ops_upsert_sla_policy",
  "ops_create_site",
  "ops_create_asset",
  "ops_set_request_status",
  "ops_assign_employee",
  "ops_record_visit",
  "ops_add_material",
  "ops_add_subcontract_cost",
]) {
  assert.ok(allSql.includes(`FUNCTION public.${rpc}`), `${rpc} RPC missing`);
}

for (const status of ["draft","approved","assigned","in_progress","on_hold","completed","accepted","cancelled"]) {
  assert.ok(allSql.includes(`'${status}'`), `work-order status ${status} missing`);
}

assert.ok(runtime.includes("invalid service request transition"), "service-request state machine missing");
assert.ok(runtime.includes("invalid work order transition"), "work-order state machine missing");
assert.ok(runtime.includes("work order requires an active assignment"), "assignment completion guard missing");
assert.ok(runtime.includes("work order requires a completed visit"), "completed visit guard missing");
assert.ok(authorization.includes("ops_require_manager(r.company_id)"), "service-request approval/closure manager authorization missing");
assert.ok(authorization.includes("service request must be approved before conversion"), "work order must require approved request");
assert.ok(integrity.includes("contract does not belong to customer"), "contract/customer integrity validation missing");
assert.ok(integrity.includes("site does not belong to maintenance company/customer"), "site ownership validation missing");
assert.ok(integrity.includes("asset does not belong to maintenance company/customer/site"), "asset ownership validation missing");
assert.match(integrity, /FUNCTION public\.ops_work_order_cost[\s\S]*ops_has_company_access\(v_company\)/, "cost RPC must fail closed on company/module access");
assert.ok(foundation.includes("response_due_at") && foundation.includes("resolution_due_at"), "SLA due timestamps missing");
assert.ok(foundation.includes("ops_preventive_plans"), "preventive maintenance foundation missing");
assert.ok(foundation.includes("inventory_item_id uuid REFERENCES public.inventory_items"), "inventory integration missing");
assert.ok(foundation.includes("vendor_id uuid REFERENCES public.vendors"), "vendor integration missing");
assert.ok(foundation.includes("cost_entry_id uuid REFERENCES public.cost_entries"), "cost ledger linkage missing");
assert.ok(foundation.includes("employee_id uuid NOT NULL REFERENCES public.hr_employees"), "HR technician assignment integration missing");
assert.ok(foundation.includes("SR-") && foundation.includes("WO-"), "sequential operational document numbering missing");

assert.ok(maintenance.includes('companyCode="OM"') && maintenance.includes('moduleKey="maintenance"'), "maintenance UI must remain behind ModuleAccessGuard");
assert.ok(maintenance.includes("ops_service_requests") && maintenance.includes("ops_work_orders"), "maintenance dashboard must surface live operations");

for (const sql of [preflight, foundation, runtime, authorization, integrity]) {
  assert.ok(!/TO anon\s*;/i.test(sql), "anon must not receive operational grants");
}
assert.ok(foundation.includes("GRANT ALL ON") && foundation.includes("TO service_role"), "service-role operational grants missing");

console.log("Gate 14 maintenance operations static checks passed ✓");
