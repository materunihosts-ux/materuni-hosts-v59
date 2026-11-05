const ADMIN_SESSION_KEY = "materuni-admin-session-v1";

export function saveAdminSession(session) {
  if (typeof window === "undefined" || !session?.access_token || !session?.refresh_token || !session?.user?.id) return;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = Number(session.expires_at) || now + Number(session.expires_in || 3600);
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: expiresAt,
    user_id: session.user.id
  }));
}

export function clearAdminSession() {
  if (typeof window !== "undefined") sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export async function restoreAdminSession(supabaseUrl, publishableKey) {
  if (typeof window === "undefined") return null;
  let saved;
  try {
    saved = JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY) || "null");
  } catch {
    clearAdminSession();
    return null;
  }
  if (!saved?.access_token || !saved?.refresh_token || !saved?.user_id) return null;

  const now = Math.floor(Date.now() / 1000);
  if (Number(saved.expires_at || 0) <= now + 60) {
    try {
      const response = await fetch(supabaseUrl + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: { apikey: publishableKey, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: saved.refresh_token })
      });
      const refreshed = await response.json().catch(() => null);
      if (!response.ok || !refreshed?.access_token || !refreshed?.refresh_token) {
        clearAdminSession();
        return null;
      }
      saveAdminSession(refreshed);
      saved = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: refreshed.expires_at || now + Number(refreshed.expires_in || 3600),
        user_id: refreshed.user?.id || saved.user_id
      };
    } catch {
      return null;
    }
  }

  try {
    const response = await fetch(
      supabaseUrl + "/rest/v1/admin_users?select=user_id&user_id=eq." + encodeURIComponent(saved.user_id),
      { headers: { apikey: publishableKey, Authorization: "Bearer " + saved.access_token }, cache: "no-store" }
    );
    const admins = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(admins) || admins.length !== 1) {
      clearAdminSession();
      return null;
    }
    return { accessToken: saved.access_token, userId: saved.user_id };
  } catch {
    return null;
  }
}

export async function signOutAdmin(supabaseUrl, publishableKey, accessToken) {
  try {
    if (accessToken) {
      await fetch(supabaseUrl + "/auth/v1/logout", {
        method: "POST",
        headers: { apikey: publishableKey, Authorization: "Bearer " + accessToken }
      });
    }
  } catch {
    // Clear the browser session even if the network is unavailable.
  } finally {
    clearAdminSession();
  }
}
