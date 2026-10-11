import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const fallback: Record<string, string> = {
  en: "I can help you plan your Materuni visit. Our six experiences are Waterfalls & Coffee Tour ($65), Coffee & Chagga Culture Tour ($50), Cooking & Culture ($70), Waterfall Hike & Cultural Day Trip ($75), Overnight Camping ($110) and Ultimate ($135) per person. Which date are you considering, and how many guests will be travelling?",
  es: "Puedo ayudarte a planificar tu visita a Materuni. Ofrecemos seis experiencias: Waterfalls & Coffee Tour ($65), Coffee & Chagga Culture ($50), Cooking & Culture ($70), Waterfall Hike & Cultural Day Trip ($75), Overnight Camping ($110) y Ultimate ($135) por persona. ¿Qué fecha tienes en mente y cuántas personas viajarán?",
  fr: "Je peux vous aider à organiser votre visite à Materuni. Nos six expériences sont : Waterfalls & Coffee Tour (65 $), Coffee & Chagga Culture (50 $), Cooking & Culture (70 $), Waterfall Hike & Cultural Day Trip (75 $), Overnight Camping (110 $) et Ultimate (135 $) par personne. Quelle date envisagez-vous et combien de personnes voyageront ?",
  de: "Ich helfe Ihnen gern bei der Planung Ihres Besuchs in Materuni. Unsere sechs Erlebnisse sind: Waterfalls & Coffee Tour (65 $), Coffee & Chagga Culture (50 $), Cooking & Culture (70 $), Waterfall Hike & Cultural Day Trip (75 $), Overnight Camping (110 $) und Ultimate (135 $) pro Person. Für welches Datum planen Sie und wie viele Gäste reisen mit?"
};

const systemPrompt = `You are the friendly guest concierge for Materuni Hosts, a boutique local experience host in Materuni Village near Moshi, Kilimanjaro, Tanzania.
Your job is to help visitors choose an experience and move naturally toward an availability check or itinerary request.
Use the visitor's language: English, Spanish, French or German. Be warm, concise and specific.
Only use these approved per-person prices: Waterfalls & Coffee Tour $65; Coffee & Chagga Culture Tour $50; Cooking & Culture $70; Waterfall Hike & Cultural Day Trip $75; Overnight Camping $110; Ultimate $135.
The Materuni waterfall is approximately 95 metres high. The experiences are hosted in Materuni Village and focus on Chagga coffee, food, culture, nature and village life.
Important booking rules: a website booking is a request, not a confirmed reservation; the host must confirm availability and arrangements; no online payment is taken at this stage; transport/pickup must be confirmed separately. Do not invent schedules, available spaces, transport inclusions, policies, licences, awards, ratings, reviews or claims of registration.
Ask only one useful follow-up at a time, usually travel date, group size, preferred experience or pickup point.
For next steps, direct visitors to https://materunihosts.com/booking or https://materunihosts.com/itinerary. For a human host, offer WhatsApp https://wa.me/255612068540.
Never ask for passport, card, password or sensitive personal data. Do not claim to have made a booking.`;

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await request.json().catch(() => null);
    const message = String(body?.message ?? "").trim().slice(0, 1200);
    const language = ["en", "es", "fr", "de"].includes(String(body?.language ?? "en"))
      ? String(body?.language ?? "en") : "en";
    let sessionId = String(body?.session_id ?? "").trim();
    let sessionToken = String(body?.session_token ?? "").trim();
    if (!message) return json({ error: "Please enter a message." }, 400);


    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Guest assistant is temporarily unavailable." }, 503);
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    const sha256 = async (value: string) => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
      return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
    };
    if (ip) {
      const ipHash = await sha256(ip);
      const { data: rate } = await supabase.from("guest_chat_rate_limits").select("*").eq("ip_hash", ipHash).maybeSingle();
      const expired = !rate || Date.now() - new Date(rate.window_started_at).getTime() >= 3600000;
      if (!expired && Number(rate.request_count) >= 100) return json({ error: "Please pause before sending more messages." }, 429);
      await supabase.from("guest_chat_rate_limits").upsert({ ip_hash: ipHash, window_started_at: expired ? new Date().toISOString() : rate.window_started_at, request_count: expired ? 1 : Number(rate.request_count) + 1, updated_at: new Date().toISOString() }, { onConflict: "ip_hash" });
    }
    let conversation: { id: string; session_id: string } | null = null;
    let newSession = false;
    if (sessionId) {
      if (!sessionToken || !/^[0-9a-f-]{36}$/i.test(sessionId)) return json({ error: "Your chat session has expired. Please start a new conversation." }, 401);
      const tokenHash = await sha256(sessionToken);
      const { data, error } = await supabase.from("ai_conversations").select("id, session_id").eq("session_id", sessionId).eq("session_token_hash", tokenHash).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Your chat session could not be verified. Please start a new conversation." }, 401);
      conversation = data;
    } else {
      sessionId = crypto.randomUUID();
      sessionToken = crypto.randomUUID() + crypto.randomUUID();
      const { data, error } = await supabase.from("ai_conversations").insert({ session_id: sessionId, session_token_hash: await sha256(sessionToken), ip_hash: ip ? await sha256(ip) : null, language_code: language, conversation_status: "open" }).select("id, session_id").single();
      if (error) throw error;
      conversation = data;
      newSession = true;
    }

    const { count, error: countError } = await supabase.from("ai_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation.id)
      .eq("sender_type", "guest")
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if (countError) throw countError;
    if ((count ?? 0) >= 20) return json({ error: "This chat has reached its short-term message limit. Please contact a local host on WhatsApp." }, 429);

    const userInsert = await supabase.from("ai_messages")
      .insert({ conversation_id: conversation.id, sender_type: "guest", message });
    if (userInsert.error) throw userInsert.error;

    const { data: history, error: historyError } = await supabase.from("ai_messages")
      .select("sender_type, message").eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false }).limit(12);
    if (historyError) throw historyError;
    const messages = (history ?? []).reverse().map((item) => ({
      role: item.sender_type === "assistant" ? "assistant" : "user",
      content: String(item.message).slice(0, 1200),
    }));

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
    let reply = fallback[language];
    let mode = "guided_fallback";
    if (openAiKey) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            temperature: 0.35,
            max_tokens: 350,
          }),
        });
        const result = await response.json().catch(() => ({}));
        const generated = result?.choices?.[0]?.message?.content;
        if (!response.ok) throw new Error(result?.error?.message || "AI provider request failed.");
        if (typeof generated === "string" && generated.trim()) {
          reply = generated.trim().slice(0, 2200);
          mode = "ai";
        }
      } catch (error) {
        console.error("Guest concierge AI fallback:", error instanceof Error ? error.message : "provider error");
      }
    }

    const assistantInsert = await supabase.from("ai_messages")
      .insert({ conversation_id: conversation.id, sender_type: "assistant", message: reply });
    if (assistantInsert.error) throw assistantInsert.error;
    await supabase.from("ai_conversations")
      .update({ updated_at: new Date().toISOString(), language_code: language })
      .eq("id", conversation.id);

    return json({ success: true, session_id: conversation.session_id, conversation_id: conversation.id, reply, mode });
  } catch (error) {
    console.error("guest-concierge error:", error);
    return json({ error: "I’m sorry — the guest assistant is unavailable right now. Please contact us on WhatsApp." }, 500);
  }
});
