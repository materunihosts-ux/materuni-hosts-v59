drop policy if exists "Admins can manage availability slots" on public.availability_slots;
create policy "Admins can manage availability slots"
on public.availability_slots for all
to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid())));
grant select, insert, update, delete on public.availability_slots to authenticated;