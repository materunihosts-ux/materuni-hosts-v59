-- Restrict anonymous API privileges to the public read surface only.
-- Row-level security still limits which site_settings rows can be selected.
REVOKE ALL PRIVILEGES ON TABLE public.admin_users FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.site_settings FROM anon;
GRANT SELECT ON TABLE public.site_settings TO anon;
