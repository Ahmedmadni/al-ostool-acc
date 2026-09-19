# Tenant 001 — Al-Ostool activation runbook

Status: application package ready; Supabase execution deferred until 27 September 2026.

Al-Ostool is represented only as the first ONEXA customer workspace. It is not a product identity, global default, or authorization bypass. The authoritative application manifest is `src/data/tenant-seeds/al-ostool.ts`.

## Prepared workspace

- Tenant ID: `tenant-001-al-ostool`
- Tenant number: `001`
- Slug: `al-ostool-alaali`
- Target plan: `enterprise`
- Locale and timezone: `ar-SA`, `Asia/Riyadh`
- Default legal entity: `AOA`
- Default branch: `RUH-HQ`
- Base currency: `SAR`
- Enabled modules: all ONEXA modules
- User assignments: intentionally empty

No commercial registration, VAT registration, bank account, person, email, credential, opening balance, or production secret has been invented or embedded in the seed.

## Required confirmations before activation

1. Verify the exact Arabic and English legal names.
2. Supply and verify the commercial registration and VAT registration numbers.
3. Confirm fiscal-year start and opening-balance cut-off date.
4. Select the existing authenticated user who will become workspace owner.
5. Map existing company and branch codes to `AOA` and `RUH-HQ`.
6. Classify legacy `OM` records under Projects / Maintenance & Operations.
7. Classify legacy `RE` records under Facilities & Real Estate.
8. Decide the destination of any legacy `IT` records instead of creating a fictitious legal entity.

## Activation sequence on or after 27 September 2026

1. Freeze writes for the agreed maintenance window and take a verified database backup/export.
2. Record row counts and financial control totals for journals, trial balance, customers, vendors, invoices, projects, payroll, inventory, assets, maintenance and facilities.
3. Apply the reviewed ONEXA migrations in their documented order through Supabase SQL Editor.
4. Run security and performance advisors and resolve every high-severity finding.
5. Create the Tenant 001 control-plane/workspace records from the validated manifest.
6. Map existing legal-entity, branch and module data; do not duplicate operational transactions.
7. Assign the workspace owner and roles through a trusted server/admin operation.
8. Write tenant authorization only to `app_metadata`; never use user-editable metadata.
9. Refresh/revoke affected sessions so new claims become effective.
10. Reconcile row counts, debit/credit totals, receivables, payables, inventory value, payroll liabilities and fixed-asset balances.
11. Enable tenancy enforcement for internal users first, then progressively for the workspace.
12. Sign off and reopen writes only after the isolation and financial reconciliation tests pass.

## Mandatory isolation tests

- A user without valid Tenant 001 membership cannot open any authenticated route.
- A user cannot read, insert, update, delete or invoke RPCs against another tenant.
- Workspace administrators cannot enable modules outside the subscription.
- Updates have both `USING` and `WITH CHECK` ownership predicates.
- Every exposed table has RLS and explicit grants.
- Views use invoker security or are kept outside exposed schemas.
- No browser bundle contains a service-role or secret key.
- Missing or stale tenant claims fail closed after enforcement is enabled.

## Financial acceptance tests

- Opening trial balance remains balanced by legal entity and branch.
- Posted journals are immutable and corrections use linked reversals.
- Each source document posts once for each revision.
- Customer and vendor aging reconcile to control accounts.
- Inventory valuation reconciles to inventory ledger accounts.
- Payroll, project cost, maintenance, fixed assets, VAT and cash reports trace back to source documents.

## Rollback conditions

Rollback before reopening writes if tenant isolation fails, control totals differ, journals become unbalanced, required identifiers are missing, or any high-severity advisor issue remains unresolved. Restore the verified backup, keep `VITE_ENFORCE_ONEXA_TENANCY` disabled, document the failed check, and correct the migration package before retrying.
