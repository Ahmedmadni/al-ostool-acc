-- Gate 5: durable biometric trust-boundary state.  This migration is ordered
-- before the existing sequential-code migration so its legacy device RPC can be
-- parsed; Gate 5's final RPC definitions are installed by 20260825220000.
DO $$
BEGIN
  IF to_regclass('public.hr_biometric_ingest_requests') IS NOT NULL
     OR to_regclass('public.hr_biometric_ingest_rejections') IS NOT NULL
     OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.hr_biometric_devices'::regclass
       AND attname IN ('token_hash','token_last_four','token_rotated_at') AND NOT attisdropped) THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Gate 5 biometric security is already or partially applied';
  END IF;
  IF to_regclass('public.hr_biometric_devices') IS NULL
     OR to_regclass('public.hr_attendance_events') IS NULL
     OR to_regprocedure('public.hr_attendance_biometric_ingest(text,text,text,timestamp with time zone,text)') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Gate 5 requires the attendance foundation ingest objects';
  END IF;
END;
$$;

ALTER TABLE public.hr_biometric_devices
  ADD COLUMN token_hash TEXT,
  ADD COLUMN token_last_four TEXT,
  ADD COLUMN token_rotated_at TIMESTAMPTZ,
  ADD COLUMN auth_failures INTEGER NOT NULL DEFAULT 0 CHECK (auth_failures>=0),
  ADD COLUMN last_auth_failure_at TIMESTAMPTZ;

CREATE TABLE public.hr_biometric_ingest_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.hr_biometric_devices(id) ON DELETE RESTRICT,
  nonce TEXT NOT NULL CHECK (char_length(nonce) BETWEEN 16 AND 128),
  request_timestamp TIMESTAMPTZ NOT NULL,
  body_hash TEXT NOT NULL CHECK (body_hash~'^[0-9a-f]{64}$'),
  source_ip TEXT,
  user_agent TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(device_id,nonce)
);
COMMENT ON TABLE public.hr_biometric_ingest_requests IS
  'Replay-security state. Retain each nonce through request_timestamp + the five-minute acceptance window plus an operational clock/processing safety margin; cleanup must never shorten that bound.';
CREATE INDEX idx_hr_biometric_ingest_requests_received
  ON public.hr_biometric_ingest_requests(received_at DESC);

CREATE TABLE public.hr_biometric_ingest_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.hr_biometric_devices(id) ON DELETE SET NULL,
  submitted_device_code TEXT CHECK (char_length(submitted_device_code)<=100),
  external_employee_no TEXT CHECK (char_length(external_employee_no)<=100),
  external_event_id TEXT CHECK (char_length(external_event_id)<=200),
  event_occurred_at TIMESTAMPTZ,
  reason TEXT NOT NULL CHECK (reason IN ('unknown_device','inactive_device','invalid_credentials',
    'invalid_signature','expired_request','future_request','nonce_conflict','unknown_employee',
    'employee_out_of_scope','event_identity_conflict','invalid_request')),
  request_fingerprint TEXT NOT NULL CHECK (request_fingerprint~'^[0-9a-f]{64}$'),
  source_ip TEXT,
  user_agent TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
COMMENT ON TABLE public.hr_biometric_ingest_rejections IS
  'Security investigation audit, not replay state. Retention is governed by a separate, longer organizational audit policy; Gate 5 does not invent or execute that policy.';
CREATE INDEX idx_hr_biometric_ingest_rejections_received
  ON public.hr_biometric_ingest_rejections(received_at DESC,reason);
CREATE INDEX idx_hr_biometric_ingest_rejections_device
  ON public.hr_biometric_ingest_rejections(device_id,received_at DESC) WHERE device_id IS NOT NULL;

ALTER TABLE public.hr_attendance_events
  ADD COLUMN ingest_request_id UUID REFERENCES public.hr_biometric_ingest_requests(id) ON DELETE SET NULL,
  ADD COLUMN ingest_payload_hash TEXT CHECK (ingest_payload_hash IS NULL OR ingest_payload_hash~'^[0-9a-f]{64}$');

-- A password verifier is still sensitive.  Replace the foundation's table-wide
-- SELECT with an explicit safe-column projection for authenticated back-office users.
REVOKE SELECT ON public.hr_biometric_devices FROM authenticated;
GRANT SELECT(id,device_code,name_ar,site_id,vendor,is_active,last_seen_at,created_at,updated_at,
  token_last_four,token_rotated_at,auth_failures,last_auth_failure_at)
  ON public.hr_biometric_devices TO authenticated;

ALTER TABLE public.hr_biometric_ingest_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_biometric_ingest_rejections ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.hr_biometric_ingest_requests,public.hr_biometric_ingest_rejections TO authenticated;
GRANT ALL ON public.hr_biometric_ingest_requests,public.hr_biometric_ingest_rejections TO service_role;
CREATE POLICY hr_biometric_ingest_requests_read ON public.hr_biometric_ingest_requests FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'hr.attendance','approve') OR public.is_admin(auth.uid()));
CREATE POLICY hr_biometric_ingest_rejections_read ON public.hr_biometric_ingest_rejections FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'hr.attendance','approve') OR public.is_admin(auth.uid()));
REVOKE INSERT,UPDATE,DELETE ON public.hr_biometric_ingest_requests,public.hr_biometric_ingest_rejections FROM authenticated;

-- Temporary compatibility columns only; final secured RPCs follow after the
-- already-versioned sequential-code migration.
