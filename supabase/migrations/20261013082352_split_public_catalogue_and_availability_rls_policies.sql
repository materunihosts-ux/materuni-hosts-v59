-- Keep public reads independent of the private admin authorization helper.
-- The helper is intentionally not executable by anon, so public policies must
-- not reference it. Authenticated administrators retain access to all rows.

DROP POLICY IF EXISTS "Read active availability or admin" ON public.availability_slots;

CREATE POLICY "Public can read active availability"
ON public.availability_slots
FOR SELECT
TO anon
USING (
  is_active = true
  AND slot_date >= (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date
  AND slot_date <= (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date + 365
  AND (
    slot_date > (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date
    OR start_time > (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::time
  )
);

CREATE POLICY "Authenticated can read active availability or admin"
ON public.availability_slots
FOR SELECT
TO authenticated
USING (
  (
    is_active = true
    AND slot_date >= (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date
    AND slot_date <= (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date + 365
    AND (
      slot_date > (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date
      OR start_time > (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::time
    )
  )
  OR (SELECT public.is_materuni_admin())
);

DROP POLICY IF EXISTS "Read active experiences or admin" ON public.experience_catalog;

CREATE POLICY "Public can read active experiences"
ON public.experience_catalog
FOR SELECT
TO anon
USING (is_active = true);

CREATE POLICY "Authenticated can read active experiences or admin"
ON public.experience_catalog
FOR SELECT
TO authenticated
USING (
  is_active = true
  OR (SELECT public.is_materuni_admin())
);
