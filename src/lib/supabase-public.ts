/**
 * Central public Supabase configuration for all browser-side site modules.
 * The publishable key is public by design; never expose service-role keys here.
 */
const envUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
const envKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

const configuredUrl = (envUrl && !envUrl.includes("YOUR_PROJECT_REF"))
  ? envUrl
  : "https://sskmzswoeljxwojcszta.supabase.co";

const configuredKey = (envKey && !envKey.includes("YOUR_SUPABASE_PUBLISHABLE_KEY"))
  ? envKey
  : "sb_publishable_G9ru4P_yKzievqiXjXEEbQ_p28cB_NZ";

export const supabaseUrl = configuredUrl.replace(/\/+$/, "");
export const publishableKey = configuredKey;
