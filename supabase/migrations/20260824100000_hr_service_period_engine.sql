-- Effective-service engine for settlements and other tenure-based HR rules.
-- Saudi Labor Law article 116 suspends the employment contract for the part
-- of unpaid leave exceeding twenty days in a service year unless the parties
-- agree otherwise.  Keep exceptional/manual exclusions explicit and audited
-- instead of overloading the last-pay-period unpaid-days field.

CREATE TABLE public.hr_service_interruptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT NOT NULL,
  legal_basis TEXT,
  exclude_from_service BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (to_date >= from_date)
);

ALTER TABLE public.hr_terminations
  ADD COLUMN IF NOT EXISTS calendar_service_days INTEGER,
  ADD COLUMN IF NOT EXISTS excluded_service_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS effective_service_days INTEGER;

COMMENT ON COLUMN public.hr_terminations.calendar_service_days IS
  'Snapshot of elapsed calendar days from hire date through the settlement last-working date.';
COMMENT ON COLUMN public.hr_terminations.excluded_service_days IS
  'Snapshot of unioned contract-suspension days excluded by the service-period engine.';
COMMENT ON COLUMN public.hr_terminations.effective_service_days IS
  'Snapshot of service days used to calculate tenure-based settlement entitlements.';

CREATE INDEX idx_hr_service_interruptions_employee_dates
  ON public.hr_service_interruptions(employee_id, from_date, to_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_service_interruptions TO authenticated;
GRANT ALL ON public.hr_service_interruptions TO service_role;
ALTER TABLE public.hr_service_interruptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY hr_service_interruptions_read
  ON public.hr_service_interruptions FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), 'hr.termination', 'view')
    OR public.has_permission(auth.uid(), 'hr.employees', 'view')
    OR public.is_admin(auth.uid())
  );

CREATE POLICY hr_service_interruptions_write
  ON public.hr_service_interruptions FOR ALL TO authenticated
  USING (
    public.has_permission(auth.uid(), 'hr.termination', 'edit')
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    public.has_permission(auth.uid(), 'hr.termination', 'edit')
    OR public.is_admin(auth.uid())
  );

CREATE TRIGGER trg_hr_service_interruptions_updated
BEFORE UPDATE ON public.hr_service_interruptions
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE OR REPLACE FUNCTION public.hr_calculate_service_period(
  _employee_id UUID,
  _as_of DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hire DATE;
  v_calendar_days INTEGER;
  v_excluded_days INTEGER;
  v_effective_days INTEGER;
  v_manual_days INTEGER;
  v_unpaid_days INTEGER;
  v_details JSONB;
BEGIN
  IF NOT (
    public.has_permission(auth.uid(), 'hr.termination', 'view')
    OR public.has_permission(auth.uid(), 'hr.employees', 'view')
    OR public.is_admin(auth.uid())
    OR auth.role() = 'service_role'
  ) THEN
    RAISE EXCEPTION 'Insufficient permission to calculate employee service period';
  END IF;

  SELECT hire_date INTO v_hire
  FROM public.hr_employees
  WHERE id = _employee_id;

  IF v_hire IS NULL THEN
    RETURN jsonb_build_object(
      'hire_date', v_hire,
      'as_of', _as_of,
      'calendar_days', 0,
      'excluded_days', 0,
      'effective_days', 0,
      'effective_years', 0,
      'details', '[]'::JSONB
    );
  END IF;
  IF _as_of < v_hire THEN
    RAISE EXCEPTION 'Service calculation date cannot precede hire date';
  END IF;

  v_calendar_days := _as_of - v_hire;

  WITH RECURSIVE
  unpaid_calendar_days AS (
    SELECT DISTINCT gs::DATE AS day
    FROM public.hr_leaves l
    CROSS JOIN LATERAL generate_series(
      GREATEST(l.from_date, v_hire),
      LEAST(l.to_date, _as_of),
      INTERVAL '1 day'
    ) gs
    WHERE l.employee_id = _employee_id
      AND l.leave_type = 'unpaid'
      AND l.status IN ('approved', 'taken')
      AND l.to_date >= v_hire
      AND l.from_date <= _as_of
  ),
  ranked_unpaid_days AS (
    SELECT day,
      ROW_NUMBER() OVER (
        PARTITION BY EXTRACT(YEAR FROM age(day, v_hire))::INTEGER
        ORDER BY day
      ) AS unpaid_day_in_service_year
    FROM unpaid_calendar_days
  ),
  statutory_exclusions AS (
    SELECT day, 'unpaid_leave_over_20_days'::TEXT AS source
    FROM ranked_unpaid_days
    WHERE unpaid_day_in_service_year > 20
  ),
  manual_exclusions AS (
    SELECT DISTINCT gs::DATE AS day, 'manual_interruption'::TEXT AS source
    FROM public.hr_service_interruptions i
    CROSS JOIN LATERAL generate_series(
      GREATEST(i.from_date, v_hire),
      LEAST(i.to_date, _as_of),
      INTERVAL '1 day'
    ) gs
    WHERE i.employee_id = _employee_id
      AND i.exclude_from_service
      AND i.to_date >= v_hire
      AND i.from_date <= _as_of
  ),
  exclusions AS (
    SELECT day, source FROM statutory_exclusions
    UNION
    SELECT day, source FROM manual_exclusions
  ),
  unique_exclusions AS (
    SELECT DISTINCT day FROM exclusions
  )
  SELECT
    (SELECT COUNT(*) FROM unique_exclusions),
    (SELECT COUNT(DISTINCT day) FROM manual_exclusions),
    (SELECT COUNT(DISTINCT day) FROM statutory_exclusions)
  INTO v_excluded_days, v_manual_days, v_unpaid_days;

  v_effective_days := GREATEST(v_calendar_days - COALESCE(v_excluded_days, 0), 0);

  SELECT COALESCE(jsonb_agg(detail ORDER BY detail->>'from_date'), '[]'::JSONB)
  INTO v_details
  FROM (
    SELECT jsonb_build_object(
      'source', 'manual_interruption',
      'id', i.id,
      'from_date', GREATEST(i.from_date, v_hire),
      'to_date', LEAST(i.to_date, _as_of),
      'reason', i.reason,
      'legal_basis', i.legal_basis
    ) AS detail
    FROM public.hr_service_interruptions i
    WHERE i.employee_id = _employee_id
      AND i.exclude_from_service
      AND i.to_date >= v_hire
      AND i.from_date <= _as_of
  ) rows;

  RETURN jsonb_build_object(
    'hire_date', v_hire,
    'as_of', _as_of,
    'calendar_days', v_calendar_days,
    'excluded_days', COALESCE(v_excluded_days, 0),
    'manual_excluded_days', COALESCE(v_manual_days, 0),
    'statutory_unpaid_excluded_days', COALESCE(v_unpaid_days, 0),
    'effective_days', v_effective_days,
    'effective_years', ROUND(v_effective_days / 365.25, 6),
    'details', v_details
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hr_calculate_service_period(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_calculate_service_period(UUID, DATE) TO authenticated, service_role;

COMMENT ON FUNCTION public.hr_calculate_service_period(UUID, DATE) IS
  'Returns calendar, excluded, and effective service. Approved unpaid leave excludes only days beyond day 20 in each employee service year; explicit interruptions are unioned without double-counting.';
