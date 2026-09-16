#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const pkg = JSON.parse(read("package.json"));
assert.equal(
  pkg.dependencies.xlsx,
  "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",
  "SheetJS must use the patched authoritative 0.20.3 tarball",
);
const lock = JSON.parse(read("bun.lock"));

assert.equal(
  pkg.scripts["check:gate19-production"],
  "node scripts/check-gate19-production-readiness.mjs",
);
for (let gate = 10; gate <= 19; gate += 1) {
  assert.ok(
    pkg.scripts.verify.includes("check:gate" + gate),
    "verify must include Gate " + gate,
  );
}
for (const file of [
  "scripts/check-gate10-hr-integration-rls.mjs",
  "scripts/check-gate11-cost-accounting-engine.mjs",
  "scripts/check-gate12-vat-engine.mjs",
  "scripts/check-gate13-holding-multicompany.mjs",
  "scripts/check-gate14-maintenance-operations.mjs",
  "scripts/check-gate15-real-estate-facilities.mjs",
  "scripts/check-gate16-customer-service-hub.mjs",
  "scripts/check-gate17-investment-holding.mjs",
  "scripts/check-gate18-zakat-engine.mjs",
  "scripts/check-gate19-production-readiness.mjs",
]) {
  assert.ok(existsSync(join(ROOT, file)), "missing permanent checker: " + file);
}

const lockedRoot = lock.workspaces?.[""];
assert.ok(lockedRoot, "bun.lock root workspace is missing");
for (const section of ["dependencies", "devDependencies"]) {
  assert.deepEqual(
    lockedRoot[section],
    pkg[section],
    "bun.lock " + section + " drifted from package.json",
  );
}

for (const migration of [
  "20260914090000_gate13_holding_multicompany_foundation.sql",
  "20260914110000_gate14_maintenance_operations_engine.sql",
  "20260914120100_gate15_real_estate_foundation.sql",
  "20260914130000_gate16_customer_service_hub.sql",
  "20260915190000_gate17_portfolio_it_foundation.sql",
  "20260916120000_gate18_zakat_engine_hardening.sql",
]) {
  assert.ok(
    existsSync(join(ROOT, "supabase/migrations", migration)),
    "missing completed-gate migration: " + migration,
  );
}

const rootRoute = read("src/routes/__root.tsx");
for (const marker of [
  'lang="ar"',
  'dir="rtl"',
  'name: "viewport"',
  'rel: "manifest"',
  'import("../lib/pwa/register-sw")',
]) {
  assert.ok(rootRoute.includes(marker), "root PWA/RTL marker missing: " + marker);
}

const vite = read("vite.config.ts");
for (const marker of [
  "VitePWA(",
  'registerType: "autoUpdate"',
  'strategies: "generateSW"',
  'navigateFallback: "/offline.html"',
  "navigateFallbackDenylist",
  "/^\\/api\\//",
  "cleanupOutdatedCaches: true",
]) {
  assert.ok(vite.includes(marker), "PWA configuration marker missing: " + marker);
}
const sw = read("src/lib/pwa/register-sw.ts");
assert.ok(sw.includes('import.meta.env.PROD'), "service worker must be production-only");
assert.ok(sw.includes("navigator.serviceWorker"), "service worker registration is missing");

const manifest = JSON.parse(read("public/manifest.webmanifest"));
assert.equal(manifest.lang, "ar");
assert.equal(manifest.dir, "rtl");
assert.ok(["standalone", "fullscreen"].includes(manifest.display));
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);

const routeTree = read("src/routeTree.gen.ts");
for (const marker of [
  "/apps",
  "/customer-service",
  "/maintenance",
  "/real-estate",
  "/technology",
  "/companies/technology",
  "/api/public/service-request",
]) {
  assert.ok(routeTree.includes(marker), "generated route is missing: " + marker);
}

const routePermissions = read("src/lib/route-permissions.ts");
for (const marker of [
  '"/apps"',
  '"/customer-service"',
  '"/maintenance"',
  '"/real-estate"',
  '"/technology"',
]) {
  assert.ok(
    routePermissions.includes(marker),
    "permission coverage is missing: " + marker,
  );
}

const publicRequest = read("src/routes/api/public/service-request.ts");
for (const marker of [
  "MAX_BODY_BYTES",
  "RequestSchema.safeParse",
  "new URL(origin).host",
  "parsed.data.website",
  "sourceHash(request)",
  'await import("@/integrations/supabase/client.server")',
  '"cs_public_submit_ticket"',
]) {
  assert.ok(
    publicRequest.includes(marker),
    "public request hardening marker missing: " + marker,
  );
}

const client = read("src/integrations/supabase/client.ts");
assert.ok(client.includes("VITE_SUPABASE_PUBLISHABLE_KEY"));
assert.ok(!client.includes("SERVICE_ROLE"), "service role key leaked into browser client");
const envExample = read(".env.example");
assert.ok(!envExample.includes("SERVICE_ROLE"), "service role must not be advertised to the client");
for (const line of envExample.split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const value = line.slice(line.indexOf("=") + 1).trim();
  assert.ok(value === "" || value === '""', "example environment value must stay blank");
}

const suspicious = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if ([".git", "node_modules", "dist", ".output"].includes(entry)) continue;
    const absolute = join(dir, entry);
    const path = relative(ROOT, absolute).replaceAll("\\", "/");
    if (statSync(absolute).isDirectory()) {
      walk(absolute);
      continue;
    }
    if (
      /^\.github\/workflows\/gate\d+/i.test(path) ||
      /(^|\/)(tmp|temp)[-_]/i.test(path) ||
      /(^|\/)fixtures?\//i.test(path) ||
      /\.(orig|rej)$/.test(path)
    ) suspicious.push(path);
  }
}
walk(ROOT);
assert.deepEqual(suspicious, [], "temporary Gate artifacts remain: " + suspicious.join(", "));

console.log("Gate 19 production-readiness checks passed ✓");
