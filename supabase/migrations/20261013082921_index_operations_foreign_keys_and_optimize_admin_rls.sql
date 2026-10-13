-- Index operational foreign keys and avoid per-row auth function evaluation
-- in private admin RLS policies.

CREATE INDEX IF NOT EXISTS invoice_items_experience_id_idx ON public.invoice_items (experience_id);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON public.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS invoices_booking_id_idx ON public.invoices (booking_id);
CREATE INDEX IF NOT EXISTS invoices_created_by_idx ON public.invoices (created_by);
CREATE INDEX IF NOT EXISTS invoices_partner_id_idx ON public.invoices (partner_id);
CREATE INDEX IF NOT EXISTS invoices_quotation_id_idx ON public.invoices (quotation_id);
CREATE INDEX IF NOT EXISTS package_rates_rate_plan_id_idx ON public.package_rates (rate_plan_id);
CREATE INDEX IF NOT EXISTS payments_recorded_by_idx ON public.payments (recorded_by);
CREATE INDEX IF NOT EXISTS quotation_items_experience_id_idx ON public.quotation_items (experience_id);
CREATE INDEX IF NOT EXISTS quotation_items_quotation_id_idx ON public.quotation_items (quotation_id);
CREATE INDEX IF NOT EXISTS quotations_created_by_idx ON public.quotations (created_by);
CREATE INDEX IF NOT EXISTS quotations_partner_id_idx ON public.quotations (partner_id);
CREATE INDEX IF NOT EXISTS rate_plans_partner_id_idx ON public.rate_plans (partner_id);

ALTER POLICY document_templates_admin_all ON public.document_templates
USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())));

ALTER POLICY invoice_items_admin_all ON public.invoice_items
USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())));

ALTER POLICY invoices_admin_all ON public.invoices
USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())));

ALTER POLICY itinerary_templates_admin_all ON public.itinerary_templates
USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())));

ALTER POLICY package_rates_admin_all ON public.package_rates
USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())));

ALTER POLICY payments_admin_all ON public.payments
USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())));

ALTER POLICY quotation_items_admin_all ON public.quotation_items
USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())));

ALTER POLICY quotations_admin_all ON public.quotations
USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())));

ALTER POLICY rate_plans_admin_all ON public.rate_plans
USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = (SELECT auth.uid())));
