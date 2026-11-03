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

-- This legacy package was replaced by the six current public experiences.
update public.experience_catalog
set is_active = false,
    updated_at = now()
where experience_key in (
  'Materuni Waterfall Hike & Cultural Day Trip',
  'The Ultimate Kilimanjaro Foothills & Materuni Experience'
);
