create or replace function public.admin_reschedule_booking(p_booking_id uuid, p_new_slot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_booking public.bookings%rowtype;
  v_old_slot public.availability_slots%rowtype;
  v_new_slot public.availability_slots%rowtype;
  v_guests integer;
  v_today date;
  v_local_time time;
begin
  if not exists (select 1 from public.admin_users where user_id = (select auth.uid())) then
    raise exception 'Admin access required';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then raise exception 'Booking not found'; end if;
  if v_booking.status <> 'Confirmed' then
    raise exception 'Only confirmed bookings can be rescheduled';
  end if;
  if v_booking.slot_id is null then raise exception 'Booking has no assigned slot'; end if;
  if p_new_slot_id is null then raise exception 'A new availability slot is required'; end if;
  if v_booking.slot_id = p_new_slot_id then raise exception 'Booking is already on this slot'; end if;

  v_guests := coalesce(v_booking.guest_count, nullif(trim(v_booking.guests), '')::integer);
  if v_guests is null or v_guests < 1 then raise exception 'Invalid guest count'; end if;

  perform id
  from public.availability_slots
  where id in (v_booking.slot_id, p_new_slot_id)
  order by id
  for update;

  select * into v_old_slot from public.availability_slots where id = v_booking.slot_id;
  if not found then raise exception 'Original availability slot not found'; end if;

  select * into v_new_slot from public.availability_slots where id = p_new_slot_id;
  if not found then raise exception 'New slot not found'; end if;

  if v_old_slot.experience <> v_booking.experience or v_old_slot.slot_date <> v_booking.booking_date then
    raise exception 'Original booking slot does not match the booking record; investigate before rescheduling';
  end if;
  if v_old_slot.booked_count < v_guests then
    raise exception 'Original slot capacity is inconsistent; booking was not moved';
  end if;
  if v_new_slot.booked_count < 0 or v_new_slot.capacity < v_new_slot.booked_count then
    raise exception 'New slot capacity data is inconsistent';
  end if;
  if not v_new_slot.is_active then raise exception 'New slot is inactive'; end if;

  v_today := (now() at time zone 'Africa/Dar_es_Salaam')::date;
  v_local_time := (now() at time zone 'Africa/Dar_es_Salaam')::time;
  if v_new_slot.slot_date < v_today then raise exception 'Cannot select a past date'; end if;
  if v_new_slot.slot_date = v_today and v_new_slot.start_time <= v_local_time then
    raise exception 'Cannot reschedule to a time that has already passed';
  end if;
  if v_new_slot.start_time >= v_new_slot.end_time then raise exception 'New slot has invalid times'; end if;
  if v_new_slot.experience <> v_booking.experience then raise exception 'Experience does not match'; end if;
  if v_new_slot.booked_count + v_guests > v_new_slot.capacity then
    raise exception 'Not enough spaces in new slot';
  end if;

  update public.availability_slots
  set booked_count = booked_count - v_guests
  where id = v_old_slot.id;

  update public.availability_slots
  set booked_count = booked_count + v_guests
  where id = v_new_slot.id;

  update public.bookings
  set slot_id = v_new_slot.id,
      booking_date = v_new_slot.slot_date,
      confirmed_at = now(),
      cancelled_at = null
  where id = p_booking_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Booking rescheduled successfully',
    'booking_id', p_booking_id,
    'new_date', v_new_slot.slot_date,
    'new_start_time', v_new_slot.start_time,
    'guest_count', v_guests
  );
end;
$function$;