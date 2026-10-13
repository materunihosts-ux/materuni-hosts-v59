create or replace function public.admin_update_ai_conversation_status(p_conversation_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Admin access required';
  end if;
  if p_status not in ('open','needs_human','resolved') then
    raise exception 'Invalid conversation status';
  end if;
  update public.ai_conversations
  set conversation_status = p_status, updated_at = now()
  where id = p_conversation_id;
  if not found then raise exception 'Conversation not found'; end if;
end;
$$;
revoke all on function public.admin_update_ai_conversation_status(uuid,text) from public, anon;
grant execute on function public.admin_update_ai_conversation_status(uuid,text) to authenticated, service_role;