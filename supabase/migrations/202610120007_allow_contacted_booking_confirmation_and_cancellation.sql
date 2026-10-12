CREATE OR REPLACE FUNCTION public.admin_confirm_booking(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_booking public.bookings%rowtype; v_slot public.availability_slots%rowtype; v_guests integer; v_today date; v_local_time time;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF v_booking.status = 'Confirmed' THEN RETURN jsonb_build_object('success', true, 'message', 'Booking already confirmed'); END IF;
  IF v_booking.status NOT IN ('New', 'Contacted') THEN RAISE EXCEPTION 'Booking cannot be confirmed in its current status'; END IF;
  IF v_booking.slot_id IS NULL THEN RAISE EXCEPTION 'Please assign an availability slot first'; END IF;
  v_guests := COALESCE(v_booking.guest_count, NULLIF(trim(v_booking.guests), '')::integer, 0);
  IF v_guests < 1 THEN RAISE EXCEPTION 'Invalid guest count'; END IF;
  SELECT * INTO v_slot FROM public.availability_slots WHERE id = v_booking.slot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Availability slot not found'; END IF;
  IF NOT v_slot.is_active THEN RAISE EXCEPTION 'Selected slot is inactive'; END IF;
  v_today := (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
  v_local_time := (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::time;
  IF v_slot.slot_date < v_today THEN RAISE EXCEPTION 'Cannot confirm a past slot'; END IF;
  IF v_slot.slot_date = v_today AND v_slot.start_time <= v_local_time THEN RAISE EXCEPTION 'Cannot confirm a time slot that has already passed'; END IF;
  IF v_slot.experience <> v_booking.experience OR v_slot.slot_date <> v_booking.booking_date THEN RAISE EXCEPTION 'Booking does not match its selected slot'; END IF;
  -- Capacity was reserved atomically when the booking request was submitted; do not reserve twice.
  IF v_slot.booked_count < v_guests THEN RAISE EXCEPTION 'Reserved capacity is missing; review this booking before confirming'; END IF;
  UPDATE public.bookings SET status = 'Confirmed', guest_count = v_guests, confirmed_at = now(), cancelled_at = NULL WHERE id = p_booking_id;
  RETURN jsonb_build_object('success', true, 'message', 'Booking confirmed successfully', 'booking_id', p_booking_id, 'guest_count', v_guests, 'remaining_spaces', v_slot.capacity - v_slot.booked_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_cancel_booking(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_booking public.bookings%rowtype; v_guests integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF v_booking.status = 'Cancelled' THEN RETURN jsonb_build_object('success', true, 'message', 'Booking already cancelled', 'capacity_restored', false); END IF;
  IF v_booking.status IN ('New', 'Contacted', 'Confirmed') AND v_booking.slot_id IS NOT NULL THEN
    v_guests := COALESCE(v_booking.guest_count, NULLIF(trim(v_booking.guests), '')::integer, 0);
    PERFORM 1 FROM public.availability_slots WHERE id = v_booking.slot_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking slot not found'; END IF;
    UPDATE public.availability_slots SET booked_count = GREATEST(0, booked_count - v_guests) WHERE id = v_booking.slot_id;
  END IF;
  UPDATE public.bookings SET status = 'Cancelled', cancelled_at = now() WHERE id = p_booking_id;
  RETURN jsonb_build_object('success', true, 'message', 'Booking cancelled successfully', 'capacity_restored', (v_booking.status IN ('New', 'Contacted', 'Confirmed') AND v_booking.slot_id IS NOT NULL));
END;
$function$;
