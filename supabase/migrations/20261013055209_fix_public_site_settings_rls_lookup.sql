revoke execute on function public.is_materuni_admin() from anon;

grant select on public.admin_users to anon;

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
    or exists (
      select 1 from public.admin_users au
      where au.user_id = (select auth.uid())
    )
  );
