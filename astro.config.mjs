import { defineConfig } from 'astro/config';

// Static Astro output works on Vercel. Netlify config is retained only for temporary testing.
// Supabase remains the remote backend; never put a service-role key in this frontend.
export default defineConfig({
  site: 'https://materunihosts.com',
  image: { remotePatterns: [{ protocol: 'https', hostname: 'sskmzswoeljxwojcszta.supabase.co', pathname: '/storage/v1/object/public/materuni-images/**' }] },
  output: 'static',
  build: { assets: '_astro' },
});
