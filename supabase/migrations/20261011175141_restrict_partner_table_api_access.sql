revoke all on table public.partners from anon, public;
grant select, insert, update, delete on table public.partners to authenticated;
grant all on table public.partners to service_role;