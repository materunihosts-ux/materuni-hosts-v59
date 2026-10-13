-- RLS policies for public catalogue and availability invoke this helper.
-- It is SECURITY DEFINER and only returns whether auth.uid() is in admin_users.
-- Granting EXECUTE lets anon evaluate the public SELECT policy safely.
GRANT EXECUTE ON FUNCTION public.is_materuni_admin() TO anon, authenticated;
