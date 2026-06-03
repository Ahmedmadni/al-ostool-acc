
REVOKE EXECUTE ON FUNCTION public.user_has_any_role(uuid, text[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_read_business(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_write_finance(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_write_operations(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_delete_master(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.user_has_any_role(uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_business(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_finance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_operations(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_delete_master(uuid) TO authenticated, service_role;
