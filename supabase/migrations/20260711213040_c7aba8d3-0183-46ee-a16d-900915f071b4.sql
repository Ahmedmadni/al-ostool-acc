
DROP POLICY IF EXISTS "authenticated can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "users view own profile" ON public.profiles;
CREATE POLICY "profiles_select_self_or_privileged" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'settings.users', 'view')
    OR public.has_permission(auth.uid(), 'hr.employees', 'view')
  );

DROP POLICY IF EXISTS "hr_wf_steps_write" ON public.hr_workflow_steps;
CREATE POLICY "hr_wf_steps_write" ON public.hr_workflow_steps FOR ALL TO authenticated
  USING (
    approver_id = auth.uid()
    OR public.has_permission(auth.uid(), 'hr.workflow', 'approve')
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    approver_id = auth.uid()
    OR public.has_permission(auth.uid(), 'hr.workflow', 'approve')
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "manager updates requests" ON public.task_requests;
CREATE POLICY "manager updates requests" ON public.task_requests
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (public.is_task_participant(task_id, auth.uid()) AND requested_by <> auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR (public.is_task_participant(task_id, auth.uid()) AND requested_by <> auth.uid())
  );
