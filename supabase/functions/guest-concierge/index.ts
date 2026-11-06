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
  en: "Our current experiences are: Waterfall & Chagga Village ($40 per person); Traditional Chagga Coffee ($36); Traditional Chagga Cooking Class ($49); Materuni & Moshi Town ($52); Materuni & Rau Forest Nature ($58); and Overnight Village ($90 USD). The Overnight Village price is quoted in USD only. Transfers are arranged and quoted separately. Which experience interests you?",
  es: "Nuestras experiencias actuales son: Cascada y aldea Chagga (40 $ por persona); Café tradicional Chagga (36 $); Clase de cocina tradicional Chagga (49 $); Materuni y Moshi (52 $); Materuni y bosque de Rau (58 $); y estancia nocturna en la aldea (90 USD). El precio de la estancia nocturna se indica solo en USD. El transporte se cotiza por separado. ¿Qué experiencia te interesa?",
  fr: "Nos expériences actuelles sont : Cascade et village Chagga (40 $ par personne) ; café traditionnel Chagga (36 $) ; cours de cuisine traditionnelle Chagga (49 $) ; Materuni et Moshi (52 $) ; Materuni et forêt de Rau (58 $) ; et nuit au village (90 USD). Le tarif de la nuitée est indiqué uniquement en USD. Le transport est organisé et facturé séparément. Quelle expérience vous intéresse ?",
  de: "Unsere aktuellen Erlebnisse sind: Wasserfall und Chagga-Dorf (40 $ pro Person); traditioneller Chagga-Kaffee (36 $); traditioneller Chagga-Kochkurs (49 $); Materuni und Moshi (52 $); Materuni und Rau-Wald (58 $); sowie eine Übernachtung im Dorf (90 USD). Der Übernachtungspreis wird nur in USD angegeben. Transfers werden separat vereinbart und berechnet. Welches Erlebnis interessiert Sie?"
};

