-- Phase D3.2: auditable daily attendance processing and approved payroll inputs.

-- This migration deliberately fails on both a complete rerun and a partial
-- application.  Supabase migrations are transactional; accepting pre-existing
-- objects here would make it impossible to know whether the payroll wrapper and
-- the attendance schema came from the same atomic application.
DO $$
BEGIN
  IF to_regclass('public.hr_attendance_policies') IS NOT NULL
     OR to_regclass('public.hr_attendance_days') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_refresh_days(date,date,uuid)') IS NOT NULL
     OR to_regprocedure('public.hr_attendance_decide_day(uuid,boolean,text)') IS NOT NULL
     OR to_regprocedure('public.hr_apply_attendance_to_payroll(uuid)') IS NOT NULL
     OR to_regprocedure('public.hr_payroll_create_run_leave_core(integer,integer)') IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='hr_payroll_lines'
         AND column_name IN ('attendance_absence_days','attendance_late_minutes','attendance_overtime_minutes')
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'attendance daily migration is already or partially applied; inspect schema history before retrying';
  END IF;
  IF to_regprocedure('public.hr_payroll_create_run(integer,integer)') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'expected leave-aware hr_payroll_create_run(integer,integer) is missing';
  END IF;
END;
$$;

CREATE TABLE public.hr_attendance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL UNIQUE REFERENCES public.hr_shift_groups(id) ON DELETE CASCADE,
  grace_minutes INTEGER NOT NULL DEFAULT 0 CHECK (grace_minutes BETWEEN 0 AND 180),
  minimum_overtime_minutes INTEGER NOT NULL DEFAULT 30 CHECK (minimum_overtime_minutes BETWEEN 0 AND 240),
  deduct_absence BOOLEAN NOT NULL DEFAULT false,
  deduct_late_minutes BOOLEAN NOT NULL DEFAULT false,
  pay_overtime BOOLEAN NOT NULL DEFAULT false,
  overtime_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.50 CHECK (overtime_multiplier BETWEEN 1 AND 5),
  salary_day_divisor NUMERIC(6,2) NOT NULL DEFAULT 30 CHECK (salary_day_divisor BETWEEN 1 AND 31),
  require_daily_approval BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hr_attendance_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE RESTRICT,
  work_date DATE NOT NULL,
  assignment_id UUID REFERENCES public.hr_shift_assignments(id) ON DELETE SET NULL,
  group_id UUID REFERENCES public.hr_shift_groups(id) ON DELETE SET NULL,
  schedule_id UUID REFERENCES public.hr_shift_schedules(id) ON DELETE SET NULL,
  first_check_in TIMESTAMPTZ,
  last_check_out TIMESTAMPTZ,
  scheduled_minutes INTEGER NOT NULL DEFAULT 0 CHECK (scheduled_minutes >= 0),
  actual_minutes INTEGER NOT NULL DEFAULT 0 CHECK (actual_minutes >= 0),
  late_minutes INTEGER NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
  early_leave_minutes INTEGER NOT NULL DEFAULT 0 CHECK (early_leave_minutes >= 0),
  overtime_minutes INTEGER NOT NULL DEFAULT 0 CHECK (overtime_minutes >= 0),
  status TEXT NOT NULL CHECK (status IN ('present','absent','incomplete','approved_leave','rest_day')),
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  calculation_details JSONB NOT NULL DEFAULT '{}'::JSONB,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, work_date)
);
CREATE INDEX idx_hr_attendance_days_date_status ON public.hr_attendance_days(work_date DESC, approval_status);
CREATE INDEX idx_hr_attendance_days_employee_date ON public.hr_attendance_days(employee_id, work_date DESC);

