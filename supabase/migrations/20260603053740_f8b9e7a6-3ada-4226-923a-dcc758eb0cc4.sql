
-- ============ 1. Foreign keys (idempotent) ============
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projects_customer_id_fkey') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='invoices_customer_id_fkey') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='invoices_project_id_fkey') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='payments_invoice_id_fkey') THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='payments_customer_id_fkey') THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customer_contacts_customer_id_fkey') THEN
    ALTER TABLE public.customer_contacts ADD CONSTRAINT customer_contacts_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='project_milestones_project_id_fkey') THEN
    ALTER TABLE public.project_milestones ADD CONSTRAINT project_milestones_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tasks_project_id_fkey') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tasks_customer_id_fkey') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_customer ON public.projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON public.invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON public.project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_contacts_customer ON public.customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_customer ON public.tasks(customer_id);

-- ============ 2. Expanded role enum ============
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ceo';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cfo';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'chief_accountant';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cost_controller';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'read_only';

-- ============ 3. Role helpers (use text-cast so new enum values work in same migration) ============
CREATE OR REPLACE FUNCTION public.user_has_any_role(_user_id uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_read_business(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_write_finance(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_has_any_role(_user_id, ARRAY['admin','cfo','finance_manager','chief_accountant','accountant'])
$$;

CREATE OR REPLACE FUNCTION public.can_write_operations(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_has_any_role(_user_id, ARRAY['admin','cfo','finance_manager','chief_accountant','accountant','project_manager','cost_controller'])
$$;

CREATE OR REPLACE FUNCTION public.can_delete_master(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_has_any_role(_user_id, ARRAY['admin','cfo','finance_manager'])
$$;

-- ============ 4. Drop old USING(true) policies & apply RBAC ============
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('customers','vendors','projects','invoices','payments',
        'customer_contacts','project_milestones','aging_buckets','bank_statements',
        'cost_entries','customer_balances','supplier_balances','equipment_costs',
        'fixed_assets','hr_costs','trial_balance_entries','data_imports',
        'attachments','tasks')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "rbac_read" ON public.customers FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.can_write_operations(auth.uid()));
CREATE POLICY "rbac_update" ON public.customers FOR UPDATE TO authenticated USING (public.can_write_operations(auth.uid()));
CREATE POLICY "rbac_delete" ON public.customers FOR DELETE TO authenticated USING (public.can_delete_master(auth.uid()));

CREATE POLICY "rbac_read" ON public.vendors FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_insert" ON public.vendors FOR INSERT TO authenticated WITH CHECK (public.can_write_operations(auth.uid()));
CREATE POLICY "rbac_update" ON public.vendors FOR UPDATE TO authenticated USING (public.can_write_operations(auth.uid()));
CREATE POLICY "rbac_delete" ON public.vendors FOR DELETE TO authenticated USING (public.can_delete_master(auth.uid()));

CREATE POLICY "rbac_read" ON public.projects FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_insert" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.can_write_operations(auth.uid()));
CREATE POLICY "rbac_update" ON public.projects FOR UPDATE TO authenticated USING (public.can_write_operations(auth.uid()));
CREATE POLICY "rbac_delete" ON public.projects FOR DELETE TO authenticated USING (public.can_delete_master(auth.uid()));

CREATE POLICY "rbac_read" ON public.invoices FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_insert" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.can_write_finance(auth.uid()));
CREATE POLICY "rbac_update" ON public.invoices FOR UPDATE TO authenticated USING (public.can_write_finance(auth.uid()));
CREATE POLICY "rbac_delete" ON public.invoices FOR DELETE TO authenticated USING (public.can_delete_master(auth.uid()));

CREATE POLICY "rbac_read" ON public.payments FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_insert" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.can_write_finance(auth.uid()));
CREATE POLICY "rbac_update" ON public.payments FOR UPDATE TO authenticated USING (public.can_write_finance(auth.uid()));
CREATE POLICY "rbac_delete" ON public.payments FOR DELETE TO authenticated USING (public.can_delete_master(auth.uid()));

CREATE POLICY "rbac_read" ON public.customer_contacts FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_write" ON public.customer_contacts FOR ALL TO authenticated USING (public.can_write_operations(auth.uid())) WITH CHECK (public.can_write_operations(auth.uid()));

CREATE POLICY "rbac_read" ON public.project_milestones FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_write" ON public.project_milestones FOR ALL TO authenticated USING (public.can_write_operations(auth.uid())) WITH CHECK (public.can_write_operations(auth.uid()));

CREATE POLICY "rbac_read" ON public.tasks FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_write" ON public.tasks FOR ALL TO authenticated USING (public.can_write_operations(auth.uid())) WITH CHECK (public.can_write_operations(auth.uid()));

CREATE POLICY "rbac_read" ON public.aging_buckets FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_write" ON public.aging_buckets FOR ALL TO authenticated USING (public.can_write_finance(auth.uid())) WITH CHECK (public.can_write_finance(auth.uid()));

CREATE POLICY "rbac_read" ON public.bank_statements FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_write" ON public.bank_statements FOR ALL TO authenticated USING (public.can_write_finance(auth.uid())) WITH CHECK (public.can_write_finance(auth.uid()));

CREATE POLICY "rbac_read" ON public.cost_entries FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_write" ON public.cost_entries FOR ALL TO authenticated USING (public.can_write_operations(auth.uid())) WITH CHECK (public.can_write_operations(auth.uid()));

CREATE POLICY "rbac_read" ON public.customer_balances FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_write" ON public.customer_balances FOR ALL TO authenticated USING (public.can_write_finance(auth.uid())) WITH CHECK (public.can_write_finance(auth.uid()));

CREATE POLICY "rbac_read" ON public.supplier_balances FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_write" ON public.supplier_balances FOR ALL TO authenticated USING (public.can_write_finance(auth.uid())) WITH CHECK (public.can_write_finance(auth.uid()));

CREATE POLICY "rbac_read" ON public.equipment_costs FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_write" ON public.equipment_costs FOR ALL TO authenticated USING (public.can_write_operations(auth.uid())) WITH CHECK (public.can_write_operations(auth.uid()));

CREATE POLICY "rbac_read" ON public.fixed_assets FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_write" ON public.fixed_assets FOR ALL TO authenticated USING (public.can_write_finance(auth.uid())) WITH CHECK (public.can_write_finance(auth.uid()));

CREATE POLICY "rbac_read" ON public.hr_costs FOR SELECT TO authenticated USING (public.user_has_any_role(auth.uid(), ARRAY['admin','cfo','finance_manager','chief_accountant','auditor']));
CREATE POLICY "rbac_write" ON public.hr_costs FOR ALL TO authenticated USING (public.user_has_any_role(auth.uid(), ARRAY['admin','cfo','finance_manager','chief_accountant'])) WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['admin','cfo','finance_manager','chief_accountant']));

CREATE POLICY "rbac_read" ON public.trial_balance_entries FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_write" ON public.trial_balance_entries FOR ALL TO authenticated USING (public.can_write_finance(auth.uid())) WITH CHECK (public.can_write_finance(auth.uid()));

CREATE POLICY "rbac_read" ON public.data_imports FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_write" ON public.data_imports FOR ALL TO authenticated USING (public.can_write_operations(auth.uid())) WITH CHECK (public.can_write_operations(auth.uid()));

CREATE POLICY "rbac_read" ON public.attachments FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "rbac_write" ON public.attachments FOR ALL TO authenticated USING (public.can_write_operations(auth.uid())) WITH CHECK (public.can_write_operations(auth.uid()));

-- ============ 5. Invoice → project billing triggers ============
DROP TRIGGER IF EXISTS trg_invoices_billing_ins ON public.invoices;
DROP TRIGGER IF EXISTS trg_invoices_billing_upd ON public.invoices;
DROP TRIGGER IF EXISTS trg_invoices_billing_del ON public.invoices;

CREATE TRIGGER trg_invoices_billing_ins
AFTER INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_project_billing();

CREATE TRIGGER trg_invoices_billing_upd
AFTER UPDATE OF total_amount, project_id ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_project_billing();

CREATE TRIGGER trg_invoices_billing_del
AFTER DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_project_billing();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON public.vendors;
CREATE TRIGGER trg_vendors_updated_at BEFORE UPDATE ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
