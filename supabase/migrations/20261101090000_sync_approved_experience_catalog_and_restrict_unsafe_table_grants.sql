-- Materuni Hosts: synchronize the approved public experience catalogue,
-- legacy public price fallbacks and browser-role table privileges.
-- This migration updates only the six active approved experiences and six
-- legacy price keys. Historical bookings, invoices and payments are untouched.
-- It is intentionally guarded: missing or unexpected records abort the migration.


do $$
declare
  matched_count integer;
  updated_count integer;
begin
  select count(*) into matched_count
  from public.experience_catalog
  where is_active = true
    and experience_key in (
      'Waterfall & Chagga Culture',
      'Traditional Coffee Experience',
      'Traditional Chagga Cooking Class',
      'Materuni & Moshi Town Tour',
      'Materuni & Rau Forest Experience',
      'Camping & Village Life'
    );

  if matched_count <> 6 then
    raise exception 'Expected 6 active experience keys, found %; no catalogue rows were changed.', matched_count;
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
    short_description = case experience_key
      when 'Waterfall & Chagga Culture' then 'Explore Materuni Waterfall with a local host, discover Chagga village life and enjoy traditional coffee making.'
      when 'Traditional Coffee Experience' then 'Discover Chagga coffee traditions in Materuni through local growing stories, roasting, grinding, brewing and tasting.'
      when 'Traditional Chagga Cooking Class' then 'Join a hands-on Chagga cooking session with a local host. Dishes and ingredients are confirmed before booking.'
      when 'Materuni & Moshi Town Tour' then 'Combine a locally hosted Materuni experience with a guided visit to Moshi town and its everyday culture.'
      when 'Materuni & Rau Forest Experience' then 'Combine a Materuni village experience with a guided nature walk in Rau Forest. The Rau Forest entrance fee is included in the published package price.'
      when 'Camping & Village Life' then 'Enjoy an overnight village experience in Materuni. Accommodation arrangements, meals and activities are confirmed by your host.'
      else short_description
    end,
    full_description = case experience_key
      when 'Waterfall & Chagga Culture' then 'Join a local host for a guided walk to Materuni Waterfall, then discover Chagga village life and traditional coffee making. Your host confirms the route and experience details before booking.'
      when 'Traditional Coffee Experience' then 'Discover traditional Chagga coffee making in Materuni with a local host, from roasting and grinding to brewing and tasting. Your host confirms the route and shared village activities for your date.'
      when 'Traditional Chagga Cooking Class' then 'Take part in a hands-on Chagga cooking session with a local host. The menu, ingredients and shared village activities are confirmed before booking.'
      when 'Materuni & Moshi Town Tour' then 'Pair a locally hosted Materuni experience with a guided Moshi town visit. The town route, local interpretation and any optional purchases are explained before booking.'
      when 'Materuni & Rau Forest Experience' then 'Combine a locally hosted Materuni experience with a guided nature walk in Rau Forest. The Rau Forest entrance fee is included in the published package price.'
      when 'Camping & Village Life' then 'Enjoy an overnight village experience in Materuni with local hosting and time to discover village life. Accommodation type, meals and next-day activities are confirmed by your host before booking.'
      else full_description
    end,
    inclusions = case experience_key
      when 'Waterfall & Chagga Culture' then '["Local guide","Materuni village and waterfall entrance fees","Traditional Chagga coffee experience and tasting","Local lunch","Drinking water"]'::jsonb
      when 'Traditional Coffee Experience' then '["Local guide","Materuni village and waterfall entrance fees","Hands-on traditional coffee making","Freshly prepared coffee tasting","Local lunch","Drinking water"]'::jsonb
      when 'Traditional Chagga Cooking Class' then '["Local guide","Materuni village and waterfall entrance fees","Traditional Chagga coffee experience","Local lunch","Drinking water","Hands-on Chagga cooking session","Menu and ingredient details confirmed before booking"]'::jsonb
      when 'Materuni & Moshi Town Tour' then '["Local Materuni guide","Materuni village and waterfall entrance fees","Traditional Chagga coffee experience","Local lunch","Drinking water","Guided Moshi town visit","Town route and additional inclusions confirmed before booking"]'::jsonb
      when 'Materuni & Rau Forest Experience' then '["Local Materuni host","Materuni village and waterfall entrance fees","Rau Forest entrance fee included","Guided Rau Forest nature walk","Local lunch","Drinking water","Traditional coffee tasting"]'::jsonb
      when 'Camping & Village Life' then '["Local guide","Materuni village and waterfall entrance fees","Traditional Chagga coffee experience","Local lunch","Drinking water","Overnight village experience with local hosting","Accommodation type, meals and activities confirmed by host"]'::jsonb
      else inclusions
    end,
    exclusions = '["Transport to and from the experience unless separately confirmed","Personal purchases and expenses","Tips and gratuities","Travel insurance","Additional food or drinks not listed under confirmed inclusions"]'::jsonb,
    product_tagline = case experience_key
      when 'Waterfall & Chagga Culture' then 'Waterfall, village heritage & Chagga hospitality'
      when 'Traditional Coffee Experience' then 'From coffee growing to a fresh cup'
      when 'Traditional Chagga Cooking Class' then 'Cook, taste & share Chagga food traditions'
      when 'Materuni & Moshi Town Tour' then 'Materuni village & Moshi town in one day'
      when 'Materuni & Rau Forest Experience' then 'Waterfall, Chagga culture & forest nature'
      when 'Camping & Village Life' then 'A slower Materuni village stay'
      else product_tagline
    end,
    best_for = case experience_key
      when 'Waterfall & Chagga Culture' then 'First-time visitors, nature lovers and travellers interested in Chagga culture'
      when 'Traditional Coffee Experience' then 'Coffee lovers, curious travellers and cultural explorers'
      when 'Traditional Chagga Cooking Class' then 'Food lovers and travellers interested in local cooking traditions'
      when 'Materuni & Moshi Town Tour' then 'Travellers who want to combine Materuni with a guided Moshi town visit'
      when 'Materuni & Rau Forest Experience' then 'Nature lovers and travellers interested in forest ecology'
      when 'Camping & Village Life' then 'Travellers who want to spend more time in Materuni village'
      else best_for
    end,
    signature_moments = case experience_key
      when 'Waterfall & Chagga Culture' then '["Guided walk to Materuni Waterfall","Meet local Chagga hosts and hear about village life","Discover traditional coffee making"]'::jsonb
      when 'Traditional Coffee Experience' then '["Discover local Chagga coffee-growing traditions","Take part in roasting, grinding and brewing","Taste freshly prepared coffee"]'::jsonb
      when 'Traditional Chagga Cooking Class' then '["Discover local ingredients and Chagga food traditions","Prepare selected dishes with a local host","Learn traditional preparation methods"]'::jsonb
      when 'Materuni & Moshi Town Tour' then '["Explore Materuni with a local host","Discover Moshi town with a local guide","Hear about local history and everyday life"]'::jsonb
      when 'Materuni & Rau Forest Experience' then '["Explore Materuni with a local host","Walk through Rau Forest with local nature interpretation","Discover forest ecology and the Mvule tree"]'::jsonb
      when 'Camping & Village Life' then '["Spend more time in Materuni village","Experience local hosting and village life","Confirm overnight arrangements with your host"]'::jsonb
      else signature_moments
    end,
    unique_amenities = case experience_key
      when 'Waterfall & Chagga Culture' then '["Local Chagga host","Traditional coffee making and tasting","Village cultural interpretation"]'::jsonb
      when 'Traditional Coffee Experience' then '["Hands-on traditional coffee preparation","Freshly prepared coffee tasting","Local Chagga coffee stories"]'::jsonb
      when 'Traditional Chagga Cooking Class' then '["Hands-on Chagga cooking session","Local host-led food preparation"]'::jsonb
      when 'Materuni & Moshi Town Tour' then '["Guided Moshi town visit","Local history and everyday-life interpretation"]'::jsonb
      when 'Materuni & Rau Forest Experience' then '["Guided Rau Forest nature walk","Forest interpretation and birdwatching"]'::jsonb
      when 'Camping & Village Life' then '["Overnight village experience","Local host arrangements confirmed before booking"]'::jsonb
      else unique_amenities
    end,
    updated_at = now()
  where is_active = true
    and experience_key in (
      'Waterfall & Chagga Culture',
      'Traditional Coffee Experience',
      'Traditional Chagga Cooking Class',
      'Materuni & Moshi Town Tour',
      'Materuni & Rau Forest Experience',
      'Camping & Village Life'
    );

  get diagnostics updated_count = row_count;
  if updated_count <> 6 then
    raise exception 'Expected to update 6 active catalogue rows, updated %; transaction rolled back.', updated_count;
  end if;
