import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const plans = read("src/lib/onexa-plans.ts");
const tenancy = read("src/lib/tenant-context.ts");
const tenantHook = read("src/hooks/use-tenant-context.ts");
const boundary = read("src/components/tenancy/tenant-boundary.tsx");
const shell = read("src/components/layout/app-shell.tsx");
const catalog = read("src/lib/erp-apps.ts");
const launcher = read("src/routes/_authenticated/apps.tsx");
const login = read("src/routes/log.tsx");
const home = read("src/routes/index.tsx");
const guard = read("src/components/group/module-access-guard.tsx");
const authLayout = read("src/routes/_authenticated.tsx");
const architecture = read("docs/architecture/onexa-tenancy-foundation.md");
const envExample = read(".env.example");
const pkg = JSON.parse(read("package.json"));

for (const key of ["start", "business", "pro", "enterprise"]) {
  assert.ok(plans.includes(`key: "${key}"`), `subscription plan missing: ${key}`);
}
for (const limit of ["activeUsers", "legalEntities", "branches", "storageGb"]) {
  assert.ok(plans.includes(limit), `plan limit missing: ${limit}`);
}
assert.ok(plans.includes("evaluateSeatAvailability") && plans.includes("pendingInvitations"), "sub-user seat capacity helper missing");
assert.ok(plans.includes("prevent concurrent over-allocation"), "seat limits must not rely on client enforcement alone");
for (const moduleKey of ["finance", "sales", "procurement", "inventory", "projects", "facilities", "logistics", "assets", "people"]) {
  assert.ok(plans.includes(`"${moduleKey}"`) || read("src/lib/onexa-product.ts").includes(`key: "${moduleKey}"`), `ONEXA module missing: ${moduleKey}`);
}

for (const claim of ["onexa_tenant_id", "onexa_tenant_slug", "onexa_tenant_name", "onexa_plan", "onexa_tenant_status", "onexa_modules"]) {
  assert.ok(tenancy.includes(claim), `trusted tenant claim missing: ${claim}`);
}
assert.ok(tenancy.includes("appMetadata") && !tenancy.includes("user?.user_metadata"), "tenant authorization must use app_metadata only");
assert.ok(tenancy.includes('VITE_ENFORCE_ONEXA_TENANCY === "true"'), "tenant enforcement feature gate missing");
assert.ok(tenancy.includes('context.mode === "legacy"') && tenancy.includes("return true"), "legacy compatibility mode missing");
assert.ok(tenantHook.includes("user?.app_metadata"), "tenant hook must resolve trusted app_metadata");
assert.ok(boundary.includes('tenant.mode === "invalid"') && boundary.includes('tenant.claims.status === "active"'), "authenticated tenant boundary must fail closed");
assert.ok(boundary.includes("tenant.canUsePath(pathname)"), "direct authenticated routes must enforce subscription modules");
assert.ok(authLayout.includes("<TenantBoundary>"), "authenticated layout is not wrapped by the tenant boundary");

assert.ok(shell.includes("tenant.canUsePath(to)"), "ERP navigation is not filtered by subscription modules");
assert.ok(shell.includes("tenant.label.name") && shell.includes("tenant.label.plan"), "workspace and plan identity missing from ERP shell");
assert.ok(catalog.includes("subscriptionModule: OnexaModuleKey"), "ERP catalogue lacks subscription module ownership");
assert.ok(!catalog.includes("مدار —") && !catalog.includes("روافد —") && !catalog.includes("نواة —"), "customer-company brands remain in the ONEXA application catalogue");
assert.ok(launcher.includes("tenant.canUseModule(app.subscriptionModule)"), "launcher does not enforce the plan before role permissions");
assert.match(launcher, /if \(!tenant\.canUseModule\(app\.subscriptionModule\)\) return false;[\s\S]*if \(isAdmin\) return true;/, "workspace admins must not bypass plan entitlements");
assert.ok(guard.includes('tenant.mode === "tenant"') && guard.includes("tenant.canUseModule(subscriptionModule)"), "legacy module guard is not tenant-aware");

assert.ok(home.includes("ONEXA_PLANS.map"), "public plan cards are not backed by the plan catalogue");
assert.ok(home.includes("activeUsers") && home.includes("legalEntities"), "public plan limits are missing");
assert.ok(login.includes("requested_plan: planKey"), "onboarding does not capture the requested plan");
assert.ok(login.includes("TENANCY_ENFORCEMENT_ENABLED") && login.includes("resolveTenantRuntime"), "login does not enforce trusted workspace claims when enabled");
assert.ok(login.includes('VITE_ENABLE_ONEXA_SIGNUP === "true"'), "self-service signup feature gate missing");

for (const variable of ["VITE_ENABLE_ONEXA_SIGNUP=\"\"", "VITE_ENFORCE_ONEXA_TENANCY=\"\""]) {
  assert.ok(envExample.includes(variable), `safe default missing: ${variable}`);
}
assert.ok(architecture.includes("dedicated Supabase project") && architecture.includes("Tenant 001"), "dedicated-database architecture contract missing");
assert.ok(architecture.includes("app_metadata") && architecture.includes("user_metadata"), "trusted/untrusted metadata boundary is undocumented");

const migrations = existsSync("supabase/migrations") ? readdirSync("supabase/migrations") : [];
assert.ok(!migrations.some((name) => /gate27|onexa.*tenant/i.test(name)), "Gate 27 must not create a migration before 27 September 2026");

assert.equal(pkg.scripts["check:gate27-tenant-foundation"], "node scripts/check-gate27-tenant-foundation.mjs");
assert.ok(pkg.scripts.verify.includes("check:gate27-tenant-foundation"), "Gate 27 is missing from verify");

console.log("Gate 27 ONEXA tenant application foundation checks passed ✓");
