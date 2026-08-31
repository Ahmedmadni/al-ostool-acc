-- Gate 4: attendance operational control layer.
-- Detection records evidence; it never changes attendance events, calculated days,
-- corrections, or closed periods.  Unexpected exceptions still propagate, so a
-- failure recorded in this transaction is not durable after transaction rollback.

DO $$
BEGIN
  IF to_regclass('public.hr_attendance_anomalies') IS NOT NULL
     OR to_regclass('public.hr_attendance_anomaly_settings') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_record_anomaly(text,text,text,uuid,uuid,uuid,uuid,date,timestamp with time zone,text,jsonb)') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_scan_anomalies(timestamp with time zone,timestamp with time zone)') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_acknowledge_anomaly(uuid,text)') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_resolve_anomaly(uuid,boolean,text)') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_run_maintenance(date)') IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Gate 4 is already or partially applied; inspect schema history before retrying';
  END IF;
  IF to_regclass('public.hr_attendance_events') IS NULL
     OR to_regclass('public.hr_attendance_days') IS NULL
     OR to_regclass('public.hr_biometric_devices') IS NULL
     OR to_regclass('public.hr_shift_assignments') IS NULL
     OR to_regclass('public.hr_shift_schedules') IS NULL
     OR to_regclass('public.hr_attendance_periods') IS NULL
     OR to_regprocedure('public.hr_attendance_refresh_days(date,date,uuid)') IS NULL
     OR to_regprocedure('public.hr_attendance_period_is_closed(date)') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Gate 4 requires the verified Gate 1, Gate 2, and Gate 3 objects';
  END IF;
END;
$$;

CREATE TABLE public.hr_attendance_anomaly_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  future_grace_minutes INTEGER NOT NULL DEFAULT 10 CHECK (future_grace_minutes BETWEEN 1 AND 120),
  stale_after_hours INTEGER NOT NULL DEFAULT 48 CHECK (stale_after_hours BETWEEN 1 AND 720),
  near_duplicate_seconds INTEGER NOT NULL DEFAULT 120 CHECK (near_duplicate_seconds BETWEEN 1 AND 900),
  maximum_scan_days INTEGER NOT NULL DEFAULT 31 CHECK (maximum_scan_days BETWEEN 1 AND 92),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
INSERT INTO public.hr_attendance_anomaly_settings(singleton) VALUES (true);

