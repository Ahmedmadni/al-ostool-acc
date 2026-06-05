
-- 1) Tighten task-attachments storage read policy to require task participation
DROP POLICY IF EXISTS "task attachments read for authenticated" ON storage.objects;
CREATE POLICY "task attachments read for participants"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM public.task_attachments ta
    WHERE ta.storage_path = storage.objects.name
      AND public.is_task_participant(ta.task_id, auth.uid())
  )
);

-- 2) Remove overly-broad SELECT policies on task_assignees and task_checklist_items
DROP POLICY IF EXISTS ta_read ON public.task_assignees;
DROP POLICY IF EXISTS tci_read ON public.task_checklist_items;

-- 3) Restrict notifications INSERT to service_role only (server-side/triggers)
DROP POLICY IF EXISTS "users insert own notifications" ON public.notifications;
