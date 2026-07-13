
-- Tighten hr_employees SELECT: remove broad finance-role access, keep HR-specific
DROP POLICY IF EXISTS emp_read ON public.hr_employees;
CREATE POLICY emp_read ON public.hr_employees
FOR SELECT
USING (
  public.is_admin(auth.uid())
  OR public.has_permission(auth.uid(), 'hr.employees', 'view')
  OR public.user_has_any_role(auth.uid(), ARRAY['hr_manager','hr_specialist'])
  OR user_id = auth.uid()
);

-- Scope task_assignees writes to task participants
DROP POLICY IF EXISTS ta_write ON public.task_assignees;
CREATE POLICY ta_write ON public.task_assignees
FOR ALL
USING (
  public.is_admin(auth.uid())
  OR public.is_task_participant(task_id, auth.uid())
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_task_participant(task_id, auth.uid())
);

-- Scope task_checklist_items writes to task participants
DROP POLICY IF EXISTS tci_write ON public.task_checklist_items;
CREATE POLICY tci_write ON public.task_checklist_items
FOR ALL
USING (
  public.is_admin(auth.uid())
  OR public.is_task_participant(task_id, auth.uid())
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_task_participant(task_id, auth.uid())
);