ALTER TABLE public.hr_attendance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_attendance_days ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_attendance_policies TO authenticated;
GRANT SELECT ON public.hr_attendance_days TO authenticated;
GRANT ALL ON public.hr_attendance_policies, public.hr_attendance_days TO service_role;
CREATE POLICY hr_attendance_policies_read ON public.hr_attendance_policies FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'hr.attendance','view') OR public.is_admin(auth.uid()));
CREATE POLICY hr_attendance_policies_write ON public.hr_attendance_policies FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid()));
CREATE POLICY hr_attendance_days_read ON public.hr_attendance_days FOR SELECT TO authenticated USING (
  public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.hr_employees e WHERE e.id = hr_attendance_days.employee_id AND e.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.hr_attendance_refresh_days(
  _date_from DATE, _date_to DATE, _employee_id UUID DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp RECORD; v_day DATE; v_assignment RECORD; v_schedule public.hr_shift_schedules;
  v_policy public.hr_attendance_policies; v_start TIMESTAMPTZ; v_end TIMESTAMPTZ;
  v_in TIMESTAMPTZ; v_out TIMESTAMPTZ; v_scheduled INTEGER; v_actual INTEGER;
  v_late INTEGER; v_early INTEGER; v_overtime INTEGER; v_status TEXT; v_count INTEGER := 0;
  v_leave_id UUID; v_existing public.hr_attendance_days; v_details JSONB;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','edit') OR public.is_admin(auth.uid()) OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'ليست لديك صلاحية معالجة الحضور';
  END IF;
  IF _date_from IS NULL OR _date_to IS NULL OR _date_to < _date_from OR _date_to - _date_from > 92 THEN
    RAISE EXCEPTION 'الفترة غير صالحة أو تتجاوز 93 يوماً';
  END IF;

  FOR v_emp IN SELECT id FROM public.hr_employees
    WHERE status IN ('active','on_leave') AND (_employee_id IS NULL OR id = _employee_id)
  LOOP
    FOR v_day IN SELECT generate_series(_date_from, _date_to, INTERVAL '1 day')::DATE LOOP
      -- Serialize refresh/approval for one logical attendance day.  The unique
      -- constraint remains the final duplicate-row guard; this lock prevents a
      -- concurrent approval from racing a newly calculated result.
      PERFORM pg_advisory_xact_lock(hashtextextended(v_emp.id::TEXT || ':' || v_day::TEXT, 0));
      SELECT a.id assignment_id, a.group_id, g.timezone, g.work_minutes, g.break_minutes
      INTO v_assignment FROM public.hr_shift_assignments a
      JOIN public.hr_shift_groups g ON g.id = a.group_id AND g.is_active
      WHERE a.employee_id = v_emp.id AND a.effective_from <= v_day
        AND (a.effective_to IS NULL OR a.effective_to >= v_day)
      ORDER BY a.effective_from DESC LIMIT 1;
      CONTINUE WHEN v_assignment.assignment_id IS NULL;

      SELECT * INTO v_schedule FROM public.hr_shift_schedules
      WHERE group_id = v_assignment.group_id AND day_of_week = EXTRACT(DOW FROM v_day)::INTEGER AND is_working_day;
      CONTINUE WHEN v_schedule.id IS NULL;
      SELECT * INTO v_policy FROM public.hr_attendance_policies WHERE group_id = v_assignment.group_id;

      v_start := (v_day + v_schedule.start_time) AT TIME ZONE v_assignment.timezone;
      v_end := (v_day + v_schedule.end_time) AT TIME ZONE v_assignment.timezone;
      IF v_end <= v_start THEN v_end := v_end + INTERVAL '1 day'; END IF;
      v_scheduled := v_assignment.work_minutes;

      SELECT MIN(occurred_at) FILTER (WHERE event_type='check_in'),
             MAX(occurred_at) FILTER (WHERE event_type='check_out')
      INTO v_in, v_out FROM public.hr_attendance_events
      WHERE employee_id = v_emp.id AND validation_status = 'accepted'
        AND schedule_id = v_schedule.id
        AND occurred_at BETWEEN
          v_start - make_interval(mins => v_schedule.checkin_open_before_minutes)
          AND v_end + make_interval(mins => v_schedule.checkout_close_after_minutes);

      SELECT id INTO v_leave_id FROM public.hr_leaves
      WHERE employee_id = v_emp.id AND status IN ('approved','taken') AND v_day BETWEEN from_date AND to_date
      ORDER BY from_date LIMIT 1;

      IF v_leave_id IS NOT NULL THEN
        v_status := 'approved_leave'; v_actual := 0; v_late := 0; v_early := 0; v_overtime := 0;
      ELSIF v_in IS NULL AND v_out IS NULL THEN
        v_status := 'absent'; v_actual := 0; v_late := 0; v_early := 0; v_overtime := 0;
      ELSIF v_in IS NULL OR v_out IS NULL OR v_out <= v_in THEN
        v_status := 'incomplete'; v_actual := 0; v_late := 0; v_early := 0; v_overtime := 0;
      ELSE
        v_status := 'present';
        v_actual := GREATEST(FLOOR(EXTRACT(EPOCH FROM (v_out-v_in))/60)::INTEGER - v_assignment.break_minutes, 0);
        v_late := GREATEST(FLOOR(EXTRACT(EPOCH FROM (v_in-v_start))/60)::INTEGER - COALESCE(v_policy.grace_minutes,0), 0);
        v_early := GREATEST(FLOOR(EXTRACT(EPOCH FROM (v_end-v_out))/60)::INTEGER, 0);
        v_overtime := GREATEST(FLOOR(EXTRACT(EPOCH FROM (v_out-v_end))/60)::INTEGER, 0);
        IF v_overtime < COALESCE(v_policy.minimum_overtime_minutes,30) THEN v_overtime := 0; END IF;
      END IF;

      v_details := jsonb_build_object('engine','attendance-daily-v1','timezone',v_assignment.timezone,
        'scheduled_start',v_start,'scheduled_end',v_end,'break_minutes',v_assignment.break_minutes,
        'leave_id',v_leave_id,'deduct_absence',COALESCE(v_policy.deduct_absence,false),
        'deduct_late_minutes',COALESCE(v_policy.deduct_late_minutes,false),
        'pay_overtime',COALESCE(v_policy.pay_overtime,false),
        'overtime_multiplier',COALESCE(v_policy.overtime_multiplier,1.5),
        'salary_day_divisor',COALESCE(v_policy.salary_day_divisor,30),
        'salary_day_minutes',v_assignment.work_minutes);

      SELECT * INTO v_existing FROM public.hr_attendance_days
      WHERE employee_id=v_emp.id AND work_date=v_day FOR UPDATE;
      IF v_existing.approval_status = 'approved' AND ROW(
          v_existing.assignment_id,v_existing.group_id,v_existing.schedule_id,
          v_existing.first_check_in,v_existing.last_check_out,v_existing.scheduled_minutes,
          v_existing.actual_minutes,v_existing.late_minutes,v_existing.early_leave_minutes,
          v_existing.overtime_minutes,v_existing.status,v_existing.calculation_details
        ) IS DISTINCT FROM ROW(
          v_assignment.assignment_id,v_assignment.group_id,v_schedule.id,
          v_in,v_out,v_scheduled,v_actual,v_late,v_early,v_overtime,v_status,v_details
        ) THEN
        RAISE EXCEPTION USING
          ERRCODE = '55000',
          MESSAGE = format('approved attendance day %s for employee %s changed; correction/reopening is required', v_day, v_emp.id);
      END IF;

      INSERT INTO public.hr_attendance_days(employee_id,work_date,assignment_id,group_id,schedule_id,
        first_check_in,last_check_out,scheduled_minutes,actual_minutes,late_minutes,early_leave_minutes,
        overtime_minutes,status,approval_status,calculation_details,calculated_at)
      VALUES (v_emp.id,v_day,v_assignment.assignment_id,v_assignment.group_id,v_schedule.id,
        v_in,v_out,v_scheduled,v_actual,v_late,v_early,v_overtime,v_status,
        CASE WHEN COALESCE(v_policy.require_daily_approval,true) THEN 'pending' ELSE 'approved' END,
        v_details, now())
      ON CONFLICT (employee_id,work_date) DO UPDATE SET
        assignment_id=EXCLUDED.assignment_id,group_id=EXCLUDED.group_id,schedule_id=EXCLUDED.schedule_id,
        first_check_in=EXCLUDED.first_check_in,last_check_out=EXCLUDED.last_check_out,
        scheduled_minutes=EXCLUDED.scheduled_minutes,actual_minutes=EXCLUDED.actual_minutes,
        late_minutes=EXCLUDED.late_minutes,early_leave_minutes=EXCLUDED.early_leave_minutes,
        overtime_minutes=EXCLUDED.overtime_minutes,status=EXCLUDED.status,
        approval_status=CASE WHEN ROW(hr_attendance_days.first_check_in,hr_attendance_days.last_check_out,
          hr_attendance_days.actual_minutes,hr_attendance_days.late_minutes,hr_attendance_days.early_leave_minutes,
          hr_attendance_days.overtime_minutes,hr_attendance_days.status,hr_attendance_days.calculation_details)
          IS NOT DISTINCT FROM ROW(EXCLUDED.first_check_in,EXCLUDED.last_check_out,EXCLUDED.actual_minutes,
          EXCLUDED.late_minutes,EXCLUDED.early_leave_minutes,EXCLUDED.overtime_minutes,EXCLUDED.status,
          EXCLUDED.calculation_details) THEN hr_attendance_days.approval_status ELSE EXCLUDED.approval_status END,
        approved_by=CASE WHEN ROW(hr_attendance_days.first_check_in,hr_attendance_days.last_check_out,
          hr_attendance_days.actual_minutes,hr_attendance_days.late_minutes,hr_attendance_days.early_leave_minutes,
          hr_attendance_days.overtime_minutes,hr_attendance_days.status,hr_attendance_days.calculation_details)
          IS NOT DISTINCT FROM ROW(EXCLUDED.first_check_in,EXCLUDED.last_check_out,EXCLUDED.actual_minutes,
          EXCLUDED.late_minutes,EXCLUDED.early_leave_minutes,EXCLUDED.overtime_minutes,EXCLUDED.status,
          EXCLUDED.calculation_details) THEN hr_attendance_days.approved_by ELSE NULL END,
        approved_at=CASE WHEN ROW(hr_attendance_days.first_check_in,hr_attendance_days.last_check_out,
          hr_attendance_days.actual_minutes,hr_attendance_days.late_minutes,hr_attendance_days.early_leave_minutes,
          hr_attendance_days.overtime_minutes,hr_attendance_days.status,hr_attendance_days.calculation_details)
          IS NOT DISTINCT FROM ROW(EXCLUDED.first_check_in,EXCLUDED.last_check_out,EXCLUDED.actual_minutes,
          EXCLUDED.late_minutes,EXCLUDED.early_leave_minutes,EXCLUDED.overtime_minutes,EXCLUDED.status,
          EXCLUDED.calculation_details) THEN hr_attendance_days.approved_at ELSE NULL END,
        calculation_details=EXCLUDED.calculation_details,calculated_at=now(),updated_at=now()
      -- Identical input is a true no-op, including audit timestamps.  Approved
      -- changed input was rejected above rather than silently reopened.
      WHERE ROW(hr_attendance_days.assignment_id,hr_attendance_days.group_id,hr_attendance_days.schedule_id,
          hr_attendance_days.first_check_in,hr_attendance_days.last_check_out,hr_attendance_days.scheduled_minutes,
          hr_attendance_days.actual_minutes,hr_attendance_days.late_minutes,hr_attendance_days.early_leave_minutes,
          hr_attendance_days.overtime_minutes,hr_attendance_days.status,hr_attendance_days.calculation_details)
        IS DISTINCT FROM ROW(EXCLUDED.assignment_id,EXCLUDED.group_id,EXCLUDED.schedule_id,
          EXCLUDED.first_check_in,EXCLUDED.last_check_out,EXCLUDED.scheduled_minutes,
          EXCLUDED.actual_minutes,EXCLUDED.late_minutes,EXCLUDED.early_leave_minutes,
          EXCLUDED.overtime_minutes,EXCLUDED.status,EXCLUDED.calculation_details);
      v_count := v_count + 1; v_assignment := NULL; v_schedule := NULL; v_policy := NULL;
      v_leave_id := NULL; v_existing := NULL; v_details := NULL;
    END LOOP;
  END LOOP;
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.hr_attendance_decide_day(_day_id UUID, _approved BOOLEAN, _notes TEXT DEFAULT NULL)
RETURNS public.hr_attendance_days LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.hr_attendance_days; v_employee_id UUID; v_work_date DATE;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'hr.attendance','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية اعتماد الحضور';
  END IF;
  SELECT employee_id,work_date INTO v_employee_id,v_work_date
  FROM public.hr_attendance_days WHERE id=_day_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'سجل اليوم غير موجود'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_employee_id::TEXT || ':' || v_work_date::TEXT, 0));
  UPDATE public.hr_attendance_days SET approval_status=CASE WHEN _approved THEN 'approved' ELSE 'rejected' END,
    approved_by=auth.uid(),approved_at=now(),notes=NULLIF(BTRIM(_notes),'')
  WHERE id=_day_id AND approval_status='pending' RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'سجل اليوم غير موجود أو سبق اتخاذ القرار عليه'; END IF;
  RETURN v_row;
