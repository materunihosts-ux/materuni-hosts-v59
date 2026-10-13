
create table if not exists public.rate_plans (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 rate_type text not null check (rate_type in ('retail','sto','net','contract','seasonal','group')),
 currency text not null default 'USD' check (currency in ('USD','TZS','EUR','GBP')),
 partner_id uuid references public.partners(id) on delete set null,
 valid_from date,
 valid_until date,
 is_active boolean not null default true,
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (valid_until is null or valid_from is null or valid_until >= valid_from)
);
create table if not exists public.package_rates (
 id uuid primary key default gen_random_uuid(),
 experience_id uuid not null references public.experience_catalog(id) on delete cascade,
 rate_plan_id uuid not null references public.rate_plans(id) on delete cascade,
 guest_min integer not null default 1 check (guest_min > 0),
 guest_max integer check (guest_max is null or guest_max >= guest_min),
 amount numeric(12,2) not null check (amount >= 0),
 pricing_unit text not null default 'per_person' check (pricing_unit in ('per_person','per_group','per_night','per_vehicle')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(experience_id,rate_plan_id,guest_min,guest_max,pricing_unit)
);
create table if not exists public.itinerary_templates (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 language_code text not null default 'en' check (language_code in ('en','es','fr','de')),
 duration_days integer not null default 1 check (duration_days > 0),
 summary text,
 itinerary jsonb not null default '[]'::jsonb,
 inclusions jsonb not null default '[]'::jsonb,
 exclusions jsonb not null default '[]'::jsonb,
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.quotations (
 id uuid primary key default gen_random_uuid(),
 quotation_number text not null unique,
 recipient_type text not null check (recipient_type in ('guest','agent')),
 partner_id uuid references public.partners(id) on delete set null,
 guest_name text not null,
 guest_email text,
 guest_phone text,
 language_code text not null default 'en' check (language_code in ('en','es','fr','de')),
 currency text not null default 'USD' check (currency in ('USD','TZS','EUR','GBP')),
 travel_start date,
 travel_end date,
 guest_count integer not null default 1 check (guest_count > 0),
 status text not null default 'draft' check (status in ('draft','sent','accepted','declined','expired','converted')),
 subtotal numeric(12,2) not null default 0,
 discount numeric(12,2) not null default 0,
 total numeric(12,2) not null default 0,
 valid_until date,
 notes text,
 terms text,
 rate_snapshot jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.quotation_items (
 id uuid primary key default gen_random_uuid(),
 quotation_id uuid not null references public.quotations(id) on delete cascade,
 experience_id uuid references public.experience_catalog(id) on delete set null,
 description text not null,
 quantity numeric(10,2) not null default 1 check (quantity > 0),
 unit_price numeric(12,2) not null check (unit_price >= 0),
 line_total numeric(12,2) not null check (line_total >= 0),
 sort_order integer not null default 0
);
create table if not exists public.invoices (
 id uuid primary key default gen_random_uuid(),
 invoice_number text not null unique,
 quotation_id uuid references public.quotations(id) on delete set null,
 booking_id uuid references public.bookings(id) on delete set null,
 recipient_type text not null check (recipient_type in ('guest','agent')),
 partner_id uuid references public.partners(id) on delete set null,
 guest_name text not null,
 guest_email text,
 guest_phone text,
 language_code text not null default 'en' check (language_code in ('en','es','fr','de')),
 currency text not null default 'USD' check (currency in ('USD','TZS','EUR','GBP')),
 issue_date date not null default current_date,
 due_date date,
 status text not null default 'unpaid' check (status in ('draft','unpaid','partially_paid','paid','overdue','cancelled')),
 subtotal numeric(12,2) not null default 0,
 discount numeric(12,2) not null default 0,
 total numeric(12,2) not null default 0,
 amount_paid numeric(12,2) not null default 0,
 balance numeric(12,2) not null default 0,
 notes text,
 terms text,
 rate_snapshot jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (amount_paid >= 0 and balance >= 0)
);
create table if not exists public.invoice_items (
 id uuid primary key default gen_random_uuid(),
 invoice_id uuid not null references public.invoices(id) on delete cascade,
 experience_id uuid references public.experience_catalog(id) on delete set null,
 description text not null,
 quantity numeric(10,2) not null default 1 check (quantity > 0),
 unit_price numeric(12,2) not null check (unit_price >= 0),
 line_total numeric(12,2) not null check (line_total >= 0),
 sort_order integer not null default 0
);
create table if not exists public.payments (
 id uuid primary key default gen_random_uuid(),
 invoice_id uuid not null references public.invoices(id) on delete restrict,
 payment_reference text,
 payment_method text,
 amount numeric(12,2) not null check (amount > 0),
 currency text not null default 'USD' check (currency in ('USD','TZS','EUR','GBP')),
 paid_at timestamptz not null default now(),
 recorded_by uuid references auth.users(id) on delete set null,
 notes text,
 created_at timestamptz not null default now()
);
create table if not exists public.document_templates (
 id uuid primary key default gen_random_uuid(),
 document_type text not null check (document_type in ('itinerary','quotation','invoice','receipt','price_list')),
 language_code text not null default 'en' check (language_code in ('en','es','fr','de')),
 template_name text not null,
 settings jsonb not null default '{}'::jsonb,
 is_default boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(document_type,language_code,template_name)
);
create index if not exists package_rates_lookup_idx on public.package_rates(experience_id,rate_plan_id,guest_min);
create index if not exists quotations_created_idx on public.quotations(created_at desc);
create index if not exists invoices_created_idx on public.invoices(created_at desc);
create index if not exists payments_invoice_idx on public.payments(invoice_id,paid_at desc);

do $$
declare t text;
begin
 foreach t in array array['rate_plans','package_rates','itinerary_templates','quotations','quotation_items','invoices','invoice_items','payments','document_templates'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists %I on public.%I',t||'_admin_all',t);
  execute format('create policy %I on public.%I for all to authenticated using (exists (select 1 from public.admin_users a where a.user_id = auth.uid())) with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))',t||'_admin_all',t);
 end loop;
end $$;
