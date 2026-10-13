-- Keep the premium overnight package aligned with the approved offer:
-- same one-night tent accommodation, enhanced camping equipment and one
-- additional special meal experience. Do not specify an unconfirmed meal type.

UPDATE public.experience_catalog
SET duration_label = '1 night'
WHERE experience_key IN (
  'Camping & Village Life',
  'The Ultimate Kilimanjaro Foothills & Materuni Experience'
);

UPDATE public.experience_catalog
SET
  unique_amenities = '[
    "One-night tent accommodation",
    "Enhanced camping equipment",
    "Additional special meal experience"
  ]'::jsonb,
  signature_moments = '[
    "Settle into the one-night tent accommodation with enhanced camping equipment",
    "Enjoy the additional special meal experience",
    "Share an evening around the campfire with local stories"
  ]'::jsonb,
  inclusions = '[
    "Professional local guide",
    "Village / entrance fees",
    "Enhanced camping equipment setup",
    "Dinner, breakfast, an additional special meal experience and drinking water"
  ]'::jsonb
WHERE experience_key = 'The Ultimate Kilimanjaro Foothills & Materuni Experience';
