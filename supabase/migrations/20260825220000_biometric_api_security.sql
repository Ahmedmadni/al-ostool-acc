-- Gate 5: signed, fresh, replay-safe biometric ingestion RPCs.
DO $$
BEGIN
  IF to_regprocedure('public.hr_attendance_claim_biometric_request(text,text,timestamp with time zone,text,text,text,text)') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_log_ingest_rejection(text,text,text,text,text,timestamp with time zone,text,text,text)') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_biometric_ingest_secure(uuid,text,text,text,timestamp with time zone,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Gate 5 biometric API functions are already or partially applied';
  END IF;
  IF to_regclass('public.hr_biometric_ingest_requests') IS NULL
     OR to_regclass('public.hr_biometric_ingest_rejections') IS NULL
     OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.hr_attendance_events'::regclass
       AND attname='ingest_request_id' AND NOT attisdropped) THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Gate 5 biometric security foundation is missing';
  END IF;
  IF to_regprocedure('extensions.crypt(text,text)') IS NULL
     OR to_regprocedure('extensions.gen_salt(text,integer)') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Gate 5 requires pgcrypto in the extensions schema';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_attendance_register_device(_device_code TEXT,_name_ar TEXT,_site_id UUID,_vendor TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_device public.hr_biometric_devices; v_token TEXT:=encode(extensions.gen_random_bytes(32),'hex');
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية تسجيل جهاز'; END IF;
  IF NULLIF(btrim(_name_ar),'') IS NULL THEN RAISE EXCEPTION 'اسم الجهاز مطلوب'; END IF;
  INSERT INTO public.hr_biometric_devices(device_code,name_ar,site_id,vendor,token_hash,token_last_four,token_rotated_at)
  VALUES(btrim(_device_code),btrim(_name_ar),_site_id,NULLIF(btrim(_vendor),''),extensions.crypt(v_token,extensions.gen_salt('bf',12)),right(v_token,4),clock_timestamp())
  RETURNING * INTO v_device;
  RETURN jsonb_build_object('device_id',v_device.id,'device_code',v_device.device_code,'token',v_token,'token_last_four',v_device.token_last_four);
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_attendance_rotate_device_token(_device_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_device public.hr_biometric_devices; v_token TEXT:=encode(extensions.gen_random_bytes(32),'hex');
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية تدوير مفتاح الجهاز'; END IF;
  UPDATE public.hr_biometric_devices SET token_hash=extensions.crypt(v_token,extensions.gen_salt('bf',12)),
    token_last_four=right(v_token,4),token_rotated_at=clock_timestamp(),auth_failures=0,last_auth_failure_at=NULL
  WHERE id=_device_id RETURNING * INTO v_device;
  IF NOT FOUND THEN RAISE EXCEPTION 'الجهاز غير موجود'; END IF;
  RETURN jsonb_build_object('device_id',v_device.id,'device_code',v_device.device_code,'token',v_token,'token_last_four',v_device.token_last_four);
END;
$$;

CREATE FUNCTION public.hr_attendance_log_ingest_rejection(
  _reason TEXT,_fingerprint TEXT,_device_code TEXT DEFAULT NULL,_employee_no TEXT DEFAULT NULL,
  _external_event_id TEXT DEFAULT NULL,_occurred_at TIMESTAMPTZ DEFAULT NULL,
  _source_ip TEXT DEFAULT NULL,_user_agent TEXT DEFAULT NULL,_device_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  INSERT INTO public.hr_biometric_ingest_rejections(device_id,submitted_device_code,external_employee_no,
    external_event_id,event_occurred_at,reason,request_fingerprint,source_ip,user_agent)
  VALUES(_device_id,left(_device_code,100),left(_employee_no,100),left(_external_event_id,200),_occurred_at,
    _reason,_fingerprint,left(_source_ip,200),left(_user_agent,500));
END;
$$;

CREATE FUNCTION public.hr_attendance_claim_biometric_request(
  _device_code TEXT,_token TEXT,_request_timestamp TIMESTAMPTZ,_nonce TEXT,_body_hash TEXT,
  _source_ip TEXT DEFAULT NULL,_user_agent TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_device public.hr_biometric_devices; v_request public.hr_biometric_ingest_requests;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  SELECT * INTO v_device FROM public.hr_biometric_devices WHERE device_code=_device_code FOR UPDATE;
  IF v_device.id IS NULL THEN
    PERFORM public.hr_attendance_log_ingest_rejection('unknown_device',_body_hash,_device_code,NULL,NULL,NULL,_source_ip,_user_agent,NULL);
    RETURN jsonb_build_object('authenticated',false,'reason','invalid_credentials');
  END IF;
  IF NOT v_device.is_active THEN
    PERFORM public.hr_attendance_log_ingest_rejection('inactive_device',_body_hash,_device_code,NULL,NULL,NULL,_source_ip,_user_agent,v_device.id);
    RETURN jsonb_build_object('authenticated',false,'reason','invalid_credentials');
  END IF;
  IF v_device.token_hash IS NULL OR extensions.crypt(coalesce(_token,''),v_device.token_hash)<>v_device.token_hash THEN
    UPDATE public.hr_biometric_devices SET auth_failures=auth_failures+1,last_auth_failure_at=clock_timestamp() WHERE id=v_device.id;
    PERFORM public.hr_attendance_log_ingest_rejection('invalid_credentials',_body_hash,_device_code,NULL,NULL,NULL,_source_ip,_user_agent,v_device.id);
    RETURN jsonb_build_object('authenticated',false,'reason','invalid_credentials');
  END IF;
  IF _request_timestamp<clock_timestamp()-interval '5 minutes' OR _request_timestamp>clock_timestamp()+interval '2 minutes' THEN
    PERFORM public.hr_attendance_log_ingest_rejection(CASE WHEN _request_timestamp>clock_timestamp() THEN 'future_request' ELSE 'expired_request' END,
      _body_hash,_device_code,NULL,NULL,NULL,_source_ip,_user_agent,v_device.id);
    RETURN jsonb_build_object('authenticated',false,'reason','stale_request');
  END IF;
  INSERT INTO public.hr_biometric_ingest_requests(device_id,nonce,request_timestamp,body_hash,source_ip,user_agent)
  VALUES(v_device.id,_nonce,_request_timestamp,_body_hash,left(_source_ip,200),left(_user_agent,500))
  ON CONFLICT(device_id,nonce) DO NOTHING RETURNING * INTO v_request;
  IF v_request.id IS NULL THEN
    SELECT * INTO v_request FROM public.hr_biometric_ingest_requests WHERE device_id=v_device.id AND nonce=_nonce;
    IF v_request.body_hash<>_body_hash THEN
      PERFORM public.hr_attendance_log_ingest_rejection('nonce_conflict',_body_hash,_device_code,NULL,NULL,NULL,_source_ip,_user_agent,v_device.id);
      RETURN jsonb_build_object('authenticated',true,'request_status','conflict','device_id',v_device.id);
    END IF;
    RETURN jsonb_build_object('authenticated',true,'request_status','replay','request_id',v_request.id,'device_id',v_device.id);
  END IF;
  UPDATE public.hr_biometric_devices SET auth_failures=0,last_seen_at=clock_timestamp() WHERE id=v_device.id;
  RETURN jsonb_build_object('authenticated',true,'request_status','claimed','request_id',v_request.id,'device_id',v_device.id);
END;
$$;

CREATE FUNCTION public.hr_attendance_biometric_ingest_secure(
  _request_id UUID,_device_code TEXT,_employee_no TEXT,_event_type TEXT,
  _occurred_at TIMESTAMPTZ,_external_event_id TEXT,_payload_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.hr_biometric_ingest_requests; v_device public.hr_biometric_devices;
  v_employee UUID; v_group public.hr_shift_groups; v_schedule public.hr_shift_schedules;
  v_local TIMESTAMP; v_work_date DATE; v_start TIMESTAMP; v_end TIMESTAMP; v_open TIMESTAMP; v_close TIMESTAMP;
  v_status TEXT:='out_of_window'; v_row public.hr_attendance_events; v_inserted BOOLEAN:=false;
  v_candidate RECORD; v_scope_found BOOLEAN:=false;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF _event_type NOT IN ('check_in','check_out') OR nullif(btrim(_external_event_id),'') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid canonical event';
  END IF;
  SELECT r.* INTO v_request FROM public.hr_biometric_ingest_requests r
    JOIN public.hr_biometric_devices d ON d.id=r.device_id
    WHERE r.id=_request_id AND d.device_code=_device_code AND d.is_active;
  SELECT * INTO v_device FROM public.hr_biometric_devices WHERE id=v_request.device_id;
  IF v_request.id IS NULL OR v_device.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='invalid ingest request'; END IF;
  SELECT id INTO v_employee FROM public.hr_employees WHERE employee_no=_employee_no;
  IF v_employee IS NULL THEN
    PERFORM public.hr_attendance_log_ingest_rejection('unknown_employee',v_request.body_hash,_device_code,_employee_no,_external_event_id,_occurred_at,v_request.source_ip,v_request.user_agent,v_device.id);
    RETURN jsonb_build_object('status','rejected','reason','unknown_employee','external_event_id',_external_event_id);
  END IF;
  -- Attribute employee assignment/group scope at event time, not current state.
  -- Candidate work dates include the group's local event date and previous date
  -- so an after-midnight punch can belong to the prior day's night shift.
  -- Device site itself is current-state because hr_biometric_devices.site_id has
  -- no effective-dated history; Gate 5 does not invent historical site evidence.
  FOR v_candidate IN
    SELECT a.id assignment_id,a.group_id,g.timezone,days.work_date,s.id schedule_id
    FROM public.hr_shift_assignments a
    JOIN public.hr_shift_groups g ON g.id=a.group_id AND g.is_active
    JOIN public.hr_shift_group_sites gs ON gs.group_id=g.id AND gs.site_id=v_device.site_id
    CROSS JOIN LATERAL (VALUES ((_occurred_at AT TIME ZONE g.timezone)::date),
      ((_occurred_at AT TIME ZONE g.timezone)::date-1)) days(work_date)
    JOIN public.hr_shift_schedules s ON s.group_id=g.id AND s.is_working_day
      AND s.day_of_week=extract(dow FROM days.work_date)::integer
    WHERE a.employee_id=v_employee AND a.effective_from<=days.work_date
      AND (a.effective_to IS NULL OR a.effective_to>=days.work_date)
    ORDER BY days.work_date DESC,a.effective_from DESC,a.id
  LOOP
    v_scope_found:=true;
    SELECT * INTO v_group FROM public.hr_shift_groups WHERE id=v_candidate.group_id;
    SELECT * INTO v_schedule FROM public.hr_shift_schedules WHERE id=v_candidate.schedule_id;
    v_work_date:=v_candidate.work_date; v_local:=_occurred_at AT TIME ZONE v_group.timezone;
    v_start:=v_work_date+v_schedule.start_time; v_end:=v_work_date+v_schedule.end_time;
    IF v_end<=v_start THEN v_end:=v_end+interval '1 day'; END IF;
    IF _event_type='check_in' THEN v_open:=v_start-make_interval(mins=>v_schedule.checkin_open_before_minutes); v_close:=v_start+make_interval(mins=>v_schedule.checkin_close_after_minutes);
    ELSE v_open:=v_end-make_interval(mins=>v_schedule.checkout_open_before_minutes); v_close:=v_end+make_interval(mins=>v_schedule.checkout_close_after_minutes); END IF;
    IF v_local BETWEEN v_open AND v_close THEN v_status:='accepted'; EXIT; END IF;
    v_schedule:=NULL;
  END LOOP;
  IF NOT v_scope_found OR v_device.site_id IS NULL THEN
    PERFORM public.hr_attendance_log_ingest_rejection('employee_out_of_scope',v_request.body_hash,_device_code,_employee_no,_external_event_id,_occurred_at,v_request.source_ip,v_request.user_agent,v_device.id);
    RETURN jsonb_build_object('status','rejected','reason','employee_out_of_scope','external_event_id',_external_event_id);
  END IF;
  INSERT INTO public.hr_attendance_events(employee_id,event_type,source,occurred_at,site_id,device_id,schedule_id,
    external_event_id,validation_status,metadata,ingest_request_id,ingest_payload_hash)
  VALUES(v_employee,_event_type,'biometric',_occurred_at,v_device.site_id,v_device.id,v_schedule.id,
    _external_event_id,v_status,jsonb_build_object('device_code',_device_code),_request_id,_payload_hash)
  ON CONFLICT(device_id,external_event_id) DO NOTHING RETURNING * INTO v_row;
  IF v_row.id IS NOT NULL THEN v_inserted:=true;
  ELSE
    SELECT * INTO v_row FROM public.hr_attendance_events WHERE device_id=v_device.id AND external_event_id=_external_event_id;
    IF v_row.employee_id<>v_employee OR v_row.event_type<>_event_type OR v_row.occurred_at<>_occurred_at
       OR (v_row.ingest_payload_hash IS NOT NULL AND v_row.ingest_payload_hash<>_payload_hash) THEN
      PERFORM public.hr_attendance_log_ingest_rejection('event_identity_conflict',v_request.body_hash,_device_code,_employee_no,_external_event_id,_occurred_at,v_request.source_ip,v_request.user_agent,v_device.id);
      RETURN jsonb_build_object('status','conflict','reason','event_identity_conflict','external_event_id',_external_event_id);
    END IF;
  END IF;
  RETURN jsonb_build_object('status',CASE WHEN v_inserted THEN 'created' ELSE 'duplicate' END,
    'event_id',v_row.id,'external_event_id',_external_event_id);
END;
$$;

REVOKE ALL ON FUNCTION public.hr_attendance_biometric_ingest(TEXT,TEXT,TEXT,TIMESTAMPTZ,TEXT) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.hr_attendance_log_ingest_rejection(TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_attendance_claim_biometric_request(TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_attendance_biometric_ingest_secure(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_log_ingest_rejection(TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_attendance_claim_biometric_request(TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_attendance_biometric_ingest_secure(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT) TO service_role;
