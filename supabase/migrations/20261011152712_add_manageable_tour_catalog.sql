create table if not exists public.experience_catalog (
  id uuid primary key default gen_random_uuid(),
  experience_key text not null unique,
  display_name text not null,
  price_usd numeric(10,2) not null default 0 check (price_usd >= 0),
  short_description text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.experience_catalog enable row level security;

drop policy if exists "Public can view active experiences" on public.experience_catalog;
create policy "Public can view active experiences"
on public.experience_catalog for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Admins can manage experiences" on public.experience_catalog;
create policy "Admins can manage experiences"
on public.experience_catalog for all
to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid())));

insert into public.experience_catalog (experience_key,display_name,price_usd,sort_order)
values
('Waterfall & Chagga Culture','Waterfalls & Coffee Tour',65,10),
('Traditional Coffee Experience','Coffee & Chagga Culture Tour',50,20),
('Traditional Chagga Cooking Class','Cooking & Culture',70,30),
('Materuni Waterfall Hike & Cultural Day Trip','Waterfall Hike & Cultural Day Trip',75,40),
('Camping & Village Life','Overnight Camping',110,50),
('The Ultimate Kilimanjaro Foothills & Materuni Experience','Ultimate',135,60)
on conflict (experience_key) do update set
 display_name=excluded.display_name,
 price_usd=excluded.price_usd,
 sort_order=excluded.sort_order,
 updated_at=now();

grant select on public.experience_catalog to anon, authenticated;
grant insert, update, delete on public.experience_catalog to authenticated;