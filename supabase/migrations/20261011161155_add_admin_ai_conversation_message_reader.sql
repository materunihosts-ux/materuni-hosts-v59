
CREATE OR REPLACE FUNCTION public.admin_get_ai_messages(p_conversation_id uuid)
RETURNS TABLE(message_id uuid, sender_type text, message text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT m.id, m.sender_type, m.message, m.created_at
  FROM public.ai_messages m
  WHERE m.conversation_id = p_conversation_id
  ORDER BY m.created_at ASC
  LIMIT 200;
END;
$function$;
