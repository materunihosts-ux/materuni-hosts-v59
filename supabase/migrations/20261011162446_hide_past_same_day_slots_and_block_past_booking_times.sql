
DROP POLICY IF EXISTS "Read active availability or admin" ON public.availability_slots;
CREATE POLICY "Read active availability or admin"
ON public.availability_slots FOR SELECT TO anon, authenticated
USING (
  (
    is_active = true
    AND slot_date >= (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date
    AND slot_date <= ((now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date + 365)
    AND (
      slot_date > (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date
      OR start_time > (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::time
    )
  )
  OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid()))
);

CREATE OR REPLACE FUNCTION public.submit_booking(
  p_experience text,
  p_slot_id uuid,
  p_guest_count integer,
  p_guest text,
  p_email text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_nationality text DEFAULT NULL::text,
  p_country_of_residence text DEFAULT NULL::text,
  p_preferred_contact text DEFAULT NULL::text,
  p_pickup text DEFAULT NULL::text,
  p_language text DEFAULT 'English'::text,
  p_notes text DEFAULT NULL::text,
  p_booking_type text DEFAULT 'tour'::text
)
RETURNS TABLE(booking_id uuid, booking_reference text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_slot public.availability_slots%rowtype;
  v_booking_id uuid;
  v_reference text;
  v_today date;
  v_local_time time;
  v_recent_count integer;
BEGIN
  v_today := (now() at time zone 'Africa/Dar_es_Salaam')::date;
  v_local_time := (now() at time zone 'Africa/Dar_es_Salaam')::time;

  IF p_experience IS NULL OR trim(p_experience) = '' THEN
    RAISE EXCEPTION 'Please select an experience.';
  END IF;
  IF p_guest_count IS NULL OR p_guest_count < 1 OR p_guest_count > 30 THEN
    RAISE EXCEPTION 'Guest count must be between 1 and 30.';
  END IF;
  IF p_guest IS NULL OR trim(p_guest) = '' THEN
    RAISE EXCEPTION 'Guest name is required.';
  END IF;
  IF coalesce(trim(p_email), '') = '' AND coalesce(trim(p_phone), '') = '' THEN
    RAISE EXCEPTION 'Please provide an email address or phone number.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(lower(coalesce(trim(p_email), '')) || '|' || coalesce(trim(p_phone), '')));
  SELECT count(*) INTO v_recent_count
  FROM public.bookings
  WHERE created_at >= now() - interval '1 hour'
    AND (
      (coalesce(trim(p_email), '') <> '' AND lower(email) = lower(trim(p_email)))
      OR (coalesce(trim(p_phone), '') <> '' AND phone = trim(p_phone))
    );
  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Too many booking requests were sent from this contact. Please contact our local host on WhatsApp.';
  END IF;

  SELECT * INTO v_slot
  FROM public.availability_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected time slot was not found.';
  END IF;
  IF v_slot.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'This time slot is no longer available.';
  END IF;
  IF v_slot.slot_date < v_today OR v_slot.slot_date > v_today + 365 THEN
    RAISE EXCEPTION 'Please select a valid future date.';
  END IF;
  IF v_slot.slot_date = v_today AND v_slot.start_time <= v_local_time THEN
    RAISE EXCEPTION 'The selected time has already passed. Please choose a later time.';
  END IF;
  IF v_slot.experience <> trim(p_experience) THEN
    RAISE EXCEPTION 'Selected time slot does not match the experience.';
  END IF;
  IF p_guest_count > (v_slot.capacity - v_slot.booked_count) THEN
    RAISE EXCEPTION 'There are not enough spaces for this group.';
  END IF;

  UPDATE public.availability_slots
  SET booked_count = booked_count + p_guest_count
  WHERE id = v_slot.id;

  v_reference := 'MH-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  INSERT INTO public.bookings (
    experience, booking_date, guests, status, guest, email, phone,
    nationality, country_of_residence, preferred_contact, pickup,
    language, notes, booking_type, slot_id, guest_count, booking_reference
  )
  VALUES (
    trim(p_experience), v_slot.slot_date, p_guest_count::text, 'New',
    trim(p_guest), nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
    nullif(trim(p_nationality), ''), nullif(trim(p_country_of_residence), ''),
    nullif(trim(p_preferred_contact), ''), nullif(trim(p_pickup), ''),
    coalesce(nullif(trim(p_language), ''), 'English'),
    nullif(trim(p_notes), ''), coalesce(nullif(trim(p_booking_type), ''), 'tour'),
    v_slot.id, p_guest_count, v_reference
  )
  RETURNING id INTO v_booking_id;

  RETURN QUERY SELECT v_booking_id, v_reference, 'New'::text;
END;
$function$;
