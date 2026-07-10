-- H9: hr_calc_gosi computed contributions on the raw gross wage with no ceiling
-- or floor, overstating both the employee deduction and employer cost for any
-- Saudi employee earning above the GOSI Annuities-branch contributory wage cap
-- (SAR 45,000/month) — and understating it for wages below the SAR 1,500 floor.
-- Mirrors the same cap now applied in src/lib/hr-calculations.ts::calcGosi.
CREATE OR REPLACE FUNCTION public.hr_calc_gosi(_gross_wage NUMERIC, _is_saudi BOOLEAN)
RETURNS TABLE(employee_share NUMERIC, employer_share NUMERIC)
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT
    CASE WHEN _gross_wage <= 0 THEN 0
         WHEN _is_saudi THEN ROUND(LEAST(GREATEST(_gross_wage, 1500), 45000) * 0.0975, 2)
         ELSE 0 END,
    CASE WHEN _gross_wage <= 0 THEN 0
         WHEN _is_saudi THEN ROUND(LEAST(GREATEST(_gross_wage, 1500), 45000) * 0.1175, 2)
         ELSE ROUND(LEAST(_gross_wage, 45000) * 0.02, 2) END
$$;
