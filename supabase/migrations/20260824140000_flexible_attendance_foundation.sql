-- Phase D3.1: flexible shifts, geofenced mobile punches and biometric devices.

CREATE TABLE public.hr_work_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  latitude NUMERIC(10,7) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(10,7) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  radius_meters INTEGER NOT NULL DEFAULT 150 CHECK (radius_meters BETWEEN 20 AND 5000),
  max_gps_accuracy_meters INTEGER NOT NULL DEFAULT 100 CHECK (max_gps_accuracy_meters BETWEEN 10 AND 1000),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hr_shift_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  work_minutes INTEGER NOT NULL DEFAULT 480 CHECK (work_minutes BETWEEN 60 AND 1440),
  break_minutes INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes BETWEEN 0 AND 240),
  break_is_paid BOOLEAN NOT NULL DEFAULT false,
  is_flexible BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hr_shift_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.hr_shift_groups(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_working_day BOOLEAN NOT NULL DEFAULT true,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  checkin_open_before_minutes INTEGER NOT NULL DEFAULT 60 CHECK (checkin_open_before_minutes BETWEEN 0 AND 720),
  checkin_close_after_minutes INTEGER NOT NULL DEFAULT 120 CHECK (checkin_close_after_minutes BETWEEN 0 AND 720),
  checkout_open_before_minutes INTEGER NOT NULL DEFAULT 120 CHECK (checkout_open_before_minutes BETWEEN 0 AND 720),
  checkout_close_after_minutes INTEGER NOT NULL DEFAULT 360 CHECK (checkout_close_after_minutes BETWEEN 0 AND 720),
  UNIQUE(group_id, day_of_week)
);

CREATE TABLE public.hr_shift_group_sites (
  group_id UUID NOT NULL REFERENCES public.hr_shift_groups(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.hr_work_sites(id) ON DELETE CASCADE,
  PRIMARY KEY(group_id, site_id)
);

CREATE TABLE public.hr_shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.hr_shift_groups(id) ON DELETE RESTRICT,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX idx_hr_shift_assignments_employee_dates
  ON public.hr_shift_assignments(employee_id, effective_from DESC, effective_to);

CREATE TABLE public.hr_biometric_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  site_id UUID REFERENCES public.hr_work_sites(id) ON DELETE SET NULL,
  vendor TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hr_attendance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('check_in', 'check_out')),
  source TEXT NOT NULL CHECK (source IN ('mobile_geofence', 'biometric', 'manual')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  site_id UUID REFERENCES public.hr_work_sites(id) ON DELETE SET NULL,
  device_id UUID REFERENCES public.hr_biometric_devices(id) ON DELETE SET NULL,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  gps_accuracy_meters NUMERIC(8,2),
  distance_from_site_meters NUMERIC(10,2),
  schedule_id UUID REFERENCES public.hr_shift_schedules(id) ON DELETE SET NULL,
  validation_status TEXT NOT NULL DEFAULT 'accepted' CHECK (validation_status IN ('accepted', 'out_of_window', 'outside_geofence', 'unassigned', 'manual_review')),
  external_event_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(device_id, external_event_id)
);
CREATE INDEX idx_hr_attendance_events_employee_time
  ON public.hr_attendance_events(employee_id, occurred_at DESC);

DO $$ BEGIN
  INSERT INTO public.permission_modules(key, parent_key, name_ar, name_en, category, sort_order)
  VALUES ('hr.attendance', 'hr', 'الحضور والانصراف', 'Attendance', 'hr', 67)
  ON CONFLICT (key) DO UPDATE SET parent_key = EXCLUDED.parent_key, name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['hr_work_sites','hr_shift_groups','hr_shift_schedules','hr_shift_group_sites','hr_shift_assignments','hr_biometric_devices','hr_attendance_events']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), ''hr.attendance'', ''view'') OR public.is_admin(auth.uid()))', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_permission(auth.uid(), ''hr.attendance'', ''edit'') OR public.is_admin(auth.uid())) WITH CHECK (public.has_permission(auth.uid(), ''hr.attendance'', ''edit'') OR public.is_admin(auth.uid()))', t || '_write', t);
  END LOOP;
END $$;

