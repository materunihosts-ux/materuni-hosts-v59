alter table public.partners
  add column if not exists whatsapp_opt_in boolean not null default false,
  add column if not exists whatsapp_opt_in_at timestamptz,
  add column if not exists whatsapp_opt_in_source text;

alter table public.partners
  add constraint partners_whatsapp_opt_in_audit_check
  check (
    (whatsapp_opt_in = false and whatsapp_opt_in_at is null)
    or
    (whatsapp_opt_in = true and whatsapp_opt_in_at is not null and whatsapp_opt_in_source is not null)
  ) not valid;

alter table public.partners validate constraint partners_whatsapp_opt_in_audit_check;

comment on column public.partners.whatsapp_opt_in is 'Explicit permission recorded before sending partner invitation messages by WhatsApp.';
comment on column public.partners.whatsapp_opt_in_at is 'Timestamp when partner WhatsApp permission was recorded.';
comment on column public.partners.whatsapp_opt_in_source is 'How explicit WhatsApp permission was obtained, e.g. verbal, email, written.';
