
-- FIX-01: Allow anonymous (registration page) to read departments & job_titles lookups
DROP POLICY IF EXISTS "anon read depts" ON public.departments;
CREATE POLICY "anon read depts" ON public.departments FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon read jobs" ON public.job_titles;
CREATE POLICY "anon read jobs" ON public.job_titles FOR SELECT TO anon USING (true);

GRANT SELECT ON public.departments TO anon;
GRANT SELECT ON public.job_titles TO anon;

-- FIX-03 Mode B: role_permissions table for managing permissions per system role
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  module_key text NOT NULL,
  action_key text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, module_key, action_key)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_read" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "rp_write" ON public.role_permissions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Extend has_permission() to also check role_permissions (after user_permissions, before job_title_permissions)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v boolean; jt uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF public.is_admin(_user_id) THEN RETURN true; END IF;

  -- 1) User-specific override
  SELECT granted INTO v FROM public.user_permissions
    WHERE user_id = _user_id AND module_key = _module AND action_key = _action;
  IF FOUND THEN RETURN v; END IF;

  -- 2) Role-based
  SELECT bool_or(rp.granted) INTO v
    FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role = rp.role
   WHERE ur.user_id = _user_id AND rp.module_key = _module AND rp.action_key = _action;
  IF v IS NOT NULL THEN RETURN v; END IF;

  -- 3) Job-title inherited
  SELECT job_title_id INTO jt FROM public.profiles WHERE id = _user_id;
  IF jt IS NOT NULL THEN
    SELECT granted INTO v FROM public.job_title_permissions
      WHERE job_title_id = jt AND module_key = _module AND action_key = _action;
    IF FOUND THEN RETURN v; END IF;
  END IF;

  RETURN false;
END $$;
