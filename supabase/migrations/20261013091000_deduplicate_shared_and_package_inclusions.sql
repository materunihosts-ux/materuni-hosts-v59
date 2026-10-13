-- Shared service standards are rendered once across the public catalogue.
-- Keep each package's own inclusions limited to its genuinely additional items.
UPDATE public.experience_catalog
SET inclusions = CASE experience_key
  WHEN 'Waterfall & Chagga Culture' THEN '[]'::jsonb
  WHEN 'Traditional Coffee Experience' THEN '[]'::jsonb
  WHEN 'Traditional Chagga Cooking Class' THEN '["Hands-on Chagga cooking experience"]'::jsonb
  WHEN 'Materuni Waterfall Hike & Cultural Day Trip' THEN '[]'::jsonb
  WHEN 'Camping & Village Life' THEN '["Camping gear setup", "Dinner and breakfast"]'::jsonb
  WHEN 'The Ultimate Kilimanjaro Foothills & Materuni Experience' THEN '["Enhanced camping equipment setup", "Dinner, breakfast and an additional special meal experience"]'::jsonb
  ELSE inclusions
END,
updated_at = now()
WHERE experience_key IN (
  'Waterfall & Chagga Culture',
  'Traditional Coffee Experience',
  'Traditional Chagga Cooking Class',
  'Materuni Waterfall Hike & Cultural Day Trip',
  'Camping & Village Life',
  'The Ultimate Kilimanjaro Foothills & Materuni Experience'
);