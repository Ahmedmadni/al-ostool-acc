
-- ============================================================
-- ERP Consolidation: Unified AR/AP Architecture — Step A schema
-- ============================================================

-- 1) Opening balance columns on customers and vendors
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS opening_balance numeric(15,2) NOT NULL DEFAULT 0;
ALTER TABLE public.vendors   ADD COLUMN IF NOT EXISTS opening_balance numeric(15,2) NOT NULL DEFAULT 0;

-- 2) Retention amount per invoice (sales)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS retention_amount numeric(15,2) NOT NULL DEFAULT 0;

-- 3) party_type on contracts (customer vs vendor) + vendor_id
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS party_type text;
UPDATE public.contracts SET party_type = CASE WHEN customer_id IS NOT NULL THEN 'customer' WHEN vendor_id IS NOT NULL THEN 'vendor' ELSE 'customer' END WHERE party_type IS NULL;
ALTER TABLE public.contracts ALTER COLUMN party_type SET DEFAULT 'customer';
ALTER TABLE public.contracts ALTER COLUMN party_type SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_party_type ON public.contracts(party_type);
CREATE INDEX IF NOT EXISTS idx_contracts_vendor ON public.contracts(vendor_id);

-- 4) Adjustments table
CREATE TABLE IF NOT EXISTS public.adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_type text NOT NULL CHECK (party_type IN ('customer','vendor')),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  adjustment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(15,2) NOT NULL,
  type text NOT NULL DEFAULT 'manual',
  reason text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((party_type='customer' AND customer_id IS NOT NULL AND vendor_id IS NULL)
      OR (party_type='vendor' AND vendor_id IS NOT NULL AND customer_id IS NULL))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adjustments TO authenticated;
GRANT ALL ON public.adjustments TO service_role;
ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY adj_read ON public.adjustments FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY adj_insert ON public.adjustments FOR INSERT TO authenticated WITH CHECK (public.can_write_finance(auth.uid()));
CREATE POLICY adj_update ON public.adjustments FOR UPDATE TO authenticated USING (public.can_write_finance(auth.uid()));
CREATE POLICY adj_delete ON public.adjustments FOR DELETE TO authenticated USING (public.can_delete_master(auth.uid()));
CREATE TRIGGER trg_adj_updated_at BEFORE UPDATE ON public.adjustments FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE INDEX idx_adjustments_customer ON public.adjustments(customer_id);
CREATE INDEX idx_adjustments_vendor ON public.adjustments(vendor_id);

-- 5) Invoice allocations (link payment ↔ invoice with per-invoice amount)
CREATE TABLE IF NOT EXISTS public.invoice_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  purchase_invoice_id uuid REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  amount numeric(15,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((invoice_id IS NOT NULL) <> (purchase_invoice_id IS NOT NULL))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_allocations TO authenticated;
GRANT ALL ON public.invoice_allocations TO service_role;
ALTER TABLE public.invoice_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY ialloc_read ON public.invoice_allocations FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY ialloc_insert ON public.invoice_allocations FOR INSERT TO authenticated WITH CHECK (public.can_write_finance(auth.uid()));
CREATE POLICY ialloc_update ON public.invoice_allocations FOR UPDATE TO authenticated USING (public.can_write_finance(auth.uid()));
CREATE POLICY ialloc_delete ON public.invoice_allocations FOR DELETE TO authenticated USING (public.can_delete_master(auth.uid()));
CREATE INDEX idx_ialloc_payment ON public.invoice_allocations(payment_id);
CREATE INDEX idx_ialloc_invoice ON public.invoice_allocations(invoice_id);
CREATE INDEX idx_ialloc_pinv ON public.invoice_allocations(purchase_invoice_id);

-- 6) Retention guarantees
CREATE TABLE IF NOT EXISTS public.retention_guarantees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  total_retention numeric(15,2) NOT NULL DEFAULT 0,
  released_amount numeric(15,2) NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retention_guarantees TO authenticated;
GRANT ALL ON public.retention_guarantees TO service_role;
ALTER TABLE public.retention_guarantees ENABLE ROW LEVEL SECURITY;
CREATE POLICY rg_read ON public.retention_guarantees FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY rg_insert ON public.retention_guarantees FOR INSERT TO authenticated WITH CHECK (public.can_write_finance(auth.uid()));
CREATE POLICY rg_update ON public.retention_guarantees FOR UPDATE TO authenticated USING (public.can_write_finance(auth.uid()));
CREATE POLICY rg_delete ON public.retention_guarantees FOR DELETE TO authenticated USING (public.can_delete_master(auth.uid()));
CREATE TRIGGER trg_rg_updated_at BEFORE UPDATE ON public.retention_guarantees FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE INDEX idx_rg_contract ON public.retention_guarantees(contract_id);
CREATE INDEX idx_rg_customer ON public.retention_guarantees(customer_id);

-- 7) Balance calculation functions (single source of truth)
CREATE OR REPLACE FUNCTION public.calc_customer_balance(_customer_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE((SELECT opening_balance FROM public.customers WHERE id = _customer_id), 0)
    + COALESCE((SELECT SUM(total_amount) FROM public.invoices WHERE customer_id = _customer_id), 0)
    - COALESCE((SELECT SUM(amount) FROM public.payments WHERE customer_id = _customer_id AND COALESCE(direction,'in') = 'in'), 0)
    - COALESCE((SELECT SUM(amount) FROM public.adjustments WHERE customer_id = _customer_id), 0)
$$;

CREATE OR REPLACE FUNCTION public.calc_vendor_balance(_vendor_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE((SELECT opening_balance FROM public.vendors WHERE id = _vendor_id), 0)
    + COALESCE((SELECT SUM(total_amount) FROM public.purchase_invoices WHERE vendor_id = _vendor_id), 0)
    - COALESCE((SELECT SUM(amount) FROM public.payments WHERE vendor_id = _vendor_id AND COALESCE(direction,'in') = 'out'), 0)
    - COALESCE((SELECT SUM(amount) FROM public.adjustments WHERE vendor_id = _vendor_id), 0)
$$;
