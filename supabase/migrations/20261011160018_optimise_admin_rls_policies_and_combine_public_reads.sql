
-- Avoid repeated auth.uid() evaluation in admin policies.
DROP POLICY IF EXISTS "Admins can verify own admin record" ON public.admin_users;
CREATE POLICY "Admins can verify own admin record"
ON public.admin_users FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can view bookings" ON public.bookings;
CREATE POLICY "Admins can view bookings"
ON public.bookings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can update bookings" ON public.bookings;
CREATE POLICY "Admins can update bookings"
ON public.bookings FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can delete bookings" ON public.bookings;
CREATE POLICY "Admins can delete bookings"
ON public.bookings FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));

-- Use one SELECT policy per table to avoid overlapping permissive read policies.
DROP POLICY IF EXISTS "Admins can manage availability slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Public can view active availability" ON public.availability_slots;
CREATE POLICY "Read active availability or admin"
ON public.availability_slots FOR SELECT TO anon, authenticated
USING (
  (is_active = true
   AND slot_date >= (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date
   AND slot_date <= ((now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date + 365))
  OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid()))
);
CREATE POLICY "Admins can insert availability slots"
ON public.availability_slots FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));
CREATE POLICY "Admins can update availability slots"
ON public.availability_slots FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));
CREATE POLICY "Admins can delete availability slots"
ON public.availability_slots FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can manage experiences" ON public.experience_catalog;
DROP POLICY IF EXISTS "Public can view active experiences" ON public.experience_catalog;
CREATE POLICY "Read active experiences or admin"
ON public.experience_catalog FOR SELECT TO anon, authenticated
USING (is_active = true OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));
CREATE POLICY "Admins can insert experiences"
ON public.experience_catalog FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));
CREATE POLICY "Admins can update experiences"
ON public.experience_catalog FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));
CREATE POLICY "Admins can delete experiences"
ON public.experience_catalog FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can manage website content" ON public.site_content;
DROP POLICY IF EXISTS "Public can read website content" ON public.site_content;
CREATE POLICY "Read website content"
ON public.site_content FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert website content"
ON public.site_content FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));
CREATE POLICY "Admins can update website content"
ON public.site_content FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));
CREATE POLICY "Admins can delete website content"
ON public.site_content FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can manage marketing contacts" ON public.marketing_contacts;
CREATE POLICY "Admins can select marketing contacts"
ON public.marketing_contacts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));
CREATE POLICY "Admins can insert marketing contacts"
ON public.marketing_contacts FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));
CREATE POLICY "Admins can update marketing contacts"
ON public.marketing_contacts FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));
CREATE POLICY "Admins can delete marketing contacts"
ON public.marketing_contacts FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public can read social links" ON public.site_settings;
CREATE POLICY "Read social settings or admin"
ON public.site_settings FOR SELECT TO anon, authenticated
USING (
  setting_key = ANY (ARRAY['instagram_url','facebook_url','tripadvisor_url','google_review_url'])
  OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid()))
);
CREATE POLICY "Admins can insert site settings"
ON public.site_settings FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));
CREATE POLICY "Admins can update site settings"
ON public.site_settings FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));
CREATE POLICY "Admins can delete site settings"
ON public.site_settings FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())));
