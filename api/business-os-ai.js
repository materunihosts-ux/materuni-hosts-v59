const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin" }, body: JSON.stringify(body) });

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const host = req.headers.host || "";
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.host !== host) return res.status(403).json({ error: "Origin not allowed." });
    } catch { return res.status(403).json({ error: "Invalid origin." }); }
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Sign in is required." });

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || "https://sskmzswoeljxwojcszta.supabase.co").replace(/\/+$/, "");
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseKey) return res.status(503).json({ error: "Server authentication is not configured. Add SUPABASE_PUBLISHABLE_KEY to Vercel server environment." });

  try {
    const userResponse = await fetch(supabaseUrl + "/auth/v1/user", { headers: { apikey: supabaseKey, Authorization: "Bearer " + token } });
    if (!userResponse.ok) return res.status(401).json({ error: "Your session is invalid or expired. Sign in again." });
    const user = await userResponse.json();
    const adminResponse = await fetch(supabaseUrl + "/rest/v1/admin_users?select=user_id&user_id=eq." + encodeURIComponent(user.id), { headers: { apikey: supabaseKey, Authorization: "Bearer " + token, Accept: "application/json" } });
    if (!adminResponse.ok) return res.status(403).json({ error: "Could not verify administrator permissions." });
    const admins = await adminResponse.json();
    if (!Array.isArray(admins) || admins.length === 0) return res.status(403).json({ error: "Administrator access is required." });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const provider = body.provider;
    if (prompt.length < 10 || prompt.length > 6000) return res.status(400).json({ error: "Enter a task between 10 and 6,000 characters." });
    const providers = {
      openai: { key: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || "gpt-4.1-mini" },
      anthropic: { key: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL || "claude-3-7-sonnet-latest" },
      google: { key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || "gemini-2.5-flash" }
    };
    if (!providers[provider]) return res.status(400).json({ error: "Choose OpenAI, Anthropic or Google Gemini." });
    const config = providers[provider];
    if (!config.key) return res.status(503).json({ error: provider + " is not connected yet. Add its API key as a server-only Vercel environment variable, then redeploy this preview." });

    const system = "You are the Materuni Hosts Business OS assistant. Help operate a community-led cultural tourism business in Materuni Village, Tanzania. Be accurate, practical and concise. Do not invent prices, availability, reviews, cultural facts, bookings, analytics or integrations. Treat all external actions as proposals only: you cannot publish, send messages, change budgets, alter bookings, or modify production systems. Mark assumptions and request verification when facts are missing. Use the approved brand voice: authentic Chagga heritage, warm human storytelling, simple premium presentation; not generic safari marketplace copy.";
    let answer = "";
    if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: "Bearer " + config.key, "Content-Type": "application/json" }, body: JSON.stringify({ model: config.model, instructions: system, input: prompt, max_output_tokens: 1400 }) });
      const d = await r.json();
      if (!r.ok) return res.status(502).json({ error: "OpenAI could not complete this request. Check provider status and API billing, then retry." });
      answer = (d.output || []).flatMap(x => x.content || []).filter(x => x.type === "output_text").map(x => x.text).join("\n");
    } else if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": config.key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" }, body: JSON.stringify({ model: config.model, max_tokens: 1400, system, messages: [{ role: "user", content: prompt }] }) });
      const d = await r.json();
      if (!r.ok) return res.status(502).json({ error: "Claude could not complete this request. Check provider status and API billing, then retry." });
      answer = (d.content || []).filter(x => x.type === "text").map(x => x.text).join("\n");
    } else {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(config.model) + ":generateContent?key=" + encodeURIComponent(config.key), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 1400 } }) });
      const d = await r.json();
      if (!r.ok) return res.status(502).json({ error: "Gemini could not complete this request. Check provider status and API billing, then retry." });
      answer = (d.candidates || []).flatMap(x => x.content?.parts || []).map(x => x.text || "").join("\n");
    }
    if (!answer.trim()) return res.status(502).json({ error: "The provider returned an empty response." });
    return res.status(200).json({ answer, provider, model: config.model, generatedAt: new Date().toISOString(), mode: "draft_only" });
  } catch (error) {
    return res.status(500).json({ error: "AI request failed safely. Check the deployment runtime logs and try again." });
  }
};
