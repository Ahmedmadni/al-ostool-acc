import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260914090000_gate13_holding_multicompany_foundation.sql", "utf8");
const home = readFileSync("src/routes/index.tsx", "utf8");
const portfolio = readFileSync("src/data/group-portfolio.ts", "utf8");
const login = readFileSync("src/routes/log.tsx", "utf8");
const legacyLogin = readFileSync("src/routes/login.tsx", "utf8");
const publicHeader = readFileSync("src/components/public/public-site-header.tsx", "utf8");
const corePublic = readFileSync("src/routes/companies.al-ostool.tsx", "utf8");
const maintenancePublic = readFileSync("src/routes/companies.maintenance.tsx", "utf8");
const realEstatePublic = readFileSync("src/routes/companies.real-estate.tsx", "utf8");
const publicShell = readFileSync("src/components/public/company-service-page.tsx", "utf8");
const maintenanceInternal = readFileSync("src/routes/_authenticated/maintenance.tsx", "utf8");
const realEstateInternal = readFileSync("src/routes/_authenticated/real-estate.tsx", "utf8");
const accessGuard = readFileSync("src/components/group/module-access-guard.tsx", "utf8");
const sitemap = readFileSync("src/routes/sitemap[.]xml.ts", "utf8");

for (const table of ["group_companies", "group_modules", "group_company_modules", "group_user_module_access"]) {
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

assert.ok(!home.includes("redirect({"), "ONEXA home must not redirect to internal ERP");
assert.ok(home.includes("ONEXA") && home.includes("onexaModules"), "ONEXA product home marker missing");
for (const route of ["/companies/al-ostool", "/companies/maintenance", "/companies/real-estate"]) {
  assert.ok(portfolio.includes(route), `Tenant 001 portfolio seed is missing ${route}`);
}
assert.ok(publicHeader.includes('href="/log"') && publicHeader.includes('/log?mode=signup'), "ONEXA authentication entry points are missing");

assert.ok(login.includes('createFileRoute("/log")'), "canonical product login must be /log");
assert.ok(login.includes("noindex, nofollow, noarchive"), "product login must be excluded from search indexing");
assert.ok(login.includes('navigate({ to: "/apps" })'), "unified login must land on the ERP apps launcher");
assert.ok(login.includes("One workspace for every business operation.") && login.includes("مساحة عمل واحدة لكل عمليات شركتك."), "unified ONEXA login message missing");
assert.ok(!login.includes("selectedSystem"), "legacy separate-system selector must not return");
assert.ok(legacyLogin.includes('redirect({ to: "/log", replace: true })'), "legacy /login route must redirect to /log");

assert.ok(maintenanceInternal.includes('companyCode="OM"') && maintenanceInternal.includes('moduleKey="maintenance"'), "maintenance module guard missing");
assert.ok(realEstateInternal.includes('companyCode="RE"') && realEstateInternal.includes('moduleKey="real_estate"'), "real-estate module guard missing");
assert.ok(accessGuard.includes('rpc("group_has_module_access"'), "module access RPC guard missing");
assert.ok(accessGuard.includes('setState(!error && data === true ? "allowed" : "denied")'), "module access guard must fail closed");

assert.ok(sitemap.includes('path: "/"'), "ONEXA sitemap home entry missing");
assert.ok(!sitemap.includes("/companies/al-ostool"), "legacy customer pages must not remain in the public sitemap");

for (const publicFile of [corePublic, maintenancePublic, realEstatePublic, publicShell, home]) {
  for (const unsafe of [".insert(", ".update(", ".delete(", ".upsert("]) {
    assert.ok(!publicFile.includes(unsafe), `public page contains direct data mutation ${unsafe}`);
  }
}
for (const legacyRoute of [corePublic, maintenancePublic, realEstatePublic]) {
  assert.ok(legacyRoute.includes('throw redirect({ to: "/"'), "legacy customer page must redirect to the ONEXA product home");
}

console.log("Gate 13 multi-company foundation and ONEXA product separation checks passed ✓");
