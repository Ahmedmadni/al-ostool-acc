
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS completion_percentage integer CHECK (completion_percentage BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS completion_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS completion_approval_note text;

-- Extend the existing notify_task_changes trigger to also notify on completion_percentage updates.
CREATE OR REPLACE FUNCTION public.notify_task_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE link text;
BEGIN
  link := '/tasks/' || NEW.id::text;
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      PERFORM public.create_notification(NEW.assigned_to, 'لديك مهمة جديدة', NEW.title, 'task_assigned', link,
        jsonb_build_object('task_id', NEW.id, 'event','task_assigned'));
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
      PERFORM public.create_notification(NEW.assigned_to, 'تم إسناد مهمة إليك', NEW.title, 'task_assigned', link,
        jsonb_build_object('task_id', NEW.id, 'event','task_reassigned'));
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'completed' AND NEW.created_by IS NOT NULL AND NEW.created_by <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
      PERFORM public.create_notification(NEW.created_by, 'مهمة بانتظار التقييم', NEW.title, 'task_completed', link,
        jsonb_build_object('task_id', NEW.id, 'event','task_completed'));
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'overdue' AND NEW.created_by IS NOT NULL THEN
      PERFORM public.create_notification(NEW.created_by, 'تأخّر إنجاز مهمة', NEW.title, 'task_overdue', link,
        jsonb_build_object('task_id', NEW.id, 'event','task_overdue'));
    END IF;
    IF NEW.rating IS DISTINCT FROM OLD.rating AND NEW.rating IS NOT NULL AND NEW.assigned_to IS NOT NULL THEN
      PERFORM public.create_notification(NEW.assigned_to, 'تم تقييم مهمتك', NEW.title || ' — ' || NEW.rating::text || '/10', 'task_rated', link,
        jsonb_build_object('task_id', NEW.id, 'event','task_rated','rating',NEW.rating));
    END IF;
    IF NEW.completion_percentage IS DISTINCT FROM OLD.completion_percentage AND NEW.completion_percentage IS NOT NULL AND NEW.assigned_to IS NOT NULL THEN
      PERFORM public.create_notification(NEW.assigned_to, 'اعتمد المدير نسبة إنجاز مهمتك',
        NEW.title || ' — ' || NEW.completion_percentage::text || '%', 'task_progress', link,
        jsonb_build_object('task_id', NEW.id, 'event','completion_approved','percentage',NEW.completion_percentage));
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.notify_task_changes() FROM PUBLIC, anon;
