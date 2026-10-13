create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  email text,
  whatsapp text,
  partner_type text not null default 'accommodation' check (partner_type in ('accommodation','local_guide','transport','travel_agency','activity_provider','other')),
  location text,
  website text,
  status text not null default 'lead' check (status in ('lead','active','paused','archived')),
  commission_rate numeric(5,2) check (commission_rate is null or (commission_rate >= 0 and commission_rate <= 100)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.partners enable row level security;
create index if not exists partners_status_idx on public.partners(status);
create index if not exists partners_business_name_idx on public.partners using gin (to_tsvector('simple', business_name));
create policy "Admins can view partners" on public.partners for select to authenticated using ((select public.is_materuni_admin()));
create policy "Admins can add partners" on public.partners for insert to authenticated with check ((select public.is_materuni_admin()));
create policy "Admins can update partners" on public.partners for update to authenticated using ((select public.is_materuni_admin())) with check ((select public.is_materuni_admin()));
create policy "Admins can delete partners" on public.partners for delete to authenticated using ((select public.is_materuni_admin()));
grant select, insert, update, delete on public.partners to authenticated;
