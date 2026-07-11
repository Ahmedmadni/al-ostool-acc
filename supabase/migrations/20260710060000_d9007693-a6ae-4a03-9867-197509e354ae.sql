-- Adds a real current/non-current classification to the chart of accounts so
-- liquidity KPIs (current ratio, quick ratio, working capital) stop assuming a
-- flat 60%/50% split of total assets/liabilities whenever no account matches
-- the old code-prefix heuristic. Backfilled once from that same heuristic so
-- existing data isn't left unclassified, but the column is now the source of
-- truth and can be corrected per account going forward.

ALTER TABLE public.chart_of_accounts
  ADD COLUMN IF NOT EXISTS is_current boolean;

COMMENT ON COLUMN public.chart_of_accounts.is_current IS
  'Current (true) vs non-current (false) classification, relevant for assets/liabilities category accounts. NULL = not yet classified.';

-- Backfill: codes starting with 11/12 => current assets, 21/22 => current liabilities.
-- Mirrors the previous client-side regex so behaviour doesn't change for already-tagged
-- accounts, but the result is now persisted and auditable/correctable per account.
UPDATE public.chart_of_accounts
SET is_current = true
WHERE is_current IS NULL
  AND category = 'assets'
  AND (code LIKE '11%' OR code LIKE '12%');

UPDATE public.chart_of_accounts
SET is_current = false
WHERE is_current IS NULL
  AND category = 'assets'
  AND code !~ '^1[12]';

UPDATE public.chart_of_accounts
SET is_current = true
WHERE is_current IS NULL
  AND category = 'liabilities'
  AND (code LIKE '21%' OR code LIKE '22%');

UPDATE public.chart_of_accounts
SET is_current = false
WHERE is_current IS NULL
  AND category = 'liabilities'
  AND code !~ '^2[12]';