END; $$;

ALTER TABLE public.hr_payroll_lines
  ADD COLUMN IF NOT EXISTS attendance_absence_days NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attendance_late_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attendance_overtime_minutes INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.hr_apply_attendance_to_payroll(_run_id UUID) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.hr_payroll_runs; v_line RECORD; v_abs NUMERIC; v_late INTEGER; v_ot INTEGER;
  v_abs_fraction NUMERIC; v_late_fraction NUMERIC; v_ot_factor NUMERIC;
  v_abs_ded NUMERIC; v_late_ded NUMERIC; v_ot_pay NUMERIC; v_changed INTEGER := 0;
BEGIN
  SELECT * INTO v_run FROM public.hr_payroll_runs WHERE id=_run_id FOR UPDATE;
  IF NOT FOUND OR v_run.status <> 'draft' THEN RAISE EXCEPTION 'يجب أن يكون مسير الرواتب مسودة'; END IF;
  IF NOT (public.has_permission(auth.uid(),'hr.payroll','edit') OR public.has_permission(auth.uid(),'hr.payroll','create') OR public.is_admin(auth.uid()) OR auth.role()='service_role') THEN
    RAISE EXCEPTION 'ليست لديك صلاحية تحديث مسير الرواتب';
  END IF;
  FOR v_line IN SELECT pl.*,e.gross_salary contract_gross,e.basic_salary contract_basic
    FROM public.hr_payroll_lines pl JOIN public.hr_employees e ON e.id=pl.employee_id WHERE pl.run_id=_run_id FOR UPDATE OF pl
  LOOP
    SELECT COUNT(*) FILTER (WHERE status='absent' AND COALESCE((calculation_details->>'deduct_absence')::BOOLEAN,false)),
      COALESCE(SUM(late_minutes) FILTER (WHERE COALESCE((calculation_details->>'deduct_late_minutes')::BOOLEAN,false)),0),
      COALESCE(SUM(overtime_minutes) FILTER (WHERE COALESCE((calculation_details->>'pay_overtime')::BOOLEAN,false)),0),
      COALESCE(SUM(CASE WHEN status='absent' AND COALESCE((calculation_details->>'deduct_absence')::BOOLEAN,false)
        THEN 1/COALESCE(NULLIF((calculation_details->>'salary_day_divisor')::NUMERIC,0),30) ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN COALESCE((calculation_details->>'deduct_late_minutes')::BOOLEAN,false)
        THEN late_minutes/(COALESCE(NULLIF((calculation_details->>'salary_day_divisor')::NUMERIC,0),30)*COALESCE(NULLIF((calculation_details->>'salary_day_minutes')::NUMERIC,0),480)) ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN COALESCE((calculation_details->>'pay_overtime')::BOOLEAN,false)
        THEN overtime_minutes*COALESCE((calculation_details->>'overtime_multiplier')::NUMERIC,1.5)/(COALESCE(NULLIF((calculation_details->>'salary_day_divisor')::NUMERIC,0),30)*COALESCE(NULLIF((calculation_details->>'salary_day_minutes')::NUMERIC,0),480)) ELSE 0 END),0)
    INTO v_abs,v_late,v_ot,v_abs_fraction,v_late_fraction,v_ot_factor FROM public.hr_attendance_days
    WHERE employee_id=v_line.employee_id AND approval_status='approved'
      AND EXTRACT(YEAR FROM work_date)=v_run.period_year AND EXTRACT(MONTH FROM work_date)=v_run.period_month;
    v_abs_ded := ROUND(COALESCE(v_line.contract_gross,0)*v_abs_fraction,2);
    v_late_ded := ROUND(COALESCE(v_line.contract_gross,0)*v_late_fraction,2);
    v_ot_pay := ROUND(COALESCE(v_line.contract_basic,0)*v_ot_factor,2);
    UPDATE public.hr_payroll_lines SET attendance_absence_days=COALESCE(v_abs,0),attendance_late_minutes=COALESCE(v_late,0),
      attendance_overtime_minutes=COALESCE(v_ot,0),absence_deduction=v_abs_ded,late_deduction=v_late_ded,overtime=v_ot_pay,
      total_deductions=total_deductions-COALESCE(absence_deduction,0)-COALESCE(late_deduction,0)+v_abs_ded+v_late_ded,
      net_salary=net_salary-COALESCE(overtime,0)+v_ot_pay+COALESCE(absence_deduction,0)+COALESCE(late_deduction,0)-v_abs_ded-v_late_ded,
      calculation_details=calculation_details||jsonb_build_object('attendance',jsonb_build_object('engine','attendance-payroll-v1','absence_days',v_abs,'late_minutes',v_late,'overtime_minutes',v_ot,'absence_deduction',v_abs_ded,'late_deduction',v_late_ded,'overtime_pay',v_ot_pay))
    WHERE id=v_line.id; v_changed:=v_changed+1;
  END LOOP;
  UPDATE public.hr_payroll_runs SET total_gross=(SELECT COALESCE(SUM(gross_salary+overtime),0) FROM public.hr_payroll_lines WHERE run_id=_run_id),
    total_deductions=(SELECT COALESCE(SUM(total_deductions),0) FROM public.hr_payroll_lines WHERE run_id=_run_id),
    total_net=(SELECT COALESCE(SUM(net_salary),0) FROM public.hr_payroll_lines WHERE run_id=_run_id) WHERE id=_run_id;
  RETURN v_changed;