CREATE TABLE public.hr_attendance_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_type TEXT NOT NULL CHECK (anomaly_type IN (
    'unexpected_absence','incomplete_punch','off_schedule_event','extreme_time_event',
    'near_duplicate','conflicting_sequence','no_active_assignment',
    'invalid_shift_configuration','inactive_device','future_event',
    'stale_event','unexpected_state_transition')),
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','high','critical')),
  employee_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  device_id UUID REFERENCES public.hr_biometric_devices(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.hr_attendance_events(id) ON DELETE SET NULL,
  attendance_day_id UUID REFERENCES public.hr_attendance_days(id) ON DELETE SET NULL,
  work_date DATE,
  occurred_at TIMESTAMPTZ,
  detection_source TEXT NOT NULL CHECK (char_length(btrim(detection_source)) BETWEEN 2 AND 80),
  description TEXT NOT NULL CHECK (char_length(btrim(description)) BETWEEN 5 AND 500),
  details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object'),
  fingerprint TEXT NOT NULL CHECK (char_length(fingerprint) BETWEEN 8 AND 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','ignored')),
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  last_detected_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  occurrence_count BIGINT NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  acknowledgement_note TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_reason TEXT,
  CHECK (last_detected_at >= first_detected_at),
  CHECK ((status IN ('resolved','ignored') AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL
      AND char_length(btrim(resolution_reason)) >= 5)
    OR (status IN ('open','acknowledged') AND resolved_by IS NULL AND resolved_at IS NULL AND resolution_reason IS NULL)),
  CHECK ((status='acknowledged' AND acknowledged_by IS NOT NULL AND acknowledged_at IS NOT NULL
      AND char_length(btrim(acknowledgement_note)) >= 5) OR status<>'acknowledged')
);

-- One active investigation per deterministic problem identity.  A recurrence
-- after resolution creates a new investigation rather than rewriting its audit.
CREATE UNIQUE INDEX uq_hr_attendance_anomalies_active_fingerprint
  ON public.hr_attendance_anomalies(fingerprint)
  WHERE status IN ('open','acknowledged');
CREATE INDEX idx_hr_attendance_anomalies_queue
  ON public.hr_attendance_anomalies(status,severity,last_detected_at DESC);
CREATE INDEX idx_hr_attendance_anomalies_employee_date
  ON public.hr_attendance_anomalies(employee_id,work_date DESC) WHERE employee_id IS NOT NULL;
CREATE INDEX idx_hr_attendance_events_received_scan
  ON public.hr_attendance_events(created_at,id);

ALTER TABLE public.hr_attendance_anomaly_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_attendance_anomalies ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.hr_attendance_anomaly_settings TO authenticated;
GRANT SELECT ON public.hr_attendance_anomalies TO authenticated;
GRANT ALL ON public.hr_attendance_anomaly_settings,public.hr_attendance_anomalies TO service_role;
CREATE POLICY hr_attendance_anomaly_settings_read ON public.hr_attendance_anomaly_settings
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'hr.attendance','view') OR public.is_admin(auth.uid()));
CREATE POLICY hr_attendance_anomalies_read ON public.hr_attendance_anomalies
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'hr.attendance','edit')
    OR public.has_permission(auth.uid(),'hr.attendance','approve') OR public.is_admin(auth.uid()));
REVOKE INSERT,UPDATE,DELETE ON public.hr_attendance_anomaly_settings,public.hr_attendance_anomalies FROM authenticated;

CREATE FUNCTION public.hr_attendance_anomaly_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF OLD.anomaly_type IS DISTINCT FROM NEW.anomaly_type OR OLD.employee_id IS DISTINCT FROM NEW.employee_id
     OR OLD.device_id IS DISTINCT FROM NEW.device_id OR OLD.event_id IS DISTINCT FROM NEW.event_id
     OR OLD.attendance_day_id IS DISTINCT FROM NEW.attendance_day_id OR OLD.work_date IS DISTINCT FROM NEW.work_date
     OR OLD.occurred_at IS DISTINCT FROM NEW.occurred_at OR OLD.detection_source IS DISTINCT FROM NEW.detection_source
     OR OLD.fingerprint IS DISTINCT FROM NEW.fingerprint OR OLD.first_detected_at IS DISTINCT FROM NEW.first_detected_at THEN
    RAISE EXCEPTION 'حقول هوية اكتشاف الشذوذ غير قابلة للتعديل';
  END IF;
  IF OLD.status IN ('resolved','ignored') THEN RAISE EXCEPTION 'الحالة المغلقة غير قابلة للتعديل'; END IF;
  IF OLD.status='acknowledged' AND NEW.status='open' THEN RAISE EXCEPTION 'لا يمكن إعادة الحالة إلى مفتوحة'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_hr_attendance_anomaly_guard BEFORE UPDATE OR DELETE
ON public.hr_attendance_anomalies FOR EACH ROW EXECUTE FUNCTION public.hr_attendance_anomaly_guard();

CREATE FUNCTION public.hr_attendance_record_anomaly(
  _type TEXT,_severity TEXT,_fingerprint TEXT,_employee UUID DEFAULT NULL,_device UUID DEFAULT NULL,
  _event UUID DEFAULT NULL,_day UUID DEFAULT NULL,_work_date DATE DEFAULT NULL,
  _occurred_at TIMESTAMPTZ DEFAULT NULL,_source TEXT DEFAULT 'attendance_detector',
  _details JSONB DEFAULT '{}'::jsonb)
