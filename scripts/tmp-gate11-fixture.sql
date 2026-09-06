\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_uid uuid, _module text, _action text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.test_permission', true), '') = _module || ':' || _action
$$;
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.test_admin', true), '') = 'true'
$$;

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  is_active boolean DEFAULT true
);

CREATE TABLE public.cost_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  description text,
  project text,
  project_id uuid REFERENCES public.projects(id),
  company text,
  department text,
  department_id uuid REFERENCES public.departments(id),
  section text,
  period text,
  amount numeric NOT NULL,
  imported_by uuid,
  workflow_status text NOT NULL DEFAULT 'posted' CHECK (workflow_status IN ('draft','approved','posted','reversed')),
  source_type text NOT NULL DEFAULT 'legacy',
  approved_by uuid,
  approved_at timestamptz,
  reversed_by uuid,
  reversed_at timestamptz,
  reversal_entry_id uuid REFERENCES public.cost_entries(id),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cost_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL UNIQUE CHECK (period~'^[0-9]{4}-[0-9]{2}$'),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  reason text,
  closed_by uuid,
  closed_at timestamptz,
  reopened_by uuid,
  reopened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.cost_entry_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_entry_id uuid NOT NULL REFERENCES public.cost_entries(id),
  from_status text,
  to_status text NOT NULL,
  reason text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.cost_period_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  reason text NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cost_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_key text NOT NULL UNIQUE,
  file_name text,
  source_type text NOT NULL DEFAULT 'general' CHECK (source_type IN ('general','hr','equipment')),
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','rejected')),
  row_count integer NOT NULL DEFAULT 0,
  accepted_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.cost_import_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.cost_import_batches(id),
  row_number integer NOT NULL,
  raw_data jsonb NOT NULL,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  cost_entry_id uuid REFERENCES public.cost_entries(id),
  source_record_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(batch_id,row_number)
);
CREATE UNIQUE INDEX cost_entries_import_line_unique
  ON public.cost_entries ((meta->>'import_line_key'))
  WHERE meta->>'import_line_key' IS NOT NULL;

CREATE TABLE public.hr_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text,
  employee_name text NOT NULL,
  nationality text,
  job_title text,
  department text,
  project text,
  period text,
  salary numeric DEFAULT 0,
  housing numeric DEFAULT 0,
  food numeric DEFAULT 0,
  tickets numeric DEFAULT 0,
  medical numeric DEFAULT 0,
  gosi numeric DEFAULT 0,
  eos numeric DEFAULT 0,
  total_cost numeric NOT NULL,
  imported_by uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.equipment_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_code text,
  equipment_name text NOT NULL,
  equipment_type text,
  project text,
  department text,
  period text,
  purchase_cost numeric DEFAULT 0,
  depreciation numeric DEFAULT 0,
  insurance numeric DEFAULT 0,
  operating_cost numeric DEFAULT 0,
  maintenance numeric DEFAULT 0,
  fuel numeric DEFAULT 0,
  total_cost numeric NOT NULL,
  imported_by uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX hr_costs_import_line_unique
  ON public.hr_costs ((meta->>'import_line_key'))
  WHERE meta->>'import_line_key' IS NOT NULL;
CREATE UNIQUE INDEX equipment_costs_import_line_unique
  ON public.equipment_costs ((meta->>'import_line_key'))
  WHERE meta->>'import_line_key' IS NOT NULL;

CREATE TABLE public.cost_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  category text NOT NULL,
  project_id uuid REFERENCES public.projects(id),
  department_id uuid REFERENCES public.departments(id),
  amount numeric(15,2) NOT NULL CHECK (amount>=0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  revision integer NOT NULL DEFAULT 1,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz
);
CREATE UNIQUE INDEX cost_budgets_dimension_unique ON public.cost_budgets
  (period,category,COALESCE(project_id,'00000000-0000-0000-0000-000000000000'::uuid),COALESCE(department_id,'00000000-0000-0000-0000-000000000000'::uuid));
CREATE TABLE public.cost_budget_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.cost_budgets(id),
  event_type text NOT NULL,
  previous_amount numeric(15,2),
  new_amount numeric(15,2) NOT NULL,
  reason text,
  revision integer NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.cost_entry_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_cost_entry_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.cost_entries
FOR EACH ROW EXECUTE FUNCTION public.cost_entry_guard();

CREATE OR REPLACE FUNCTION public.cost_entry_create_manual(text,numeric,text,text,uuid,uuid)
RETURNS public.cost_entries LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT NULL::public.cost_entries $$;
CREATE OR REPLACE FUNCTION public.cost_entry_approve(uuid)
RETURNS public.cost_entries LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT NULL::public.cost_entries $$;
CREATE OR REPLACE FUNCTION public.cost_entry_reverse(uuid,text)
RETURNS public.cost_entries LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT NULL::public.cost_entries $$;
CREATE OR REPLACE FUNCTION public.cost_period_set_status(text,boolean,text)
RETURNS public.cost_periods LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT NULL::public.cost_periods $$;
CREATE OR REPLACE FUNCTION public.cost_import_post(text,text,jsonb)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '{}'::jsonb $$;
CREATE OR REPLACE FUNCTION public.cost_aux_import_post(text,text,text,jsonb)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '{}'::jsonb $$;
CREATE OR REPLACE FUNCTION public.cost_budget_save(text,text,numeric,uuid,uuid,text,text)
RETURNS public.cost_budgets LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT NULL::public.cost_budgets $$;
CREATE OR REPLACE FUNCTION public.cost_budget_approve(uuid)
RETURNS public.cost_budgets LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT NULL::public.cost_budgets $$;

GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

INSERT INTO public.projects(id,name) VALUES
('20000000-0000-0000-0000-000000000001','Project One');
INSERT INTO public.departments(id,name_ar,is_active) VALUES
('30000000-0000-0000-0000-000000000001','الإدارة الأولى',true);
