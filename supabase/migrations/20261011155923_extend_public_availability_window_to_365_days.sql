
DROP POLICY IF EXISTS "Public can view active availability" ON public.availability_slots;
CREATE POLICY "Public can view active availability"
ON public.availability_slots
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND slot_date >= (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date
  AND slot_date <= ((now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date + 365)
);
