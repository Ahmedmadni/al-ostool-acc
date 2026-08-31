-- Gate 5 post-merge security review fixes. This migration intentionally does
-- not alter the provisioning contract: authenticated back-office callers must
-- still pass each function's hr.attendance edit/admin authorization check.

REVOKE ALL ON FUNCTION public.hr_attendance_register_device(TEXT,TEXT,UUID,TEXT)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.hr_attendance_rotate_device_token(UUID)
  FROM PUBLIC,anon,authenticated,service_role;

-- The attendance device-management UI invokes both RPCs with the signed-in
-- user's authenticated role. No server/service-role caller is required.
GRANT EXECUTE ON FUNCTION public.hr_attendance_register_device(TEXT,TEXT,UUID,TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_rotate_device_token(UUID)
  TO authenticated;

-- Match the API's existing metadata truncation at the database boundary. NOT
-- VALID avoids rejecting deployment because of any pre-Gate-5 historical row,
-- while PostgreSQL still enforces these constraints for new and changed rows.
ALTER TABLE public.hr_biometric_ingest_requests
  ADD CONSTRAINT hr_biometric_ingest_requests_source_ip_length
    CHECK (source_ip IS NULL OR char_length(source_ip)<=200) NOT VALID,
  ADD CONSTRAINT hr_biometric_ingest_requests_user_agent_length
    CHECK (user_agent IS NULL OR char_length(user_agent)<=500) NOT VALID;
ALTER TABLE public.hr_biometric_ingest_rejections
  ADD CONSTRAINT hr_biometric_ingest_rejections_source_ip_length
    CHECK (source_ip IS NULL OR char_length(source_ip)<=200) NOT VALID,
  ADD CONSTRAINT hr_biometric_ingest_rejections_user_agent_length
    CHECK (user_agent IS NULL OR char_length(user_agent)<=500) NOT VALID;

COMMENT ON COLUMN public.hr_biometric_devices.site_id IS
  'Medium / Deferred operational integrity limitation: current-state, not effective-dated. Delayed biometric events may be accepted for up to 31 days, so historical device-site attribution requires an operational control until a future history model exists.';
