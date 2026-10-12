-- Idempotent guest booking requests.
-- A stable client key maps retries of the same request to the original booking.
create table if not exists public.booking_idempotency (
  idempotency_key uuid primary key,
  request_hash text not null,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.booking_idempotency enable row level security;
revoke all on table public.booking_idempotency from public, anon, authenticated;

create or replace function public.submit_booking_idempotent(
  p_idempotency_key uuid,
  p_experience text,
  p_slot_id uuid,
  p_guest_count integer,
  p_guest text,
  p_email text,
  p_phone text,
  p_nationality text,
  p_country_of_residence text,
  p_preferred_contact text,
  p_pickup text,
  p_language text,
  p_notes text,
  p_booking_type text
)
returns table(booking_id uuid, booking_reference text, status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_hash text;
  v_existing public.booking_idempotency%rowtype;
  v_result record;
begin
  if p_idempotency_key is null then
    raise exception 'A booking request key is required.';
  end if;

  v_hash := md5(jsonb_build_object(
    'experience', p_experience,
    'slot_id', p_slot_id,
    'guest_count', p_guest_count,
    'guest', trim(coalesce(p_guest, '')),
    'email', lower(trim(coalesce(p_email, ''))),
    'phone', trim(coalesce(p_phone, '')),
    'nationality', trim(coalesce(p_nationality, '')),
    'country', trim(coalesce(p_country_of_residence, '')),
    'preferred_contact', trim(coalesce(p_preferred_contact, '')),
    'pickup', trim(coalesce(p_pickup, '')),
    'language', trim(coalesce(p_language, '')),
    'notes', trim(coalesce(p_notes, '')),
    'booking_type', trim(coalesce(p_booking_type, ''))
  )::text);

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into v_existing
  from public.booking_idempotency
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash <> v_hash then
      raise exception 'This booking request key was already used with different details. Refresh the page and submit again.';
    end if;

    return query
      select b.id, b.booking_reference, b.status
      from public.bookings b
      where b.id = v_existing.booking_id;
    return;
  end if;

  select * into v_result
  from public.submit_booking(
    p_experience, p_slot_id, p_guest_count, p_guest, p_email, p_phone,
    p_nationality, p_country_of_residence, p_preferred_contact, p_pickup,
    p_language, p_notes, p_booking_type
  );

  insert into public.booking_idempotency(idempotency_key, request_hash, booking_id)
  values (p_idempotency_key, v_hash, v_result.booking_id);

  return query select v_result.booking_id, v_result.booking_reference, v_result.status;
end;
$function$;

revoke all on function public.submit_booking_idempotent(uuid,text,uuid,integer,text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.submit_booking_idempotent(uuid,text,uuid,integer,text,text,text,text,text,text,text,text,text,text) to anon, authenticated;
