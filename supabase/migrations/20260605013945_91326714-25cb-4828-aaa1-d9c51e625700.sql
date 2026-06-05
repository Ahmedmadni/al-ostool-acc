
-- 1) Add started_at column
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- 2) Fix trigger function: replace invalid 'completed' enum value with 'done'
CREATE OR REPLACE FUNCTION public.notify_task_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'done' AND NEW.created_by IS NOT NULL AND NEW.created_by <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
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
END $function$;

-- 3) Auto-populate started_at / completed_at on status transitions
CREATE OR REPLACE FUNCTION public.task_set_lifecycle_timestamps()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'in_progress' AND NEW.started_at IS NULL THEN
      NEW.started_at := now();
    END IF;
    IF NEW.status = 'done' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'in_progress' AND NEW.started_at IS NULL THEN
        NEW.started_at := now();
      END IF;
      IF NEW.status = 'done' AND NEW.completed_at IS NULL THEN
        NEW.completed_at := now();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_lifecycle_timestamps ON public.tasks;
CREATE TRIGGER trg_task_lifecycle_timestamps
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.task_set_lifecycle_timestamps();
