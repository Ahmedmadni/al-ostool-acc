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

CREATE TYPE public.hr_request_type AS ENUM ('hiring','promotion','salary_increase','transfer','secondment','leave','return_from_leave','resignation','termination','warning','violation','loan','asset_assignment','asset_return','other');
CREATE TYPE public.hr_request_status AS ENUM ('draft','pending','in_progress','approved','rejected','cancelled','completed');
CREATE TYPE public.hr_termination_reason AS ENUM ('resignation','end_of_contract','dismissal','mutual_agreement','retirement','death','other');
CREATE TYPE public.hr_leave_status AS ENUM ('pending','approved','rejected','cancelled','taken');

CREATE TABLE public.hr_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  full_name_ar text NOT NULL
);
CREATE TABLE public.hr_workflow_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_no text UNIQUE NOT NULL,
  request_type public.hr_request_type NOT NULL,
  requested_by uuid,
  employee_id uuid REFERENCES public.hr_employees(id),
  subject text,
  payload jsonb DEFAULT '{}'::jsonb,
  attachments jsonb DEFAULT '[]'::jsonb,
  status public.hr_request_status NOT NULL DEFAULT 'draft',
  current_step int DEFAULT 0,
  submitted_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.hr_workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.hr_workflow_requests(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  approver_id uuid,
  approver_role text,
  action text CHECK (action IN ('pending','approved','rejected','skipped','returned')),
  comment text,
  acted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.hr_terminations (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.hr_leaves (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status public.hr_leave_status DEFAULT 'pending');

CREATE OR REPLACE FUNCTION public.has_permission(_uid uuid, _module text, _action text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.test_permission', true), '') = _module || ':' || _action
$$;
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.test_admin', true), '') = 'true'
$$;

CREATE OR REPLACE FUNCTION public.hr_calculate_service_period(uuid, date DEFAULT CURRENT_DATE) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '{}'::jsonb $$;
CREATE OR REPLACE FUNCTION public.hr_termination_refresh_components(uuid) RETURNS public.hr_terminations LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT NULL::public.hr_terminations $$;
CREATE OR REPLACE FUNCTION public.hr_termination_create_draft(jsonb) RETURNS public.hr_terminations LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT NULL::public.hr_terminations $$;
CREATE OR REPLACE FUNCTION public.hr_termination_clearance(uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '{}'::jsonb $$;
CREATE OR REPLACE FUNCTION public.hr_termination_approve(uuid) RETURNS public.hr_terminations LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT NULL::public.hr_terminations $$;
CREATE OR REPLACE FUNCTION public.hr_leave_rule(text, date DEFAULT CURRENT_DATE) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '{}'::jsonb $$;
CREATE OR REPLACE FUNCTION public.hr_calc_leave_entitlement(uuid, text, integer DEFAULT NULL) RETURNS numeric LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT 0::numeric $$;
CREATE OR REPLACE FUNCTION public.hr_get_leave_summary(uuid, integer DEFAULT NULL) RETURNS TABLE(leave_type text, entitled numeric, used numeric, pending numeric, remaining numeric) LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT 'annual'::text,0::numeric,0::numeric,0::numeric,0::numeric $$;
CREATE OR REPLACE FUNCTION public.hr_leave_validate_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.hr_leave_guard_decision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.hr_leaves_balance_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.hr_leave_decide(uuid, boolean) RETURNS public.hr_leaves LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT NULL::public.hr_leaves $$;

GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_workflow_requests, public.hr_workflow_steps TO authenticated;
GRANT SELECT ON public.hr_employees TO authenticated;
GRANT ALL ON public.hr_workflow_requests, public.hr_workflow_steps, public.hr_employees TO service_role;

ALTER TABLE public.hr_workflow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_workflow_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_wf_read" ON public.hr_workflow_requests FOR SELECT TO authenticated USING (requested_by = auth.uid() OR public.has_permission(auth.uid(),'hr.workflow','view') OR public.is_admin(auth.uid()));
CREATE POLICY "hr_wf_insert" ON public.hr_workflow_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "hr_wf_update" ON public.hr_workflow_requests FOR UPDATE TO authenticated USING (requested_by = auth.uid() OR public.has_permission(auth.uid(),'hr.workflow','edit') OR public.is_admin(auth.uid()));
CREATE POLICY "hr_wf_delete" ON public.hr_workflow_requests FOR DELETE TO authenticated USING (public.has_permission(auth.uid(),'hr.workflow','delete') OR public.is_admin(auth.uid()));
CREATE POLICY "hr_wf_steps_read" ON public.hr_workflow_steps FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.hr_workflow_requests r WHERE r.id=request_id AND (r.requested_by=auth.uid() OR public.has_permission(auth.uid(),'hr.workflow','view') OR public.is_admin(auth.uid()))));
CREATE POLICY "hr_wf_steps_write" ON public.hr_workflow_steps FOR ALL TO authenticated USING (approver_id=auth.uid() OR public.has_permission(auth.uid(),'hr.workflow','approve') OR public.is_admin(auth.uid())) WITH CHECK (auth.uid() IS NOT NULL);

INSERT INTO public.hr_employees(id,user_id,full_name_ar) VALUES
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Employee One'),
('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Employee Two');
