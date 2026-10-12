alter table public.communication_logs
  add column if not exists idempotency_key uuid;

create unique index if not exists communication_logs_idempotency_channel_uidx
  on public.communication_logs (idempotency_key, channel)
  where idempotency_key is not null;

comment on column public.communication_logs.idempotency_key is
  'Client-generated request UUID used to prevent duplicate partner invitation deliveries on network retries.';
