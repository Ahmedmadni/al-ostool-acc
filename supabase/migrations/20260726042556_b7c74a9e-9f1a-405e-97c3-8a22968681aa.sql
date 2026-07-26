
-- 1) Avatars: scope read to owner folder + admin
DROP POLICY IF EXISTS "avatars read authenticated" ON storage.objects;
CREATE POLICY "avatars read own or admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.is_admin(auth.uid())
    )
  );

-- 2) Tighten can_read_business to explicit business roles
CREATE OR REPLACE FUNCTION public.can_read_business(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.user_has_any_role(_user_id, ARRAY[
    'admin','ceo','cfo','finance_manager','project_manager',
    'accountant','chief_accountant','cost_controller','auditor'
  ])
$$;

-- 3) employees: restrict SELECT to admins / HR-permitted users
DROP POLICY IF EXISTS emp_read ON public.employees;
CREATE POLICY emp_read ON public.employees
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'hr.employees', 'view')
  );

-- 4) hr_costs: restrict SELECT to admins / HR payroll or employees permission
DROP POLICY IF EXISTS rbac_read ON public.hr_costs;
CREATE POLICY rbac_read ON public.hr_costs
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'hr.payroll', 'view')
    OR public.has_permission(auth.uid(), 'hr.employees', 'view')
  );
