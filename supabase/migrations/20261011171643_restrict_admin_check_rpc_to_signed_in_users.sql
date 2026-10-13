REVOKE EXECUTE ON FUNCTION public.is_materuni_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_materuni_admin() TO authenticated, service_role;