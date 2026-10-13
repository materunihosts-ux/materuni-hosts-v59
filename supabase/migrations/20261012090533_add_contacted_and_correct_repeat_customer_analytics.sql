create or replace function public.admin_get_analytics(p_start_date date, p_end_date date)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_result jsonb;
begin
  if not exists (select 1 from public.admin_users where user_id = (select auth.uid())) then
    raise exception 'Admin access required';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date or p_end_date > p_start_date + 366 then
    raise exception 'Invalid date range';
  end if;

  with filtered as (
    select b.*, e.display_name, e.price_usd
    from public.bookings b
    left join public.experience_catalog e on e.experience_key = b.experience
    where b.booking_date between p_start_date and p_end_date
  ),
  popular as (
    select jsonb_agg(
      jsonb_build_object(
        'experience', coalesce(display_name, experience),
        'bookings', booking_count,
        'guests', guest_count
      ) order by booking_count desc, guest_count desc
    ) as items
    from (
      select display_name, experience,
        count(*)::integer as booking_count,
        coalesce(sum(coalesce(guest_count, nullif(trim(guests), '')::integer, 0)),0)::integer as guest_count
      from filtered
      group by display_name, experience
    ) p
  )
  select jsonb_build_object(
    'total_bookings', count(*),
    'confirmed', count(*) filter (where status = 'Confirmed'),
    'new', count(*) filter (where status = 'New'),
    'contacted', count(*) filter (where status = 'Contacted'),
    'cancelled', count(*) filter (where status = 'Cancelled'),
    'total_guests', coalesce(sum(coalesce(guest_count, nullif(trim(guests), '')::integer, 0)) filter (where status <> 'Cancelled'), 0),
    'returning_guests', count(distinct lower(trim(email))) filter (
      where nullif(trim(email), '') is not null
        and lower(trim(email)) in (
          select lower(trim(email)) from filtered
          where nullif(trim(email), '') is not null
          group by lower(trim(email)) having count(*) > 1
        )
    ),
    'estimated_confirmed_value_usd', coalesce(
      sum(price_usd * coalesce(guest_count, nullif(trim(guests), '')::integer, 0))
      filter (where status = 'Confirmed'), 0
    ),
    'popular_experiences', (select coalesce(items, '[]'::jsonb) from popular)
  )
  into v_result
  from filtered;

  return v_result;
end;
$function$;