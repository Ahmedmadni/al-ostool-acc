
-- 1) profiles: only self + admin
DROP POLICY IF EXISTS "users view own or managers view all" ON public.profiles;
CREATE POLICY "users view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.is_admin(auth.uid()));

-- 2) supplier_balances + trial_balance_entries: finance-only read
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['supplier_balances','trial_balance_entries']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS rbac_read ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY rbac_read ON public.%I FOR SELECT TO authenticated USING (public.can_read_sensitive_finance(auth.uid()))',
      t
    );
  END LOOP;
END $$;

-- 3) tasks: visibility-scoped read
DROP POLICY IF EXISTS tasks_read ON public.tasks;
DROP POLICY IF EXISTS rbac_read ON public.tasks;
CREATE POLICY tasks_read ON public.tasks
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR auth.uid() = ANY(visible_to_user_ids)
);

-- 4) task_assignees + task_checklist_items: only task participants
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['task_assignees','task_checklist_items']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS rbac_read ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS read_participants ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY read_participants ON public.%I FOR SELECT TO authenticated USING (public.is_task_participant(task_id, auth.uid()))',
      t
    );
  END LOOP;
END $$;
