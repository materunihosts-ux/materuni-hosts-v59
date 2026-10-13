alter table public.experience_catalog add column if not exists product_tagline text, add column if not exists best_for text, add column if not exists signature_moments jsonb not null default '[]'::jsonb, add column if not exists unique_amenities jsonb not null default '[]'::jsonb;

alter table public.experience_catalog add constraint experience_catalog_signature_moments_array check (jsonb_typeof(signature_moments) = 'array') not valid;
alter table public.experience_catalog add constraint experience_catalog_unique_amenities_array check (jsonb_typeof(unique_amenities) = 'array') not valid;

alter table public.experience_catalog validate constraint experience_catalog_signature_moments_array;
alter table public.experience_catalog validate constraint experience_catalog_unique_amenities_array;

drop policy if exists "Public can read approved public site settings" on public.site_settings;
create policy "Public can read approved public site settings" on public.site_settings for select to anon, authenticated using (setting_key = any (array['faq_items','approach_content','language_content','instagram_url','facebook_url','tripadvisor_url','google_review_url','landing_pages_content','experience_shared_inclusions']::text[]) or exists (select 1 from public.admin_users au where au.user_id = (select auth.uid())));