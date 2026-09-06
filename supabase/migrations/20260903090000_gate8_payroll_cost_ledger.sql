-- Gate 8: finalized Payroll -> Cost Ledger posting hardening.
-- Employer cost is finalized earned gross plus attendance overtime, less only
-- attendance/leave reductions of earned pay, plus the employer GOSI contribution.

DO $$
DECLARE v_duplicates INTEGER;
BEGIN
  IF to_regclass('public.hr_payroll_runs') IS NULL
     OR to_regclass('public.hr_payroll_lines') IS NULL
     OR to_regclass('public.cost_entries') IS NULL
     OR to_regclass('public.cost_periods') IS NULL
     OR to_regprocedure('public.hr_payroll_attendance_is_stale(uuid)') IS NULL
     OR to_regprocedure('public.hr_sync_payroll_cost_entries(uuid)') IS NULL
     OR to_regprocedure('public.cost_period_set_status(text,boolean,text)') IS NULL
     OR to_regclass('public.uq_cost_entries_hr_payroll_line_source') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Gate 8 requires the complete verified Gate 7 payroll/cost foundation';
  END IF;

  -- The helper is the Gate 8 application marker. Its presence before this migration
  -- means the schema is already or partially applied and requires inspection.
  IF to_regprocedure('public.hr_payroll_employer_cost(numeric,numeric,numeric,numeric,numeric,numeric,numeric)') IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Gate 8 is already or partially applied; inspect schema history before retrying';
  END IF;

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
      MESSAGE=format('Gate 8 found %s duplicated payroll-line cost sources; manual reconciliation is required',v_duplicates);
  END IF;
END;
$$;

