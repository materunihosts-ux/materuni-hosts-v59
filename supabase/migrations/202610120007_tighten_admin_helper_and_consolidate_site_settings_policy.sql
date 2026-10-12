-- Least-privilege access for the admin helper and consolidate duplicate public SELECT policies.
REVOKE ALL ON FUNCTION public.is_materuni_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_materuni_admin() TO authenticated;

DROP POLICY IF EXISTS "Public can read published public content settings" ON public.site_settings;
DROP POLICY IF EXISTS "Read social settings or admin" ON public.site_settings;

CREATE POLICY "Public can read approved public site settings"
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (
  setting_key = ANY (ARRAY[
    'faq_items'::text,
    'approach_content'::text,
    'language_content'::text,
    'instagram_url'::text,
    'facebook_url'::text,
    'tripadvisor_url'::text,
    'google_review_url'::text
  ])
  OR EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = (SELECT auth.uid())
  )
);
