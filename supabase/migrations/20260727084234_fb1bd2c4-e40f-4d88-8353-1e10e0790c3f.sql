
-- 1) Add new allowance / financial fields for richer employee cost profile
ALTER TABLE public.hr_employees
  ADD COLUMN IF NOT EXISTS food_allowance numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meal_allowance numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS environment_allowance numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eos_reserved_balance numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS years_of_service_snapshot numeric(6,2);

-- 2) Rebuild gross_salary generated column to include the new allowances
ALTER TABLE public.hr_employees DROP COLUMN IF EXISTS gross_salary;
ALTER TABLE public.hr_employees
  ADD COLUMN gross_salary numeric(14,2)
  GENERATED ALWAYS AS (
    COALESCE(basic_salary,0)
    + COALESCE(housing_allowance,0)
    + COALESCE(transport_allowance,0)
    + COALESCE(other_allowances,0)
    + COALESCE(food_allowance,0)
    + COALESCE(meal_allowance,0)
    + COALESCE(environment_allowance,0)
    + COALESCE(commission,0)
  ) STORED;

-- 3) Employee number must be unique per company (same number may exist across subsidiaries)
ALTER TABLE public.hr_employees DROP CONSTRAINT IF EXISTS hr_employees_employee_no_key;
CREATE UNIQUE INDEX IF NOT EXISTS hr_employees_company_no_uniq
  ON public.hr_employees (company_id, employee_no);
