/**
 * Public browser configuration for Materuni Hosts.
 * Supabase publishable keys are public by design. Never expose service-role keys here.
 */
const fallbackUrl = "https://sskmzswoeljxwojcszta.supabase.co";
const fallbackKey = "sb_publishable_G9ru4P_yKzievqiXjXEEbQ_p28cB_NZ";
const configuredUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
const configuredKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
export const supabaseUrl = (configuredUrl || fallbackUrl).replace(/\/+$/, "");
export const publishableKey = configuredKey || fallbackKey;