end $$;

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

do $landing_copy_sync$
declare
  current_copy jsonb;
begin
  select setting_value::jsonb into current_copy
  from public.site_settings
  where setting_key = 'landing_pages_content'
  for update;

  if current_copy is null or jsonb_typeof(current_copy->'camping') <> 'object' then
    raise exception 'Expected landing_pages_content.camping object; no landing copy was changed.';
  end if;

  current_copy := jsonb_set(current_copy, '{camping,hero_title}', to_jsonb('An overnight village experience in Materuni'::text), true);
  current_copy := jsonb_set(current_copy, '{camping,hero_intro}', to_jsonb('Spend more time in Materuni with local hosts. Accommodation arrangements, meals and activities are confirmed by your host before booking.'::text), true);
  current_copy := jsonb_set(current_copy, '{camping,story_title}', to_jsonb('More time to experience Materuni Village.'::text), true);
  current_copy := jsonb_set(current_copy, '{camping,story_intro}', to_jsonb('The overnight village experience gives you more time to connect with local hosts and learn about daily life. Accommodation, meals and activities are confirmed for your dates before booking.'::text), true);
  current_copy := jsonb_set(current_copy, '{camping,offers_title}', to_jsonb('Explore an overnight village experience in Materuni.'::text), true);
  current_copy := jsonb_set(current_copy, '{camping,offers_intro}', to_jsonb('Ask about availability and the arrangements for your dates. Your host will confirm accommodation, meals and activities before booking.'::text), true);
  current_copy := jsonb_set(current_copy, '{camping,final_title}', to_jsonb('Stay a little longer in Materuni.'::text), true);
  current_copy := jsonb_set(current_copy, '{camping,final_intro}', to_jsonb('Tell us when you would like to visit and your host will confirm the available overnight arrangements.'::text), true);
  current_copy := jsonb_set(current_copy, '{camping,final_cta}', to_jsonb('Ask about overnight availability'::text), true);

  update public.site_settings
  set setting_value = current_copy::text, updated_at = now()
  where setting_key = 'landing_pages_content';

  if not found then
    raise exception 'landing_pages_content setting was not updated.';
  end if;
end $landing_copy_sync$;


-- Browser clients do not require these table-level privileges. Keep normal
-- SELECT/INSERT/UPDATE/DELETE grants and all existing RLS policies unchanged.
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

-- Both postgres and supabase_admin have public-schema default ACL entries
-- in the live project, so revoke the unsafe privileges for both creators.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON TABLES FROM anon, authenticated;
