-- Phase D1: versioned Saudi leave rules and server-authoritative requests.
-- Rules are dated so a future regulatory change does not rewrite historical
-- entitlements.  Event leave is validated per request rather than pretending
-- to be a renewable annual balance.

ALTER TYPE public.hr_leave_type ADD VALUE IF NOT EXISTS 'marriage';
ALTER TYPE public.hr_leave_type ADD VALUE IF NOT EXISTS 'bereavement';
ALTER TYPE public.hr_leave_type ADD VALUE IF NOT EXISTS 'sibling_bereavement';

CREATE TABLE public.hr_leave_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_type TEXT NOT NULL,
  label_ar TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  entitlement_days NUMERIC(6,2),
  max_request_days NUMERIC(6,2),
  balance_mode TEXT NOT NULL CHECK (balance_mode IN ('annual', 'rolling_year', 'per_event', 'uncapped')),
  gender_restriction TEXT CHECK (gender_restriction IN ('female', 'male')),
  minimum_service_days INTEGER NOT NULL DEFAULT 0,
  pay_schedule JSONB NOT NULL DEFAULT '[]'::JSONB,
  legal_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (leave_type, effective_from)
);

CREATE INDEX idx_hr_leave_rules_effective
  ON public.hr_leave_rules(leave_type, effective_from DESC);

ALTER TABLE public.hr_leave_rules ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.hr_leave_rules TO authenticated;
GRANT ALL ON public.hr_leave_rules TO service_role;

CREATE POLICY hr_leave_rules_read ON public.hr_leave_rules
FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), 'hr.leaves', 'view')
  OR public.is_admin(auth.uid())
);

INSERT INTO public.hr_leave_rules (
  leave_type, label_ar, effective_from, effective_to, entitlement_days,
  max_request_days, balance_mode, gender_restriction,
  minimum_service_days, pay_schedule, legal_reference, notes
) VALUES
  ('annual', 'سنوية', '2005-09-27', NULL, 21, NULL, 'annual', NULL, 0,
    '[{"from":1,"to":21,"pay_percent":100}]', 'نظام العمل - المادة 109', 'يرتفع الاستحقاق إلى 30 يوماً بعد خمس سنوات متصلة'),
  ('sick', 'مرضية', '2005-09-27', NULL, 120, 120, 'rolling_year', NULL, 0,
    '[{"from":1,"to":30,"pay_percent":100},{"from":31,"to":90,"pay_percent":75},{"from":91,"to":120,"pay_percent":0}]', 'نظام العمل - المادة 117', NULL),
  ('maternity', 'وضع', '2005-09-27', '2025-02-18', 70, 70, 'per_event', 'female', 0,
    '[{"from":1,"to":70,"pay_percent":100}]', 'نظام العمل - المادة 151 قبل تعديل 2025', NULL),
  ('maternity', 'وضع', '2025-02-19', NULL, 84, 84, 'per_event', 'female', 0,
    '[{"from":1,"to":84,"pay_percent":100}]', 'نظام العمل - المادة 151 المعدلة', 'اثنا عشر أسبوعاً بأجر كامل'),
  ('paternity', 'مولود', '2005-09-27', NULL, 3, 3, 'per_event', 'male', 0,
    '[{"from":1,"to":3,"pay_percent":100}]', 'نظام العمل - المادة 113', NULL),
  ('marriage', 'زواج', '2005-09-27', NULL, 5, 5, 'per_event', NULL, 0,
    '[{"from":1,"to":5,"pay_percent":100}]', 'نظام العمل - المادة 113', NULL),
  ('bereavement', 'وفاة زوج أو أصل أو فرع', '2005-09-27', NULL, 5, 5, 'per_event', NULL, 0,
    '[{"from":1,"to":5,"pay_percent":100}]', 'نظام العمل - المادة 113', NULL),
  ('sibling_bereavement', 'وفاة أخ أو أخت', '2025-02-19', NULL, 3, 3, 'per_event', NULL, 0,
    '[{"from":1,"to":3,"pay_percent":100}]', 'نظام العمل - المادة 113 المعدلة', NULL),
  ('hajj', 'حج', '2005-09-27', NULL, 15, 15, 'per_event', NULL, 730,
    '[{"from":1,"to":15,"pay_percent":100}]', 'نظام العمل - المادة 114', 'مرة واحدة طوال الخدمة، من 10 إلى 15 يوماً'),
  ('emergency', 'اضطرارية - سياسة منشأة', '2005-09-27', NULL, 5, 5, 'annual', NULL, 0,
    '[{"from":1,"to":5,"pay_percent":100}]', NULL, 'ليست بديلاً عن إجازات المناسبات النظامية'),
  ('study', 'اختبارات دراسية', '2005-09-27', NULL, NULL, NULL, 'per_event', NULL, 0,
    '[]', 'نظام العمل - المواد 115 و116', 'بحسب أيام الاختبار الفعلية وشروط النظام'),
  ('unpaid', 'بدون أجر', '2005-09-27', NULL, NULL, NULL, 'uncapped', NULL, 0,
    '[{"from":1,"to":null,"pay_percent":0}]', 'نظام العمل - المادة 116', NULL),
  ('compensatory', 'تعويضية', '2005-09-27', NULL, NULL, NULL, 'uncapped', NULL, 0,
    '[]', NULL, 'وفق رصيد التعويض المعتمد')
