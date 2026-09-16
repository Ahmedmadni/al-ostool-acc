\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.role',true),'')
$$;
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT _user_id='00000000-0000-0000-0000-000000000099'::uuid $$;
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid,_module text,_action text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT _user_id IN (
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000099'::uuid
  ) AND _module='tax'
$$;

CREATE TABLE public.trial_balance_entries(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  account_code text NOT NULL,
  account_name text NOT NULL,
  account_type text,
  debit numeric(15,2) DEFAULT 0,
  credit numeric(15,2) DEFAULT 0,
  balance numeric(15,2) DEFAULT 0,
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by uuid REFERENCES auth.users(id)
);

CREATE TABLE public.zakat_returns(
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
  UNIQUE(year_from,year_to)
);
ALTER TABLE public.zakat_returns ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.zakat_returns TO authenticated;
GRANT ALL ON public.zakat_returns TO service_role;
CREATE POLICY zakat_returns_read ON public.zakat_returns FOR SELECT TO authenticated USING (true);
CREATE POLICY zakat_returns_insert ON public.zakat_returns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY zakat_returns_update ON public.zakat_returns FOR UPDATE TO authenticated USING (true);

CREATE TABLE public.vat_returns(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'draft'
);

INSERT INTO auth.users(id) VALUES
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000099');

INSERT INTO public.trial_balance_entries(id,period,account_code,account_name,debit,credit,balance,imported_by) VALUES
  ('10000000-0000-0000-0000-000000000001','2026-12','3000','رأس المال',0,100000,100000,'00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002','2026-12','1500','الأصول الثابتة',25000,0,25000,'00000000-0000-0000-0000-000000000001');
