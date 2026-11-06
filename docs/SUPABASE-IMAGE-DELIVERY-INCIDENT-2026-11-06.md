# Supabase image delivery incident — 6 November 2026

## Observed evidence
The GitHub Actions build on the Intelligence OS draft branch reached Astro image generation, then failed because multiple public objects in the `materuni-images` Supabase Storage bucket returned HTTP 402. This is consistent with the previously reported project/organisation quota exhaustion.

Affected examples observed in the build log included the camping hero, community story image, coffee plantation story, waterfall trail, coffee lesson and optimized WebP objects. The failure is not a malformed image URL or an Astro syntax error; the remote origin refused delivery.

## Immediate build mitigation
- Replace Astro `<Image>` / `getImage()` processing for remote Supabase objects with native HTML `<img>` elements. This prevents static builds from fetching the remote source at build time.
- Preserve explicit alt text, width and height attributes, loading priority and the existing original image URLs.
- Keep Astro's default image service available for future local assets. Remote Supabase images are not transformed into build-time WebP/srcset variants until their source can be fetched reliably.
- It does **not** restore the Supabase bucket. If the origin still returns HTTP 402, visitors and preview browsers will still see missing remote images.

## Proper recovery options
1. Restore the existing Supabase project/storage service within the available quota and verify representative public object URLs return HTTP 200.
2. Or migrate the verified original image assets to a separately configured static/CDN image host (for example the planned Hostinger hosting) and update the CMS/image URL contract in a controlled batch.
3. After image delivery is stable, re-enable Sharp optimisation and verify generated formats, sizes, cache headers, responsive srcsets and Core Web Vitals.

## Safety
- No Storage objects were deleted or copied.
- No Supabase billing, project settings, bucket policies or database records were changed.
- No production deployment was performed.
- Before migration, preserve original files, source/licence records, alt text and current CMS references. Do not replace images with generated or unrelated stock images.

## Verification status
The SEO regression suite passed 21/21 tests on commit `9ae5c2f50808a4070f381d0ee421993c5ef02404`. That commit's Astro check then exposed a separate stray-character issue in the crawler page, corrected in a later commit. The latest build after replacing remote Astro image processing with native `<img>` elements must complete before this mitigation is considered verified.
