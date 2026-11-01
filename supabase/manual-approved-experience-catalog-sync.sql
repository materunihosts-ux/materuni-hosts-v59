-- Approved Materuni Hosts experience catalogue alignment.
-- Review and execute in Supabase SQL Editor only after the preview build passes.
-- Existing bookings and historical records are not modified.
begin;

do $$
declare
  matched_count integer;
  updated_count integer;
begin
  select count(*) into matched_count
  from public.experience_catalog
  where experience_key in (
    'Waterfall & Chagga Culture',
    'Traditional Coffee Experience',
    'Traditional Chagga Cooking Class',
    'Materuni & Moshi Town Tour',
    'Materuni & Rau Forest Experience',
    'Camping & Village Life'
  );

  if matched_count <> 6 then
    raise exception 'Expected 6 approved experience keys, found %; no catalogue rows were changed.', matched_count;
  end if;

  update public.experience_catalog
  set
    display_name = case experience_key
      when 'Waterfall & Chagga Culture' then 'Materuni Waterfall & Chagga Village Experience'
      when 'Traditional Coffee Experience' then 'Traditional Chagga Coffee Experience'
      when 'Traditional Chagga Cooking Class' then 'Traditional Chagga Cooking Class'
      when 'Materuni & Moshi Town Tour' then 'Materuni & Moshi Town Cultural Experience'
      when 'Materuni & Rau Forest Experience' then 'Materuni & Rau Forest Nature Experience'
      when 'Camping & Village Life' then 'Materuni Overnight Village Experience'
      else display_name
    end,
    price_usd = case experience_key
      when 'Waterfall & Chagga Culture' then 40
      when 'Traditional Coffee Experience' then 36
      when 'Traditional Chagga Cooking Class' then 49
      when 'Materuni & Moshi Town Tour' then 52
      when 'Materuni & Rau Forest Experience' then 58
      when 'Camping & Village Life' then 90
      else price_usd
    end,
    updated_at = now()
  where experience_key in (
    'Waterfall & Chagga Culture',
    'Traditional Coffee Experience',
    'Traditional Chagga Cooking Class',
    'Materuni & Moshi Town Tour',
    'Materuni & Rau Forest Experience',
    'Camping & Village Life'
  )
  and is_active = true;

  get diagnostics updated_count = row_count;
  if updated_count <> 6 then
    raise exception 'Expected to update 6 active catalogue rows, updated %; transaction rolled back.', updated_count;
  end if;
end $$;

select experience_key, display_name, price_usd, is_active
from public.experience_catalog
where experience_key in (
  'Waterfall & Chagga Culture',
  'Traditional Coffee Experience',
  'Traditional Chagga Cooking Class',
  'Materuni & Moshi Town Tour',
  'Materuni & Rau Forest Experience',
  'Camping & Village Life'
)
order by sort_order;

-- Synchronize legacy public-site fallback values only when all expected keys exist.
do $site_content_sync$
declare
  matched_count integer;
  updated_count integer;
begin
  select count(*) into matched_count
  from public.site_content
  where id in ('waterfall_price','coffee_price','cooking_price','culturalday_price','camping_price','ultimate_price');

  if matched_count <> 6 then
    raise exception 'Expected 6 legacy site_content price keys, found %; catalogue transaction rolled back.', matched_count;
  end if;

  update public.site_content
  set content = case id
    when 'waterfall_price' then '40'
    when 'coffee_price' then '36'
    when 'cooking_price' then '49'
    when 'culturalday_price' then '52'
    when 'camping_price' then '90'
    when 'ultimate_price' then ''
    else content
  end,
  updated_at = now()
  where id in ('waterfall_price','coffee_price','cooking_price','culturalday_price','camping_price','ultimate_price');

  get diagnostics updated_count = row_count;
  if updated_count <> 6 then
    raise exception 'Expected to update 6 legacy site_content price keys, updated %; transaction rolled back.', updated_count;
  end if;
end $site_content_sync$;

select id, content from public.site_content
where id in ('waterfall_price','coffee_price','cooking_price','culturalday_price','camping_price','ultimate_price')
order by id;

commit;
