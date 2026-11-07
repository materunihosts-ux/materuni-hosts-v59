import { defineConfig, passthroughImageService } from 'astro/config';

// Static Astro output works on Vercel. Netlify config is retained only for temporary testing.
// Supabase remains the remote backend; never put a service-role key in this frontend.
// Temporary build safeguard: avoid downloading remote Supabase images during CI while
// the Storage endpoint is returning HTTP 402. Restore Sharp optimization after assets
// have been migrated into the repository and their local files have been verified.
export default defineConfig({
  site: 'https://materunihosts.com',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  image: {
    service: passthroughImageService(),
    remotePatterns: [{ protocol: 'https', hostname: 'sskmzswoeljxwojcszta.supabase.co', pathname: '/storage/v1/object/public/materuni-images/**' }]
  },
  output: 'static',
  build: { assets: '_astro' },
});
