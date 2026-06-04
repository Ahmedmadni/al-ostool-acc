
-- =========== Extend tasks ===========
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS completion_note text,
  ADD COLUMN IF NOT EXISTS completion_outcome text CHECK (completion_outcome IN ('success','failed')),
  ADD COLUMN IF NOT EXISTS rating integer CHECK (rating BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS rating_note text,
  ADD COLUMN IF NOT EXISTS rated_at timestamptz,
  ADD COLUMN IF NOT EXISTS rated_by uuid REFERENCES auth.users(id);

-- =========== Extend notifications ===========
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Allow triggers (SECURITY DEFINER) to insert notifications for any user.
DROP POLICY IF EXISTS "users insert own notifications" ON public.notifications;
CREATE POLICY "users insert own notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
-- service_role bypasses RLS; security-definer triggers run as definer (postgres) so RLS is bypassed too.

-- =========== Helper: is task participant ===========
CREATE OR REPLACE FUNCTION public.is_task_participant(_task_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = _task_id
      AND (t.assigned_to = _user_id OR t.created_by = _user_id OR _user_id = ANY(t.visible_to_user_ids))
  ) OR public.is_admin(_user_id)
$$;

-- =========== task_comments ===========
CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read comments" ON public.task_comments
  FOR SELECT TO authenticated USING (public.is_task_participant(task_id, auth.uid()));
CREATE POLICY "participants insert comments" ON public.task_comments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_task_participant(task_id, auth.uid()));
CREATE POLICY "author manages own comments" ON public.task_comments
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "author deletes own comments" ON public.task_comments
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);

-- =========== task_requests ===========
CREATE TABLE IF NOT EXISTS public.task_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('reschedule','reassign')),
  reason text,
  proposed_due_date timestamptz,
  proposed_assignee uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decision_note text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_requests TO authenticated;
GRANT ALL ON public.task_requests TO service_role;
ALTER TABLE public.task_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read requests" ON public.task_requests
  FOR SELECT TO authenticated USING (public.is_task_participant(task_id, auth.uid()));
CREATE POLICY "assignee creates requests" ON public.task_requests
  FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid() AND public.is_task_participant(task_id, auth.uid()));
CREATE POLICY "manager updates requests" ON public.task_requests
  FOR UPDATE TO authenticated USING (public.is_task_participant(task_id, auth.uid())) WITH CHECK (public.is_task_participant(task_id, auth.uid()));
CREATE TRIGGER trg_task_requests_updated BEFORE UPDATE ON public.task_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE INDEX IF NOT EXISTS idx_task_requests_task ON public.task_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_task_requests_status ON public.task_requests(status);

-- =========== task_attachments ===========
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read task attachments" ON public.task_attachments
  FOR SELECT TO authenticated USING (public.is_task_participant(task_id, auth.uid()));
CREATE POLICY "participants insert task attachments" ON public.task_attachments
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid() AND public.is_task_participant(task_id, auth.uid()));
CREATE POLICY "uploader deletes task attachments" ON public.task_attachments
  FOR DELETE TO authenticated USING (uploaded_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON public.task_attachments(task_id);

-- =========== Notification helper ===========
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid, _title text, _message text, _type text, _link text, _metadata jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, title, message, type, link, metadata)
  VALUES (_user_id, _title, COALESCE(_message,''), COALESCE(_type,'info'), _link, COALESCE(_metadata,'{}'::jsonb));
END $$;

