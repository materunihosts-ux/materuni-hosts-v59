/**
 * Static public business identity. Keep non-transactional website facts here.
 * Customer records, bookings, availability and payments must never be placed here.
 */
export const siteContent = {
  name: "Materuni Hosts",
  url: "https://materunihosts.com/",
  logo: "https://materunihosts.com/materuni-hosts-logo-round.svg",
  email: "hello@materunihosts.com",
  telephone: "+255612068540",
  whatsapp: "+255612068540",
  currency: ["USD", "TZS"],
  language: ["English", "Swahili"],
  address: {
    streetAddress: "Materuni Juu, Moshi Rural",
    addressLocality: "Materuni Village",
    addressRegion: "Kilimanjaro",
    postalCode: "25210",
    addressCountry: "TZ"
  },
  areaServed: "Materuni Village, Moshi Rural, Kilimanjaro, Tanzania",
  description: "Materuni Hosts introduces visitors to Materuni Village through locally hosted waterfall walks, Chagga coffee traditions, cooking and cultural experiences in the Kilimanjaro foothills near Moshi, Tanzania."
} as const;
