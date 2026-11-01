-- Review-only hardening for the public booking RPC.
-- This replaces the existing submit_booking function without changing its
-- SECURITY DEFINER status, search_path, return contract or existing grants.
-- Do not apply until the preview booking flow is tested against a Supabase branch.
-- The existing contact-based limit (5 requests per contact per hour) is retained.
-- Add edge/IP-based throttling at the public gateway before removing the direct RPC.

create or replace function public.submit_booking(
  p_experience text,
  p_slot_id uuid,
  p_guest_count integer,
  p_guest text,
  p_email text default null,
  p_phone text default null,
  p_nationality text default null,
  p_country_of_residence text default null,
  p_preferred_contact text default null,
  p_pickup text default null,
  p_language text default 'English',
  p_notes text default null,
  p_booking_type text default 'tour'
)
returns table(booking_id uuid, booking_reference text, status text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_slot public.availability_slots%rowtype;
  v_booking_id uuid;
  v_reference text;
  v_today date;
  v_local_time time;
  v_recent_count integer;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := trim(coalesce(p_phone, ''));
begin
  v_today := (now() at time zone 'Africa/Dar_es_Salaam')::date;
  v_local_time := (now() at time zone 'Africa/Dar_es_Salaam')::time;

  if p_experience is null or trim(p_experience) = '' or length(trim(p_experience)) > 120 then
    raise exception 'Please select a valid experience.';
  end if;
  if not exists (
    select 1 from public.experience_catalog
    where experience_key = trim(p_experience) and is_active is true
  ) then
    raise exception 'This experience is not currently available for booking.';
  end if;
  if p_guest_count is null or p_guest_count < 1 or p_guest_count > 30 then
    raise exception 'Guest count must be between 1 and 30.';
  end if;
  if p_guest is null or trim(p_guest) = '' or length(trim(p_guest)) > 120 then
    raise exception 'Please provide a guest name of no more than 120 characters.';
  end if;
  if v_email = '' and v_phone = '' then
    raise exception 'Please provide an email address or phone number.';
  end if;
  if v_email <> '' and (
    length(v_email) > 254 or
    v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ) then
    raise exception 'Please provide a valid email address.';
  end if;
  if v_phone <> '' and (
    length(v_phone) > 32 or
    length(regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 7 and 15
  ) then
    raise exception 'Please provide a valid phone number.';
  end if;
  if length(coalesce(p_nationality, '')) > 100
    or length(coalesce(p_country_of_residence, '')) > 100
    or length(coalesce(p_preferred_contact, '')) > 40
    or length(coalesce(p_pickup, '')) > 160
    or length(coalesce(p_language, '')) > 30
    or length(coalesce(p_booking_type, '')) > 30
    or length(coalesce(p_notes, '')) > 2000 then
    raise exception 'One or more booking details exceed the allowed length.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_email || '|' || v_phone));
  select count(*) into v_recent_count
  from public.bookings
  where created_at >= now() - interval '1 hour'
    and (
      (v_email <> '' and lower(email) = v_email)
      or (v_phone <> '' and phone = v_phone)
    );
  if v_recent_count >= 5 then
    raise exception 'Too many booking requests were sent from this contact. Please contact our local host on WhatsApp.';
  end if;

  select * into v_slot
  from public.availability_slots
  where id = p_slot_id
  for update;

  if not found then
    raise exception 'Selected time slot was not found.';
  end if;
  if v_slot.is_active is not true then
    raise exception 'This time slot is no longer available.';
  end if;
  if v_slot.slot_date < v_today or v_slot.slot_date > v_today + 365 then
    raise exception 'Please select a valid future date.';
  end if;
  if v_slot.slot_date = v_today and v_slot.start_time <= v_local_time then
    raise exception 'The selected time has already passed. Please choose a later time.';
  end if;
  if v_slot.experience <> trim(p_experience) then
    raise exception 'Selected time slot does not match the experience.';
  end if;
  if p_guest_count > (v_slot.capacity - v_slot.booked_count) then
    raise exception 'There are not enough spaces for this group.';
  end if;

  update public.availability_slots
  set booked_count = booked_count + p_guest_count
  where id = v_slot.id;

  v_reference := 'MH-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.bookings (
    experience, booking_date, guests, status, guest, email, phone,
    nationality, country_of_residence, preferred_contact, pickup,
    language, notes, booking_type, slot_id, guest_count, booking_reference
  )
  values (
    trim(p_experience), v_slot.slot_date, p_guest_count::text, 'New',
    trim(p_guest), nullif(v_email, ''), nullif(v_phone, ''),
    nullif(trim(p_nationality), ''), nullif(trim(p_country_of_residence), ''),
    nullif(trim(p_preferred_contact), ''), nullif(trim(p_pickup), ''),
    coalesce(nullif(trim(p_language), ''), 'English'),
    nullif(trim(p_notes), ''), coalesce(nullif(trim(p_booking_type), ''), 'tour'),
    v_slot.id, p_guest_count, v_reference
  )
  returning id into v_booking_id;

  return query select v_booking_id, v_reference, 'New'::text;
end;
$function$;

-- The public submit_booking_idempotent wrapper remains intentionally callable
-- by anon. It delegates to this function, which validates active catalogue,
-- contact data, capacity and per-contact request frequency.
