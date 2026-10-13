create or replace function public.admin_delete_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_booking public.bookings%rowtype;
  v_today date;
  v_guests integer;
begin
  if not exists (
    select 1 from public.admin_users where user_id = auth.uid()
  ) then
    raise exception 'Admin access required';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then raise exception 'Booking not found'; end if;

  v_today := (now() at time zone 'Africa/Dar_es_Salaam')::date;
  if v_booking.status <> 'Cancelled' and v_booking.booking_date >= v_today then
    raise exception 'Only cancelled or past bookings can be permanently deleted';
  end if;

  if v_booking.status <> 'Cancelled' and v_booking.slot_id is not null then
    v_guests := coalesce(v_booking.guest_count, nullif(trim(v_booking.guests), '')::integer, 0);
    perform id from public.availability_slots where id = v_booking.slot_id for update;
    update public.availability_slots
    set booked_count = greatest(0, booked_count - greatest(v_guests, 0))
    where id = v_booking.slot_id;
  end if;

  delete from public.bookings where id = p_booking_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Booking permanently deleted',
    'booking_id', p_booking_id
  );
end;
$function$;

revoke all on function public.admin_delete_booking(uuid) from public, anon;
grant execute on function public.admin_delete_booking(uuid) to authenticated;