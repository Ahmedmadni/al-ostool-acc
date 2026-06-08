DROP POLICY IF EXISTS "users view own profile" ON public.profiles;
CREATE POLICY "authenticated can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);