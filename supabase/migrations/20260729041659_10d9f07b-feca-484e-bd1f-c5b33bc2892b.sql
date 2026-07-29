-- C3: bulk leave-balance report across all active employees for a given
-- leave type/year — reuses hr_calc_leave_entitlement (same source hr_get_leave_summary
-- already relies on per-employee) instead of N+1 client-side RPC calls.
CREATE OR REPLACE FUNCTION public.hr_leave_balance_report(_year INTEGER DEFAULT NULL, _leave_type TEXT DEFAULT 'annual')
RETURNS TABLE(employee_id UUID, employee_no TEXT, full_name_ar TEXT, department_id TEXT, entitled NUMERIC, used NUMERIC, pending NUMERIC, remaining NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE y INTEGER := COALESCE(_year, EXTRACT(YEAR FROM CURRENT_DATE)::int);
BEGIN
  RETURN QUERY
  SELECT
    e.id, e.employee_no, e.full_name_ar, e.department_id,
    public.hr_calc_leave_entitlement(e.id, _leave_type, y),
    COALESCE((SELECT SUM(l.days_count) FROM public.hr_leaves l
              WHERE l.employee_id = e.id AND l.leave_type::text = _leave_type
                AND l.status IN ('approved','taken') AND EXTRACT(YEAR FROM l.from_date) = y), 0),
    COALESCE((SELECT SUM(l.days_count) FROM public.hr_leaves l
              WHERE l.employee_id = e.id AND l.leave_type::text = _leave_type
                AND l.status = 'pending' AND EXTRACT(YEAR FROM l.from_date) = y), 0),
    GREATEST(public.hr_calc_leave_entitlement(e.id, _leave_type, y)
      - COALESCE((SELECT SUM(l.days_count) FROM public.hr_leaves l
                  WHERE l.employee_id = e.id AND l.leave_type::text = _leave_type
                    AND l.status IN ('approved','taken') AND EXTRACT(YEAR FROM l.from_date) = y), 0), 0)
  FROM public.hr_employees e
  WHERE e.status = 'active'
  ORDER BY e.full_name_ar;
END $$;

GRANT EXECUTE ON FUNCTION public.hr_leave_balance_report(INTEGER, TEXT) TO authenticated;
