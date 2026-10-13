create or replace function public.is_materuni_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_materuni_admin() from public;
grant execute on function public.is_materuni_admin() to anon, authenticated;

drop policy if exists "Read active availability or admin" on public.availability_slots;
drop policy if exists "Admins can delete availability slots" on public.availability_slots;
drop policy if exists "Admins can insert availability slots" on public.availability_slots;
drop policy if exists "Admins can update availability slots" on public.availability_slots;

create policy "Read active availability or admin"
on public.availability_slots
for select
to anon, authenticated
using (
  (
    is_active = true
    and slot_date >= (now() at time zone 'Africa/Dar_es_Salaam')::date
    and slot_date <= (now() at time zone 'Africa/Dar_es_Salaam')::date + 365
    and (
      slot_date > (now() at time zone 'Africa/Dar_es_Salaam')::date
      or start_time > (now() at time zone 'Africa/Dar_es_Salaam')::time
    )
  )
  or public.is_materuni_admin()
);

create policy "Admins can delete availability slots"
on public.availability_slots
for delete
to authenticated
using (public.is_materuni_admin());

create policy "Admins can insert availability slots"
on public.availability_slots
for insert
to authenticated
with check (public.is_materuni_admin());

create policy "Admins can update availability slots"
on public.availability_slots
for update
to authenticated
using (public.is_materuni_admin())
with check (public.is_materuni_admin());

drop policy if exists "Read active experiences or admin" on public.experience_catalog;
drop policy if exists "Admins can delete experiences" on public.experience_catalog;
drop policy if exists "Admins can insert experiences" on public.experience_catalog;
drop policy if exists "Admins can update experiences" on public.experience_catalog;

create policy "Read active experiences or admin"
on public.experience_catalog
for select
to anon, authenticated
using (is_active = true or public.is_materuni_admin());

create policy "Admins can delete experiences"
on public.experience_catalog
for delete
to authenticated
using (public.is_materuni_admin());

create policy "Admins can insert experiences"
on public.experience_catalog
for insert
to authenticated
with check (public.is_materuni_admin());

create policy "Admins can update experiences"
on public.experience_catalog
for update
to authenticated
using (public.is_materuni_admin())
with check (public.is_materuni_admin());