-- H1: termination reasons were generic labels (resignation/dismissal/other)
-- with no link to the specific Labor Law cases that change what's owed:
--   - Article 53 probation-period termination: either party may end the
--     contract without notice/compensation obligations.
--   - Article 77 arbitrary dismissal: an employer terminating without a
--     legitimate cause owes the employee compensation — either the
--     contract's stipulated penalty clause or, for a fixed-term contract,
--     the remaining contract value.
--   - Articles 74/75 mirror case: an employee leaving without a legitimate
--     cause/notice owes the company the same kind of compensation.
-- Add these as first-class reasons so the settlement math and the printed
-- document reflect which legal case actually applies, instead of every
-- dismissal looking identical regardless of cause.
ALTER TYPE public.hr_termination_reason ADD VALUE IF NOT EXISTS 'probation';
ALTER TYPE public.hr_termination_reason ADD VALUE IF NOT EXISTS 'arbitrary_dismissal';
ALTER TYPE public.hr_termination_reason ADD VALUE IF NOT EXISTS 'unlawful_resignation';

-- The penalty clause (الشرط الجزائي), when a contract specifies one, is
-- the first source the settlement calculator checks for Article 77
-- compensation before falling back to the remaining contract value or a
-- manual figure. Stored on the employee record per the same convention as
-- annual_leave_days (a contractual override kept with the employee's file).
ALTER TABLE public.hr_employees ADD COLUMN IF NOT EXISTS penalty_clause_amount NUMERIC(14,2) DEFAULT 0;

COMMENT ON COLUMN public.hr_employees.penalty_clause_amount IS
  'الشرط الجزائي المنصوص عليه في عقد الموظف — يُستخدم كقيمة مقترحة لتعويض المادة 77 (فصل تعسفي/ترك عمل غير مشروع) عند إنهاء الخدمة.';

-- Keep the SQL mirror of calcEndOfService (src/lib/hr-calculations.ts) in
-- sync: unlawful_resignation is a resignation in substance and gets the
-- same reduced-factor schedule.
CREATE OR REPLACE FUNCTION public.hr_calc_end_of_service(_monthly_wage NUMERIC, _service_years NUMERIC, _reason TEXT)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE first5 NUMERIC; rest NUMERIC; base NUMERIC; factor NUMERIC := 1.0;
BEGIN
  IF _monthly_wage IS NULL OR _service_years IS NULL OR _service_years <= 0 THEN RETURN 0; END IF;
  first5 := LEAST(_service_years, 5) * (_monthly_wage / 2);
  rest := GREATEST(_service_years - 5, 0) * _monthly_wage;
  base := first5 + rest;
  IF _reason IN ('resignation', 'unlawful_resignation') THEN
    IF _service_years < 2 THEN factor := 0;
    ELSIF _service_years < 5 THEN factor := 1.0/3.0;
    ELSIF _service_years < 10 THEN factor := 2.0/3.0;
    ELSE factor := 1.0; END IF;
  END IF;
  RETURN ROUND(base * factor, 2);
END $$;
