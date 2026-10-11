import { defineConfig } from 'astro/config';

// Static Astro output works on Vercel. Netlify config is retained only for temporary testing.
// Supabase remains the remote backend; never put a service-role key in this frontend.
export default defineConfig({
  output: 'static',
  build: { assets: '_astro' },
});
