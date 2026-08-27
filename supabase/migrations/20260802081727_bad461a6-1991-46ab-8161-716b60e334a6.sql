-- data_templates
DROP POLICY IF EXISTS data_templates_select ON public.data_templates;
DROP POLICY IF EXISTS data_templates_insert ON public.data_templates;
DROP POLICY IF EXISTS data_templates_update ON public.data_templates;
DROP POLICY IF EXISTS data_templates_delete ON public.data_templates;
CREATE POLICY data_templates_select ON public.data_templates FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY data_templates_insert ON public.data_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY data_templates_update ON public.data_templates FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY data_templates_delete ON public.data_templates FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- hr_employees
DROP POLICY IF EXISTS emp_read ON public.hr_employees;
CREATE POLICY emp_read ON public.hr_employees FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR has_permission(auth.uid(), 'hr.employees'::text, 'view'::text)
  OR user_has_any_role(auth.uid(), ARRAY['hr_manager'::text, 'hr_specialist'::text])
  OR (user_id = auth.uid())
);

-- job_title_permissions
DROP POLICY IF EXISTS jtp_read ON public.job_title_permissions;
CREATE POLICY jtp_read ON public.job_title_permissions FOR SELECT TO authenticated
USING (
  (job_title_id = current_job_title_id())
  OR is_admin(auth.uid())
  OR has_permission(auth.uid(), 'settings.permissions'::text, 'view'::text)
);

-- role_permissions
DROP POLICY IF EXISTS rp_read ON public.role_permissions;
CREATE POLICY rp_read ON public.role_permissions FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR has_permission(auth.uid(), 'settings.permissions'::text, 'view'::text)
);

-- task_assignees
DROP POLICY IF EXISTS ta_write ON public.task_assignees;
CREATE POLICY ta_write ON public.task_assignees FOR ALL TO authenticated
USING (is_admin(auth.uid()) OR is_task_participant(task_id, auth.uid()))
WITH CHECK (is_admin(auth.uid()) OR is_task_participant(task_id, auth.uid()));

-- task_checklist_items
DROP POLICY IF EXISTS tci_write ON public.task_checklist_items;
CREATE POLICY tci_write ON public.task_checklist_items FOR ALL TO authenticated
USING (is_admin(auth.uid()) OR is_task_participant(task_id, auth.uid()))
WITH CHECK (is_admin(auth.uid()) OR is_task_participant(task_id, auth.uid()));