
-- Vendors master data
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  name_en text,
  category text,
  region text,
  tax_number text,
  commercial_register text,
  phone text,
  mobile text,
  email text,
  address text,
  city text,
  country text DEFAULT 'المملكة العربية السعودية',
  payment_period int DEFAULT 30,
  credit_limit numeric DEFAULT 0,
  current_balance numeric DEFAULT 0,
  total_purchased numeric DEFAULT 0,
  total_paid numeric DEFAULT 0,
  total_outstanding numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view vendors" ON public.vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert vendors" ON public.vendors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update vendors" ON public.vendors FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin delete vendors" ON public.vendors FOR DELETE TO authenticated USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'finance_manager'::app_role));
CREATE TRIGGER trg_vendors_updated BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- Data imports tracking (Analysis data lifecycle)
CREATE TABLE public.data_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type text NOT NULL,
  period text,
  file_name text,
  row_count int DEFAULT 0,
  status text DEFAULT 'active',
  replaced_at timestamptz,
  notes text,
  imported_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_imports TO authenticated;
GRANT ALL ON public.data_imports TO service_role;
ALTER TABLE public.data_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all data_imports" ON public.data_imports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Project contracts & retention
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS contract_number text,
  ADD COLUMN IF NOT EXISTS retention_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billed_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unbilled_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financial_progress numeric DEFAULT 0;

-- Trigger to update project billing on invoice change
CREATE OR REPLACE FUNCTION public.update_project_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pid uuid;
  total numeric;
  cv numeric;
BEGIN
  pid := COALESCE(NEW.project_id, OLD.project_id);
  IF pid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT COALESCE(SUM(total_amount),0) INTO total FROM public.invoices WHERE project_id = pid;
  SELECT COALESCE(contract_value,0) INTO cv FROM public.projects WHERE id = pid;
  UPDATE public.projects
    SET billed_amount = total,
        unbilled_amount = GREATEST(cv - total, 0),
        financial_progress = CASE WHEN cv > 0 THEN LEAST(100, (total / cv) * 100) ELSE 0 END
    WHERE id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_project_billing ON public.invoices;
CREATE TRIGGER trg_invoice_project_billing
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_project_billing();
