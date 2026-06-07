
CREATE OR REPLACE FUNCTION public.get_email_by_employee_id(_employee_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE employee_id = _employee_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_employee_id(text) TO anon, authenticated;
