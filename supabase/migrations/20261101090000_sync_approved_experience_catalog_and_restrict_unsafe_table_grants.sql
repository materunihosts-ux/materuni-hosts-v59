-- Materuni Hosts: synchronize approved public experience catalogue values.
-- This migration intentionally updates only the six active, approved experiences.
-- Chemka and Marangu remain enquiry-only and are not inserted into the bookable catalogue.

DO $$
BEGIN
  UPDATE public.experience_catalog
     SET display_name = 'Materuni Waterfall & Chagga Village Experience',
         price_usd = 40.00,
         is_active = true,
         sort_order = 10
   WHERE experience_key = 'Waterfall & Chagga Culture' AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expected active catalogue row missing: Waterfall & Chagga Culture'; END IF;

  UPDATE public.experience_catalog
     SET display_name = 'Traditional Chagga Coffee Experience',
         price_usd = 36.00,
         is_active = true,
         sort_order = 20
   WHERE experience_key = 'Traditional Coffee Experience' AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expected active catalogue row missing: Traditional Coffee Experience'; END IF;

  UPDATE public.experience_catalog
     SET display_name = 'Traditional Chagga Cooking Class',
         price_usd = 49.00,
         is_active = true,
         sort_order = 30
   WHERE experience_key = 'Traditional Chagga Cooking Class' AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expected active catalogue row missing: Traditional Chagga Cooking Class'; END IF;

  UPDATE public.experience_catalog
     SET display_name = 'Materuni & Moshi Town Cultural Experience',
         price_usd = 52.00,
         is_active = true,
         sort_order = 40
   WHERE experience_key = 'Materuni & Moshi Town Tour' AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expected active catalogue row missing: Materuni & Moshi Town Tour'; END IF;

  UPDATE public.experience_catalog
     SET display_name = 'Materuni & Rau Forest Nature Experience',
         price_usd = 58.00,
         is_active = true,
         sort_order = 50
   WHERE experience_key = 'Materuni & Rau Forest Experience' AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expected active catalogue row missing: Materuni & Rau Forest Experience'; END IF;

  UPDATE public.experience_catalog
     SET display_name = 'Materuni Overnight Village Experience',
         price_usd = 90.00,
         is_active = true,
         sort_order = 60
   WHERE experience_key = 'Camping & Village Life' AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expected active catalogue row missing: Camping & Village Life'; END IF;
END $$;

-- These privileges are not required by browser clients or ordinary signed-in users.
-- Keep SELECT/INSERT/UPDATE/DELETE grants and RLS policies unchanged.
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

-- Prevent the same unsafe privileges being inherited by newly created public tables.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON TABLES FROM anon, authenticated;
