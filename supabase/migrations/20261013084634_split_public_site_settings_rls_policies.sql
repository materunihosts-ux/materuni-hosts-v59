
DROP POLICY IF EXISTS "Public can read approved public site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Authenticated can read approved public site settings or admin" ON public.site_settings;

CREATE POLICY "Public can read approved public site settings"
ON public.site_settings
FOR SELECT
TO anon
USING (
  setting_key = ANY (ARRAY[
    'faq_items'::text,
    'approach_content'::text,
    'language_content'::text,
    'instagram_url'::text,
    'facebook_url'::text,
    'tripadvisor_url'::text,
    'google_review_url'::text,
    'landing_pages_content'::text,
    'experience_shared_inclusions'::text
  ])
);

CREATE POLICY "Authenticated can read approved public site settings or admin"
ON public.site_settings
FOR SELECT
TO authenticated
USING (
  setting_key = ANY (ARRAY[
    'faq_items'::text,
    'approach_content'::text,
    'language_content'::text,
    'instagram_url'::text,
    'facebook_url'::text,
    'tripadvisor_url'::text,
    'google_review_url'::text,
    'landing_pages_content'::text,
    'experience_shared_inclusions'::text
  ])
  OR (SELECT public.is_materuni_admin())
);
