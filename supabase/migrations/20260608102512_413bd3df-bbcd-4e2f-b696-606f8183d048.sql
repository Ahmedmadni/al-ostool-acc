
-- Remove anonymous read access from departments and job_titles (keep authenticated reads)
DROP POLICY IF EXISTS "anon read depts" ON public.departments;
DROP POLICY IF EXISTS "anon read jobs" ON public.job_titles;
REVOKE SELECT ON public.departments FROM anon;
REVOKE SELECT ON public.job_titles FROM anon;

-- Add missing UPDATE policy on task-attachments bucket so users can only overwrite their own files
DROP POLICY IF EXISTS "task_attachments_update_own" ON storage.objects;
CREATE POLICY "task_attachments_update_own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (owner = auth.uid() OR public.is_admin(auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND (owner = auth.uid() OR public.is_admin(auth.uid()))
  );
