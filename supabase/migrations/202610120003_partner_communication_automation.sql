-- Partner and guest communication delivery audit trail.
create table if not exists public.communication_logs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partners(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  recipient text not null,
  channel text not null check (channel in ('email','whatsapp')),
  communication_type text not null,
  delivery_status text not null check (delivery_status in ('pending','sent','failed','skipped')),
  provider_reference text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists communication_logs_created_at_idx on public.communication_logs(created_at desc);
create index if not exists communication_logs_partner_id_idx on public.communication_logs(partner_id);
alter table public.communication_logs enable row level security;
revoke all on public.communication_logs from anon, authenticated;
grant select on public.communication_logs to authenticated;
drop policy if exists "Admins can read communication logs" on public.communication_logs;
create policy "Admins can read communication logs" on public.communication_logs
for select to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
