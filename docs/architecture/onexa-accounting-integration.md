# ONEXA connected accounting integration

Gate 28 defines the application contract that connects operational modules to the general ledger and analytical reports. It deliberately creates no database migration; database implementation remains deferred until 27 September 2026.

## Operating model

Every financially relevant record follows one lifecycle:

`draft → submitted → approved → posted → reversed`

Rejected documents may return to draft. Cancelled documents are terminal. A posted document is immutable: a correction creates a linked reversal, then a new source revision. No module may update or delete posted journal lines.

## Posting boundary

The catalogue in `src/lib/accounting/posting-contracts.ts` is the source-independent contract for sixteen document types across finance, sales, procurement, inventory, projects, facilities, logistics, assets, and people.

For each source type it defines:

- the owning ONEXA module and approved status trigger;
- the debit and credit account roles, not hard-coded account IDs;
- required and optional analytical dimensions;
- downstream financial and operating reports;
- reversal-only correction behavior.

Account-role mapping belongs to each tenant/legal entity. This lets different companies use different charts of accounts without changing product code.

## Required server transaction

The future Supabase RPC must be the only write path from an approved source document to the ledger. Within one database transaction it must:

1. Resolve the authenticated tenant from trusted server claims, never request JSON.
2. Lock the source document, fiscal period, and stable idempotency key.
3. Verify tenant, legal entity, status, permissions, open period, account mapping, dimensions, currency, tax and balanced totals.
4. Insert an immutable journal header and journal lines with source type, source ID, source revision, tenant, entity and dimensions.
5. Mark the source as posted and store the journal ID.
6. Append an audit event and return the existing journal on a safe retry.

`onexa-posting-v1:{tenant}:{entity}:{sourceType}:{sourceId}:{revision}` is the application idempotency format. The database must enforce an equivalent unique constraint and advisory lock.

## Tenant isolation

All ledger headers, lines, mappings, fiscal periods, dimensions and report sources require tenant ownership. RLS must fail closed and derive tenant identity from trusted `app_metadata` or server-maintained membership tables. Client-provided tenant IDs are filters only after the server has resolved and verified membership.

Dedicated-database enterprise tenants use the same posting contract and report catalogue; only the resolved Supabase project changes.

## Reporting lineage

`src/lib/reporting/report-catalog.ts` maps every operational source to financial and analytical reports. General ledger and trial balance consume all posted documents. Specialist reports retain source dimensions such as customer, vendor, project, contract, warehouse, asset, property, vehicle, employee and cost center.

Every report row must be traceable in both directions:

- report → journal line → journal header → source document and revision;
- source document → journal entry/reversal → impacted reports.

## Deferred database objects

The post-27-September migration should add or normalize:

- tenant-scoped journal headers and journal lines;
- source-document posting registry and idempotency uniqueness;
- tenant/legal-entity account-role mappings;
- fiscal-period locking and close controls;
- analytical dimension columns or bridge tables;
- posting, reversal and traceability RPCs;
- RLS policies, grants, audit events and regression tests.

Existing cost, payroll, VAT and financial-statement engines should be adapted behind this boundary rather than duplicated.
