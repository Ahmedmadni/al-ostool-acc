
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'finance_manager', 'project_manager', 'accountant');
CREATE TYPE public.customer_sector AS ENUM ('infrastructure', 'crusher', 'equipment_rental', 'general_contracting', 'other_services', 'asset_sales');
CREATE TYPE public.customer_age AS ENUM ('lt_1', '1_to_3', '3_to_5', '5_to_10', 'gt_10');
CREATE TYPE public.customer_size AS ENUM ('small', 'medium', 'large', 'strategic');
CREATE TYPE public.customer_risk AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.project_status AS ENUM ('new', 'in_progress', 'on_hold', 'completed', 'delayed');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'issued', 'due', 'overdue', 'paid', 'unbilled');
CREATE TYPE public.task_type AS ENUM ('meeting', 'visit', 'call', 'collection_reminder', 'other');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'done', 'cancelled');

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- =========================================================
-- USER ROLES
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- AUTO-CREATE PROFILE ON SIGNUP + FIRST-USER ADMIN
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'accountant') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- HELPER: any authenticated user (for permissive policies)
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_timestamp() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================================================
-- CUSTOMERS
-- =========================================================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT,
  sector public.customer_sector,
  activity TEXT,
  commercial_register TEXT,
  tax_number TEXT,
  phone TEXT,
  mobile TEXT,
  email TEXT,
  website TEXT,
  country TEXT DEFAULT 'المملكة العربية السعودية',
  city TEXT,
  address TEXT,
  account_manager TEXT,
  age_category public.customer_age,
  size_category public.customer_size,
  risk_level public.customer_risk DEFAULT 'low',
  credit_limit NUMERIC(15,2) DEFAULT 0,
  payment_period INT DEFAULT 30,
  current_balance NUMERIC(15,2) DEFAULT 0,
  total_invoiced NUMERIC(15,2) DEFAULT 0,
  total_collected NUMERIC(15,2) DEFAULT 0,
  total_outstanding NUMERIC(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_code ON public.customers(code);
CREATE INDEX idx_customers_sector ON public.customers(sector);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update customers" ON public.customers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin delete customers" ON public.customers FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'finance_manager'));
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- =========================================================
-- CUSTOMER CONTACTS
-- =========================================================
CREATE TABLE public.customer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  job_title TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_contacts TO authenticated;
GRANT ALL ON public.customer_contacts TO service_role;
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all contacts" ON public.customer_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- PROJECTS
-- =========================================================
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  manager TEXT,
  start_date DATE,
  end_date DATE,
  contract_value NUMERIC(15,2) DEFAULT 0,
  budget NUMERIC(15,2) DEFAULT 0,
  actual_cost NUMERIC(15,2) DEFAULT 0,
  progress_actual NUMERIC(5,2) DEFAULT 0,
  progress_planned NUMERIC(5,2) DEFAULT 0,
  status public.project_status DEFAULT 'new',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_customer ON public.projects(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all projects" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- =========================================================
-- PROJECT MILESTONES
-- =========================================================
CREATE TABLE public.project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  weight NUMERIC(5,2) DEFAULT 0,
  progress NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_milestones TO authenticated;
GRANT ALL ON public.project_milestones TO service_role;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all milestones" ON public.project_milestones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- INVOICES
-- =========================================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  issue_date DATE,
  due_date DATE,
  amount NUMERIC(15,2) DEFAULT 0,
  vat_amount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) DEFAULT 0,
  paid_amount NUMERIC(15,2) DEFAULT 0,
  status public.invoice_status DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all invoices" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- =========================================================
-- PAYMENTS
-- =========================================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(15,2) NOT NULL,
  method TEXT,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all payments" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- TRIAL BALANCE
-- =========================================================
CREATE TABLE public.trial_balance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT,
  debit NUMERIC(15,2) DEFAULT 0,
  credit NUMERIC(15,2) DEFAULT 0,
  balance NUMERIC(15,2) DEFAULT 0,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_by UUID REFERENCES auth.users(id)
);
CREATE INDEX idx_tb_period ON public.trial_balance_entries(period);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_balance_entries TO authenticated;
GRANT ALL ON public.trial_balance_entries TO service_role;
ALTER TABLE public.trial_balance_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all tb" ON public.trial_balance_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- TASKS
-- =========================================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type public.task_type DEFAULT 'other',
  status public.task_status DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all tasks" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own notifications" ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid() OR user_id IS NULL) WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- =========================================================
-- AUDIT LOGS
-- =========================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin view audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "auth insert audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- =========================================================
-- REPORT TEMPLATES
-- =========================================================
CREATE TABLE public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_templates TO authenticated;
GRANT ALL ON public.report_templates TO service_role;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth own templates" ON public.report_templates FOR ALL TO authenticated USING (created_by = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- =========================================================
-- ATTACHMENTS metadata table
-- =========================================================
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  size INT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all attachments" ON public.attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- STORAGE BUCKET FOR ATTACHMENTS
-- =========================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth read attachments bucket" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'attachments');
CREATE POLICY "auth upload attachments bucket" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "auth delete own attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'attachments' AND auth.uid() = owner);
