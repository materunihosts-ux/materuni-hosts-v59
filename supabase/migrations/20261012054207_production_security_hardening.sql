-- Production security hardening for guest booking and private operational data.
REVOKE ALL ON FUNCTION public.submit_booking(text, uuid, integer, text, text, text, text, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_booking_idempotent(uuid, text, uuid, integer, text, text, text, text, text, text, text, text, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_booking_idempotent(uuid, text, uuid, integer, text, text, text, text, text, text, text, text, text, text)
  TO anon, authenticated;

REVOKE ALL PRIVILEGES ON TABLE
  public.ai_conversations,
  public.ai_messages,
  public.booking_idempotency,
  public.guest_chat_rate_limits,
  public.guest_profiles,
  public.notification_logs
FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS booking_idempotency_booking_id_idx ON public.booking_idempotency(booking_id);
CREATE INDEX IF NOT EXISTS communication_logs_booking_id_idx ON public.communication_logs(booking_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'availability_slots_capacity_bounds_chk') THEN
    ALTER TABLE public.availability_slots
      ADD CONSTRAINT availability_slots_capacity_bounds_chk
      CHECK (capacity > 0 AND booked_count >= 0 AND booked_count <= capacity) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.availability_slots VALIDATE CONSTRAINT availability_slots_capacity_bounds_chk;
