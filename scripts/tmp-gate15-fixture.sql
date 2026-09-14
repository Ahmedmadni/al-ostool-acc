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

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;

CREATE TABLE public.group_companies(
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.group_modules(
  id uuid PRIMARY KEY,
  module_key text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.group_company_modules(
  company_id uuid NOT NULL REFERENCES public.group_companies(id),
  module_id uuid NOT NULL REFERENCES public.group_modules(id),
  is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY(company_id,module_id)
);
CREATE TABLE public.group_user_module_access(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  company_id uuid NOT NULL REFERENCES public.group_companies(id),
  module_id uuid NOT NULL REFERENCES public.group_modules(id),
  access_role text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  valid_from date,
  valid_to date
);

CREATE OR REPLACE FUNCTION public.group_has_module_access(_company_code text,_module_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.group_user_module_access a
    JOIN public.group_companies c ON c.id=a.company_id
    JOIN public.group_modules m ON m.id=a.module_id
    JOIN public.group_company_modules cm ON cm.company_id=c.id AND cm.module_id=m.id
    WHERE a.user_id=auth.uid() AND a.is_active AND c.is_active AND m.is_active AND cm.is_active
      AND c.code=upper(btrim(_company_code)) AND m.module_key=lower(btrim(_module_key))
      AND (a.valid_from IS NULL OR a.valid_from<=CURRENT_DATE)
      AND (a.valid_to IS NULL OR a.valid_to>=CURRENT_DATE)
  )
$$;

CREATE TABLE public.customers(id uuid PRIMARY KEY, name text);
CREATE TABLE public.vendors(id uuid PRIMARY KEY, name text);
CREATE TABLE public.contracts(id uuid PRIMARY KEY, customer_id uuid, vendor_id uuid);
CREATE TABLE public.invoices(id uuid PRIMARY KEY, customer_id uuid, total_amount numeric DEFAULT 0);
CREATE TABLE public.cost_entries(id uuid PRIMARY KEY, amount numeric);
CREATE TABLE public.fixed_assets(id uuid PRIMARY KEY);
CREATE TABLE public.ops_sites(id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES public.group_companies(id));
CREATE TABLE public.ops_assets(id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES public.group_companies(id));

INSERT INTO auth.users(id) VALUES
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002');

INSERT INTO public.group_companies(id,code) VALUES
 ('10000000-0000-0000-0000-000000000001','RE'),
 ('10000000-0000-0000-0000-000000000002','OM');
INSERT INTO public.group_modules(id,module_key) VALUES
 ('20000000-0000-0000-0000-000000000001','real_estate'),
 ('20000000-0000-0000-0000-000000000002','maintenance');
INSERT INTO public.group_company_modules(company_id,module_id) VALUES
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002');
INSERT INTO public.group_user_module_access(user_id,company_id,module_id,access_role) VALUES
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','manager');

INSERT INTO public.customers(id,name) VALUES
 ('30000000-0000-0000-0000-000000000001','Tenant One'),
 ('30000000-0000-0000-0000-000000000002','Tenant Two');
INSERT INTO public.vendors(id,name) VALUES ('40000000-0000-0000-0000-000000000001','Landlord One');
INSERT INTO public.invoices(id,customer_id,total_amount) VALUES
 ('50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',2500),
 ('50000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002',2500);
INSERT INTO public.cost_entries(id,amount) VALUES ('60000000-0000-0000-0000-000000000001',1000);
INSERT INTO public.ops_sites(id,company_id) VALUES
 ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002'),
 ('70000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001');
INSERT INTO public.ops_assets(id,company_id) VALUES
 ('71000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