RETURNS public.hr_attendance_anomalies LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row public.hr_attendance_anomalies;
BEGIN
  -- Internal primitive: EXECUTE is withheld from clients; the public scanner and
  -- service-role integrations are the only entry points.
  LOOP
    INSERT INTO public.hr_attendance_anomalies(anomaly_type,severity,fingerprint,employee_id,device_id,event_id,
      attendance_day_id,work_date,occurred_at,detection_source,description,details)
    VALUES (_type,_severity,_fingerprint,_employee,_device,_event,_day,_work_date,_occurred_at,_source,
      COALESCE(NULLIF(btrim(_details->>'description'),''),replace(_type,'_',' ')),COALESCE(_details,'{}'::jsonb))
    -- The conflict target exactly matches the partial unique index.  Resolved and
    -- ignored rows are outside its predicate, so recurrence creates a new row.
    ON CONFLICT (fingerprint) WHERE status IN ('open','acknowledged') DO UPDATE
      SET last_detected_at=clock_timestamp(),occurrence_count=public.hr_attendance_anomalies.occurrence_count+1,
          details=EXCLUDED.details,severity=EXCLUDED.severity
      -- If a resolver closes the conflicting row while this statement waits,
      -- do not touch its audit metadata.  Retry the INSERT as a new investigation.
      WHERE public.hr_attendance_anomalies.status IN ('open','acknowledged')
    RETURNING * INTO v_row;
    EXIT WHEN v_row.id IS NOT NULL;
  END LOOP;
  RETURN v_row;
END;
$$;

