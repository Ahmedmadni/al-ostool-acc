-- HR closure: database-owned sequential codes and transactional attendance setup RPCs.
CREATE SEQUENCE IF NOT EXISTS public.hr_work_site_code_seq;
CREATE SEQUENCE IF NOT EXISTS public.hr_shift_group_code_seq;
CREATE SEQUENCE IF NOT EXISTS public.hr_biometric_device_code_seq;

SELECT setval('public.hr_work_site_code_seq',GREATEST(COALESCE(MAX(substring(code FROM '^SITE-([0-9]+)$')::BIGINT),0),1),COALESCE(MAX(substring(code FROM '^SITE-([0-9]+)$')::BIGINT),0)>0)
FROM public.hr_work_sites WHERE code~'^SITE-[0-9]+$';
SELECT setval('public.hr_shift_group_code_seq',GREATEST(COALESCE(MAX(substring(code FROM '^SHIFT-([0-9]+)$')::BIGINT),0),1),COALESCE(MAX(substring(code FROM '^SHIFT-([0-9]+)$')::BIGINT),0)>0)
FROM public.hr_shift_groups WHERE code~'^SHIFT-[0-9]+$';
SELECT setval('public.hr_biometric_device_code_seq',GREATEST(COALESCE(MAX(substring(device_code FROM '^DEV-([0-9]+)$')::BIGINT),0),1),COALESCE(MAX(substring(device_code FROM '^DEV-([0-9]+)$')::BIGINT),0)>0)
FROM public.hr_biometric_devices WHERE device_code~'^DEV-[0-9]+$';

CREATE OR REPLACE FUNCTION public.hr_assign_sequential_code() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF TG_TABLE_NAME='hr_biometric_devices' THEN
      IF NEW.device_code IS DISTINCT FROM OLD.device_code THEN RAISE EXCEPTION 'لا يمكن تعديل الكود التسلسلي بعد إنشائه'; END IF;
    ELSE
      IF NEW.code IS DISTINCT FROM OLD.code THEN RAISE EXCEPTION 'لا يمكن تعديل الكود التسلسلي بعد إنشائه'; END IF;
    END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='hr_work_sites' THEN NEW.code:='SITE-'||LPAD(nextval('public.hr_work_site_code_seq')::TEXT,6,'0');
  ELSIF TG_TABLE_NAME='hr_shift_groups' THEN NEW.code:='SHIFT-'||LPAD(nextval('public.hr_shift_group_code_seq')::TEXT,6,'0');
  ELSIF TG_TABLE_NAME='hr_biometric_devices' THEN NEW.device_code:='DEV-'||LPAD(nextval('public.hr_biometric_device_code_seq')::TEXT,6,'0');
  ELSE RAISE EXCEPTION 'جدول غير مدعوم لتوليد الكود'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_hr_work_sites_sequential_code BEFORE INSERT OR UPDATE ON public.hr_work_sites FOR EACH ROW EXECUTE FUNCTION public.hr_assign_sequential_code();
CREATE TRIGGER trg_hr_shift_groups_sequential_code BEFORE INSERT OR UPDATE ON public.hr_shift_groups FOR EACH ROW EXECUTE FUNCTION public.hr_assign_sequential_code();
CREATE TRIGGER trg_hr_biometric_devices_sequential_code BEFORE INSERT OR UPDATE ON public.hr_biometric_devices FOR EACH ROW EXECUTE FUNCTION public.hr_assign_sequential_code();

CREATE OR REPLACE FUNCTION public.hr_attendance_create_site(_name_ar TEXT,_latitude NUMERIC,_longitude NUMERIC,_radius_meters INTEGER DEFAULT 150)
RETURNS public.hr_work_sites LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_site public.hr_work_sites;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية إضافة موقع'; END IF;
  IF btrim(COALESCE(_name_ar,''))='' OR _latitude NOT BETWEEN -90 AND 90 OR _longitude NOT BETWEEN -180 AND 180 OR _radius_meters NOT BETWEEN 20 AND 5000 THEN RAISE EXCEPTION 'بيانات الموقع غير صالحة'; END IF;
  INSERT INTO public.hr_work_sites(code,name_ar,latitude,longitude,radius_meters)
  VALUES('',btrim(_name_ar),_latitude,_longitude,_radius_meters) RETURNING * INTO v_site;
  RETURN v_site;
