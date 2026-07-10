-- H26: ZATCA e-invoicing (فاتورة) readiness — the invoices table had no fields
-- at all for e-invoicing compliance: no UUID separate from the human invoice
-- number, no counter/hash chaining, no QR/cryptographic stamp, no submission
-- tracking. This adds the foundational columns only — it does NOT implement
-- actual ZATCA API integration, XML generation, or certificate-based signing
-- (those require a live ZATCA onboarding/CSID and a compliant invoice
-- generation service, well beyond a schema change). Every column is nullable
-- and unused until that integration exists, so this carries no behavioral
-- risk today; it exists so a future integration doesn't need another
-- disruptive schema migration on the core invoices table.

CREATE TYPE public.zatca_invoice_type AS ENUM ('standard', 'simplified');
CREATE TYPE public.zatca_submission_status AS ENUM ('not_submitted', 'submitted', 'cleared', 'reported', 'rejected');

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS zatca_uuid uuid,
  ADD COLUMN IF NOT EXISTS zatca_icv integer,
  ADD COLUMN IF NOT EXISTS zatca_previous_invoice_hash text,
  ADD COLUMN IF NOT EXISTS zatca_invoice_hash text,
  ADD COLUMN IF NOT EXISTS zatca_qr_code text,
  ADD COLUMN IF NOT EXISTS zatca_cryptographic_stamp text,
  ADD COLUMN IF NOT EXISTS zatca_invoice_type public.zatca_invoice_type,
  ADD COLUMN IF NOT EXISTS zatca_status public.zatca_submission_status NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS zatca_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS zatca_response jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_zatca_uuid ON public.invoices(zatca_uuid) WHERE zatca_uuid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_zatca_icv ON public.invoices(zatca_icv) WHERE zatca_icv IS NOT NULL;

COMMENT ON COLUMN public.invoices.zatca_icv IS 'Invoice Counter Value — sequential per taxpayer, required for ZATCA hash chaining. Not auto-populated; must be assigned by the future submission integration in strict sequence.';
COMMENT ON COLUMN public.invoices.zatca_previous_invoice_hash IS 'Base64 hash of the immediately preceding cleared invoice, per ZATCA chaining rules.';