CREATE FUNCTION public.hr_attendance_scan_anomalies(_from TIMESTAMPTZ,_to TIMESTAMPTZ)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_settings public.hr_attendance_anomaly_settings; v_event RECORD; v_count INTEGER:=0; v_day RECORD;
BEGIN
  IF NOT (auth.role()='service_role' OR public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية فحص الشذوذ';
  END IF;
  SELECT * INTO STRICT v_settings FROM public.hr_attendance_anomaly_settings WHERE singleton;
  IF _from IS NULL OR _to IS NULL OR _to<=_from OR _to-_from>make_interval(days=>v_settings.maximum_scan_days) OR _to>clock_timestamp()+interval '1 minute' THEN
    RAISE EXCEPTION 'نطاق فحص الشذوذ غير صالح أو غير محدود بشكل آمن';
  END IF;

  FOR v_event IN
    SELECT e.*,lag(e.id) OVER(PARTITION BY e.employee_id,e.event_type ORDER BY e.occurred_at,e.id) previous_id,
      extract(epoch FROM e.occurred_at-lag(e.occurred_at) OVER(PARTITION BY e.employee_id,e.event_type ORDER BY e.occurred_at,e.id)) seconds
    FROM public.hr_attendance_events e WHERE e.created_at>=_from AND e.created_at<_to
  LOOP
    IF v_event.occurred_at>v_event.created_at+make_interval(mins=>v_settings.future_grace_minutes) THEN
      PERFORM public.hr_attendance_record_anomaly('future_event','high','future-event:'||v_event.id,v_event.employee_id,v_event.device_id,v_event.id,NULL,NULL,v_event.occurred_at,'event_scan',jsonb_build_object('description','Event timestamp is unreasonably future-dated','received_at',v_event.created_at)); v_count:=v_count+1;
    END IF;
    IF v_event.created_at>v_event.occurred_at+make_interval(hours=>v_settings.stale_after_hours) THEN
      PERFORM public.hr_attendance_record_anomaly('stale_event','warning','stale-event:'||v_event.id,v_event.employee_id,v_event.device_id,v_event.id,NULL,NULL,v_event.occurred_at,'event_scan',jsonb_build_object('description','Event arrived after the configured stale threshold','received_at',v_event.created_at,'closed_period',public.hr_attendance_period_is_closed((v_event.occurred_at AT TIME ZONE 'Asia/Riyadh')::date))); v_count:=v_count+1;
    END IF;
    -- Foundation biometric ingestion rejects unknown devices and unmapped
    -- employees before INSERT: its device is validated and event.employee_id is
    -- non-null. Gate 4 cannot derive rejected attempts from persisted events.
    IF v_event.device_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.hr_biometric_devices d WHERE d.id=v_event.device_id AND NOT d.is_active) THEN
      PERFORM public.hr_attendance_record_anomaly('inactive_device','high','inactive-device-event:'||v_event.id,v_event.employee_id,v_event.device_id,v_event.id,NULL,NULL,v_event.occurred_at,'event_scan',jsonb_build_object('description','Event was sent by an inactive device')); v_count:=v_count+1;
    END IF;
    IF v_event.validation_status='unassigned' THEN
      PERFORM public.hr_attendance_record_anomaly('no_active_assignment','high','unassigned-event:'||v_event.id,v_event.employee_id,v_event.device_id,v_event.id,NULL,NULL,v_event.occurred_at,'event_scan',jsonb_build_object('description','Employee had no active shift assignment')); v_count:=v_count+1;
    ELSIF v_event.validation_status='out_of_window' THEN
      PERFORM public.hr_attendance_record_anomaly('off_schedule_event','warning','off-schedule-event:'||v_event.id,v_event.employee_id,v_event.device_id,v_event.id,NULL,NULL,v_event.occurred_at,'event_scan',jsonb_build_object('description','Event is outside its shift window')); v_count:=v_count+1;
    END IF;
    IF v_event.seconds BETWEEN 0 AND v_settings.near_duplicate_seconds THEN
      PERFORM public.hr_attendance_record_anomaly('near_duplicate','warning','near-duplicate:'||v_event.previous_id||':'||v_event.id,v_event.employee_id,v_event.device_id,v_event.id,NULL,NULL,v_event.occurred_at,'event_scan',jsonb_build_object('description','Two same-type punches occurred within the configured near-duplicate window','previous_event_id',v_event.previous_id,'seconds',v_event.seconds)); v_count:=v_count+1;
    END IF;
  END LOOP;

  FOR v_day IN SELECT d.* FROM public.hr_attendance_days d WHERE d.work_date BETWEEN (_from AT TIME ZONE 'Asia/Riyadh')::date AND ((_to-interval '1 microsecond') AT TIME ZONE 'Asia/Riyadh')::date AND d.status IN ('absent','incomplete') LOOP
    -- Gate 1 creates rows only for effective assignments and working schedules,
    -- and assigns approved_leave before absent; repeat those exclusions explicitly.
    IF v_day.status='absent' AND NOT EXISTS(SELECT 1 FROM public.hr_leaves l WHERE l.employee_id=v_day.employee_id AND l.status IN ('approved','taken') AND v_day.work_date BETWEEN l.from_date AND l.to_date) THEN
      PERFORM public.hr_attendance_record_anomaly('unexpected_absence','high','absence:'||v_day.employee_id||':'||v_day.work_date,v_day.employee_id,NULL,NULL,v_day.id,v_day.work_date,NULL,'day_scan',jsonb_build_object('description','Expected working day has no attendance evidence')); v_count:=v_count+1;
    ELSIF v_day.status='incomplete' THEN
      PERFORM public.hr_attendance_record_anomaly('incomplete_punch','warning','incomplete:'||v_day.id,v_day.employee_id,NULL,NULL,v_day.id,v_day.work_date,NULL,'day_scan',jsonb_build_object('description','Expected working day has an incomplete punch pair')); v_count:=v_count+1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE FUNCTION public.hr_attendance_acknowledge_anomaly(_anomaly_id UUID,_note TEXT)
