-- Gate 7: Attendance -> Payroll integration hardening and payroll-derived cost handoff.
-- Code-only migration. Production application requires a separate DB preflight/review.

DO $$
DECLARE
  v_partial BOOLEAN;
  v_duplicates INTEGER;
BEGIN
  -- Fail fast on missing verified dependencies.
  IF to_regclass('public.hr_attendance_periods') IS NULL
     OR to_regclass('public.hr_attendance_days') IS NULL
     OR to_regclass('public.hr_payroll_runs') IS NULL
     OR to_regclass('public.hr_payroll_lines') IS NULL
     OR to_regclass('public.cost_entries') IS NULL
     OR to_regclass('public.cost_periods') IS NULL
     OR to_regprocedure('public.hr_attendance_lock_periods(date,date)') IS NULL
     OR to_regprocedure('public.hr_apply_attendance_to_payroll(uuid)') IS NULL
     OR to_regprocedure('public.hr_sync_payroll_cost_entries(uuid)') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Gate 7 requires the verified Attendance, Payroll, and Cost foundations';
  END IF;

  -- A retry after any of these objects exists would otherwise create a nested or mixed Gate 7 state.
  SELECT
    to_regprocedure('public.hr_apply_attendance_to_payroll_gate7_core(uuid)') IS NOT NULL
    OR to_regprocedure('public.hr_attendance_payroll_snapshot_hash(uuid)') IS NOT NULL
    OR to_regprocedure('public.hr_payroll_attendance_is_stale(uuid)') IS NOT NULL
    OR to_regprocedure('public.hr_payroll_attendance_status_guard()') IS NOT NULL
    OR to_regprocedure('public.hr_payroll_line_gate7_guard()') IS NOT NULL
    OR to_regprocedure('public.hr_sync_payroll_cost_entries_gate7_core(uuid)') IS NOT NULL
    OR to_regclass('public.uq_cost_entries_hr_payroll_line_source') IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='hr_payroll_runs'
        AND column_name IN ('attendance_period_id','attendance_snapshot_hash','attendance_applied_at','attendance_applied_by','attendance_apply_count')
    )
  INTO v_partial;
  IF v_partial THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Gate 7 is already or partially applied; inspect schema history before retrying';
  END IF;

  -- Do not silently deduplicate financial history. Production must be inspected explicitly if this fails.
  SELECT COUNT(*) INTO v_duplicates
  FROM (
    SELECT meta->>'payroll_line_id'
    FROM public.cost_entries
    WHERE COALESCE(meta->>'source','')='hr_payroll'
      AND NULLIF(meta->>'payroll_line_id','') IS NOT NULL
    GROUP BY meta->>'payroll_line_id'
    HAVING COUNT(*) > 1
  ) d;
  IF v_duplicates > 0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE=format('Gate 7 found %s duplicated payroll-derived cost source keys; manual reconciliation is required before migration',v_duplicates);
  END IF;
END;
$$;

ALTER TABLE public.hr_payroll_runs
  ADD COLUMN attendance_period_id UUID REFERENCES public.hr_attendance_periods(id) ON DELETE RESTRICT,
  ADD COLUMN attendance_snapshot_hash TEXT,
  ADD COLUMN attendance_applied_at TIMESTAMPTZ,
  ADD COLUMN attendance_applied_by UUID REFERENCES auth.users(id),
  ADD COLUMN attendance_apply_count INTEGER NOT NULL DEFAULT 0 CHECK (attendance_apply_count >= 0);

