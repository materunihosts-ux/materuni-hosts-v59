-- Least-privilege cleanup for public-schema tables.
-- Removes only privileges that public website visitors and signed-in clients
-- do not need for ordinary row-level API operations.
-- This intentionally leaves SELECT, INSERT, UPDATE and DELETE grants unchanged.
-- Review table-specific access patterns before running in production.
begin;

do $$
declare
  target record;
begin
  for target in
    select format('%I.%I', ns.nspname, cls.relname) as qualified_name
    from pg_class cls
    join pg_namespace ns on ns.oid = cls.relnamespace
    where ns.nspname = 'public'
      and cls.relkind in ('r', 'p')
  loop
    execute format(
      'revoke truncate, references, trigger on table %s from anon, authenticated',
      target.qualified_name
    );
  end loop;
end $$;

commit;
