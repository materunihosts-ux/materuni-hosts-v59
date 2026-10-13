-- Keep the admin inbox workflow statuses compatible with the conversation table.
-- The concierge can also hand a conversation to a human host.
ALTER TABLE public.ai_conversations
  DROP CONSTRAINT IF EXISTS ai_conversations_conversation_status_check;

ALTER TABLE public.ai_conversations
  ADD CONSTRAINT ai_conversations_conversation_status_check
  CHECK (conversation_status IN (
    'open',
    'closed',
    'handed_to_admin',
    'needs_human',
    'resolved'
  ));
