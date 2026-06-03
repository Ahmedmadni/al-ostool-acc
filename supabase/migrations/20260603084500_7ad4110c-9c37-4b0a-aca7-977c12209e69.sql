
-- 1) Profiles: restrict SELECT (was USING true exposing all emails).
-- Allow users to see their own profile; allow admins/CFO/managers to see all (needed for team task assignment).
DROP POLICY IF EXISTS "users view all profiles" ON public.profiles;

CREATE POLICY "users view own or managers view all" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR public.user_has_any_role(auth.uid(), ARRAY['admin','cfo','finance_manager','chief_accountant'])
);

-- 2) Notifications: remove NULL user_id loophole; require ownership.
DROP POLICY IF EXISTS "users own notifications" ON public.notifications;

CREATE POLICY "users select own notifications" ON public.notifications
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "users insert own notifications" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "users update own notifications" ON public.notifications
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "users delete own notifications" ON public.notifications
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 3) Audit logs: prevent forged entries by binding user_id to caller.
DROP POLICY IF EXISTS "auth insert audit" ON public.audit_logs;

CREATE POLICY "auth insert own audit" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
-- Note: SECURITY DEFINER trigger log_audit_event continues to work because it runs as table owner.

-- 4) Storage attachments bucket: enforce role-based read & write.
DROP POLICY IF EXISTS "auth read attachments bucket" ON storage.objects;
DROP POLICY IF EXISTS "auth upload attachments bucket" ON storage.objects;
DROP POLICY IF EXISTS "auth delete own attachments" ON storage.objects;

CREATE POLICY "attachments read by business roles" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'attachments' AND public.can_read_business(auth.uid()));

CREATE POLICY "attachments write by ops roles" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attachments' AND public.can_write_operations(auth.uid()));

CREATE POLICY "attachments update by ops roles" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'attachments' AND public.can_write_operations(auth.uid()))
WITH CHECK (bucket_id = 'attachments' AND public.can_write_operations(auth.uid()));

CREATE POLICY "attachments delete by owner or admin" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'attachments'
  AND (auth.uid() = owner OR public.is_admin(auth.uid()))
);