CREATE FUNCTION public.hr_payroll_employer_cost(
  _gross_salary NUMERIC,
  _overtime NUMERIC,
  _unpaid_leave_deduction NUMERIC,
  _sick_leave_deduction NUMERIC,
  _absence_deduction NUMERIC,
  _late_deduction NUMERIC,
  _gosi_employer NUMERIC
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path=''
AS $$
  SELECT round(
    COALESCE(_gross_salary,0) + COALESCE(_overtime,0)
    - COALESCE(_unpaid_leave_deduction,0) - COALESCE(_sick_leave_deduction,0)
    - COALESCE(_absence_deduction,0) - COALESCE(_late_deduction,0)
    + COALESCE(_gosi_employer,0),
    2
  )
$$;

REVOKE ALL ON FUNCTION public.hr_payroll_employer_cost(NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_payroll_employer_cost(NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC)
  TO service_role;

CREATE OR REPLACE FUNCTION public.hr_sync_payroll_cost_entries(_run_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_run public.hr_payroll_runs;
  v_line RECORD;
  v_existing public.cost_entries;
  v_cost UUID;
  v_created INTEGER:=0;
  v_period TEXT;
  v_amount NUMERIC;
  v_posted_at TIMESTAMPTZ:=clock_timestamp();
BEGIN
  IF auth.role()<>'service_role' THEN
    RAISE EXCEPTION 'ترحيل تكلفة الرواتب خدمة داخلية فقط';
  END IF;

  SELECT * INTO v_run FROM public.hr_payroll_runs WHERE id=_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'مسير الرواتب غير موجود'; END IF;
  v_period:=format('%s-%s',v_run.period_year,lpad(v_run.period_month::TEXT,2,'0'));

  -- Gate 8 lock order: period advisory lock -> period row -> payroll run ->
  -- payroll lines (UUID order) -> conflicting cost source row.
  PERFORM pg_advisory_xact_lock(hashtextextended('cost-period:'||v_period,0));
  PERFORM 1 FROM public.cost_periods WHERE period=v_period FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.cost_periods WHERE period=v_period AND status='closed') THEN
    RAISE EXCEPTION 'فترة التكلفة مقفلة';
  END IF;

  SELECT * INTO v_run FROM public.hr_payroll_runs WHERE id=_run_id FOR UPDATE;
  IF format('%s-%s',v_run.period_year,lpad(v_run.period_month::TEXT,2,'0')) IS DISTINCT FROM v_period THEN
    RAISE EXCEPTION 'payroll period changed concurrently; retry cost sync';
  END IF;
  IF v_run.status NOT IN ('approved','paid') THEN
    RAISE EXCEPTION 'لا يمكن ترحيل تكلفة مسير غير معتمد';
  END IF;
  IF public.hr_payroll_attendance_is_stale(_run_id) THEN
    RAISE EXCEPTION 'لا يمكن ترحيل تكلفة مسير يعتمد على نسخة حضور قديمة';
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
    v_amount:=public.hr_payroll_employer_cost(
      v_line.gross_salary,v_line.overtime,v_line.unpaid_leave_deduction,
      v_line.sick_leave_deduction,v_line.absence_deduction,
      v_line.late_deduction,v_line.gosi_employer
    );
    IF v_amount < 0 THEN
      RAISE EXCEPTION 'تكلفة صاحب العمل سالبة لسطر الرواتب %',v_line.id;
    END IF;
    -- Zero employer cost carries no ledger value; retain no noise row.
    IF v_amount = 0 THEN CONTINUE; END IF;

    v_cost:=NULL;
    INSERT INTO public.cost_entries(
      category,description,project,project_id,department_id,period,amount,meta,imported_by,
      workflow_status,source_type
    ) VALUES (
      'hr.payroll','راتب '||v_line.full_name_ar||' ('||v_line.employee_no||') - '||v_run.run_no,
      v_line.project_name,v_line.project_id,v_line.department_id,v_period,v_amount,
      jsonb_build_object(
        'source','hr_payroll','source_key','hr_payroll_line:'||v_line.id,
        'payroll_run_id',v_run.id,'payroll_line_id',v_line.id,'employee_id',v_line.employee_id,
        'period',v_period,'project_id',v_line.project_id,'department_id',v_line.department_id,
        'posted_at',v_posted_at,'posted_by_role',auth.role(),'posted_by',auth.uid(),
        'attendance_period_id',v_run.attendance_period_id,
        'attendance_snapshot_hash',v_run.attendance_snapshot_hash,
        'employer_cost_formula','gross_salary + overtime - unpaid_leave - sick_leave - absence - late + gosi_employer',
        'gross_salary',COALESCE(v_line.gross_salary,0),'overtime',COALESCE(v_line.overtime,0),
        'unpaid_leave_deduction',COALESCE(v_line.unpaid_leave_deduction,0),
        'sick_leave_deduction',COALESCE(v_line.sick_leave_deduction,0),
        'absence_deduction',COALESCE(v_line.absence_deduction,0),
        'late_deduction',COALESCE(v_line.late_deduction,0),
        'gosi_employer',COALESCE(v_line.gosi_employer,0)
      ),auth.uid(),'posted','hr_payroll'
    )
    ON CONFLICT ((meta->>'payroll_line_id'))
      WHERE COALESCE(meta->>'source','')='hr_payroll'
        AND NULLIF(meta->>'payroll_line_id','') IS NOT NULL
    DO NOTHING RETURNING id INTO v_cost;

    IF v_cost IS NULL THEN
      SELECT * INTO v_existing FROM public.cost_entries
      WHERE COALESCE(meta->>'source','')='hr_payroll'
        AND meta->>'payroll_line_id'=v_line.id::TEXT FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'تعذر تحديد قيد تكلفة سطر الرواتب'; END IF;
      IF v_existing.amount IS DISTINCT FROM v_amount
         OR v_existing.period IS DISTINCT FROM v_period
         OR v_existing.project_id IS DISTINCT FROM v_line.project_id
         OR v_existing.department_id IS DISTINCT FROM v_line.department_id
         OR v_existing.source_type IS DISTINCT FROM 'hr_payroll'
         OR v_existing.workflow_status IS DISTINCT FROM 'posted'
         OR v_existing.meta->>'payroll_run_id' IS DISTINCT FROM v_run.id::TEXT
         OR v_existing.meta->>'employee_id' IS DISTINCT FROM v_line.employee_id::TEXT THEN
        RAISE EXCEPTION 'قيد تكلفة الرواتب الموجود لا يطابق حقائق المسير النهائية للسطر %',v_line.id;
      END IF;
      v_cost:=v_existing.id;
    ELSE
      v_created:=v_created+1;
    END IF;

    IF v_line.cost_entry_id IS DISTINCT FROM v_cost THEN
      UPDATE public.hr_payroll_lines SET cost_entry_id=v_cost WHERE id=v_line.id;
    END IF;
  END LOOP;
  RETURN v_created;
END;
$$;

-- Serialize period close/reopen with payroll posting, including a previously
-- absent cost_periods row. The advisory key is identical to the sync function.
CREATE OR REPLACE FUNCTION public.cost_period_set_status(_period TEXT,_closed BOOLEAN,_reason TEXT)
RETURNS public.cost_periods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_period public.cost_periods;
  v_from TEXT;
  v_target TEXT;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'costs','manage') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية إدارة فترات التكاليف';
  END IF;
  IF _period!~'^[0-9]{4}-[0-9]{2}$' OR char_length(btrim(COALESCE(_reason,'')))<10 THEN
    RAISE EXCEPTION 'الفترة أو السبب غير صالح';
  END IF;

  v_target:=CASE WHEN _closed THEN 'closed' ELSE 'open' END;
  PERFORM pg_advisory_xact_lock(hashtextextended('cost-period:'||_period,0));
  SELECT status INTO v_from FROM public.cost_periods WHERE period=_period FOR UPDATE;
  IF v_from IS NOT DISTINCT FROM v_target THEN
    RAISE EXCEPTION 'الفترة في الحالة المطلوبة بالفعل';
  END IF;

  INSERT INTO public.cost_periods(period,status,reason,closed_by,closed_at,reopened_by,reopened_at)
  VALUES(
    _period,v_target,btrim(_reason),
    CASE WHEN _closed THEN auth.uid() END,
    CASE WHEN _closed THEN now() END,
    CASE WHEN NOT _closed THEN auth.uid() END,
    CASE WHEN NOT _closed THEN now() END
  )
  ON CONFLICT(period) DO UPDATE SET
    status=EXCLUDED.status,
    reason=EXCLUDED.reason,
    closed_by=EXCLUDED.closed_by,
    closed_at=EXCLUDED.closed_at,
    reopened_by=EXCLUDED.reopened_by,
    reopened_at=EXCLUDED.reopened_at
  RETURNING * INTO v_period;

  RETURN v_period;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_sync_payroll_cost_entries(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_sync_payroll_cost_entries(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.cost_period_set_status(TEXT,BOOLEAN,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cost_period_set_status(TEXT,BOOLEAN,TEXT) TO authenticated,service_role;

COMMENT ON FUNCTION public.hr_payroll_employer_cost(NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC) IS
  'Gate 8 employer cost; employee GOSI, loans, other deductions and net salary intentionally do not reduce employer cost.';
