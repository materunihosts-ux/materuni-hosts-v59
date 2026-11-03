-- Correct stale public prices embedded in saved German, Spanish and French FAQ translations.
-- language_content stores faq_items_json as a JSON-encoded string inside JSON.
update public.site_settings
set setting_value = jsonb_set(
  setting_value::jsonb,
  '{de,faq_items_json}',
  to_jsonb(replace(replace(replace(replace(replace(replace(
    setting_value::jsonb #>> '{de,faq_items_json}',
    'Materuni Waterfall & Chagga Culture (45 $)', 'Materuni Waterfall & Chagga Culture (40 $)'),
    'Materuni Coffee & Chagga Culture (41 $)', 'Materuni Coffee & Chagga Culture (36 $)'),
    'Traditional Chagga Cooking (55 $)', 'Traditional Chagga Cooking (49 $)'),
    'Materuni & Moshi Town (59 $)', 'Materuni & Moshi Town (52 $)'),
    'Materuni & Rau Forest (65 $)', 'Materuni & Rau Forest (58 $)'),
    'Materuni Overnight Village Experience (101 $)', 'Materuni Overnight Village Experience (90 $)'),
  false
)::text
where setting_key = 'language_content'
  and setting_value::jsonb #>> '{de,faq_items_json}' is not null;

update public.site_settings
set setting_value = jsonb_set(
  setting_value::jsonb,
  '{es,faq_items_json}',
  to_jsonb(replace(replace(replace(replace(replace(replace(
    setting_value::jsonb #>> '{es,faq_items_json}',
    'Materuni Waterfall & Chagga Culture ($45)', 'Materuni Waterfall & Chagga Culture ($40)'),
    'Materuni Coffee & Chagga Culture ($41)', 'Materuni Coffee & Chagga Culture ($36)'),
    'Traditional Chagga Cooking ($55)', 'Traditional Chagga Cooking ($49)'),
    'Materuni & Moshi Town ($59)', 'Materuni & Moshi Town ($52)'),
    'Materuni & Rau Forest ($65)', 'Materuni & Rau Forest ($58)'),
    'Materuni Overnight Village Experience ($101)', 'Materuni Overnight Village Experience ($90)'),
  false
)::text
where setting_key = 'language_content'
  and setting_value::jsonb #>> '{es,faq_items_json}' is not null;

update public.site_settings
set setting_value = jsonb_set(
  setting_value::jsonb,
  '{fr,faq_items_json}',
  to_jsonb(replace(replace(replace(replace(replace(replace(
    setting_value::jsonb #>> '{fr,faq_items_json}',
    'Materuni Waterfall & Chagga Culture (45 $)', 'Materuni Waterfall & Chagga Culture (40 $)'),
    'Materuni Coffee & Chagga Culture (41 $)', 'Materuni Coffee & Chagga Culture (36 $)'),
    'Traditional Chagga Cooking (55 $)', 'Traditional Chagga Cooking (49 $)'),
    'Materuni & Moshi Town (59 $)', 'Materuni & Moshi Town (52 $)'),
    'Materuni & Rau Forest (65 $)', 'Materuni & Rau Forest (58 $)'),
    'Materuni Overnight Village Experience (101 $)', 'Materuni Overnight Village Experience (90 $)'),
  false
)::text
where setting_key = 'language_content'
  and setting_value::jsonb #>> '{fr,faq_items_json}' is not null;
