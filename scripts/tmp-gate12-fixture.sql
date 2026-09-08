\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.role',true),'')
$$;
CREATE OR REPLACE FUNCTION public.has_permission(_uid uuid,_module text,_action text)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT COALESCE(current_setting('app.test_permission',true),'')=_module||':'||_action $$;
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT COALESCE(current_setting('app.test_admin',true),'')='true' $$;

INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000001');

CREATE TABLE public.invoices(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  issue_date date NOT NULL,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  vat_amount numeric(15,2) NOT NULL DEFAULT 0,
  tax_category text,
  status text NOT NULL
);
CREATE TABLE public.purchase_invoices(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  issue_date date NOT NULL,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  vat_amount numeric(15,2) NOT NULL DEFAULT 0,
  tax_category text,
  status text NOT NULL,
  currency text DEFAULT 'SAR'
);

CREATE TABLE public.tax_rate_rules(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_type text NOT NULL,
  rate numeric(8,6) NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  source_note text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tax_type,effective_from)
);

CREATE TABLE public.vat_returns(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_from date NOT NULL,
  period_to date NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  net_vat numeric(15,2),
  final_vat numeric(15,2),
  status text NOT NULL DEFAULT 'draft',
  source_fingerprint text,
  created_by uuid,
  updated_by uuid,
  calculated_by uuid,
  calculated_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  filed_by uuid,
  filed_at timestamptz,
  filing_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(period_from,period_to)
);
CREATE TABLE public.vat_return_sources(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.vat_returns(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  tax_category text NOT NULL,
  net_amount numeric(15,2) NOT NULL,
  vat_amount numeric(15,2) NOT NULL,
  source_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(return_id,source_type,source_id)
);
CREATE TABLE public.vat_return_adjustments(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.vat_returns(id) ON DELETE CASCADE,
  direction text NOT NULL,
  tax_category text NOT NULL,
  net_amount numeric(15,2) NOT NULL,
  vat_amount numeric(15,2) NOT NULL,
  reason text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.vat_return_status_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.vat_returns(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  reason text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.vat_invoice_tax_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END $$;
CREATE TRIGGER trg_invoices_vat_guard BEFORE INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.vat_invoice_tax_guard();
CREATE TRIGGER trg_purchase_invoices_vat_guard BEFORE INSERT OR UPDATE OR DELETE ON public.purchase_invoices FOR EACH ROW EXECUTE FUNCTION public.vat_invoice_tax_guard();

CREATE OR REPLACE FUNCTION public.vat_source_fingerprint(date,date) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT 'legacy'::text $$;
CREATE OR REPLACE FUNCTION public.vat_return_stored_fingerprint(uuid) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT 'legacy'::text $$;
CREATE OR REPLACE FUNCTION public.vat_calculate_return(date,date,numeric,jsonb) RETURNS public.vat_returns LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT NULL::public.vat_returns $$;
CREATE OR REPLACE FUNCTION public.vat_calculate_return_flexible(date,date,uuid[],uuid[],jsonb,numeric,jsonb) RETURNS public.vat_returns LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT NULL::public.vat_returns $$;
CREATE OR REPLACE FUNCTION public.vat_approve_return(uuid) RETURNS public.vat_returns LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT NULL::public.vat_returns $$;
CREATE OR REPLACE FUNCTION public.vat_file_return(uuid,text) RETURNS public.vat_returns LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT NULL::public.vat_returns $$;
CREATE OR REPLACE FUNCTION public.vat_reopen_return(uuid,text) RETURNS public.vat_returns LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT NULL::public.vat_returns $$;
CREATE OR REPLACE FUNCTION public.vat_log_status_transition() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.vat_return_status_events(return_id,from_status,to_status,changed_by) VALUES(NEW.id,OLD.status,NEW.status,auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_vat_status_transition AFTER UPDATE OF status ON public.vat_returns FOR EACH ROW EXECUTE FUNCTION public.vat_log_status_transition();

GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.invoices,public.purchase_invoices,public.tax_rate_rules TO authenticated,service_role;
GRANT SELECT ON public.vat_returns,public.vat_return_sources,public.vat_return_adjustments,public.vat_return_status_events TO authenticated;
GRANT ALL ON public.vat_returns,public.vat_return_sources,public.vat_return_adjustments,public.vat_return_status_events TO service_role;
GRANT EXECUTE ON FUNCTION public.vat_calculate_return(date,date,numeric,jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.vat_calculate_return_flexible(date,date,uuid[],uuid[],jsonb,numeric,jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.vat_approve_return(uuid),public.vat_file_return(uuid,text),public.vat_reopen_return(uuid,text) TO authenticated,service_role;

INSERT INTO public.tax_rate_rules(tax_type,rate,effective_from,effective_to,source_note)
VALUES('vat',0.15,'2020-07-01',NULL,'test VAT rate');
