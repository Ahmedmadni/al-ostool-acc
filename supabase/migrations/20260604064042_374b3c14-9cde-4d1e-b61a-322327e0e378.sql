
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid,text,text,text,text,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_task_changes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_task_comment() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_task_request() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_tasks() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_task_participant(uuid,uuid) FROM PUBLIC, anon;
