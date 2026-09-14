\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;

CREATE TABLE public.group_companies(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text UNIQUE NOT NULL,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.group_modules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),module_key text UNIQUE NOT NULL,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.group_user_module_access(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,company_id uuid NOT NULL,module_id uuid NOT NULL,
 access_role text NOT NULL,is_active boolean NOT NULL DEFAULT true,valid_from date,valid_to date
);
INSERT INTO public.group_companies(id,code) VALUES('10000000-0000-0000-0000-000000000001','OM'),('10000000-0000-0000-0000-000000000002','CORE');
INSERT INTO public.group_modules(id,module_key) VALUES('20000000-0000-0000-0000-000000000001','maintenance');
INSERT INTO public.group_user_module_access(user_id,company_id,module_id,access_role) VALUES
('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','admin'),
('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','member');
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT _uid='00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE OR REPLACE FUNCTION public.group_has_module_access(_company_code text,_module_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(
   SELECT 1 FROM public.group_user_module_access a
   JOIN public.group_companies c ON c.id=a.company_id
   JOIN public.group_modules m ON m.id=a.module_id
   WHERE a.user_id=auth.uid() AND a.is_active AND c.is_active AND m.is_active
     AND c.code=upper(btrim(_company_code)) AND m.module_key=lower(btrim(_module_key))
     AND (a.valid_from IS NULL OR a.valid_from<=CURRENT_DATE) AND (a.valid_to IS NULL OR a.valid_to>=CURRENT_DATE)
 ) OR public.is_admin(auth.uid())
$$;

CREATE TABLE public.customers(id uuid PRIMARY KEY,name text);
CREATE TABLE public.contracts(id uuid PRIMARY KEY,customer_id uuid);
CREATE TABLE public.hr_employees(id uuid PRIMARY KEY,full_name text);
CREATE TABLE public.vendors(id uuid PRIMARY KEY,name text);
CREATE TABLE public.inventory_items(id uuid PRIMARY KEY,name text);
CREATE TABLE public.cost_entries(id uuid PRIMARY KEY,amount numeric);

INSERT INTO public.customers VALUES('30000000-0000-0000-0000-000000000001','عميل الاختبار');
INSERT INTO public.contracts VALUES('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');
INSERT INTO public.hr_employees VALUES('50000000-0000-0000-0000-000000000001','فني الاختبار');
INSERT INTO public.vendors VALUES('60000000-0000-0000-0000-000000000001','مقاول الاختبار');
INSERT INTO public.inventory_items VALUES('70000000-0000-0000-0000-000000000001','قطعة اختبار');
