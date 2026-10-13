
CREATE UNIQUE INDEX IF NOT EXISTS ai_conversations_session_id_unique_idx
ON public.ai_conversations(session_id);
CREATE INDEX IF NOT EXISTS ai_messages_conversation_created_idx
ON public.ai_messages(conversation_id, created_at DESC);
