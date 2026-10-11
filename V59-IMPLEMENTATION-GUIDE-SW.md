# Materuni Hosts V59 — mahali pa marekebisho

## Muundo wa kurasa
- `src/pages/index.astro` — homepage na sehemu zake zote (hero, experiences, story, reviews, booking, FAQ, map, footer).
- `src/pages/travel-guide.astro` — mwongozo mpya wa Materuni.
- `src/pages/partners.astro` — ukurasa wa washirika, ulihamishwa kutoka `public/partners.html`.
- `src/pages/sustainability.astro` — ukurasa wa responsible tourism, ulihamishwa kutoka `public/sustainability.html`.
- `src/pages/admin.astro` — dashboard ya admin, ulihamishwa kutoka `public/admin.html`; umewekewa `noindex`.
- `src/components/SEO.astro` — sehemu moja ya metadata inayotumiwa na kurasa zote.
- `public/assets/site.css` — responsive type scale, brand tokens, contrast, focus states, mobile safeguards.
- `public/assets/site.js` — Supabase content, availability na booking; timeout/offline/duplicate-submit handling.
- `public/sw.js` — cache mpya `materuni-hosts-v59` ili kuondoa assets za zamani.
- `public/sitemap.xml` na `public/robots.txt` — SEO crawl settings.

## Kuweka mradi kwenye kompyuta
1. Fungua ZIP na uingie ndani ya folder yenye `package.json`.
2. Tumia Node.js LTS.
3. Endesha `npm install`.
4. Endesha `npm run check`.
5. Endesha `npm run build`.
6. Ikiwa hatua ya 4 na 5 zimepita, kagua preview kwa `npm run dev` au `npm run preview` kabla ya deploy.

## Routes
- `/`
- `/travel-guide`
- `/partners`
- `/sustainability`
- `/admin` (private; noindex)

Vercel redirects zinahifadhi viungo vya zamani vya `.html`.

## Muhimu kuhusu picha
Nembo ya WebP ipo tayari na imetumika kwa tovuti na OG/Twitter. PNG za PWA zimeachwa kwa sababu manifest inazitumia. Picha za uzoefu zinazotoka Supabase Storage hazikubadilishwa kwa wingi kwa sababu hazipo kama source files ndani ya ZIP hii; hakikisha unapakia picha za wageni katika WebP/JPEG zilizopunguzwa ukubwa kabla ya kuziweka kwenye bucket.

## Tahadhari ya kabla ya deploy
Build ya Astro haikuthibitishwa hapa: `npm install` ilikwama kwa timeout na `node_modules` haikuwepo. Usitumie Netlify/Vercel deployment credits mpaka `npm run check` na `npm run build` zipite kwenye mazingira yenye dependencies.
