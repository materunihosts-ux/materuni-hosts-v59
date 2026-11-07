/** Public navigation is authored with the website and does not require a CMS lookup. */
export const primaryNavigation = [
  { href: "/", key: "nav_home", label: "Home" },
  { href: "/experiences", key: "nav_experiences", label: "All Experiences" },
  { href: "/about-us", key: "nav_about", label: "About us" },
  { href: "/camping", key: "nav_camping", label: "Village stay" },
  { href: "/journal", key: "nav_journal", label: "Journal" },
  { href: "/faq", key: "nav_faqs", label: "FAQs" }
] as const;
export const primaryNavigationCta = { href: "/booking", key: "nav_availability", label: "Check availability" } as const;
export const supportedLanguages = [
  { code: "en", label: "EN", name: "English" },
  { code: "es", label: "ES", name: "Español" },
  { code: "fr", label: "FR", name: "Français" },
  { code: "de", label: "DE", name: "Deutsch" }
] as const;
