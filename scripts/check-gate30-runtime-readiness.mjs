import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const flags = read("src/lib/runtime-flags.ts");
const posting = read("src/lib/accounting/posting-service.ts");
const workspace = read("src/lib/provisioning/workspace-service.ts");
const hook = read("src/hooks/use-workspace-overview.ts");
const panel = read("src/components/tenancy/workspace-subscription-panel.tsx");
const launcher = read("src/routes/_authenticated/apps.tsx");
const architecture = read("docs/architecture/onexa-runtime-readiness.md");
const env = read(".env.example");
const pkg = JSON.parse(read("package.json"));

for (const key of ["VITE_ENABLE_ONEXA_PROVISIONING", "VITE_ENABLE_ONEXA_POSTING"]) {
  assert.ok(env.includes(`${key}=""`), `${key} must remain fail-closed in the example environment`);
  assert.ok(flags.includes(`import.meta.env.${key} === "true"`), `${key} runtime gate is missing`);
}

for (const invariant of [
  "evaluatePostingReadiness", "ONEXA_POSTING_ENABLED", 'rpc("onexa_post_journal"',
  'rpc("onexa_reverse_journal"', "journal_requires_two_lines", "ONEXA_REVERSAL_REASON_REQUIRED",
]) assert.ok(posting.includes(invariant), `posting runtime invariant missing: ${invariant}`);
assert.ok(!posting.includes("service_role") && !posting.includes("user_metadata"), "client posting service must not use privileged or editable identity data");

for (const table of [
  "onexa_workspace", "onexa_workspace_memberships", "onexa_workspace_invitations",
  "onexa_legal_entities", "onexa_branches", "onexa_module_entitlements",
]) assert.ok(workspace.includes(`from("${table}")`), `workspace runtime query missing: ${table}`);
for (const invariant of ["ONEXA_PROVISIONING_ENABLED", 'rpc("onexa_reserve_invitation"', "evaluateSeatAvailability"]) {
  assert.ok(workspace.includes(invariant), `workspace runtime invariant missing: ${invariant}`);
}
assert.ok(!workspace.includes("service_role") && !workspace.includes("user_metadata"), "workspace client must not use privileged or editable identity data");

assert.ok(hook.includes("enabled: ONEXA_PROVISIONING_ENABLED") && hook.includes('tenant.claims.status === "active"'), "workspace query is not fail-closed");
for (const label of ["المقاعد", "الكيانات القانونية", "الفروع", "الموديولات", "حجز دعوة"]) {
  assert.ok(panel.includes(label), `workspace panel missing: ${label}`);
}
assert.ok(launcher.includes("<WorkspaceSubscriptionPanel />"), "workspace readiness is not visible in the app launcher");

for (const phrase of ["Fail-closed feature switches", "tenant advisory lock", "one transaction", "Activation order"]) {
  assert.ok(architecture.includes(phrase), `runtime architecture contract missing: ${phrase}`);
}

const migrations = existsSync("supabase/migrations") ? readdirSync("supabase/migrations") : [];
assert.ok(!migrations.some((name) => /gate30|runtime.?readiness/i.test(name)), "Gate 30 must not create a migration before manual activation");
assert.equal(pkg.scripts["check:gate30-runtime-readiness"], "node scripts/check-gate30-runtime-readiness.mjs");
assert.ok(pkg.scripts.verify.includes("check:gate30-runtime-readiness"), "Gate 30 is missing from verify");

console.log("Gate 30 ONEXA runtime readiness checks passed ✓");
