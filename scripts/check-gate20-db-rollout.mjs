#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const manifest = JSON.parse(read("scripts/production-db/migration-manifest.json"));
const pkg = JSON.parse(read("package.json"));

assert.equal(manifest.schema_version, 1);
assert.equal(manifest.execution_policy.production_state, "NOT_STARTED");
assert.equal(
  manifest.execution_policy.execution_mode,
  "manual_lovable_supabase_sql_editor",
);
assert.equal(
  manifest.execution_policy.schema_changes_not_before,
  "2026-09-27",
);
assert.equal(manifest.execution_policy.requires_read_only_preflight, true);
assert.equal(manifest.execution_policy.requires_postflight_after_each_batch, true);

const migrations = manifest.batches.flatMap((batch) => batch.migrations);
assert.equal(migrations.length, 23, "Gate 20 must track all 23 candidate migrations");
assert.equal(new Set(migrations).size, migrations.length, "migration paths must be unique");

let previousVersion = "";
for (const path of migrations) {
  assert.ok(existsSync(join(ROOT, path)), "missing migration: " + path);
  const file = path.split("/").at(-1);
  const version = file.split("_")[0];
  assert.match(version, /^\d{14}$/);
  assert.ok(version > previousVersion, "migrations are not strictly ordered: " + path);
  previousVersion = version;
}

function executableSql(source) {
  return source
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'(?:''|[^'])*'/g, "''")
    .toLowerCase();
}

for (const path of [
  "scripts/production-db/preflight-readonly.sql",
  "scripts/production-db/postflight-readonly.sql",
]) {
  const sql = read(path);
  const executable = executableSql(sql);
  assert.ok(executable.includes("set transaction read only"));
  assert.ok(executable.includes("set local statement_timeout"));
  assert.ok(executable.includes("set local lock_timeout"));
  assert.ok(executable.trimEnd().endsWith("rollback;"));
  assert.ok(!/\b(insert|update|delete|merge|truncate|drop|alter|create|grant|revoke|call|copy)\b/.test(executable), path + " must remain read-only");
}

const runbook = read("docs/production-db-rollout.md");
for (const marker of [
  "27-09-2026",
  "NOT STARTED",
  "Query succeeded",
  "Preflight",
  "Postflight",
  "لا تشغّل",
  "supabase_migrations",
]) {
  assert.ok(runbook.includes(marker), "runbook marker missing: " + marker);
}

assert.equal(
  pkg.scripts["check:gate20-db-rollout"],
  "node scripts/check-gate20-db-rollout.mjs",
);
assert.equal(pkg.scripts["db:plan"], "node scripts/production-db/print-plan.mjs");
assert.ok(pkg.scripts.verify.includes("check:gate20-db-rollout"));

console.log("Gate 20 deferred database rollout checks passed ✓");
