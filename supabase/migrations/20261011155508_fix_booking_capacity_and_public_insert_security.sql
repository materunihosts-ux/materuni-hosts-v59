
-- Keep public booking submissions inside the validated RPC only.
DROP POLICY IF EXISTS "Public can submit booking requests" ON public.bookings;
REVOKE INSERT ON TABLE public.bookings FROM anon, authenticated;

-- Retire the older RPC that immediately created a Confirmed booking.
REVOKE EXECUTE ON FUNCTION public.create_smart_booking(uuid, integer, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_smart_booking(uuid, integer, text, text, text, text, text, text, text, text, text, text) TO service_role;

-- A public submission reserves capacity once. Admin confirmation must not reserve it again.
CREATE OR REPLACE FUNCTION public.admin_confirm_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_booking public.bookings%rowtype;
  v_slot public.availability_slots%rowtype;
  v_guests integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.status = 'Confirmed' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Booking already confirmed');
  END IF;

  IF v_booking.status NOT IN ('New', 'Pending') THEN
    RAISE EXCEPTION 'Booking cannot be confirmed in its current status';
  END IF;

  IF v_booking.slot_id IS NULL THEN
    RAISE EXCEPTION 'Please assign an availability slot first';
  END IF;

  v_guests := COALESCE(v_booking.guest_count, NULLIF(trim(v_booking.guests), '')::integer, 0);
  IF v_guests < 1 THEN
    RAISE EXCEPTION 'Invalid guest count';
  END IF;

  SELECT * INTO v_slot
  FROM public.availability_slots
  WHERE id = v_booking.slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Availability slot not found';
  END IF;

  IF NOT v_slot.is_active THEN
    RAISE EXCEPTION 'Selected slot is inactive';
  END IF;

  IF v_slot.slot_date < (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date THEN
    RAISE EXCEPTION 'Cannot confirm a past slot';
  END IF;

  IF v_slot.experience <> v_booking.experience OR v_slot.slot_date <> v_booking.booking_date THEN
    RAISE EXCEPTION 'Booking does not match its selected slot';
  END IF;

  -- submit_booking already increased booked_count when it created this pending request.
  -- Check that the slot still contains at least this reservation; do not increment twice.
  IF v_slot.booked_count < v_guests THEN
    RAISE EXCEPTION 'Reserved capacity is missing; review this booking before confirming';
  END IF;

  UPDATE public.bookings
  SET status = 'Confirmed', guest_count = v_guests, confirmed_at = now(), cancelled_at = NULL
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Booking confirmed successfully',
    'booking_id', p_booking_id,
    'guest_count', v_guests,
    'remaining_spaces', v_slot.capacity - v_slot.booked_count
  );
END;
$function$;

-- Restore capacity when either a pending or confirmed reservation is cancelled.
CREATE OR REPLACE FUNCTION public.admin_cancel_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_booking public.bookings%rowtype;
  v_guests integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.status = 'Cancelled' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Booking already cancelled', 'capacity_restored', false);
  END IF;

  IF v_booking.status IN ('New', 'Pending', 'Confirmed') AND v_booking.slot_id IS NOT NULL THEN
    v_guests := COALESCE(v_booking.guest_count, NULLIF(trim(v_booking.guests), '')::integer, 0);

    PERFORM 1 FROM public.availability_slots WHERE id = v_booking.slot_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Booking slot not found';
    END IF;

    UPDATE public.availability_slots
    SET booked_count = GREATEST(0, booked_count - v_guests)
    WHERE id = v_booking.slot_id;
  END IF;

  UPDATE public.bookings
  SET status = 'Cancelled', cancelled_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Booking cancelled successfully',
    'capacity_restored', (v_booking.status IN ('New', 'Pending', 'Confirmed') AND v_booking.slot_id IS NOT NULL)
  );
END;
$function$;
