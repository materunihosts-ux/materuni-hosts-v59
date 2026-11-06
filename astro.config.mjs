import { defineConfig, passthroughImageService } from 'astro/config';

// Static Astro output works on Vercel. Netlify config is retained only for temporary testing.
// Supabase remains the remote backend; never put a service-role key in this frontend.
export default defineConfig({
  site: 'https://materunihosts.com',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  image: {
    remotePatterns: [{ protocol: 'https', hostname: 'sskmzswoeljxwojcszta.supabase.co', pathname: '/storage/v1/object/public/materuni-images/**' }],
    // Supabase currently returns HTTP 402 after the project quota was exhausted.
    // Keep Astro builds independent of remote image availability; restore Sharp
    // optimisation after image delivery is recovered or assets are migrated.
    service: passthroughImageService(),\n  },
  output: 'static',
  build: { assets: '_astro' },
});
