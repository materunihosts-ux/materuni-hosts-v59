grant execute on function public.is_materuni_admin() to anon;

alter policy "Public can read approved public site settings"
  on public.site_settings
  using (
    setting_key = any (array[
      'faq_items'::text,
      'approach_content'::text,
      'language_content'::text,
      'instagram_url'::text,
      'facebook_url'::text,
      'tripadvisor_url'::text,
      'google_review_url'::text,
      'landing_pages_content'::text
    ])
    or (select public.is_materuni_admin())
  );