RETURNS public.hr_attendance_anomalies LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row public.hr_attendance_anomalies;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية استلام الحالة'; END IF;
  IF char_length(btrim(coalesce(_note,'')))<5 THEN RAISE EXCEPTION 'ملاحظة الاستلام مطلوبة'; END IF;
  SELECT * INTO v_row FROM public.hr_attendance_anomalies WHERE id=_anomaly_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.status<>'open' THEN RAISE EXCEPTION 'الحالة غير موجودة أو ليست مفتوحة'; END IF;
  UPDATE public.hr_attendance_anomalies SET status='acknowledged',acknowledged_by=auth.uid(),acknowledged_at=clock_timestamp(),acknowledgement_note=btrim(_note) WHERE id=_anomaly_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE FUNCTION public.hr_attendance_resolve_anomaly(_anomaly_id UUID,_ignore BOOLEAN,_reason TEXT)
RETURNS public.hr_attendance_anomalies LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row public.hr_attendance_anomalies;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','approve') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية إغلاق الحالة'; END IF;
  IF char_length(btrim(coalesce(_reason,'')))<5 THEN RAISE EXCEPTION 'سبب المعالجة مطلوب'; END IF;
  SELECT * INTO v_row FROM public.hr_attendance_anomalies WHERE id=_anomaly_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.status NOT IN ('open','acknowledged') THEN RAISE EXCEPTION 'الحالة غير موجودة أو مغلقة بالفعل'; END IF;
  UPDATE public.hr_attendance_anomalies SET status=CASE WHEN _ignore THEN 'ignored' ELSE 'resolved' END,
    resolved_by=auth.uid(),resolved_at=clock_timestamp(),resolution_reason=btrim(_reason) WHERE id=_anomaly_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE FUNCTION public.hr_attendance_run_maintenance(_work_date DATE)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_days INTEGER:=0; v_anomalies INTEGER; v_from TIMESTAMPTZ; v_to TIMESTAMPTZ;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF _work_date IS NULL OR _work_date<CURRENT_DATE-31 OR _work_date>CURRENT_DATE THEN RAISE EXCEPTION 'تاريخ الصيانة يجب أن يكون ضمن آخر 31 يوماً'; END IF;
  -- Period lock is acquired inside refresh before any employee/day lock.  The
  -- anomaly upserts occur only after refresh returns and never call back into it.
  IF NOT public.hr_attendance_period_is_closed(_work_date) THEN v_days:=public.hr_attendance_refresh_days(_work_date,_work_date,NULL); END IF;
  v_from:=(_work_date::timestamp AT TIME ZONE 'Asia/Riyadh'); v_to:=LEAST(v_from+interval '1 day',clock_timestamp());
  IF v_to>v_from THEN v_anomalies:=public.hr_attendance_scan_anomalies(v_from,v_to); ELSE v_anomalies:=0; END IF;
  RETURN jsonb_build_object('work_date',_work_date,'processed_days',v_days,'anomalies_touched',v_anomalies,'ran_at',clock_timestamp());
EXCEPTION WHEN OTHERS THEN
  -- Gate 4 has no durable processing-failure row path.  This diagnostic context
  -- reaches the caller/log collector; any INSERT here would roll back when the
  -- original error is re-raised.  Do not claim processing-failure persistence.
  RAISE NOTICE 'attendance maintenance failed for %: [%] %',_work_date,SQLSTATE,SQLERRM;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_attendance_anomaly_guard() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.hr_attendance_record_anomaly(TEXT,TEXT,TEXT,UUID,UUID,UUID,UUID,DATE,TIMESTAMPTZ,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_attendance_scan_anomalies(TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.hr_attendance_acknowledge_anomaly(UUID,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.hr_attendance_resolve_anomaly(UUID,BOOLEAN,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.hr_attendance_run_maintenance(DATE) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_record_anomaly(TEXT,TEXT,TEXT,UUID,UUID,UUID,UUID,DATE,TIMESTAMPTZ,TEXT,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_attendance_scan_anomalies(TIMESTAMPTZ,TIMESTAMPTZ) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_attendance_acknowledge_anomaly(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_resolve_anomaly(UUID,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_run_maintenance(DATE) TO service_role;
