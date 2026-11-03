-- Align the live public experience catalogue with Materuni Hosts' approved direct-booking prices.
-- Public prices are USD per person. TZS equivalents are displayed only where an approved amount exists.
insert into public.experience_catalog (experience_key, display_name, price_usd, sort_order, is_active)
values
  ('Waterfall & Chagga Culture', 'Materuni Waterfall & Chagga Village Experience', 40, 10, true),
  ('Traditional Coffee Experience', 'Materuni Coffee & Chagga Culture Experience', 36, 20, true),
  ('Traditional Chagga Cooking Class', 'Materuni Chagga Cooking & Village Experience', 49, 30, true),
  ('Materuni & Moshi Town Tour', 'Materuni & Moshi Town Cultural Tour', 52, 40, true),
  ('Materuni & Rau Forest Experience', 'Materuni & Rau Forest Nature Experience', 58, 50, true),
  ('Camping & Village Life', 'Materuni Overnight Village Experience', 90, 60, true)
on conflict (experience_key) do update set
  display_name = excluded.display_name,
  price_usd = excluded.price_usd,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();


-- Give the two additional day-trip records the content needed by catalogue-driven cards.
update public.experience_catalog
set short_description = 'Pair the shared Materuni day experience with a guided Moshi town visit. Explore local history, everyday life and the market area with a local guide.',
    full_description = 'Pair the shared Materuni day experience with a guided Moshi town visit. Explore the town with a local guide, learn about its history and everyday life, and discover its streets and market area.',
    image_url = 'https://sskmzswoeljxwojcszta.supabase.co/storage/v1/object/public/materuni-images/story_image/1791995912146-materuni-community.jpg',
    duration_label = '7–8 hours',
    inclusions = '["Professional local Materuni guide","Materuni village and waterfall entrance fees","Traditional Chagga coffee experience","Authentic local lunch","One bottle of drinking water","Guided Moshi town walk with local guide"]'::jsonb,
    exclusions = '["Transport to and from Materuni unless arranged separately","Personal purchases and expenses","Tips and gratuities"]'::jsonb,
    product_tagline = 'Materuni village & Moshi town',
    best_for = 'Guests interested in village life and Moshi town history',
    signature_moments = '["Guided Moshi town walk","Local history and everyday-life interpretation","Local market walk"]'::jsonb,
    unique_amenities = '["Guided Moshi town walk with a local town guide","Local history and everyday-life interpretation","Local market walk and cultural orientation"]'::jsonb,
    updated_at = now()
where experience_key = 'Materuni & Moshi Town Tour';

update public.experience_catalog
set short_description = 'Combine the shared Materuni day experience with a guided nature walk in Rau Forest near Moshi, including the ancient Mvule tree and birdlife.',
    full_description = 'Combine the shared Materuni day experience with a guided nature walk in Rau Forest near Moshi. Discover forest ecology, birdlife, the ancient Mvule tree and nearby rice fields. The Rau Forest entrance fee is already included in the package price.',
    image_url = 'https://sskmzswoeljxwojcszta.supabase.co/storage/v1/object/public/materuni-images/story_image/1791601761441-q3iog8mni3r.jpg',
    duration_label = '7–8 hours',
    inclusions = '["Professional local Materuni guide","Materuni village and waterfall entrance fees","Traditional Chagga coffee experience","Authentic local lunch","One bottle of drinking water","Guided Rau Forest nature walk","Rau Forest entrance fee"]'::jsonb,
    exclusions = '["Transport to and from Materuni unless arranged separately","Personal purchases and expenses","Tips and gratuities"]'::jsonb,
    product_tagline = 'Waterfall, culture & forest nature',
    best_for = 'Guests interested in forest ecology, birdlife and nature',
    signature_moments = '["Guided Rau Forest nature walk","Ancient Mvule tree","Nearby rice-field discovery"]'::jsonb,
    unique_amenities = '["Guided Rau Forest nature walk","Forest interpretation and birdwatching","Ancient Mvule tree and nearby rice-field discovery"]'::jsonb,
    updated_at = now()
where experience_key = 'Materuni & Rau Forest Experience';

-- This legacy package was replaced by the six current public experiences.
update public.experience_catalog
set is_active = false,
    updated_at = now()
where experience_key in (
  'Materuni Waterfall Hike & Cultural Day Trip',
  'The Ultimate Kilimanjaro Foothills & Materuni Experience'
);