-- A regular employee may inspect only their own raw punches. Attendance editors
-- retain the organisation-wide audit view used by the management screen.
DROP POLICY hr_attendance_events_read ON public.hr_attendance_events;
CREATE POLICY hr_attendance_events_read ON public.hr_attendance_events
FOR SELECT TO authenticated USING (
  public.has_permission(auth.uid(), 'hr.attendance', 'edit')
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.hr_employees employee
    WHERE employee.id = hr_attendance_events.employee_id
      AND employee.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.hr_distance_meters(
  _lat1 NUMERIC, _lng1 NUMERIC, _lat2 NUMERIC, _lng2 NUMERIC
)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT 6371000 * 2 * asin(sqrt(
    power(sin(radians((_lat2 - _lat1)::DOUBLE PRECISION) / 2), 2)
    + cos(radians(_lat1::DOUBLE PRECISION)) * cos(radians(_lat2::DOUBLE PRECISION))
    * power(sin(radians((_lng2 - _lng1)::DOUBLE PRECISION) / 2), 2)
  ))
$$;

CREATE OR REPLACE FUNCTION public.hr_attendance_mobile_punch(
  _event_type TEXT, _site_id UUID, _latitude NUMERIC, _longitude NUMERIC,
  _accuracy_meters NUMERIC DEFAULT NULL
)
RETURNS public.hr_attendance_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_employee UUID;
  v_group public.hr_shift_groups;
  v_site public.hr_work_sites;
  v_schedule public.hr_shift_schedules;
  v_now TIMESTAMPTZ := now();
  v_local TIMESTAMP;
  v_work_date DATE;
  v_start TIMESTAMP;
  v_end TIMESTAMP;
  v_open TIMESTAMP;
  v_close TIMESTAMP;
  v_distance NUMERIC;
  v_last_type TEXT;
  v_row public.hr_attendance_events;
  i INTEGER;
BEGIN
  IF _event_type NOT IN ('check_in', 'check_out') THEN RAISE EXCEPTION 'نوع حركة الحضور غير صالح'; END IF;
  IF _latitude NOT BETWEEN -90 AND 90 OR _longitude NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'إحداثيات غير صالحة'; END IF;

  SELECT id INTO v_employee FROM public.hr_employees WHERE user_id = auth.uid() AND status IN ('active','on_leave');
  IF v_employee IS NULL THEN RAISE EXCEPTION 'حسابك غير مرتبط بموظف نشط'; END IF;

  SELECT g.* INTO v_group
  FROM public.hr_shift_assignments a JOIN public.hr_shift_groups g ON g.id = a.group_id
  WHERE a.employee_id = v_employee AND a.effective_from <= CURRENT_DATE
    AND (a.effective_to IS NULL OR a.effective_to >= CURRENT_DATE) AND g.is_active
  ORDER BY a.effective_from DESC LIMIT 1;
  IF v_group.id IS NULL THEN RAISE EXCEPTION 'لا توجد مجموعة دوام فعالة للموظف'; END IF;

  SELECT s.* INTO v_site FROM public.hr_work_sites s
  JOIN public.hr_shift_group_sites gs ON gs.site_id = s.id
  WHERE s.id = _site_id AND gs.group_id = v_group.id AND s.is_active;
  IF v_site.id IS NULL THEN RAISE EXCEPTION 'الموقع غير مسموح لمجموعة دوامك'; END IF;
  IF _accuracy_meters IS NULL OR _accuracy_meters > v_site.max_gps_accuracy_meters THEN
    RAISE EXCEPTION 'دقة تحديد الموقع غير كافية (المطلوب % متر أو أفضل)', v_site.max_gps_accuracy_meters;
  END IF;
  v_distance := public.hr_distance_meters(_latitude, _longitude, v_site.latitude, v_site.longitude);
  IF v_distance > v_site.radius_meters THEN
    RAISE EXCEPTION 'أنت خارج نطاق الموقع (% متر، المسموح % متر)', ROUND(v_distance), v_site.radius_meters;
  END IF;

  v_local := v_now AT TIME ZONE v_group.timezone;
  FOR i IN 0..1 LOOP
    v_work_date := v_local::DATE - i;
    SELECT s.* INTO v_schedule FROM public.hr_shift_schedules s
    WHERE s.group_id = v_group.id AND s.day_of_week = EXTRACT(DOW FROM v_work_date)::INTEGER AND s.is_working_day;
    CONTINUE WHEN v_schedule.id IS NULL;
    v_start := v_work_date + v_schedule.start_time;
    v_end := v_work_date + v_schedule.end_time;
    IF v_end <= v_start THEN v_end := v_end + INTERVAL '1 day'; END IF;
    IF _event_type = 'check_in' THEN
      v_open := v_start - make_interval(mins => v_schedule.checkin_open_before_minutes);
      v_close := v_start + make_interval(mins => v_schedule.checkin_close_after_minutes);
    ELSE
      v_open := v_end - make_interval(mins => v_schedule.checkout_open_before_minutes);
      v_close := v_end + make_interval(mins => v_schedule.checkout_close_after_minutes);
    END IF;
    EXIT WHEN v_local BETWEEN v_open AND v_close;
    v_schedule := NULL;
  END LOOP;
  IF v_schedule.id IS NULL THEN RAISE EXCEPTION 'الحركة خارج نافذة الحضور أو الانصراف المحددة'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_employee::TEXT, 0));
  SELECT event_type INTO v_last_type FROM public.hr_attendance_events
  WHERE employee_id = v_employee AND validation_status = 'accepted'
  ORDER BY occurred_at DESC LIMIT 1;
  IF _event_type = 'check_in' AND v_last_type = 'check_in' THEN RAISE EXCEPTION 'تم تسجيل الحضور مسبقاً ولم يسجل الانصراف'; END IF;
  IF _event_type = 'check_out' AND COALESCE(v_last_type, '') <> 'check_in' THEN RAISE EXCEPTION 'يجب تسجيل الحضور أولاً'; END IF;

  INSERT INTO public.hr_attendance_events(
    employee_id, event_type, source, occurred_at, site_id, latitude, longitude,
    gps_accuracy_meters, distance_from_site_meters, schedule_id, created_by
  ) VALUES (
    v_employee, _event_type, 'mobile_geofence', v_now, v_site.id, _latitude, _longitude,
    _accuracy_meters, ROUND(v_distance, 2), v_schedule.id, auth.uid()
  ) RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_attendance_biometric_ingest(
  _device_code TEXT, _employee_no TEXT, _event_type TEXT,
  _occurred_at TIMESTAMPTZ, _external_event_id TEXT
)
RETURNS public.hr_attendance_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_device public.hr_biometric_devices;
  v_employee UUID;
  v_group public.hr_shift_groups;
  v_schedule public.hr_shift_schedules;
  v_local TIMESTAMP;
  v_work_date DATE;
  v_start TIMESTAMP;
  v_end TIMESTAMP;
  v_open TIMESTAMP;
  v_close TIMESTAMP;
  v_status TEXT := 'accepted';
  v_row public.hr_attendance_events;
  i INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF _event_type NOT IN ('check_in','check_out') THEN RAISE EXCEPTION 'invalid event type'; END IF;
  IF NULLIF(BTRIM(_external_event_id), '') IS NULL THEN RAISE EXCEPTION 'external event id is required'; END IF;
  SELECT * INTO v_device FROM public.hr_biometric_devices WHERE device_code = _device_code AND is_active;
  IF v_device.id IS NULL THEN RAISE EXCEPTION 'unknown or inactive device'; END IF;
  SELECT id INTO v_employee FROM public.hr_employees WHERE employee_no = _employee_no;
  IF v_employee IS NULL THEN RAISE EXCEPTION 'unknown employee'; END IF;

  SELECT g.* INTO v_group
  FROM public.hr_shift_assignments a JOIN public.hr_shift_groups g ON g.id = a.group_id
  WHERE a.employee_id = v_employee
    AND a.effective_from <= (_occurred_at AT TIME ZONE g.timezone)::DATE
    AND (a.effective_to IS NULL OR a.effective_to >= (_occurred_at AT TIME ZONE g.timezone)::DATE)
    AND g.is_active
  ORDER BY a.effective_from DESC LIMIT 1;
  IF v_group.id IS NULL OR v_device.site_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.hr_shift_group_sites gs
    WHERE gs.group_id = v_group.id AND gs.site_id = v_device.site_id
  ) THEN
    v_status := 'unassigned';
  ELSE
    v_local := _occurred_at AT TIME ZONE v_group.timezone;
    FOR i IN 0..1 LOOP
      v_work_date := v_local::DATE - i;
      SELECT s.* INTO v_schedule FROM public.hr_shift_schedules s
      WHERE s.group_id = v_group.id AND s.day_of_week = EXTRACT(DOW FROM v_work_date)::INTEGER AND s.is_working_day;
      CONTINUE WHEN v_schedule.id IS NULL;
      v_start := v_work_date + v_schedule.start_time;
      v_end := v_work_date + v_schedule.end_time;
      IF v_end <= v_start THEN v_end := v_end + INTERVAL '1 day'; END IF;
      IF _event_type = 'check_in' THEN
        v_open := v_start - make_interval(mins => v_schedule.checkin_open_before_minutes);
        v_close := v_start + make_interval(mins => v_schedule.checkin_close_after_minutes);
      ELSE
        v_open := v_end - make_interval(mins => v_schedule.checkout_open_before_minutes);
        v_close := v_end + make_interval(mins => v_schedule.checkout_close_after_minutes);
      END IF;
      EXIT WHEN v_local BETWEEN v_open AND v_close;
      v_schedule := NULL;
    END LOOP;
    IF v_schedule.id IS NULL THEN v_status := 'out_of_window'; END IF;
  END IF;

  INSERT INTO public.hr_attendance_events(
    employee_id, event_type, source, occurred_at, site_id, device_id, schedule_id,
    external_event_id, validation_status, metadata
  ) VALUES (
    v_employee, _event_type, 'biometric', _occurred_at, v_device.site_id, v_device.id, v_schedule.id,
    _external_event_id, v_status, jsonb_build_object('device_code', _device_code)
  ) ON CONFLICT (device_id, external_event_id) DO UPDATE SET external_event_id = EXCLUDED.external_event_id
  RETURNING * INTO v_row;
  UPDATE public.hr_biometric_devices SET last_seen_at = now() WHERE id = v_device.id;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_attendance_mobile_punch(TEXT, UUID, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_attendance_biometric_ingest(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_attendance_mobile_punch(TEXT, UUID, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_biometric_ingest(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.hr_attendance_events FROM authenticated;
