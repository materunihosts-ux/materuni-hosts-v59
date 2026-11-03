-- Correct stale public prices embedded in the saved German, Spanish and French FAQ translations.
-- The language_content setting stores faq_items_json as a JSON-encoded string inside JSON.
update public.site_settings s
set setting_value = jsonb_set(
  s.setting_value::jsonb,
  array[v.language_code, 'faq_items_json'],
  to_jsonb(
    case v.language_code
      when 'de' then replace(replace(replace(replace(replace(replace(
        s.setting_value::jsonb #>> array[v.language_code, 'faq_items_json'],
        'Materuni Waterfall & Chagga Culture (45 $)', 'Materuni Waterfall & Chagga Culture (40 $)'),
        'Materuni Coffee & Chagga Culture (41 $)', 'Materuni Coffee & Chagga Culture (36 $)'),
        'Traditional Chagga Cooking (55 $)', 'Traditional Chagga Cooking (49 $)'),
        'Materuni & Moshi Town (59 $)', 'Materuni & Moshi Town (52 $)'),
        'Materuni & Rau Forest (65 $)', 'Materuni & Rau Forest (58 $)'),
        'Materuni Overnight Village Experience (101 $)', 'Materuni Overnight Village Experience (90 $)')
      when 'fr' then replace(replace(replace(replace(replace(replace(
        s.setting_value::jsonb #>> array[v.language_code, 'faq_items_json'],
        'Materuni Waterfall & Chagga Culture (45 $)', 'Materuni Waterfall & Chagga Culture (40 $)'),
        'Materuni Coffee & Chagga Culture (41 $)', 'Materuni Coffee & Chagga Culture (36 $)'),
        'Traditional Chagga Cooking (55 $)', 'Traditional Chagga Cooking (49 $)'),
        'Materuni & Moshi Town (59 $)', 'Materuni & Moshi Town (52 $)'),
        'Materuni & Rau Forest (65 $)', 'Materuni & Rau Forest (58 $)'),
        'Materuni Overnight Village Experience (101 $)', 'Materuni Overnight Village Experience (90 $)')
      when 'es' then replace(replace(replace(replace(replace(replace(
        s.setting_value::jsonb #>> array[v.language_code, 'faq_items_json'],
        'Materuni Waterfall & Chagga Culture ($45)', 'Materuni Waterfall & Chagga Culture ($40)'),
        'Materuni Coffee & Chagga Culture ($41)', 'Materuni Coffee & Chagga Culture ($36)'),
        'Traditional Chagga Cooking ($55)', 'Traditional Chagga Cooking ($49)'),
        'Materuni & Moshi Town ($59)', 'Materuni & Moshi Town ($52)'),
        'Materuni & Rau Forest ($65)', 'Materuni & Rau Forest ($58)'),
        'Materuni Overnight Village Experience ($101)', 'Materuni Overnight Village Experience ($90)')
    end
  ),
  false
)::text
from (values ('de'), ('es'), ('fr')) as v(language_code)
where s.setting_key = 'language_content'
  and s.setting_value::jsonb ? v.language_code
  and s.setting_value::jsonb #>> array[v.language_code, 'faq_items_json'] is not null;
