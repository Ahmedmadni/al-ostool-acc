#!/usr/bin/env node
import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("./migration-manifest.json", import.meta.url), "utf8"),
);

console.log(manifest.title);
console.log("Production state: " + manifest.execution_policy.production_state);
console.log(
  "Schema changes not before: " +
    manifest.execution_policy.schema_changes_not_before +
    " (" +
    manifest.execution_policy.timezone +
    ")",
);
console.log("Execution mode: " + manifest.execution_policy.execution_mode);
console.log("");

let total = 0;
for (const batch of manifest.batches) {
  console.log(batch.id + " — " + batch.label + " [" + batch.risk + "]");
  for (const migration of batch.migrations) {
    total += 1;
    console.log("  " + String(total).padStart(2, "0") + ". " + migration);
  }
  console.log("");
}
console.log("Candidate migrations: " + total);
console.log("Preflight decides which candidates are actually pending; never run this list blindly.");
