import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const seedTypes = read("src/lib/provisioning/tenant-seed.ts");
const seed = read("src/data/tenant-seeds/al-ostool.ts");
const runbook = read("docs/runbooks/tenant-001-al-ostool-activation.md");
const product = read("src/lib/onexa-product.ts");
const shell = read("src/components/layout/app-shell.tsx");
const home = read("src/routes/index.tsx");
const env = read(".env.example");
const pkg = JSON.parse(read("package.json"));

for (const invariant of [
  'tenantId: "tenant-001-al-ostool"', 'tenantNumber: 1', 'tenantSlug: "al-ostool-alaali"',
  'planKey: "enterprise"', 'migrationState: "application_ready"', 'locale: "ar-SA"',
  'timezone: "Asia/Riyadh"', 'baseCurrency: "SAR"', 'code: "AOA"', 'code: "RUH-HQ"',
]) assert.ok(seed.includes(invariant), `Tenant 001 seed invariant missing: ${invariant}`);

assert.ok(seed.includes("enabledModules: onexaModuleKeys"), "Tenant 001 must preserve all ONEXA modules");
assert.ok(seed.includes("userAssignments: []"), "application seed must not bind real users");
for (const sensitivePlaceholder of [
  "commercial_registration_number", "vat_registration_number", "workspace_owner_user_id",
  "opening_balances_cutoff_date",
]) assert.ok(seed.includes(sensitivePlaceholder), `required activation input missing: ${sensitivePlaceholder}`);

for (const role of [
  "workspace_owner", "finance_manager", "accountant", "project_manager", "hr_manager", "auditor_readonly",
]) assert.ok(seed.includes(`key: "${role}"`), `Tenant 001 role seed missing: ${role}`);

for (const validator of [
  "validateTenantSeed", "duplicate_modules", "module_outside_plan", "legal_entity_limit_exceeded",
  "branch_limit_exceeded", "one_default_legal_entity_required", "one_default_branch_required",
  "seed_must_not_assign_users", "buildTrustedTenantAppMetadata", "buildTenantProvisioningPreview",
]) assert.ok(seedTypes.includes(validator), `tenant seed validation missing: ${validator}`);
assert.ok(seedTypes.includes("trusted server/admin provisioning operation only"), "app_metadata payload lacks trusted-operation warning");

for (const section of [
  "Required confirmations before activation", "Activation sequence on or after 27 September 2026",
  "Mandatory isolation tests", "Financial acceptance tests", "Rollback conditions",
]) assert.ok(runbook.includes(section), `Tenant 001 runbook section missing: ${section}`);
assert.ok(runbook.includes("service-role or secret key") && runbook.includes("USING") && runbook.includes("WITH CHECK"), "security acceptance checks are incomplete");
assert.ok(runbook.includes("Customer and vendor aging reconcile") && runbook.includes("Opening trial balance remains balanced"), "financial reconciliation checks are incomplete");

for (const brandedSurface of [product, shell, home]) {
  assert.ok(!brandedSurface.includes("Al-Ostool Al-Ali Contracting Company"), "Tenant 001 identity leaked into ONEXA product UI");
  assert.ok(!brandedSurface.includes("شركة الأسطول الآلي للمقاولات"), "Tenant 001 Arabic identity leaked into ONEXA product UI");
}
assert.ok(env.includes('VITE_ENFORCE_ONEXA_TENANCY=""'), "tenancy enforcement safe default changed before migration");

const migrations = existsSync("supabase/migrations") ? readdirSync("supabase/migrations") : [];
assert.ok(!migrations.some((name) => /gate29|tenant.?001|al.?ostool.*tenant/i.test(name)), "Gate 29 must not create a migration before 27 September 2026");
assert.equal(pkg.scripts["check:gate29-tenant001-seed"], "node scripts/check-gate29-tenant001-seed.mjs");
assert.ok(pkg.scripts.verify.includes("check:gate29-tenant001-seed"), "Gate 29 is missing from verify");

console.log("Gate 29 Tenant 001 application seed and activation readiness checks passed ✓");
