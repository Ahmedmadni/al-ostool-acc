-- Link approved payroll runs to the unified cost ledger.  The payroll line
-- already had cost_entry_id, but no code ever populated it, so approved
-- salaries were absent from project and executive cost reporting.

CREATE OR REPLACE FUNCTION public.hr_sync_payroll_cost_entries(_run_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.hr_payroll_runs;
  v_line RECORD;
  v_cost_entry_id UUID;
  v_created INTEGER := 0;
BEGIN
  SELECT * INTO v_run
  FROM public.hr_payroll_runs
  WHERE id = _run_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'مسير الرواتب غير موجود';
  END IF;
  IF v_run.status NOT IN ('approved', 'paid') THEN
    RAISE EXCEPTION 'لا يمكن ترحيل تكلفة مسير غير معتمد';
  END IF;

  FOR v_line IN
    SELECT pl.id, pl.employee_id, pl.project_id, pl.gross_salary,
           pl.gosi_employer, e.employee_no, e.full_name_ar, e.department_id,
           p.name AS project_name
    FROM public.hr_payroll_lines pl
    JOIN public.hr_employees e ON e.id = pl.employee_id
    LEFT JOIN public.projects p ON p.id = pl.project_id
    WHERE pl.run_id = _run_id AND pl.cost_entry_id IS NULL
    FOR UPDATE OF pl
  LOOP
    INSERT INTO public.cost_entries (
      category, description, project, project_id, department_id, period,
      amount, meta, imported_by
    ) VALUES (
      'hr.payroll',
      'راتب ' || v_line.full_name_ar || ' (' || v_line.employee_no || ') - ' || v_run.run_no,
      v_line.project_name,
      v_line.project_id,
      v_line.department_id,
      format('%s-%s', v_run.period_year, lpad(v_run.period_month::TEXT, 2, '0')),
      coalesce(v_line.gross_salary, 0) + coalesce(v_line.gosi_employer, 0),
      jsonb_build_object(
        'source', 'hr_payroll',
        'payroll_run_id', v_run.id,
        'payroll_line_id', v_line.id,
        'employee_id', v_line.employee_id,
        'gross_salary', coalesce(v_line.gross_salary, 0),
        'gosi_employer', coalesce(v_line.gosi_employer, 0)
      ),
      auth.uid()
    ) RETURNING id INTO v_cost_entry_id;

    UPDATE public.hr_payroll_lines
    SET cost_entry_id = v_cost_entry_id
    WHERE id = v_line.id;
    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_sync_payroll_cost_entries(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_sync_payroll_cost_entries(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.hr_payroll_sync_costs_after_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('approved', 'paid')
     AND (OLD.status IS DISTINCT FROM NEW.status OR TG_OP = 'INSERT') THEN
    PERFORM public.hr_sync_payroll_cost_entries(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_payroll_sync_costs ON public.hr_payroll_runs;
CREATE TRIGGER trg_hr_payroll_sync_costs
AFTER INSERT OR UPDATE OF status ON public.hr_payroll_runs
FOR EACH ROW EXECUTE FUNCTION public.hr_payroll_sync_costs_after_approval();

-- Bring already-approved runs into the same source of truth.  The helper is
-- idempotent because it only creates entries for lines without a link.
DO $$
DECLARE
  v_run_id UUID;
BEGIN
  FOR v_run_id IN
    SELECT id FROM public.hr_payroll_runs WHERE status IN ('approved', 'paid')
  LOOP
    PERFORM public.hr_sync_payroll_cost_entries(v_run_id);
  END LOOP;
END;
$$;
