# ERP Consolidation & Unified AR/AP Architecture

This is a large, multi-phase refactor. Below is the proposed plan and structure before I touch code.

## 1. Module restructure

### Customer module — `/customers/*`
```
/customers              → Customers list (existing)
/customers/contracts    → Customer Contracts (filtered: party_type='customer')
/customers/invoices     → Sales Invoices (moved from /invoices)
/customers/collections  → Collections (incoming payments) + Collection Wizard
/customers/retention    → Retention Guarantees
/customers/aging        → Aging Analysis (moved from /receivables/aging)
/customers/intelligence → Customer & AR Intelligence (MERGED)
/customers/reports      → Reports
```

### Vendor module — `/vendors/*`
```
/vendors                → Vendors list (existing)
/vendors/contracts      → Vendor Contracts (party_type='vendor')
/vendors/invoices       → Purchase Invoices
/vendors/payments       → Payments (outgoing)
/vendors/aging          → Aging (existing)
/vendors/intelligence   → Vendor & AP Intelligence (MERGED)
/vendors/reports        → Reports
```

### Routes to remove (merged/duplicated)
- `/intelligence/customers` → merge into `/customers/intelligence`
- `/intelligence/vendors` → merge into `/vendors/intelligence`
- `/intelligence/` index → remove (replaced by per-module pages)
- `/receivables/intelligence` → merge into `/customers/intelligence`
- `/receivables/aging` → moved to `/customers/aging`
- `/payables/intelligence` → merge into `/vendors/intelligence`
- `/invoices` → moved to `/customers/invoices`
- `/suppliers` → redirect to `/vendors`
- `/contracts` → split into `/customers/contracts` and `/vendors/contracts`
- `/vendors/top` → merged into vendor intelligence

### Projects module — kept independent
`/projects/*` remains as-is, focused on project P&L, progress, cash flow, and linked contracts/invoices.

## 2. Dynamic balance engine

Create `src/lib/balance-engine.ts` as the **single source of truth**:

```
customerBalance(customerId) =
  opening_balance
  + Σ invoices.total_amount
  − Σ payments(direction='in').amount
  − Σ adjustments

vendorBalance(vendorId) =
  opening_balance
  + Σ purchase_invoices.total_amount
  − Σ payments(direction='out').amount
  − Σ adjustments
```

Refactor every dashboard, statement, aging, and intelligence page to call this engine instead of reading stored `current_balance` / `total_outstanding` columns. DB triggers (`recalc_customer_totals`, `recalc_vendor_totals`) remain as cache, but UI reads from the engine to guarantee consistency.

Add an `adjustments` table (customer_id/vendor_id, amount, type, reason, date) — used in the balance formula.

## 3. Collection Wizard — `/customers/collections/new`

Multi-step dialog:
1. **Select customer** (searchable combobox).
2. **Show unpaid/partial invoices** in a table with columns: invoice #, description, project, contract, amount, VAT, retention, total, paid, outstanding, due date, status.
3. **Allocate**: input received amount + payment method/date/reference. User distributes across selected invoices (auto-fill oldest-first, or manual per-row).
4. **Review & confirm** → creates payment row(s) with `invoice_allocations` (new table linking payment_id ↔ invoice_id ↔ amount).
5. Balances update instantly via balance engine + query invalidation.

## 4. Retention Guarantees — `/customers/retention`

New table `retention_guarantees`:
- contract_id, customer_id, project_id
- total_retention, released_amount, remaining_retention (computed)
- due_date, status

Also add `retention_amount` column to `invoices` if missing. Page shows contracts grouped with their retention; clicking opens linked invoices and their per-invoice retention values. Release action creates a payment of type `retention_release`.

## 5. Contracts split

Add `party_type` ('customer' | 'vendor') to `contracts` table (existing table already has both customer_id and vendor_id — just filter). Create two dedicated routes; remove generic `/contracts`.

## 6. Unified Intelligence Centers

Single page per module combining DSO/DPO, concentration, risk scoring, aging breakdown, top entities, sector analysis, collection/payment forecast, exposure, dependency, upcoming payments — all powered by the balance engine.

## 7. Navigation

Update `src/components/layout/app-shell.tsx` and `src/lib/mobile-modules.ts`:
- Customer group with 8 children listed above
- Vendor group with 7 children listed above
- Remove "Intelligence" top-level group
- Remove "Receivables" and "Payables" top-level groups
- Keep "Projects" as independent module

## Technical sections

### Database migrations (one migration)
1. `CREATE TABLE adjustments` (customer_id nullable, vendor_id nullable, amount, type, reason, date) + GRANTs + RLS.
2. `CREATE TABLE invoice_allocations` (payment_id, invoice_id, amount) + GRANTs + RLS.
3. `CREATE TABLE retention_guarantees` (...) + GRANTs + RLS.
4. `ALTER TABLE invoices ADD COLUMN retention_amount numeric DEFAULT 0` (if missing).
5. `ALTER TABLE contracts ADD COLUMN party_type text` + backfill from customer_id/vendor_id.
6. SQL function `public.calc_customer_balance(uuid)` and `public.calc_vendor_balance(uuid)` for server-side use.

### Files created
- `src/lib/balance-engine.ts` — client-side balance helpers
- `src/components/collections/collection-wizard.tsx`
- `src/routes/_authenticated/customers/contracts.tsx`
- `src/routes/_authenticated/customers/invoices.tsx`
- `src/routes/_authenticated/customers/collections.tsx`
- `src/routes/_authenticated/customers/retention.tsx`
- `src/routes/_authenticated/customers/aging.tsx`
- `src/routes/_authenticated/customers/intelligence.tsx`
- `src/routes/_authenticated/customers/reports.tsx`
- Vendor counterparts under `src/routes/_authenticated/vendors/`

### Files deleted
- `src/routes/_authenticated/intelligence/{index,customers,vendors}.tsx`
- `src/routes/_authenticated/receivables/{aging,intelligence}.tsx`
- `src/routes/_authenticated/payables/intelligence.tsx`
- `src/routes/_authenticated/invoices/index.tsx`
- `src/routes/_authenticated/suppliers/index.tsx`
- `src/routes/_authenticated/contracts/index.tsx`
- `src/routes/_authenticated/vendors/top.tsx`

### Files updated
- `app-shell.tsx`, `mobile-modules.ts` — navigation
- `route-permissions.ts` — new route paths
- AI assistant prompts referencing old routes
- Any dashboard reading `current_balance` directly → call balance engine

## Scope check

This is roughly 15–20 new files, 10 deleted files, 1 large migration, and updates to navigation + permissions. Estimated to be done in **3 sequenced steps** to keep each turn reviewable:

**Step A** — Migration (adjustments, invoice_allocations, retention_guarantees, contracts.party_type, balance SQL functions) + `balance-engine.ts`.
**Step B** — New customer routes + Collection Wizard + Retention page + delete old AR pages + update navigation.
**Step C** — New vendor routes + delete old AP/Intelligence pages + update AI prompts and reports.

## Questions before I start

1. Is the 3-step sequencing OK, or do you want it all in one turn?
2. The `adjustments` table is new — do you also want a UI to create/edit adjustments, or is it enough that the balance engine includes them when they exist?
3. For the Collection Wizard, default allocation strategy: **oldest invoice first** (FIFO) — confirm?
4. Should `/projects` get any of the new contract/invoice/retention tabs surfaced inside the project detail page, or stay as it is today?