END; $$;

CREATE OR REPLACE FUNCTION public.hr_attendance_create_shift_group(_name_ar TEXT,_start_time TIME,_end_time TIME,_break_minutes INTEGER,_site_id UUID,_working_days JSONB,
  _checkin_before INTEGER DEFAULT 60,_checkin_after INTEGER DEFAULT 120,_checkout_before INTEGER DEFAULT 120,_checkout_after INTEGER DEFAULT 360)
RETURNS public.hr_shift_groups LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_group public.hr_shift_groups; v_day JSONB;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية إضافة مجموعة دوام'; END IF;
  IF btrim(COALESCE(_name_ar,''))='' OR jsonb_typeof(_working_days)<>'array' OR jsonb_array_length(_working_days)=0 THEN RAISE EXCEPTION 'اسم المجموعة وأيام العمل مطلوبة'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(_working_days) d WHERE d!~'^[0-6]$') OR
     (SELECT COUNT(*) FROM jsonb_array_elements_text(_working_days))<>(SELECT COUNT(DISTINCT value) FROM jsonb_array_elements_text(_working_days)) THEN RAISE EXCEPTION 'أيام العمل غير صالحة أو مكررة'; END IF;
  IF _site_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.hr_work_sites WHERE id=_site_id AND is_active) THEN RAISE EXCEPTION 'الموقع غير موجود أو غير نشط'; END IF;
  INSERT INTO public.hr_shift_groups(code,name_ar,work_minutes,break_minutes,break_is_paid)
  VALUES('',btrim(_name_ar),480,_break_minutes,false) RETURNING * INTO v_group;
  INSERT INTO public.hr_attendance_policies(group_id) VALUES(v_group.id);
  FOR v_day IN SELECT value FROM jsonb_array_elements(_working_days) LOOP
    INSERT INTO public.hr_shift_schedules(group_id,day_of_week,start_time,end_time,checkin_open_before_minutes,checkin_close_after_minutes,checkout_open_before_minutes,checkout_close_after_minutes)
    VALUES(v_group.id,(v_day#>>'{}')::SMALLINT,_start_time,_end_time,_checkin_before,_checkin_after,_checkout_before,_checkout_after);
  END LOOP;
  IF _site_id IS NOT NULL THEN INSERT INTO public.hr_shift_group_sites(group_id,site_id) VALUES(v_group.id,_site_id); END IF;
  RETURN v_group;
END; $$;

CREATE OR REPLACE FUNCTION public.hr_attendance_register_device(_device_code TEXT,_name_ar TEXT,_site_id UUID,_vendor TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE v_device public.hr_biometric_devices; v_token TEXT:=encode(gen_random_bytes(32),'hex');
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية تسجيل جهاز'; END IF;
  IF NULLIF(BTRIM(_name_ar),'') IS NULL THEN RAISE EXCEPTION 'اسم الجهاز مطلوب'; END IF;
  IF _site_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.hr_work_sites WHERE id=_site_id AND is_active) THEN RAISE EXCEPTION 'الموقع غير موجود أو غير نشط'; END IF;
  INSERT INTO public.hr_biometric_devices(device_code,name_ar,site_id,vendor,token_hash,token_last_four,token_rotated_at)
  VALUES('',BTRIM(_name_ar),_site_id,NULLIF(BTRIM(_vendor),''),encode(digest(v_token,'sha256'),'hex'),right(v_token,4),now()) RETURNING * INTO v_device;
  RETURN jsonb_build_object('device_id',v_device.id,'device_code',v_device.device_code,'token',v_token,'token_last_four',v_device.token_last_four);
END; $$;

REVOKE INSERT ON public.hr_work_sites,public.hr_shift_groups,public.hr_biometric_devices FROM authenticated;
REVOKE ALL ON FUNCTION public.hr_attendance_create_site(TEXT,NUMERIC,NUMERIC,INTEGER),public.hr_attendance_create_shift_group(TEXT,TIME,TIME,INTEGER,UUID,JSONB,INTEGER,INTEGER,INTEGER,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_attendance_create_site(TEXT,NUMERIC,NUMERIC,INTEGER),public.hr_attendance_create_shift_group(TEXT,TIME,TIME,INTEGER,UUID,JSONB,INTEGER,INTEGER,INTEGER,INTEGER) TO authenticated;
