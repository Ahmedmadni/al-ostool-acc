-- D0: audit found that H13's loan-installment linkage was never actually
-- live — trg_hr_loan_generate_installments and trg_hr_loan_installments_sync
-- do not exist on the database despite being committed in
-- 20260710090000_8ee7bdf0-1da2-4ce6-8c2a-36f6b92d93c1.sql (0 rows in
-- hr_loan_installments for 3 real loans confirms it never ran). The synced
-- version also tried to assign hr_loans.remaining_amount directly, which is
-- a GENERATED STORED column — that statement cannot execute at all. This
-- redeploys the linkage correctly (paid_amount/status only; remaining_amount
-- derives itself) and backfills schedules for loans that predate it.

CREATE OR REPLACE FUNCTION public.hr_loan_generate_installments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  i INT;
  base_amount NUMERIC;
  running_total NUMERIC := 0;
BEGIN
  IF NEW.installments_count IS NULL OR NEW.installments_count <= 0 THEN
    RETURN NEW;
  END IF;
  base_amount := ROUND(NEW.amount / NEW.installments_count, 2);
  FOR i IN 1..NEW.installments_count LOOP
    INSERT INTO public.hr_loan_installments (loan_id, installment_no, due_date, amount, paid)
    VALUES (
      NEW.id, i, (NEW.loan_date + (i || ' months')::interval)::date,
      CASE WHEN i = NEW.installments_count THEN NEW.amount - running_total ELSE base_amount END,
      false
    );
    running_total := running_total + base_amount;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_loan_generate_installments ON public.hr_loans;
CREATE TRIGGER trg_hr_loan_generate_installments
AFTER INSERT ON public.hr_loans
FOR EACH ROW EXECUTE FUNCTION public.hr_loan_generate_installments();

-- D2: keep hr_loans.paid_amount/status in sync with what's actually marked
-- paid on the installment schedule — remaining_amount is GENERATED so it is
-- never assigned here, only paid_amount and status.
CREATE OR REPLACE FUNCTION public.hr_loan_sync_from_installments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_loan_id UUID := COALESCE(NEW.loan_id, OLD.loan_id);
  v_paid NUMERIC;
  v_amount NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_paid FROM public.hr_loan_installments WHERE loan_id = v_loan_id AND paid = true;
  SELECT amount INTO v_amount FROM public.hr_loans WHERE id = v_loan_id;
  UPDATE public.hr_loans SET
    paid_amount = v_paid,
    status = CASE WHEN status <> 'cancelled' AND v_amount - v_paid <= 0.01 THEN 'completed'
                  WHEN status = 'completed' AND v_amount - v_paid > 0.01 THEN 'active'
                  ELSE status END,
    updated_at = now()
  WHERE id = v_loan_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_loan_installments_sync ON public.hr_loan_installments;
CREATE TRIGGER trg_hr_loan_installments_sync
AFTER INSERT OR UPDATE OR DELETE ON public.hr_loan_installments
FOR EACH ROW EXECUTE FUNCTION public.hr_loan_sync_from_installments();

-- Backfill: loans created before either trigger existed have no schedule yet.
DO $$
DECLARE r RECORD; i INT; base_amount NUMERIC; running_total NUMERIC;
BEGIN
  FOR r IN
    SELECT l.* FROM public.hr_loans l
    WHERE NOT EXISTS (SELECT 1 FROM public.hr_loan_installments li WHERE li.loan_id = l.id)
      AND l.installments_count > 0
  LOOP
    base_amount := ROUND(r.amount / r.installments_count, 2);
    running_total := 0;
    FOR i IN 1..r.installments_count LOOP
      INSERT INTO public.hr_loan_installments (loan_id, installment_no, due_date, amount, paid)
      VALUES (
        r.id, i, (r.loan_date + (i || ' months')::interval)::date,
        CASE WHEN i = r.installments_count THEN r.amount - running_total ELSE base_amount END,
        false
      );
      running_total := running_total + base_amount;
    END LOOP;
    -- Preserve any paid_amount that was already recorded on the loan itself
    -- (e.g. entered by hand before the schedule existed) by marking the
    -- earliest installments paid up to that amount, so the backfill doesn't
    -- silently reset progress someone already tracked.
    IF r.paid_amount > 0 THEN
      DECLARE v_remaining NUMERIC := r.paid_amount; v_inst RECORD;
      BEGIN
        FOR v_inst IN SELECT id, amount FROM public.hr_loan_installments WHERE loan_id = r.id ORDER BY installment_no ASC LOOP
          EXIT WHEN v_remaining <= 0;
          IF v_inst.amount <= v_remaining + 0.01 THEN
            UPDATE public.hr_loan_installments SET paid = true, paid_at = now() WHERE id = v_inst.id;
            v_remaining := v_remaining - v_inst.amount;
          ELSE
            EXIT;
          END IF;
        END LOOP;
      END;
    END IF;
  END LOOP;
END $$;

