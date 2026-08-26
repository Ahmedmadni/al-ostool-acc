-- Phase D3.5: per-device credentials, anomaly monitoring and scheduled maintenance.

ALTER TABLE public.hr_biometric_devices
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS token_last_four TEXT,
  ADD COLUMN IF NOT EXISTS token_rotated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auth_failures INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_auth_failure_at TIMESTAMPTZ;

CREATE TABLE public.hr_attendance_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('future_event','stale_event','rapid_duplicate','impossible_travel','excessive_corrections','device_offline')),
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  employee_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  device_id UUID REFERENCES public.hr_biometric_devices(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.hr_attendance_events(id) ON DELETE SET NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);
CREATE INDEX idx_hr_attendance_anomalies_status ON public.hr_attendance_anomalies(status,severity,last_detected_at DESC);
ALTER TABLE public.hr_attendance_anomalies ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.hr_attendance_anomalies TO authenticated;
GRANT ALL ON public.hr_attendance_anomalies TO service_role;
CREATE POLICY hr_attendance_anomalies_read ON public.hr_attendance_anomalies FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'hr.attendance','edit') OR public.has_permission(auth.uid(),'hr.attendance','approve') OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.hr_attendance_register_device(_device_code TEXT,_name_ar TEXT,_site_id UUID,_vendor TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE v_device public.hr_biometric_devices; v_token TEXT:=encode(gen_random_bytes(32),'hex');
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية تسجيل جهاز'; END IF;
  IF NULLIF(BTRIM(_device_code),'') IS NULL OR NULLIF(BTRIM(_name_ar),'') IS NULL THEN RAISE EXCEPTION 'رمز واسم الجهاز مطلوبان'; END IF;
  INSERT INTO public.hr_biometric_devices(device_code,name_ar,site_id,vendor,token_hash,token_last_four,token_rotated_at)
  VALUES(BTRIM(_device_code),BTRIM(_name_ar),_site_id,NULLIF(BTRIM(_vendor),''),encode(digest(v_token,'sha256'),'hex'),right(v_token,4),now())
  RETURNING * INTO v_device;
  RETURN jsonb_build_object('device_id',v_device.id,'device_code',v_device.device_code,'token',v_token,'token_last_four',v_device.token_last_four);
END; $$;

CREATE OR REPLACE FUNCTION public.hr_attendance_rotate_device_token(_device_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE v_device public.hr_biometric_devices; v_token TEXT:=encode(gen_random_bytes(32),'hex');
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية تدوير مفتاح الجهاز'; END IF;
  UPDATE public.hr_biometric_devices SET token_hash=encode(digest(v_token,'sha256'),'hex'),token_last_four=right(v_token,4),
    token_rotated_at=now(),auth_failures=0,last_auth_failure_at=NULL WHERE id=_device_id RETURNING * INTO v_device;
  IF NOT FOUND THEN RAISE EXCEPTION 'الجهاز غير موجود'; END IF;
  RETURN jsonb_build_object('device_id',v_device.id,'device_code',v_device.device_code,'token',v_token,'token_last_four',v_device.token_last_four);
END; $$;

CREATE OR REPLACE FUNCTION public.hr_attendance_authenticate_device(_device_code TEXT,_token TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE v_device public.hr_biometric_devices; v_valid BOOLEAN;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  SELECT * INTO v_device FROM public.hr_biometric_devices WHERE device_code=_device_code AND is_active FOR UPDATE;
  IF NOT FOUND OR v_device.token_hash IS NULL THEN RETURN false; END IF;
  v_valid:=v_device.token_hash=encode(digest(COALESCE(_token,''),'sha256'),'hex');
  IF v_valid THEN UPDATE public.hr_biometric_devices SET auth_failures=0,last_seen_at=now() WHERE id=v_device.id;
  ELSE UPDATE public.hr_biometric_devices SET auth_failures=auth_failures+1,last_auth_failure_at=now() WHERE id=v_device.id; END IF;
  RETURN v_valid;
END; $$;

CREATE OR REPLACE FUNCTION public.hr_attendance_scan_anomalies(_from TIMESTAMPTZ DEFAULT now()-INTERVAL '2 days',_to TIMESTAMPTZ DEFAULT now())
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count INTEGER:=0; v_rows INTEGER:=0;
BEGIN
  IF NOT (auth.role()='service_role' OR public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية فحص الشذوذ'; END IF;
  INSERT INTO public.hr_attendance_anomalies(anomaly_type,severity,employee_id,device_id,event_id,dedupe_key,details)
  SELECT 'future_event','critical',employee_id,device_id,id,'future:'||id,jsonb_build_object('occurred_at',occurred_at,'received_at',created_at)
  FROM public.hr_attendance_events WHERE created_at BETWEEN _from AND _to AND occurred_at>created_at+INTERVAL '5 minutes'
  ON CONFLICT(dedupe_key) DO UPDATE SET last_detected_at=now(),details=EXCLUDED.details;
  GET DIAGNOSTICS v_count=ROW_COUNT;

  INSERT INTO public.hr_attendance_anomalies(anomaly_type,severity,employee_id,device_id,event_id,dedupe_key,details)
  SELECT 'stale_event','medium',employee_id,device_id,id,'stale:'||id,jsonb_build_object('occurred_at',occurred_at,'received_at',created_at)
  FROM public.hr_attendance_events WHERE created_at BETWEEN _from AND _to AND created_at>occurred_at+INTERVAL '24 hours'
  ON CONFLICT(dedupe_key) DO UPDATE SET last_detected_at=now(),details=EXCLUDED.details;
  GET DIAGNOSTICS v_rows=ROW_COUNT; v_count:=v_count+v_rows;

  INSERT INTO public.hr_attendance_anomalies(anomaly_type,severity,employee_id,device_id,event_id,dedupe_key,details)
  SELECT 'rapid_duplicate','high',employee_id,device_id,id,'rapid:'||id,jsonb_build_object('previous_event_id',previous_id,'seconds',seconds)
  FROM (SELECT e.*,lag(id) OVER(PARTITION BY employee_id,event_type ORDER BY occurred_at) previous_id,
    EXTRACT(EPOCH FROM occurred_at-lag(occurred_at) OVER(PARTITION BY employee_id,event_type ORDER BY occurred_at)) seconds
    FROM public.hr_attendance_events e WHERE occurred_at BETWEEN _from AND _to AND validation_status='accepted') x
  WHERE seconds BETWEEN 0 AND 120
  ON CONFLICT(dedupe_key) DO UPDATE SET last_detected_at=now(),details=EXCLUDED.details;
  GET DIAGNOSTICS v_rows=ROW_COUNT; v_count:=v_count+v_rows;

  INSERT INTO public.hr_attendance_anomalies(anomaly_type,severity,employee_id,event_id,dedupe_key,details)
  SELECT 'impossible_travel','critical',employee_id,id,'travel:'||id,jsonb_build_object('previous_event_id',previous_id,'distance_meters',distance_m,'seconds',seconds)
  FROM (SELECT z.*,public.hr_distance_meters(latitude,longitude,previous_latitude,previous_longitude) distance_m FROM
    (SELECT e.*,lag(id) OVER(PARTITION BY employee_id ORDER BY occurred_at) previous_id,
      lag(latitude) OVER(PARTITION BY employee_id ORDER BY occurred_at) previous_latitude,
      lag(longitude) OVER(PARTITION BY employee_id ORDER BY occurred_at) previous_longitude,
      EXTRACT(EPOCH FROM occurred_at-lag(occurred_at) OVER(PARTITION BY employee_id ORDER BY occurred_at)) seconds
      FROM public.hr_attendance_events e WHERE occurred_at BETWEEN _from AND _to AND source='mobile_geofence' AND validation_status='accepted') z) x
  WHERE seconds>0 AND distance_m>1000 AND distance_m/seconds>55.56
  ON CONFLICT(dedupe_key) DO UPDATE SET last_detected_at=now(),details=EXCLUDED.details;
  GET DIAGNOSTICS v_rows=ROW_COUNT; v_count:=v_count+v_rows;

  INSERT INTO public.hr_attendance_anomalies(anomaly_type,severity,employee_id,dedupe_key,details)
  SELECT 'excessive_corrections','high',employee_id,'corrections:'||employee_id||':'||to_char(created_at,'YYYY-MM'),
    jsonb_build_object('month',to_char(created_at,'YYYY-MM'),'requests',COUNT(*))
  FROM public.hr_attendance_correction_requests WHERE created_at BETWEEN _from-INTERVAL '1 month' AND _to
  GROUP BY employee_id,to_char(created_at,'YYYY-MM') HAVING COUNT(*)>3
  ON CONFLICT(dedupe_key) DO UPDATE SET last_detected_at=now(),details=EXCLUDED.details;
  GET DIAGNOSTICS v_rows=ROW_COUNT; v_count:=v_count+v_rows;

  INSERT INTO public.hr_attendance_anomalies(anomaly_type,severity,device_id,dedupe_key,details)
  SELECT 'device_offline','medium',id,'offline:'||id,jsonb_build_object('device_code',device_code,'last_seen_at',last_seen_at)
  FROM public.hr_biometric_devices WHERE is_active AND COALESCE(last_seen_at,created_at)<now()-INTERVAL '24 hours'
  ON CONFLICT(dedupe_key) DO UPDATE SET last_detected_at=now(),details=EXCLUDED.details;
  GET DIAGNOSTICS v_rows=ROW_COUNT; v_count:=v_count+v_rows; RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.hr_attendance_resolve_anomaly(_anomaly_id UUID,_dismiss BOOLEAN,_notes TEXT)
RETURNS public.hr_attendance_anomalies LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.hr_attendance_anomalies;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','approve') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية إغلاق الإنذار'; END IF;
  IF char_length(BTRIM(COALESCE(_notes,'')))<5 THEN RAISE EXCEPTION 'ملاحظات المعالجة مطلوبة'; END IF;
  UPDATE public.hr_attendance_anomalies SET status=CASE WHEN _dismiss THEN 'dismissed' ELSE 'resolved' END,
    resolved_by=auth.uid(),resolved_at=now(),resolution_notes=BTRIM(_notes) WHERE id=_anomaly_id AND status='open' RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'الإنذار غير موجود أو مغلق'; END IF; RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.hr_attendance_run_maintenance(_work_date DATE DEFAULT CURRENT_DATE-1)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_days INTEGER; v_anomalies INTEGER; v_new INTEGER; v_user UUID;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF public.hr_attendance_period_is_closed(_work_date) THEN v_days:=0;
  ELSE v_days:=public.hr_attendance_refresh_days(_work_date,_work_date,NULL); END IF;
  v_anomalies:=public.hr_attendance_scan_anomalies((_work_date::TIMESTAMP AT TIME ZONE 'Asia/Riyadh'),now());
  SELECT COUNT(*) INTO v_new FROM public.hr_attendance_anomalies WHERE first_detected_at>now()-INTERVAL '1 minute' AND status='open';
  IF v_new>0 THEN
    FOR v_user IN SELECT id FROM public.profiles WHERE status='active'
      AND (public.has_permission(id,'hr.attendance','approve') OR public.is_admin(id))
    LOOP
      PERFORM public.create_notification(v_user,'تنبيهات حضور جديدة',format('تم اكتشاف %s حالة تحتاج المراجعة',v_new),
        'attendance_anomaly','/hr/attendance',jsonb_build_object('new_anomalies',v_new,'work_date',_work_date));
    END LOOP;
  END IF;
  RETURN jsonb_build_object('work_date',_work_date,'processed_days',v_days,'anomalies_touched',v_anomalies,'new_anomalies',v_new,'ran_at',now());
END; $$;

REVOKE ALL ON FUNCTION public.hr_attendance_register_device(TEXT,TEXT,UUID,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_attendance_rotate_device_token(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_attendance_authenticate_device(TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_attendance_scan_anomalies(TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_attendance_resolve_anomaly(UUID,BOOLEAN,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_attendance_run_maintenance(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_attendance_register_device(TEXT,TEXT,UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_rotate_device_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_authenticate_device(TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_attendance_scan_anomalies(TIMESTAMPTZ,TIMESTAMPTZ) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_attendance_resolve_anomaly(UUID,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_run_maintenance(DATE) TO service_role;
REVOKE INSERT,UPDATE,DELETE ON public.hr_attendance_anomalies FROM authenticated;
