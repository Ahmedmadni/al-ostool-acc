-- Grant elmadnim@gmail.com (employee #650, أحمد المدني) the admin role.
-- is_admin() checks user_roles for role='admin', and both the client-side
-- can() gate and every has_permission()-backed RLS policy (HR, fleet.*,
-- inventory.*) short-circuit to true for admins — so this alone grants
-- full access app-wide without needing per-module grants.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'elmadnim@gmail.com'
ON CONFLICT DO NOTHING;