ON CONFLICT (leave_type, effective_from) DO UPDATE SET
  label_ar = EXCLUDED.label_ar,
  effective_to = EXCLUDED.effective_to,
  entitlement_days = EXCLUDED.entitlement_days,
  max_request_days = EXCLUDED.max_request_days,
  balance_mode = EXCLUDED.balance_mode,
  gender_restriction = EXCLUDED.gender_restriction,
  minimum_service_days = EXCLUDED.minimum_service_days,
  pay_schedule = EXCLUDED.pay_schedule,
  legal_reference = EXCLUDED.legal_reference,
  notes = EXCLUDED.notes;

CREATE OR REPLACE FUNCTION public.hr_leave_rule(_leave_type TEXT, _as_of DATE DEFAULT CURRENT_DATE)
RETURNS public.hr_leave_rules
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.*
  FROM public.hr_leave_rules r
  WHERE r.leave_type = _leave_type
    AND r.effective_from <= _as_of
    AND (r.effective_to IS NULL OR r.effective_to >= _as_of)
  ORDER BY r.effective_from DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.hr_calc_leave_entitlement(
  _employee_id UUID,
  _leave_type TEXT,
  _year INTEGER DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hire DATE;
  v_contract_annual NUMERIC;
  v_opening NUMERIC;
  v_year INTEGER := COALESCE(_year, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
  v_as_of DATE;
  v_service_years NUMERIC;
  v_rule public.hr_leave_rules;
  v_base NUMERIC;
  v_adjustment NUMERIC;
BEGIN
  SELECT hire_date, annual_leave_days, COALESCE(opening_leave_balance_days, 0)
  INTO v_hire, v_contract_annual, v_opening
  FROM public.hr_employees
  WHERE id = _employee_id;
  IF v_hire IS NULL THEN RETURN 0; END IF;

  v_as_of := LEAST(make_date(v_year, 12, 31), CURRENT_DATE);
  v_service_years := GREATEST(v_as_of - v_hire, 0) / 365.25;
  SELECT * INTO v_rule FROM public.hr_leave_rule(_leave_type, v_as_of);

  IF _leave_type = 'annual' THEN
    v_base := COALESCE(v_contract_annual, CASE WHEN v_service_years >= 5 THEN 30 ELSE 21 END);
    IF v_year = EXTRACT(YEAR FROM v_hire)::INTEGER THEN v_base := v_base + v_opening; END IF;
  ELSE
    v_base := COALESCE(v_rule.entitlement_days, 0);
  END IF;

  SELECT COALESCE(SUM(days), 0) INTO v_adjustment
  FROM public.hr_leave_adjustments
  WHERE employee_id = _employee_id AND leave_type::TEXT = _leave_type AND year = v_year;

  RETURN v_base + v_adjustment;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_leave_validate_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule public.hr_leave_rules;
  v_hire DATE;
  v_gender TEXT;
  v_overlap BOOLEAN;
  v_prior_hajj INTEGER;
BEGIN
  IF NEW.to_date < NEW.from_date THEN RAISE EXCEPTION 'تاريخ نهاية الإجازة يسبق بدايتها'; END IF;
  NEW.days_count := NEW.to_date - NEW.from_date + 1;

  SELECT hire_date, LOWER(COALESCE(gender, '')) INTO v_hire, v_gender
  FROM public.hr_employees WHERE id = NEW.employee_id;
  IF v_hire IS NULL OR NEW.from_date < v_hire THEN RAISE EXCEPTION 'تاريخ الإجازة يسبق تاريخ التعيين'; END IF;

  SELECT * INTO v_rule FROM public.hr_leave_rule(NEW.leave_type::TEXT, NEW.from_date);
  IF v_rule.id IS NOT NULL THEN
    IF v_rule.max_request_days IS NOT NULL AND NEW.days_count > v_rule.max_request_days THEN
      RAISE EXCEPTION 'مدة الطلب (%) تتجاوز الحد النظامي لهذا النوع (%)', NEW.days_count, v_rule.max_request_days;
    END IF;
    IF (NEW.from_date - v_hire) < v_rule.minimum_service_days THEN
      RAISE EXCEPTION 'لم تكتمل مدة الخدمة الدنيا المطلوبة لهذا النوع من الإجازة';
    END IF;
    IF v_rule.gender_restriction = 'female' AND v_gender NOT IN ('female', 'f', 'أنثى') THEN
      RAISE EXCEPTION 'إجازة الوضع متاحة للموظفات فقط';
    END IF;
    IF v_rule.gender_restriction = 'male' AND v_gender NOT IN ('male', 'm', 'ذكر') THEN
      RAISE EXCEPTION 'إجازة المولود متاحة للموظفين الذكور فقط';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.hr_leaves l
    WHERE l.employee_id = NEW.employee_id
      AND l.id <> NEW.id
      AND l.status IN ('pending', 'approved', 'taken')
      AND daterange(l.from_date, l.to_date, '[]') && daterange(NEW.from_date, NEW.to_date, '[]')
  ) INTO v_overlap;
  IF v_overlap THEN RAISE EXCEPTION 'توجد إجازة أخرى متداخلة للموظف في هذه الفترة'; END IF;

  IF NEW.leave_type::TEXT = 'hajj' THEN
    SELECT COUNT(*) INTO v_prior_hajj FROM public.hr_leaves
    WHERE employee_id = NEW.employee_id AND leave_type::TEXT = 'hajj'
      AND status IN ('approved', 'taken') AND id <> NEW.id;
    IF v_prior_hajj > 0 THEN RAISE EXCEPTION 'إجازة الحج تمنح مرة واحدة طوال الخدمة'; END IF;
    IF NEW.days_count < 10 THEN RAISE EXCEPTION 'إجازة الحج لا تقل عن عشرة أيام'; END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_leave_validate_request ON public.hr_leaves;
CREATE TRIGGER trg_hr_leave_validate_request
BEFORE INSERT OR UPDATE OF employee_id, leave_type, from_date, to_date, status
ON public.hr_leaves
FOR EACH ROW EXECUTE FUNCTION public.hr_leave_validate_request();

CREATE OR REPLACE FUNCTION public.hr_leave_guard_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('approved', 'rejected')
     AND NOT (
       public.has_permission(auth.uid(), 'hr.leaves', 'approve')
       OR public.is_admin(auth.uid())
     ) THEN
    RAISE EXCEPTION 'اعتماد أو رفض الإجازة يتطلب صلاحية hr.leaves:approve';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_leave_guard_decision ON public.hr_leaves;
CREATE TRIGGER trg_hr_leave_guard_decision
BEFORE UPDATE OF status ON public.hr_leaves
FOR EACH ROW EXECUTE FUNCTION public.hr_leave_guard_decision();

CREATE OR REPLACE FUNCTION public.hr_leave_decide(_leave_id UUID, _approved BOOLEAN)
RETURNS public.hr_leaves
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.hr_leaves;
BEGIN
  IF NOT (public.has_permission(auth.uid(), 'hr.leaves', 'approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية اعتماد أو رفض الإجازات';
  END IF;

  SELECT * INTO v_row FROM public.hr_leaves WHERE id = _leave_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'طلب الإجازة غير موجود'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'طلب الإجازة ليس قيد الاعتماد'; END IF;

  UPDATE public.hr_leaves
  SET status = CASE WHEN _approved THEN 'approved'::public.hr_leave_status ELSE 'rejected'::public.hr_leave_status END,
      approved_by = auth.uid(), approved_at = now()
  WHERE id = _leave_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_leave_rule(TEXT, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_leave_decide(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_leave_rule(TEXT, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hr_leave_decide(UUID, BOOLEAN) TO authenticated;
