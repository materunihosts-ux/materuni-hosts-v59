-- Keep the notification delivery state constraint aligned with the Edge Functions.
-- Both booking-notifications and admin-booking-notification record intentionally skipped
-- deliveries when a channel is not configured or a recipient is unavailable.
ALTER TABLE public.notification_logs
  DROP CONSTRAINT IF EXISTS notification_logs_delivery_status_check;

ALTER TABLE public.notification_logs
  ADD CONSTRAINT notification_logs_delivery_status_check
  CHECK (delivery_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text]));
