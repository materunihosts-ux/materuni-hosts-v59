import { siteContent } from "./site-content";

/** Global SEO defaults. Individual routes may override title and description in SiteLayout props. */
export const seoDefaults = {
  siteName: siteContent.name,
  siteUrl: siteContent.url,
  title: "Materuni Hosts | Authentic Chagga Experiences",
  description: "Discover authentic Chagga coffee, waterfalls, food and village life in Materuni, Kilimanjaro, Tanzania.",
  defaultLanguage: "en",
  robots: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
  socialImage: "https://sskmzswoeljxwojcszta.supabase.co/storage/v1/object/public/materuni-images/hero_image/1791995544192-materuni-waterfall.jpg"
} as const;
