create table if not exists public.site_settings (
  setting_key text primary key,
  setting_value text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "Public can read social links" on public.site_settings;
create policy "Public can read social links" on public.site_settings
for select to anon, authenticated
using (setting_key in ('instagram_url','facebook_url','tripadvisor_url','google_review_url'));
drop policy if exists "Admins can manage site settings" on public.site_settings;
create policy "Admins can manage site settings" on public.site_settings
for all to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;
insert into public.site_settings(setting_key,setting_value) values
('instagram_url','https://www.instagram.com/REPLACE_MATERUNI_HOSTS'),
('facebook_url','https://www.facebook.com/REPLACE_MATERUNI_HOSTS'),
('tripadvisor_url','https://www.tripadvisor.com/REPLACE_MATERUNI_HOSTS'),
('google_review_url','https://g.page/r/REPLACE_WITH_MATERUNI_HOSTS_REVIEW')
on conflict (setting_key) do nothing;