-- D3: mark a payroll run as paid AND settle the loan installments its
-- loan_deduction figures were drawn from — replaces a plain status flip that
-- left the deduction as a number on the payslip with no effect on the loan.
CREATE OR REPLACE FUNCTION public.hr_payroll_mark_paid(_run_id UUID)
RETURNS public.hr_payroll_runs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status TEXT;
  v_line RECORD;
  v_remaining NUMERIC;
  v_inst RECORD;
  v_run public.hr_payroll_runs;
BEGIN
  SELECT status INTO v_status FROM public.hr_payroll_runs WHERE id = _run_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'مسير الرواتب غير موجود'; END IF;
  IF v_status <> 'approved' THEN RAISE EXCEPTION 'يجب اعتماد المسير أولاً قبل تسجيل الصرف'; END IF;

  FOR v_line IN SELECT id AS line_id, employee_id, loan_deduction FROM public.hr_payroll_lines WHERE run_id = _run_id AND loan_deduction > 0 LOOP
    v_remaining := v_line.loan_deduction;
    FOR v_inst IN
      SELECT li.id, li.amount FROM public.hr_loan_installments li
      JOIN public.hr_loans l ON l.id = li.loan_id
      WHERE l.employee_id = v_line.employee_id AND l.status = 'active' AND li.paid = false
      ORDER BY l.loan_date ASC, li.installment_no ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      IF v_inst.amount <= v_remaining + 0.01 THEN
        UPDATE public.hr_loan_installments SET paid = true, paid_at = now(), payroll_line_id = v_line.line_id WHERE id = v_inst.id;
        v_remaining := v_remaining - v_inst.amount;
      ELSE
        EXIT; -- amount doesn't cleanly cover this installment; leave for manual review
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.hr_payroll_runs SET status = 'paid', paid_at = now() WHERE id = _run_id RETURNING * INTO v_run;
  RETURN v_run;
END $$;

GRANT EXECUTE ON FUNCTION public.hr_payroll_mark_paid(UUID) TO authenticated;

-- D5: manual leave-balance adjustments (carry-over, correction, one-off
-- grant) — folded directly into hr_calc_leave_entitlement so every consumer
-- (hr_get_leave_summary, hr_leave_balance_report, the termination refresh,
-- the balance-enforcing trigger) reflects it automatically with no separate
-- code path to keep in sync.
CREATE TABLE public.hr_leave_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  leave_type public.hr_leave_type NOT NULL,
  year INTEGER NOT NULL,
  days NUMERIC(6,2) NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_leave_adj_emp ON public.hr_leave_adjustments(employee_id, leave_type, year);

ALTER TABLE public.hr_leave_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_leave_adj_all" ON public.hr_leave_adjustments FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'hr.leaves','view') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'hr.leaves','edit') OR public.is_admin(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_leave_adjustments TO authenticated;
GRANT ALL ON public.hr_leave_adjustments TO service_role;

DROP TRIGGER IF EXISTS trg_audit_hr_leave_adjustments ON public.hr_leave_adjustments;
CREATE TRIGGER trg_audit_hr_leave_adjustments AFTER INSERT OR UPDATE OR DELETE ON public.hr_leave_adjustments FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE OR REPLACE FUNCTION public.hr_calc_leave_entitlement(_employee_id uuid, _leave_type text, _year integer DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hire date;
  v_service_years numeric;
  -- Preserves the original semantics: service years as of Dec 31 of an
  -- explicit _year, or as of today when _year is omitted (not Dec 31 of the
  -- current year, which would over-credit service not yet completed).
  v_year integer := COALESCE(_year, EXTRACT(YEAR FROM CURRENT_DATE)::int);
  v_base numeric;
  v_adjustment numeric;
BEGIN
  SELECT hire_date INTO v_hire FROM public.hr_employees WHERE id = _employee_id;
  IF v_hire IS NULL THEN RETURN 0; END IF;
  -- date - date yields an integer day count in Postgres, not an interval —
  -- the original EXTRACT(EPOCH FROM ...) form on it throws
  -- "function extract(unknown, integer) does not exist" on every call. This
  -- had been silently broken since it was first written; every leave-balance
  -- consumer (hr_get_leave_summary, the balance trigger, the new termination
  -- refresh and reports) was failing until this was caught and fixed here.
  v_service_years := (COALESCE(make_date(_year,12,31), CURRENT_DATE) - v_hire) / 365.25;

  v_base := CASE _leave_type
    WHEN 'annual'       THEN CASE WHEN v_service_years >= 5 THEN 30 ELSE 21 END
    WHEN 'sick'         THEN 120
    WHEN 'emergency'    THEN 5
    WHEN 'maternity'    THEN 70
    WHEN 'paternity'    THEN 3
    WHEN 'hajj'         THEN 15
    WHEN 'compensatory' THEN 999
    WHEN 'study'        THEN 15
    WHEN 'unpaid'       THEN 999
    ELSE 0
  END;

  SELECT COALESCE(SUM(days), 0) INTO v_adjustment
  FROM public.hr_leave_adjustments
  WHERE employee_id = _employee_id AND leave_type::text = _leave_type AND year = v_year;

  RETURN v_base + v_adjustment;
END $$;