-- =========== Trigger: task created / assignment / completion ===========
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
    -- reassignment
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
      PERFORM public.create_notification(NEW.assigned_to, 'تم إسناد مهمة إليك', NEW.title, 'task_assigned', link,
        jsonb_build_object('task_id', NEW.id, 'event','task_reassigned'));
    END IF;
    -- completion → notify creator/manager to rate
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'completed' AND NEW.created_by IS NOT NULL AND NEW.created_by <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
      PERFORM public.create_notification(NEW.created_by, 'مهمة بانتظار التقييم', NEW.title, 'task_completed', link,
        jsonb_build_object('task_id', NEW.id, 'event','task_completed'));
    END IF;
    -- overdue
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'overdue' AND NEW.created_by IS NOT NULL THEN
      PERFORM public.create_notification(NEW.created_by, 'تأخّر إنجاز مهمة', NEW.title, 'task_overdue', link,
        jsonb_build_object('task_id', NEW.id, 'event','task_overdue'));
    END IF;
    -- rating → notify assignee
    IF NEW.rating IS DISTINCT FROM OLD.rating AND NEW.rating IS NOT NULL AND NEW.assigned_to IS NOT NULL THEN
      PERFORM public.create_notification(NEW.assigned_to, 'تم تقييم مهمتك', NEW.title || ' — ' || NEW.rating::text || '/10', 'task_rated', link,
        jsonb_build_object('task_id', NEW.id, 'event','task_rated','rating',NEW.rating));
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_tasks ON public.tasks;
CREATE TRIGGER trg_notify_tasks AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_changes();

-- =========== Trigger: task comments ===========
CREATE OR REPLACE FUNCTION public.notify_task_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; recipient uuid; link text;
BEGIN
  SELECT id, title, assigned_to, created_by INTO t FROM public.tasks WHERE id = NEW.task_id;
  link := '/tasks/' || NEW.task_id::text;
  -- notify the other side(s)
  IF t.assigned_to IS NOT NULL AND t.assigned_to <> NEW.user_id THEN
    PERFORM public.create_notification(t.assigned_to, 'تعليق جديد على مهمة', t.title, 'task_comment', link,
      jsonb_build_object('task_id', t.id, 'event','task_comment'));
  END IF;
  IF t.created_by IS NOT NULL AND t.created_by <> NEW.user_id AND t.created_by <> t.assigned_to THEN
    PERFORM public.create_notification(t.created_by, 'تعليق جديد على مهمة', t.title, 'task_comment', link,
      jsonb_build_object('task_id', t.id, 'event','task_comment'));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_task_comment ON public.task_comments;
CREATE TRIGGER trg_notify_task_comment AFTER INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_comment();

-- =========== Trigger: task requests ===========
CREATE OR REPLACE FUNCTION public.notify_task_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; link text; ttl text;
BEGIN
  SELECT id, title, assigned_to, created_by INTO t FROM public.tasks WHERE id = NEW.task_id;
  link := '/tasks/' || NEW.task_id::text;
  ttl := CASE WHEN NEW.request_type='reschedule' THEN 'طلب إعادة جدولة' ELSE 'طلب إعادة إسناد' END;
  IF TG_OP = 'INSERT' THEN
    IF t.created_by IS NOT NULL AND t.created_by <> NEW.requested_by THEN
      PERFORM public.create_notification(t.created_by, ttl, t.title, 'task_request', link,
        jsonb_build_object('task_id', t.id, 'request_id', NEW.id, 'event','task_request_created'));
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected') THEN
    PERFORM public.create_notification(NEW.requested_by,
      CASE WHEN NEW.status='approved' THEN 'تمت الموافقة على طلبك' ELSE 'تم رفض طلبك' END,
      t.title, 'task_request_decision', link,
      jsonb_build_object('task_id', t.id, 'request_id', NEW.id, 'event','task_request_decision','status',NEW.status));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_task_request ON public.task_requests;
CREATE TRIGGER trg_notify_task_request AFTER INSERT OR UPDATE ON public.task_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_request();

-- =========== Auto-overdue function (callable by cron) ===========
CREATE OR REPLACE FUNCTION public.mark_overdue_tasks()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  WITH updated AS (
    UPDATE public.tasks t
       SET status = 'overdue'
     WHERE t.due_date IS NOT NULL
       AND t.due_date < now()
       AND t.status NOT IN ('completed','cancelled','overdue')
       AND NOT EXISTS (
         SELECT 1 FROM public.task_requests r
          WHERE r.task_id = t.id AND r.status = 'pending'
       )
     RETURNING 1
  )
  SELECT count(*) INTO n FROM updated;
  RETURN n;
END $$;

-- =========== Realtime ===========
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;
