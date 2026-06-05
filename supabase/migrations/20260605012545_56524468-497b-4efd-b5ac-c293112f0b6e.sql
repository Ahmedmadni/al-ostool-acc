
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_requests TO authenticated;
GRANT ALL ON public.task_requests TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_checklist_items TO authenticated;
GRANT ALL ON public.task_checklist_items TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_assignees TO authenticated;
GRANT ALL ON public.task_assignees TO service_role;
