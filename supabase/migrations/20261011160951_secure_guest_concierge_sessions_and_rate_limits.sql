
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS session_token_hash text,
  ADD COLUMN IF NOT EXISTS ip_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS ai_conversations_session_token_hash_unique_idx
ON public.ai_conversations(session_token_hash)
WHERE session_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_conversations_ip_created_idx
ON public.ai_conversations(ip_hash, created_at DESC)
WHERE ip_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.guest_chat_rate_limits (
  ip_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.guest_chat_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_chat_rate_limits FROM anon, authenticated;
GRANT ALL ON public.guest_chat_rate_limits TO service_role;
