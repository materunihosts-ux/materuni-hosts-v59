import { defineConfig, passthroughImageService } from 'astro/config';

// Static Astro output works on Vercel. Netlify config is retained only for temporary testing.
// Supabase remains the remote backend; never put a service-role key in this frontend.
export default defineConfig({
  site: 'https://materunihosts.com',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  image: {\n    remotePatterns: [{ protocol: 'https', hostname: 'sskmzswoeljxwojcszta.supabase.co', pathname: '/storage/v1/object/public/materuni-images/**' }],\n    // Supabase currently returns HTTP 402 after the project quota was exhausted.\n    // Keep Astro builds independent of remote image availability; restore Sharp\n    // optimisation after image delivery is recovered or assets are migrated.\n    service: passthroughImageService(),\n  },
  output: 'static',
  build: { assets: '_astro' },
});
