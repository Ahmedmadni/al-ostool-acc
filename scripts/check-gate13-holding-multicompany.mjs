import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260914090000_gate13_holding_multicompany_foundation.sql", "utf8");
const home = readFileSync("src/routes/index.tsx", "utf8");
const login = readFileSync("src/routes/login.tsx", "utf8");
const corePublic = readFileSync("src/routes/companies.al-ostool.tsx", "utf8");
const maintenancePublic = readFileSync("src/routes/companies.maintenance.tsx", "utf8");
const realEstatePublic = readFileSync("src/routes/companies.real-estate.tsx", "utf8");
const publicShell = readFileSync("src/components/public/company-service-page.tsx", "utf8");
const maintenanceInternal = readFileSync("src/routes/_authenticated/maintenance.tsx", "utf8");
const realEstateInternal = readFileSync("src/routes/_authenticated/real-estate.tsx", "utf8");
const accessGuard = readFileSync("src/components/group/module-access-guard.tsx", "utf8");
const sitemap = readFileSync("src/routes/sitemap[.]xml.ts", "utf8");

for (const table of [
  "group_companies",
  "group_modules",
  "group_company_modules",
  "group_user_module_access",
]) {
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`), `${table} table missing`);
  assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`), `${table} RLS missing`);
}

assert.match(migration, /partially applied/, "partial-application preflight missing");
assert.match(migration, /to_regprocedure\('public\.group_has_module_access\(text,text\)'\)/, "function partial preflight missing");
assert.match(migration, /SECURITY DEFINER\s+SET search_path=''/s, "module access RPC must use SECURITY DEFINER with empty search_path");
assert.match(migration, /REVOKE ALL ON FUNCTION public\.group_has_module_access\(TEXT,TEXT\) FROM PUBLIC,anon;/, "RPC PUBLIC/anon revoke missing");
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.group_has_module_access\(TEXT,TEXT\) TO authenticated,service_role;/, "RPC grant missing");
assert.match(migration, /REVOKE INSERT,UPDATE,DELETE ON public\.group_companies,public\.group_modules,public\.group_company_modules,public\.group_user_module_access FROM authenticated;/, "authenticated table writes must be revoked");

for (const seed of ["'HOLDING'", "'CORE'", "'OM'", "'RE'", "'corporate_erp'", "'maintenance'", "'real_estate'"]) {
  assert.ok(migration.includes(seed), `required seed ${seed} missing`);
}

assert.ok(!home.includes("redirect({"), "holding home must not redirect to internal ERP");
for (const marker of ["مجموعة الأسطول الآلي", "/companies/maintenance", "/companies/real-estate", "/login"]) {
  assert.ok(home.includes(marker), `holding home marker ${marker} missing`);
}

for (const marker of ["corporate", "maintenance", "real_estate", "/maintenance", "/real-estate", "/dashboard"]) {
  assert.ok(login.includes(marker), `login module selector marker ${marker} missing`);
}
assert.ok(login.includes("ظهور النظام لا يمنح صلاحية تلقائيًا"), "login permission disclaimer missing");

assert.ok(maintenanceInternal.includes('companyCode="OM"') && maintenanceInternal.includes('moduleKey="maintenance"'), "maintenance module guard missing");
assert.ok(realEstateInternal.includes('companyCode="RE"') && realEstateInternal.includes('moduleKey="real_estate"'), "real-estate module guard missing");
assert.ok(accessGuard.includes('rpc("group_has_module_access"'), "module access RPC guard missing");
assert.ok(accessGuard.includes('setState(!error && data === true ? "allowed" : "denied")'), "module access guard must fail closed");

for (const route of ["/companies/al-ostool", "/companies/maintenance", "/companies/real-estate"]) {
  assert.ok(sitemap.includes(route), `sitemap missing ${route}`);
}

for (const publicFile of [corePublic, maintenancePublic, realEstatePublic, publicShell, home]) {
  for (const unsafe of [".insert(", ".update(", ".delete(", ".upsert("]) {
    assert.ok(!publicFile.includes(unsafe), `public page contains direct data mutation ${unsafe}`);
  }
}

assert.ok(corePublic.includes("شركة الأسطول الآلي") && corePublic.includes("إدارة وتنفيذ المشاريع"), "core company public scope incomplete");
assert.ok(maintenancePublic.includes("صيانة التكييف") && maintenancePublic.includes("أنظمة الحريق"), "maintenance public scope incomplete");
assert.ok(realEstatePublic.includes("التأجير وإعادة التأجير") && realEstatePublic.includes("الإشغال"), "real-estate public scope incomplete");

console.log("Gate 13 holding / multi-company static checks passed ✓");
