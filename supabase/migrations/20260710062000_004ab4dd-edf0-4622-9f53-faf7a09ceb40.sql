-- VAT and Zakat return forms were previously stored ONLY in the browser's
-- localStorage (src/components/tax/vat-return-form.tsx, zakat-return-form.tsx),
-- with zero connection to Supabase: no audit trail of who filled them in or
-- when, no backup, not shared between users/devices, and lost on cache clear.
-- These tables give both forms a real, durable, auditable home consistent with
-- every other financial record in the system.

CREATE TABLE IF NOT EXISTS public.vat_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_from date NOT NULL,
  period_to date NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  net_vat numeric(15,2),
  final_vat numeric(15,2),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_from, period_to)
);

CREATE TABLE IF NOT EXISTS public.zakat_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_from date NOT NULL,
  year_to date NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  zakat_due numeric(15,2),
  tax_due numeric(15,2),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year_from, year_to)
);

CREATE TRIGGER trg_vat_returns_updated_at BEFORE UPDATE ON public.vat_returns
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE TRIGGER trg_zakat_returns_updated_at BEFORE UPDATE ON public.zakat_returns
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

GRANT SELECT, INSERT, UPDATE ON public.vat_returns TO authenticated;
GRANT ALL ON public.vat_returns TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.zakat_returns TO authenticated;
GRANT ALL ON public.zakat_returns TO service_role;

ALTER TABLE public.vat_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zakat_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY vat_returns_read ON public.vat_returns FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY vat_returns_insert ON public.vat_returns FOR INSERT TO authenticated WITH CHECK (public.can_write_finance(auth.uid()));
CREATE POLICY vat_returns_update ON public.vat_returns FOR UPDATE TO authenticated USING (public.can_write_finance(auth.uid()));

CREATE POLICY zakat_returns_read ON public.zakat_returns FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY zakat_returns_insert ON public.zakat_returns FOR INSERT TO authenticated WITH CHECK (public.can_write_finance(auth.uid()));
CREATE POLICY zakat_returns_update ON public.zakat_returns FOR UPDATE TO authenticated USING (public.can_write_finance(auth.uid()));
