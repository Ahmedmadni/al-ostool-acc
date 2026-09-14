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

CREATE SEQUENCE public.ops_service_request_seq;
CREATE OR REPLACE FUNCTION public.ops_next_request_no() RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT 'SR-' || lpad(nextval('public.ops_service_request_seq')::text,6,'0')
$$;
CREATE TABLE public.ops_sites(
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.group_companies(id)
);
CREATE TABLE public.ops_assets(
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.group_companies(id)
);
CREATE TABLE public.ops_sla_policies(
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.group_companies(id),
  priority text NOT NULL,
  response_minutes integer NOT NULL,
  resolution_minutes integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.ops_service_requests(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.group_companies(id),
  request_no text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  contract_id uuid,
  site_id uuid REFERENCES public.ops_sites(id),
  asset_id uuid REFERENCES public.ops_assets(id),
  sla_policy_id uuid REFERENCES public.ops_sla_policies(id),
  title text NOT NULL,
  description text,
  request_type text NOT NULL CHECK (request_type IN ('corrective','preventive','inspection','emergency','other')),
  priority text NOT NULL,
  response_due_at timestamptz,
  resolution_due_at timestamptz,
  requested_by uuid REFERENCES auth.users(id)
);
CREATE TABLE public.ops_status_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  reason text,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.re_properties(
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.group_companies(id)
);
CREATE TABLE public.re_buildings(
  id uuid PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.re_properties(id)
);
CREATE TABLE public.re_units(
  id uuid PRIMARY KEY,
  building_id uuid NOT NULL REFERENCES public.re_buildings(id)
);
CREATE TABLE public.re_facility_links(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.re_properties(id),
  unit_id uuid REFERENCES public.re_units(id),
  ops_site_id uuid REFERENCES public.ops_sites(id),
  ops_asset_id uuid REFERENCES public.ops_assets(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO auth.users(id) VALUES
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002');

INSERT INTO public.group_companies(id,code) VALUES
 ('10000000-0000-0000-0000-000000000001','OM'),
 ('10000000-0000-0000-0000-000000000002','RE'),
 ('10000000-0000-0000-0000-000000000003','CORE');
INSERT INTO public.group_modules(id,module_key) VALUES
 ('20000000-0000-0000-0000-000000000001','maintenance'),
 ('20000000-0000-0000-0000-000000000002','real_estate'),
 ('20000000-0000-0000-0000-000000000003','corporate_erp');
INSERT INTO public.group_company_modules(company_id,module_id) VALUES
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002'),
 ('10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003');
INSERT INTO public.group_user_module_access(user_id,company_id,module_id,access_role) VALUES
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','manager'),
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','manager'),
 ('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','manager');

INSERT INTO public.customers(id,name) VALUES ('30000000-0000-0000-0000-000000000001','Customer One');
INSERT INTO public.ops_sites(id,company_id) VALUES ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
INSERT INTO public.ops_assets(id,company_id) VALUES ('71000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
INSERT INTO public.ops_sla_policies(id,company_id,priority,response_minutes,resolution_minutes) VALUES
 ('72000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','normal',60,480),
 ('72000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','critical',15,120);
INSERT INTO public.re_properties(id,company_id) VALUES ('80000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
INSERT INTO public.re_buildings(id,property_id) VALUES ('81000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001');
INSERT INTO public.re_units(id,building_id) VALUES ('82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001');
INSERT INTO public.re_facility_links(property_id,unit_id,ops_site_id,ops_asset_id) VALUES
 ('80000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001');
