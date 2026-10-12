/**
 * Central public Supabase configuration for all browser-side site modules.
 * The publishable key is public by design; never expose service-role keys here.
 */
const configuredUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
const configuredKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!configuredUrl || !configuredKey) {
  throw new Error("Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
}

export const supabaseUrl = configuredUrl.replace(/\/+$/, "");
export const publishableKey = configuredKey;