CREATE OR REPLACE FUNCTION public.hr_attendance_payroll_snapshot_hash(_period_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_period public.hr_attendance_periods;
  v_days JSONB;
BEGIN
  SELECT * INTO v_period
  FROM public.hr_attendance_periods
  WHERE id=_period_id;
  IF NOT FOUND OR v_period.status<>'closed' THEN
    RAISE EXCEPTION 'فترة الحضور غير مقفلة';
  END IF;

  SELECT COALESCE(jsonb_agg(x.payload ORDER BY x.employee_id,x.work_date,x.id),'[]'::JSONB)
  INTO v_days
  FROM (
    SELECT d.employee_id,d.work_date,d.id,
      jsonb_build_object(
        'employee_id',d.employee_id,
        'work_date',d.work_date,
        'id',d.id,
        'status',d.status,
        'approval_status',d.approval_status,
        'scheduled_minutes',d.scheduled_minutes,
        'actual_minutes',d.actual_minutes,
        'late_minutes',d.late_minutes,
        'early_leave_minutes',d.early_leave_minutes,
        'overtime_minutes',d.overtime_minutes,
        'calculation_details',d.calculation_details
      ) AS payload
    FROM public.hr_attendance_days d
    WHERE d.approval_status='approved'
      AND EXTRACT(YEAR FROM d.work_date)::INTEGER=v_period.period_year
      AND EXTRACT(MONTH FROM d.work_date)::INTEGER=v_period.period_month
  ) x;

  -- closed_at intentionally participates: reopen/reclose invalidates an earlier payroll snapshot
  -- even when the approved facts happen to return to the same values.
  RETURN md5(concat_ws('|',
    v_period.id::TEXT,
    v_period.period_year::TEXT,
    v_period.period_month::TEXT,
    COALESCE(EXTRACT(EPOCH FROM v_period.closed_at)::TEXT,''),
    v_period.summary_snapshot::TEXT,
    v_days::TEXT
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_payroll_attendance_is_stale(_run_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_run public.hr_payroll_runs;
  v_period public.hr_attendance_periods;
  v_hash TEXT;
BEGIN
  SELECT * INTO v_run FROM public.hr_payroll_runs WHERE id=_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'مسير الرواتب غير موجود'; END IF;

  SELECT * INTO v_period
  FROM public.hr_attendance_periods
  WHERE period_year=v_run.period_year AND period_month=v_run.period_month;

  IF NOT FOUND OR v_period.status<>'closed'
     OR v_run.attendance_period_id IS NULL
     OR v_run.attendance_snapshot_hash IS NULL
     OR v_run.attendance_period_id<>v_period.id THEN
    RETURN TRUE;
  END IF;

  v_hash:=public.hr_attendance_payroll_snapshot_hash(v_period.id);
  RETURN v_run.attendance_snapshot_hash IS DISTINCT FROM v_hash;
END;
$$;

-- Preserve the verified Gate 1-3 calculation core while adding snapshot lifecycle and lock ordering.
ALTER FUNCTION public.hr_apply_attendance_to_payroll(UUID)
  RENAME TO hr_apply_attendance_to_payroll_gate7_core;
REVOKE ALL ON FUNCTION public.hr_apply_attendance_to_payroll_gate7_core(UUID)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.hr_apply_attendance_to_payroll(_run_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_run public.hr_payroll_runs;
  v_period public.hr_attendance_periods;
  v_from DATE;
  v_hash TEXT;
  v_changed INTEGER;
BEGIN
  SELECT * INTO v_run FROM public.hr_payroll_runs WHERE id=_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'مسير الرواتب غير موجود'; END IF;
  v_from:=make_date(v_run.period_year,v_run.period_month,1);

  -- Global Gate 3 order: attendance calendar period first, then payroll run.
  PERFORM public.hr_attendance_lock_periods(v_from,v_from);
  SELECT * INTO v_run FROM public.hr_payroll_runs WHERE id=_run_id FOR UPDATE;
  IF v_run.status<>'draft' THEN RAISE EXCEPTION 'إعادة تطبيق الحضور متاحة لمسير المسودة فقط'; END IF;

  SELECT * INTO v_period
  FROM public.hr_attendance_periods
  WHERE period_year=v_run.period_year AND period_month=v_run.period_month AND status='closed'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'يجب إقفال فترة الحضور قبل تطبيقها على مسير الرواتب'; END IF;

  v_hash:=public.hr_attendance_payroll_snapshot_hash(v_period.id);
  v_changed:=public.hr_apply_attendance_to_payroll_gate7_core(_run_id);

  UPDATE public.hr_payroll_runs
  SET attendance_period_id=v_period.id,
      attendance_snapshot_hash=v_hash,
      attendance_applied_at=now(),
      attendance_applied_by=auth.uid(),
      attendance_apply_count=attendance_apply_count+1
  WHERE id=_run_id;

  RETURN v_changed;
END;
$$;

-- Direct status changes remain supported by the existing UI, but financial states require a fresh attendance snapshot.
CREATE OR REPLACE FUNCTION public.hr_payroll_attendance_status_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_period public.hr_attendance_periods;
  v_hash TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('pending_approval','approved','paid') THEN
    SELECT * INTO v_period
    FROM public.hr_attendance_periods
    WHERE period_year=NEW.period_year AND period_month=NEW.period_month;

    IF NOT FOUND OR v_period.status<>'closed' THEN
      RAISE EXCEPTION 'لا يمكن اعتماد أو صرف مسير مرتبط بفترة حضور مفتوحة';
    END IF;
    IF NEW.attendance_period_id IS NULL
       OR NEW.attendance_period_id<>v_period.id
       OR NEW.attendance_snapshot_hash IS NULL THEN
      RAISE EXCEPTION 'يجب تطبيق الحضور الحالي على مسير الرواتب قبل الاعتماد';
    END IF;

    v_hash:=public.hr_attendance_payroll_snapshot_hash(v_period.id);
    IF NEW.attendance_snapshot_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'بيانات الحضور تغيرت؛ أعد تطبيق الحضور على مسير الرواتب قبل الاعتماد';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hr_payroll_runs_attendance_status_guard
BEFORE UPDATE ON public.hr_payroll_runs
FOR EACH ROW EXECUTE FUNCTION public.hr_payroll_attendance_status_guard();

-- API clients must not bypass the authoritative attendance application or mutate frozen payroll lines.
CREATE OR REPLACE FUNCTION public.hr_payroll_line_gate7_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_status public.hr_payroll_status;
BEGIN
  IF TG_OP='UPDATE' AND current_user IN ('anon','authenticated','service_role') THEN
    SELECT status INTO v_status FROM public.hr_payroll_runs WHERE id=OLD.run_id;
    IF v_status<>'draft' THEN
      RAISE EXCEPTION 'بنود مسير الرواتب غير قابلة للتعديل بعد مغادرة حالة المسودة';
    END IF;

    IF ROW(OLD.attendance_absence_days,OLD.attendance_late_minutes,OLD.attendance_overtime_minutes,
           OLD.absence_deduction,OLD.late_deduction,OLD.overtime)
       IS DISTINCT FROM
       ROW(NEW.attendance_absence_days,NEW.attendance_late_minutes,NEW.attendance_overtime_minutes,
           NEW.absence_deduction,NEW.late_deduction,NEW.overtime) THEN
      RAISE EXCEPTION 'قيم الرواتب المشتقة من الحضور لا تعدل مباشرة';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hr_payroll_lines_gate7_guard
BEFORE UPDATE ON public.hr_payroll_lines
FOR EACH ROW EXECUTE FUNCTION public.hr_payroll_line_gate7_guard();

-- One durable cost source per payroll line, including historical rows that used source metadata before source_type existed.
CREATE UNIQUE INDEX uq_cost_entries_hr_payroll_line_source
ON public.cost_entries ((meta->>'payroll_line_id'))
WHERE COALESCE(meta->>'source','')='hr_payroll'
  AND NULLIF(meta->>'payroll_line_id','') IS NOT NULL;

ALTER FUNCTION public.hr_sync_payroll_cost_entries(UUID)
  RENAME TO hr_sync_payroll_cost_entries_gate7_core;
REVOKE ALL ON FUNCTION public.hr_sync_payroll_cost_entries_gate7_core(UUID)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.hr_sync_payroll_cost_entries(_run_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_run public.hr_payroll_runs;
  v_line RECORD;
  v_cost UUID;
  v_created INTEGER:=0;
  v_period TEXT;
  v_amount NUMERIC;
BEGIN
  IF auth.role()<>'service_role' THEN
    RAISE EXCEPTION 'ترحيل تكلفة الرواتب خدمة داخلية فقط';
  END IF;

  SELECT * INTO v_run FROM public.hr_payroll_runs WHERE id=_run_id FOR UPDATE;
  IF NOT FOUND OR v_run.status NOT IN ('approved','paid') THEN
    RAISE EXCEPTION 'لا يمكن ترحيل تكلفة مسير غير معتمد';
  END IF;
  IF public.hr_payroll_attendance_is_stale(_run_id) THEN
    RAISE EXCEPTION 'لا يمكن ترحيل تكلفة مسير يعتمد على نسخة حضور قديمة';
  END IF;

  v_period:=format('%s-%s',v_run.period_year,lpad(v_run.period_month::TEXT,2,'0'));
  IF EXISTS(SELECT 1 FROM public.cost_periods WHERE period=v_period AND status='closed') THEN
    RAISE EXCEPTION 'فترة التكلفة مقفلة';
  END IF;

  FOR v_line IN
    SELECT pl.*,e.employee_no,e.full_name_ar,e.department_id,p.name project_name
    FROM public.hr_payroll_lines pl
    JOIN public.hr_employees e ON e.id=pl.employee_id
    LEFT JOIN public.projects p ON p.id=pl.project_id
    WHERE pl.run_id=_run_id
    ORDER BY pl.id
    FOR UPDATE OF pl
  LOOP
    v_amount:=ROUND(
      GREATEST(COALESCE(v_line.gross_salary,0)+COALESCE(v_line.overtime,0)
        -COALESCE(v_line.unpaid_leave_deduction,0)-COALESCE(v_line.sick_leave_deduction,0)
        -COALESCE(v_line.absence_deduction,0)-COALESCE(v_line.late_deduction,0),0)
      +COALESCE(v_line.gosi_employer,0),2);

    INSERT INTO public.cost_entries(
      category,description,project,project_id,department_id,period,amount,meta,imported_by,
      workflow_status,source_type
    ) VALUES (
      'hr.payroll','راتب '||v_line.full_name_ar||' ('||v_line.employee_no||') - '||v_run.run_no,
      v_line.project_name,v_line.project_id,v_line.department_id,v_period,v_amount,
      jsonb_build_object(
        'source','hr_payroll','payroll_run_id',v_run.id,'payroll_line_id',v_line.id,
        'employee_id',v_line.employee_id,'attendance_period_id',v_run.attendance_period_id,
        'attendance_snapshot_hash',v_run.attendance_snapshot_hash,
        'gross_salary',COALESCE(v_line.gross_salary,0),
        'attendance_overtime',COALESCE(v_line.overtime,0),
        'attendance_absence_deduction',COALESCE(v_line.absence_deduction,0),
        'attendance_late_deduction',COALESCE(v_line.late_deduction,0),
        'unpaid_leave_deduction',COALESCE(v_line.unpaid_leave_deduction,0),
        'sick_leave_deduction',COALESCE(v_line.sick_leave_deduction,0),
        'gosi_employer',COALESCE(v_line.gosi_employer,0)
      ),auth.uid(),'posted','hr_payroll'
    )
    ON CONFLICT ((meta->>'payroll_line_id'))
      WHERE COALESCE(meta->>'source','')='hr_payroll'
        AND NULLIF(meta->>'payroll_line_id','') IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_cost;

    IF v_cost IS NULL THEN
      SELECT id INTO v_cost
      FROM public.cost_entries
      WHERE COALESCE(meta->>'source','')='hr_payroll'
        AND meta->>'payroll_line_id'=v_line.id::TEXT
      FOR UPDATE;
    ELSE
      v_created:=v_created+1;
    END IF;

    IF v_cost IS NULL THEN
      RAISE EXCEPTION 'تعذر تحديد قيد تكلفة سطر الرواتب';
    END IF;
    IF v_line.cost_entry_id IS DISTINCT FROM v_cost THEN
      UPDATE public.hr_payroll_lines SET cost_entry_id=v_cost WHERE id=v_line.id;
    END IF;
    v_cost:=NULL;
  END LOOP;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_attendance_payroll_snapshot_hash(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_payroll_attendance_is_stale(UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.hr_apply_attendance_to_payroll(UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.hr_sync_payroll_cost_entries(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_payroll_attendance_status_guard() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.hr_payroll_line_gate7_guard() FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.hr_attendance_payroll_snapshot_hash(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_payroll_attendance_is_stale(UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_apply_attendance_to_payroll(UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_sync_payroll_cost_entries(UUID) TO service_role;

COMMENT ON COLUMN public.hr_payroll_runs.attendance_snapshot_hash IS
  'Deterministic Gate 7 hash of the closed approved-attendance snapshot used for this payroll run.';
COMMENT ON FUNCTION public.hr_payroll_attendance_is_stale(UUID) IS
  'Returns true when the payroll run is not bound to the currently closed attendance snapshot for its month.';
