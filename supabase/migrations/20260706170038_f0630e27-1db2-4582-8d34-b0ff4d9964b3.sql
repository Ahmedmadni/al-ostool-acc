
-- Entitlement per leave type based on service years (Saudi Labor Law defaults)
CREATE OR REPLACE FUNCTION public.hr_calc_leave_entitlement(_employee_id uuid, _leave_type text, _year integer DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hire date;
  v_service_years numeric;
BEGIN
  SELECT hire_date INTO v_hire FROM public.hr_employees WHERE id = _employee_id;
  IF v_hire IS NULL THEN RETURN 0; END IF;
  v_service_years := EXTRACT(EPOCH FROM (COALESCE(make_date(_year,12,31), CURRENT_DATE) - v_hire)) / (365.25 * 86400);

  RETURN CASE _leave_type
    WHEN 'annual'       THEN CASE WHEN v_service_years >= 5 THEN 30 ELSE 21 END
    WHEN 'sick'         THEN 120        -- 30 full + 60 (3/4) + 30 unpaid
    WHEN 'emergency'    THEN 5
    WHEN 'maternity'    THEN 70
    WHEN 'paternity'    THEN 3
    WHEN 'hajj'         THEN 15
    WHEN 'compensatory' THEN 999        -- accrued per approved overtime
    WHEN 'study'        THEN 15
    WHEN 'unpaid'       THEN 999        -- no cap
    ELSE 0
  END;
END $$;

-- Summary: entitled / used (approved+taken) / pending / remaining
CREATE OR REPLACE FUNCTION public.hr_get_leave_summary(_employee_id uuid, _year integer DEFAULT NULL)
RETURNS TABLE(leave_type text, entitled numeric, used numeric, pending numeric, remaining numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y integer := COALESCE(_year, EXTRACT(YEAR FROM CURRENT_DATE)::int);
BEGIN
  RETURN QUERY
  WITH types(t) AS (VALUES ('annual'),('sick'),('emergency'),('maternity'),('paternity'),('hajj'),('unpaid'),('compensatory'),('study'))
  SELECT
    tp.t::text,
    public.hr_calc_leave_entitlement(_employee_id, tp.t, y),
    COALESCE((SELECT SUM(days_count) FROM public.hr_leaves l
              WHERE l.employee_id = _employee_id AND l.leave_type::text = tp.t
                AND l.status IN ('approved','taken') AND EXTRACT(YEAR FROM l.from_date) = y), 0),
    COALESCE((SELECT SUM(days_count) FROM public.hr_leaves l
              WHERE l.employee_id = _employee_id AND l.leave_type::text = tp.t
                AND l.status = 'pending' AND EXTRACT(YEAR FROM l.from_date) = y), 0),
    GREATEST(public.hr_calc_leave_entitlement(_employee_id, tp.t, y)
      - COALESCE((SELECT SUM(days_count) FROM public.hr_leaves l
                  WHERE l.employee_id = _employee_id AND l.leave_type::text = tp.t
                    AND l.status IN ('approved','taken') AND EXTRACT(YEAR FROM l.from_date) = y), 0), 0)
  FROM types tp;
END $$;

-- Trigger: sync hr_leave_balances on approval/cancellation & enforce balance
CREATE OR REPLACE FUNCTION public.hr_leaves_balance_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer;
  v_entitled numeric;
  v_remaining numeric;
BEGIN
  v_year := EXTRACT(YEAR FROM NEW.from_date)::int;
  v_entitled := public.hr_calc_leave_entitlement(NEW.employee_id, NEW.leave_type::text, v_year);

  -- Block approval if insufficient balance (except unpaid/compensatory)
  IF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status <> 'approved'
     AND NEW.leave_type::text NOT IN ('unpaid','compensatory') THEN
    SELECT remaining INTO v_remaining
      FROM public.hr_get_leave_summary(NEW.employee_id, v_year)
      WHERE leave_type = NEW.leave_type::text;
    IF v_remaining < NEW.days_count THEN
      RAISE EXCEPTION 'رصيد إجازة % غير كافٍ (المتاح: %، المطلوب: %)',
        NEW.leave_type, v_remaining, NEW.days_count;
    END IF;
  END IF;

  -- Upsert balance row
  INSERT INTO public.hr_leave_balances (employee_id, leave_type, year, entitled_days, used_days, balance_days)
  VALUES (NEW.employee_id, NEW.leave_type, v_year, v_entitled, 0, v_entitled)
  ON CONFLICT DO NOTHING;

  -- Recompute used & balance from source of truth
  UPDATE public.hr_leave_balances b SET
    entitled_days = v_entitled,
    used_days = COALESCE((SELECT SUM(days_count) FROM public.hr_leaves
                          WHERE employee_id = NEW.employee_id
                            AND leave_type = NEW.leave_type
                            AND status IN ('approved','taken')
                            AND EXTRACT(YEAR FROM from_date) = v_year), 0),
    balance_days = GREATEST(v_entitled - COALESCE((SELECT SUM(days_count) FROM public.hr_leaves
                          WHERE employee_id = NEW.employee_id
                            AND leave_type = NEW.leave_type
                            AND status IN ('approved','taken')
                            AND EXTRACT(YEAR FROM from_date) = v_year), 0), 0),
    updated_at = now()
  WHERE b.employee_id = NEW.employee_id AND b.leave_type = NEW.leave_type AND b.year = v_year;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_hr_leaves_balance_sync ON public.hr_leaves;
CREATE TRIGGER trg_hr_leaves_balance_sync
AFTER INSERT OR UPDATE OF status ON public.hr_leaves
FOR EACH ROW EXECUTE FUNCTION public.hr_leaves_balance_sync();

-- Unique constraint required for upsert semantics
CREATE UNIQUE INDEX IF NOT EXISTS hr_leave_balances_unique
  ON public.hr_leave_balances (employee_id, leave_type, year);
