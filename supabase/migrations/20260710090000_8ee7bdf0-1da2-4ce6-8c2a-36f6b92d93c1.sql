-- H13: hr_loan_installments was fully designed (installment_no, due_date,
-- amount, paid, payroll_line_id) but nothing ever wrote a row into it — loan
-- creation only ever touched the summary columns on hr_loans itself, so there
-- was no per-installment due-date schedule to track or mark as paid.

-- Auto-generate the installment schedule whenever a loan is created. Any
-- rounding remainder from amount / installments_count is absorbed into the
-- last installment so the schedule always sums exactly to the loan amount.
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

-- Keep the loan's summary columns (paid_amount, remaining_amount, status) in
-- sync with the actual installment schedule instead of being maintained by
-- hand or drifting from what's actually been marked paid.
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
    remaining_amount = GREATEST(v_amount - v_paid, 0),
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