END; $$;

ALTER FUNCTION public.hr_payroll_create_run(INTEGER,INTEGER) RENAME TO hr_payroll_create_run_leave_core;
CREATE OR REPLACE FUNCTION public.hr_payroll_create_run(_period_year INTEGER,_period_month INTEGER)
RETURNS public.hr_payroll_runs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_run public.hr_payroll_runs;
BEGIN
  v_run:=public.hr_payroll_create_run_leave_core(_period_year,_period_month);
  PERFORM public.hr_apply_attendance_to_payroll(v_run.id);
  SELECT * INTO v_run FROM public.hr_payroll_runs WHERE id=v_run.id; RETURN v_run;
END; $$;

REVOKE ALL ON FUNCTION public.hr_attendance_refresh_days(DATE,DATE,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_attendance_decide_day(UUID,BOOLEAN,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_apply_attendance_to_payroll(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_payroll_create_run(INTEGER,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_attendance_refresh_days(DATE,DATE,UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_attendance_decide_day(UUID,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_apply_attendance_to_payroll(UUID) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_payroll_create_run(INTEGER,INTEGER) TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.hr_attendance_days FROM authenticated;

-- Keep the unified cost ledger aligned with the approved attendance-adjusted pay.
CREATE OR REPLACE FUNCTION public.hr_sync_payroll_cost_entries(_run_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_run public.hr_payroll_runs; v_line RECORD; v_cost UUID; v_created INTEGER:=0;
BEGIN
  SELECT * INTO v_run FROM public.hr_payroll_runs WHERE id=_run_id;
  IF NOT FOUND OR v_run.status NOT IN ('approved','paid') THEN RAISE EXCEPTION 'لا يمكن ترحيل تكلفة مسير غير معتمد'; END IF;
  FOR v_line IN SELECT pl.*,e.employee_no,e.full_name_ar,e.department_id,p.name project_name
    FROM public.hr_payroll_lines pl JOIN public.hr_employees e ON e.id=pl.employee_id
    LEFT JOIN public.projects p ON p.id=pl.project_id
    WHERE pl.run_id=_run_id AND pl.cost_entry_id IS NULL FOR UPDATE OF pl
  LOOP
    INSERT INTO public.cost_entries(category,description,project,project_id,department_id,period,amount,meta,imported_by)
    VALUES ('hr.payroll','راتب '||v_line.full_name_ar||' ('||v_line.employee_no||') - '||v_run.run_no,
      v_line.project_name,v_line.project_id,v_line.department_id,
      format('%s-%s',v_run.period_year,lpad(v_run.period_month::TEXT,2,'0')),
      GREATEST(COALESCE(v_line.gross_salary,0)+COALESCE(v_line.overtime,0)
        -COALESCE(v_line.unpaid_leave_deduction,0)-COALESCE(v_line.sick_leave_deduction,0)
        -COALESCE(v_line.absence_deduction,0)-COALESCE(v_line.late_deduction,0),0)+COALESCE(v_line.gosi_employer,0),
      jsonb_build_object('source','hr_payroll','payroll_run_id',v_run.id,'payroll_line_id',v_line.id,
        'employee_id',v_line.employee_id,'gross_salary',COALESCE(v_line.gross_salary,0),
        'attendance_overtime',COALESCE(v_line.overtime,0),'attendance_absence_deduction',COALESCE(v_line.absence_deduction,0),
        'attendance_late_deduction',COALESCE(v_line.late_deduction,0),'unpaid_leave_deduction',COALESCE(v_line.unpaid_leave_deduction,0),
        'sick_leave_deduction',COALESCE(v_line.sick_leave_deduction,0),'gosi_employer',COALESCE(v_line.gosi_employer,0)),auth.uid())
    RETURNING id INTO v_cost;
    UPDATE public.hr_payroll_lines SET cost_entry_id=v_cost WHERE id=v_line.id; v_created:=v_created+1;
  END LOOP;
  RETURN v_created;
END; $$;