const systemPrompt = `You are the friendly guest concierge for Materuni Hosts, a boutique local experience host in Materuni Village near Moshi, Kilimanjaro, Tanzania.
Your job is to help visitors choose an experience and move naturally toward an availability check or itinerary request.
Use the visitor's language: English, Spanish, French or German. Be warm, concise and specific.
Use only these approved prices: Waterfall & Chagga Village $40 per person; Traditional Chagga Coffee $36 per person; Traditional Chagga Cooking Class $49 per person; Materuni & Moshi Town $52 per person; Materuni & Rau Forest Nature $58 per person; Overnight Village $90 USD (quote in USD only; do not claim a per-person basis unless the host confirms it). Never convert the Overnight Village price into TZS or another currency. Transfers are quoted separately. Never use old package names or prices. If asked for an exact detail not listed here (duration, inclusions, difficulty, meals, child rates, group discounts, accessibility, weather, cancellation or availability), say the host must confirm it rather than guessing. Do not claim that a date or slot is available.
The Materuni waterfall is approximately 95 metres high. The experiences are hosted in Materuni Village and focus on Chagga coffee, food, culture, nature and village life.
Important booking rules: a website booking is a request, not a confirmed reservation; the host must confirm availability and arrangements; no online payment is taken at this stage; transport/pickup must be confirmed separately. Do not invent schedules, available spaces, transport inclusions, policies, licences, awards, ratings, reviews or claims of registration.
Ask only one useful follow-up at a time, usually travel date, group size, preferred experience or pickup point.
For next steps, direct visitors to https://materunihosts.com/booking or https://materunihosts.com/itinerary. For a human host, offer WhatsApp https://wa.me/255612068540.
Never ask for passport, card, password or sensitive personal data. Do not claim to have made a booking.`;

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > 8_192) {
          await reader.cancel();
          return json({ error: "Message is too large. Please shorten it and try again." }, 413);
        }
        chunks.push(value);
      }
    }
    const requestBytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      requestBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let body: Record<string, unknown> | null;
    try {
      body = JSON.parse(new TextDecoder().decode(requestBytes));
    } catch {
      return json({ error: "Please send a valid message request." }, 400);
    }
    const message = String(body?.message ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200);
    const language = ["en", "es", "fr", "de"].includes(String(body?.language ?? "en"))
      ? String(body?.language ?? "en") : "en";
    let sessionId = String(body?.session_id ?? "").trim();
    let sessionToken = String(body?.session_token ?? "").trim().slice(0, 128);
    if (!message) return json({ error: "Please enter a message." }, 400);


    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Guest assistant is temporarily unavailable." }, 503);
    try { const parsedUrl = new URL(supabaseUrl); if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost") throw new Error(); }
    catch { console.error("guest-concierge configuration error: invalid SUPABASE_URL"); return json({ error: "Guest assistant is temporarily unavailable." }, 503); }
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    const sha256 = async (value: string) => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
      return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
    };
    if (ip) {
      const ipHash = await sha256(ip);
      const { data: rate, error: rateReadError } = await supabase.from("guest_chat_rate_limits").select("*").eq("ip_hash", ipHash).maybeSingle();
      if (rateReadError) throw rateReadError;
      const expired = !rate || Date.now() - new Date(rate.window_started_at).getTime() >= 3600000;
      if (!expired && Number(rate.request_count) >= 100) return json({ error: "Please pause before sending more messages." }, 429);
      const { error: rateWriteError } = await supabase.from("guest_chat_rate_limits").upsert({ ip_hash: ipHash, window_started_at: expired ? new Date().toISOString() : rate.window_started_at, request_count: expired ? 1 : Number(rate.request_count) + 1, updated_at: new Date().toISOString() }, { onConflict: "ip_hash" });
      if (rateWriteError) throw rateWriteError;
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
    const question = message.toLowerCase();
    const guidedReplies = [
      {
        test: /book|booking|availability|available|date|reserve|reserv|fecha|disponib|réserv|buch|verfügbar/,
        answers: {
          en: "You can check available dates and times on our booking page: https://materunihosts.com/booking. Choose your experience and group size, then send a request. A local host will confirm availability before the booking is final.",
          es: "Puedes consultar fechas y horarios en https://materunihosts.com/booking. Elige tu experiencia y el tamaño del grupo y envía una solicitud. Un anfitrión local confirmará la disponibilidad antes de finalizar la reserva.",
          fr: "Consultez les dates et horaires sur https://materunihosts.com/booking. Choisissez votre expérience et la taille du groupe, puis envoyez une demande. Un hôte local confirmera la disponibilité avant la réservation définitive.",
          de: "Verfügbare Termine und Zeiten finden Sie unter https://materunihosts.com/booking. Wählen Sie Ihr Erlebnis und die Gruppengröße und senden Sie eine Anfrage. Ein lokaler Gastgeber bestätigt die Verfügbarkeit, bevor die Buchung verbindlich wird."
        }
      },
      {
        test: /transport|pickup|pick up|transfer|taxi|traslado|transporte|transport|abhol/,
        answers: {
          en: "Pickup and transport are arranged separately and must be confirmed with your host. Add your hotel or pickup point to the booking notes, or message us on WhatsApp: https://wa.me/255612068540.",
          es: "La recogida y el transporte se coordinan por separado y deben confirmarse con tu anfitrión. Añade tu hotel o punto de recogida en las notas, o escríbenos por WhatsApp: https://wa.me/255612068540.",
          fr: "Le transport et le point de prise en charge doivent être confirmés séparément avec votre hôte. Indiquez votre hôtel dans les notes ou contactez-nous sur WhatsApp : https://wa.me/255612068540.",
          de: "Abholung und Transport werden separat organisiert und müssen mit Ihrem Gastgeber bestätigt werden. Geben Sie Ihr Hotel in den Buchungsnotizen an oder schreiben Sie uns über WhatsApp: https://wa.me/255612068540."
        }
      },
      {
        test: /payment|pay|card|deposit|pago|payer|zahlung|bezahlen/,
        answers: {
          en: "There is no live card payment on the website yet. First send your booking request; after the host confirms the details, we will share the payment instructions. No payment is taken when you submit the request.",
          es: "La web todavía no acepta pagos con tarjeta. Primero envía tu solicitud; cuando el anfitrión confirme los detalles, te enviaremos las instrucciones de pago. No se cobra nada al enviar la solicitud.",
          fr: "Le site ne propose pas encore de paiement par carte. Envoyez d'abord votre demande ; après confirmation par l'hôte, nous vous communiquerons les modalités de paiement. Aucun paiement n'est effectué lors de l'envoi.",
          de: "Auf der Website ist derzeit keine Kartenzahlung möglich. Senden Sie zuerst Ihre Anfrage; nach Bestätigung durch den Gastgeber erhalten Sie die Zahlungsinformationen. Beim Absenden der Anfrage wird nichts berechnet."
        }
      },
      {
        test: /waterfall|height|cascada|chute|wasserfall/,
        answers: {
          en: "Materuni Waterfall is approximately 95 metres high, reached by a guided rainforest walk. You can combine the waterfall with a Chagga coffee experience or choose the full cultural day trip.",
          es: "La cascada de Materuni tiene aproximadamente 95 metros de altura y se alcanza mediante una caminata guiada por el bosque. Puedes combinarla con una experiencia de café Chagga o elegir la excursión cultural completa.",
          fr: "La cascade de Materuni mesure environ 95 mètres. On y accède par une randonnée guidée en forêt. Vous pouvez la combiner avec une expérience de café Chagga ou choisir la journée culturelle complète.",
          de: "Der Materuni-Wasserfall ist etwa 95 Meter hoch und über eine geführte Wanderung durch den Regenwald erreichbar. Sie können ihn mit einem Chagga-Kaffeeerlebnis oder einem ganzen Kulturtag verbinden."
        }
      }
    ];
    const normalizedQuestion = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const priceIntent = /price|prices|cost|how much|precio|cuesta|cuanto|prix|combien|kosten|preis|wie viel|tarif|tarifa/.test(normalizedQuestion);
    const priceItems = [
      { keys: /coffee|cafe|café|kaffee/, values: { en: "The Traditional Chagga Coffee Experience is $36 per person.", es: "La experiencia de café tradicional Chagga cuesta 36 $ por persona.", fr: "L’expérience de café traditionnel Chagga coûte 36 $ par personne.", de: "Das traditionelle Chagga-Kaffeeerlebnis kostet 36 $ pro Person." } },
      { keys: /cook|cooking|food|cuisine|cocina|kochen|kochkurs/, values: { en: "The Traditional Chagga Cooking Class is $49 per person.", es: "La clase de cocina tradicional Chagga cuesta 49 $ por persona.", fr: "Le cours de cuisine traditionnelle Chagga coûte 49 $ par personne.", de: "Der traditionelle Chagga-Kochkurs kostet 49 $ pro Person." } },
      { keys: /waterfall|cascade|cascada|chute|wasserfall|chagga village|village chagga|aldea chagga|chagga-dorf/, values: { en: "The Waterfall & Chagga Village Experience is $40 per person.", es: "La experiencia de cascada y aldea Chagga cuesta 40 $ por persona.", fr: "L’expérience cascade et village Chagga coûte 40 $ par personne.", de: "Das Erlebnis Wasserfall & Chagga-Dorf kostet 40 $ pro Person." } },
      { keys: /moshi|town|ciudad|ville|stadt/, values: { en: "Materuni & Moshi Town is $52 per person.", es: "Materuni y Moshi cuesta 52 $ por persona.", fr: "Materuni et Moshi coûte 52 $ par personne.", de: "Materuni & Moshi kostet 52 $ pro Person." } },
      { keys: /rau|forest|bosque|foret|forêt|wald/, values: { en: "Materuni & Rau Forest Nature is $58 per person.", es: "Materuni y la naturaleza del bosque de Rau cuesta 58 $ por persona.", fr: "Materuni et la nature de la forêt de Rau coûte 58 $ par personne.", de: "Materuni & Natur im Rau-Wald kostet 58 $ pro Person." } },
      { keys: /overnight|stay|night|noche|nuit|nacht|accommodation|alojamiento|hebergement|hébergement|ubernacht|übernacht/, values: { en: "The Overnight Village experience is quoted at $90 USD. The price is provided in USD only; please ask the host to confirm the basis and arrangements for your group.", es: "La experiencia de estancia nocturna en la aldea cuesta 90 USD. El precio se indica solo en USD; consulta al anfitrión para confirmar cómo se aplica a tu grupo y los detalles.", fr: "L’expérience avec nuit au village est proposée à 90 USD. Le tarif est indiqué uniquement en USD ; demandez à l’hôte de confirmer son application à votre groupe et les modalités.", de: "Das Übernachtungserlebnis im Dorf wird mit 90 USD angegeben. Der Preis gilt nur in USD; bitte lassen Sie sich die Berechnungsgrundlage und Einzelheiten für Ihre Gruppe vom Gastgeber bestätigen." } },
    ];
    const selectedPrice = priceItems.find(item => item.keys.test(normalizedQuestion));
    const matched = guidedReplies.find(rule => rule.test.test(normalizedQuestion));
    let reply = priceIntent ? (selectedPrice ? selectedPrice.values[language] : fallback[language]) : matched ? matched.answers[language] : fallback[language];
    let mode = "guided_fallback";
    // Price replies are deterministic: never let generated AI text overwrite the approved catalogue prices.
    if (openAiKey && !matched && !priceIntent) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            temperature: 0.25,
            max_tokens: 240,
          }),
          signal: AbortSignal.timeout(8_000),
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

    return json({ success: true, session_id: conversation.session_id, session_token: sessionToken, conversation_id: conversation.id, reply, mode });
  } catch (error) {
    console.error("guest-concierge failed:", error instanceof Error ? error.name : "unknown_error");
    return json({ error: "I’m sorry — the guest assistant is unavailable right now. Please contact us on WhatsApp." }, 500);
  }
});
