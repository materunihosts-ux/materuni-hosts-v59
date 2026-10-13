
CREATE OR REPLACE FUNCTION public.admin_get_analytics(p_start_date date, p_end_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  WITH filtered AS (
    SELECT b.*, e.display_name, e.price_usd
    FROM public.bookings b
    LEFT JOIN public.experience_catalog e ON e.experience_key = b.experience
    WHERE b.booking_date BETWEEN p_start_date AND p_end_date
  ),
  popular AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'experience', COALESCE(display_name, experience),
        'bookings', booking_count,
        'guests', guest_count
      ) ORDER BY booking_count DESC, guest_count DESC
    ) AS items
    FROM (
      SELECT display_name, experience,
        count(*)::integer AS booking_count,
        coalesce(sum(coalesce(guest_count, nullif(trim(guests), '')::integer, 0)),0)::integer AS guest_count
      FROM filtered
      GROUP BY display_name, experience
    ) p
  )
  SELECT jsonb_build_object(
    'total_bookings', count(*),
    'confirmed', count(*) FILTER (WHERE status = 'Confirmed'),
    'new', count(*) FILTER (WHERE status = 'New'),
    'cancelled', count(*) FILTER (WHERE status = 'Cancelled'),
    'total_guests', coalesce(sum(coalesce(guest_count, nullif(trim(guests), '')::integer, 0)) FILTER (WHERE status <> 'Cancelled'), 0),
    'returning_guests', count(*) FILTER (
      WHERE email IN (
        SELECT email FROM filtered WHERE email IS NOT NULL GROUP BY email HAVING count(*) > 1
      )
    ),
    'estimated_confirmed_value_usd', coalesce(
      sum(price_usd * coalesce(guest_count, nullif(trim(guests), '')::integer, 0))
      FILTER (WHERE status = 'Confirmed'), 0
    ),
    'popular_experiences', (SELECT coalesce(items, '[]'::jsonb) FROM popular)
  )
  INTO v_result
  FROM filtered;

  RETURN v_result;
END;
$function$;
