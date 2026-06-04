
CREATE OR REPLACE FUNCTION public.can_read_sensitive_finance(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.user_has_any_role(_user_id, ARRAY['admin','cfo','finance_manager','chief_accountant','accountant','auditor'])
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bank_statements','aging_buckets','customer_balances','payments']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS rbac_read ON public.%I', t);
    EXECUTE format('CREATE POLICY rbac_read ON public.%I FOR SELECT TO authenticated USING (public.can_read_sensitive_finance(auth.uid()))', t);
  END LOOP;
END $$;
