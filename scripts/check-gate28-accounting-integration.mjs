import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const contracts = read("src/lib/accounting/posting-contracts.ts");
const readiness = read("src/lib/accounting/posting-readiness.ts");
const reports = read("src/lib/reporting/report-catalog.ts");
const overview = read("src/components/accounting/integration-overview.tsx");
const launcher = read("src/routes/_authenticated/apps.tsx");
const shell = read("src/components/layout/app-shell.tsx");
const architecture = read("docs/architecture/onexa-accounting-integration.md");
const pkg = JSON.parse(read("package.json"));

for (const documentType of [
  "sales_invoice", "customer_receipt", "purchase_invoice", "supplier_payment",
  "inventory_receipt", "inventory_issue", "payroll_run", "fixed_asset_acquisition",
  "depreciation_run", "project_cost", "maintenance_work_order_cost", "lease_invoice",
  "lease_receipt", "fleet_trip_cost", "fuel_issue", "bank_transfer",
]) {
  assert.ok(contracts.includes(`documentType: "${documentType}"`), `posting contract missing: ${documentType}`);
  assert.ok(reports.includes(`"${documentType}"`), `report lineage missing: ${documentType}`);
}

for (const status of ["draft", "submitted", "approved", "posted", "rejected", "cancelled", "reversed"]) {
  assert.ok(contracts.includes(`${status}: [`), `document lifecycle state missing: ${status}`);
}
assert.ok(contracts.includes('posted: ["reversed"]'), "posted documents must be corrected by reversal only");
assert.ok(!contracts.includes('posted: ["draft"') && !contracts.includes('posted: ["cancelled"'), "posted documents must be immutable");

for (const invariant of [
  "buildPostingIdempotencyKey", "onexa-posting-v1", "journal_must_balance",
  "document_must_be_approved", "fiscal_period_required", "dimension_required",
]) assert.ok(readiness.includes(invariant), `posting preflight invariant missing: ${invariant}`);

for (const report of [
  "general_ledger", "trial_balance", "balance_sheet", "income_statement", "cash_flow",
  "vat_return", "ar_aging", "ap_aging", "inventory_valuation", "project_profitability",
  "maintenance_cost", "fixed_asset_register", "payroll_cost", "lease_portfolio", "fleet_cost",
]) assert.ok(reports.includes(`key: "${report}"`), `connected report missing: ${report}`);

assert.ok(overview.includes("POSTING_CONTRACTS.length") && overview.includes("ONEXA_REPORTS.length"), "integration overview is not backed by live catalogues");
assert.ok(launcher.includes("<AccountingIntegrationOverview />"), "accounting integration is not visible in the app launcher");

const assetsStart = shell.indexOf('key: "assets"');
const financialsStart = shell.indexOf('key: "financials"');
const reportsStart = shell.indexOf('key: "reports"');
assert.ok(assetsStart >= 0 && financialsStart > assetsStart && reportsStart > financialsStart, "navigation group order changed unexpectedly");
assert.ok(!shell.slice(assetsStart, financialsStart).includes('to: "/trial-balance"'), "trial balance remains under fixed assets");
assert.ok(shell.slice(financialsStart, reportsStart).includes('to: "/trial-balance"'), "trial balance is missing from general ledger navigation");

for (const phrase of ["one database transaction", "immutable journal", "app_metadata", "source document → journal entry/reversal"]) {
  assert.ok(architecture.includes(phrase), `architecture contract missing: ${phrase}`);
}

const migrations = existsSync("supabase/migrations") ? readdirSync("supabase/migrations") : [];
assert.ok(!migrations.some((name) => /gate28|onexa.*posting/i.test(name)), "Gate 28 must not create a migration before 27 September 2026");
assert.equal(pkg.scripts["check:gate28-accounting-integration"], "node scripts/check-gate28-accounting-integration.mjs");
assert.ok(pkg.scripts.verify.includes("check:gate28-accounting-integration"), "Gate 28 is missing from verify");

console.log("Gate 28 ONEXA connected accounting integration checks passed ✓");
