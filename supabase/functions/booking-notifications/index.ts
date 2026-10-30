// Supabase Edge Function runtime declarations for the repository-wide Astro type check.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
declare module "npm:@supabase/supabase-js@2" {
  export function createClient(...args: any[]): any;
}

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });
const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    // Enforce the limit while reading the stream; Content-Length alone can be absent or spoofed.
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > 16_384) {
          await reader.cancel();
          return json({ error: "Request is too large." }, 413);
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
    const bodyText = new TextDecoder().decode(requestBytes);
    const body = bodyText ? JSON.parse(bodyText) : null;
    const bookingId = String(body?.booking_id ?? "").trim();
    const idempotencyKey = String(body?.idempotency_key ?? "").trim();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(bookingId) || !uuidPattern.test(idempotencyKey)) {
      return json({ error: "A valid booking reference is required." }, 400);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Notification service is not configured." }, 503);
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    // The idempotency key proves possession of the booking request and prevents
    // callers who only know a booking UUID from triggering notifications.
    const { data: proof, error: proofError } = await supabase.from("booking_idempotency")
      .select("booking_id").eq("idempotency_key", idempotencyKey).eq("booking_id", bookingId).maybeSingle();
    if (proofError) throw proofError;
    if (!proof) return json({ error: "Booking notification authorisation failed." }, 403);
    const { data: booking, error: bookingError } = await supabase.from("bookings")
      .select("id, booking_reference, experience, booking_date, guest_count, guests, guest, email, phone, preferred_contact, pickup, notes, status, created_at")
      .eq("id", bookingId).maybeSingle();
    if (bookingError) throw bookingError;
    if (!booking || booking.status !== "New") return json({ error: "Booking not found or no longer eligible for notifications." }, 404);
    const createdAt = new Date(booking.created_at).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 30 * 60 * 1000 || createdAt > Date.now() + 60_000) {
      return json({ error: "This booking notification link has expired." }, 410);
    }

    const guestName = String(booking.guest ?? "Guest").replace(/[\x00-\x1F\x7F]/g, " ").trim().slice(0, 120) || "Guest";
    const experience = String(booking.experience ?? "Materuni experience").replace(/[\x00-\x1F\x7F]/g, " ").trim().slice(0, 160);
    const bookingDate = String(booking.booking_date ?? "").slice(0, 40);
    const guests = Number(booking.guest_count ?? booking.guests ?? 1);
    const phone = String(booking.phone ?? "").replace(/[^+0-9 ()-]/g, "").slice(0, 30);
    const reference = String(booking.booking_reference ?? booking.id);
    const summary = `Booking ${reference}: ${guestName} · ${experience} · ${bookingDate} · ${guests} guest(s)`;
    const outcomes: Record<string, string> = {};

    async function claim(channel: string, type: string, recipient: string, message: string) {
      const { data, error } = await supabase.from("notification_logs").insert({
        booking_id: bookingId, recipient, channel, notification_type: type, message, delivery_status: "pending",
      }).select("id").single();
      if (!error) return { duplicate: false, id: data.id, state: "claimed" };
      if (error.code !== "23505") throw error;

      // A pending row normally means another request is delivering this message.
      // If a worker crashed after claiming it, allow one caller to reclaim it
      // after ten minutes. The conditional UPDATE is atomic and preserves the
      // partial unique index that prevents concurrent duplicate deliveries.
      const { data: existing, error: lookupError } = await supabase.from("notification_logs")
        .select("id, delivery_status, created_at")
        .eq("booking_id", bookingId).eq("channel", channel)
        .eq("notification_type", type)
        .in("delivery_status", ["pending", "sent"])
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!existing) return { duplicate: true, id: null, state: "in_progress" };
      if (existing.delivery_status === "sent") return { duplicate: true, id: null, state: "already_processed" };

      const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: reclaimed, error: reclaimError } = await supabase.from("notification_logs")
        .update({
          recipient, message, created_at: new Date().toISOString(),
          error_message: null, provider_reference: null, sent_at: null,
        })
        .eq("id", existing.id).eq("delivery_status", "pending")
        .lt("created_at", staleBefore)
        .select("id").maybeSingle();
      if (reclaimError) throw reclaimError;
      if (reclaimed) return { duplicate: false, id: reclaimed.id };
      return { duplicate: true, id: null };
    }
    async function finish(id: string | null, status: string, providerReference?: string, errorMessage?: string) {
      if (!id) return;
      const { error } = await supabase.from("notification_logs").update({
        delivery_status: status, provider_reference: providerReference ?? null,
        error_message: errorMessage ?? null, sent_at: status === "sent" ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) console.error("Could not update notification log:", error.message);
    }
    async function logSkipped(channel: string, type: string, recipient: string, message: string, reason: string) {
      const { data: existing, error: lookupError } = await supabase.from("notification_logs")
        .select("id").eq("booking_id", bookingId).eq("channel", channel)
        .eq("notification_type", type).eq("delivery_status", "skipped").maybeSingle();
      if (lookupError) console.error("Could not inspect skipped notification:", lookupError.message);
      if (existing) {
        const { error } = await supabase.from("notification_logs").update({
          recipient, message, error_message: reason,
        }).eq("id", existing.id);
        if (error) console.error("Could not refresh skipped notification:", error.message);
        return;
      }
      const { error } = await supabase.from("notification_logs").insert({
        booking_id: bookingId, recipient, channel, notification_type: type,
        message, delivery_status: "skipped", error_message: reason,
      });
      if (error) console.error("Could not log skipped notification:", error.message);
    }
    async function sendEmail(recipient: string, type: string, subject: string, html: string, message: string) {
      const apiKey = Deno.env.get("RESEND_API_KEY");
      const from = Deno.env.get("EMAIL_FROM");
      if (!apiKey || !from) {
        outcomes[type] = "not_configured";
        await logSkipped("email", type, recipient, message, "Resend API key or verified sender is not configured.");
        return;
      }
      const reservation = await claim("email", type, recipient, message);
      if (reservation.duplicate) { outcomes[type] = reservation.state; return; }
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [recipient], subject, html }), signal: AbortSignal.timeout(10_000),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.message || `Resend returned ${response.status}`);
        await finish(reservation.id, "sent", result?.id);
        outcomes[type] = "sent";
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "Email delivery failed.";
        await finish(reservation.id, "failed", undefined, messageText);
        outcomes[type] = "failed";
      }
    }

    const rawGuestEmail = String(booking.email ?? "").trim().slice(0, 254);
    const guestEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawGuestEmail) ? rawGuestEmail : "";
    const rawAdminEmail = String(Deno.env.get("ADMIN_NOTIFICATION_EMAIL") ?? "").trim().slice(0, 254);
    const adminEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawAdminEmail) ? rawAdminEmail : "";
    // Read the saved "received" template from Email Studio. If settings are
    // unavailable or invalid, retain a safe built-in acknowledgement.
    const { data: templateSetting, error: templateError } = await supabase.from("site_settings")
      .select("setting_value").eq("setting_key", "email_templates").maybeSingle();
    if (templateError) console.warn("Email Studio templates unavailable; using the built-in booking acknowledgement.");
    let emailTemplates: Record<string, { subject?: string; body?: string }> = {};
    try {
      const parsed = JSON.parse(templateSetting?.setting_value || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        emailTemplates = parsed as Record<string, { subject?: string; body?: string }>;
      }
    } catch {
      emailTemplates = {};
    }
    const receivedTemplate = emailTemplates.received;
    const templateValues: Record<string, string> = {
      guest_name: guestName,
      partner_name: guestName,
      experience,
      booking_date: bookingDate,
      guest_count: String(guests),
      booking_reference: reference,
      host_name: String(Deno.env.get("HOST_CONTACT_NAME") || "Saidi Materu & Local Hosts").slice(0, 120),
      reply_email: String(Deno.env.get("EMAIL_REPLY_TO") || "materunihosts@gmail.com").slice(0, 254),
      whatsapp: String(Deno.env.get("PUBLIC_WHATSAPP_NUMBER") || "+255 612 068 540").slice(0, 40),
    };
    const renderReceivedTemplate = (value: unknown, fallback: string, maxLength: number) => {
      const source = typeof value === "string" && value.trim() ? value : fallback;
      return source.replace(/\{\{([a-z_]+)\}\}/g, (_match, key: string) => templateValues[key] ?? "").slice(0, maxLength);
    };
    const defaultReceivedBody = [
      "Hello {{guest_name}},",
      "",
      "Thank you for your booking request with Materuni Hosts. We are delighted to welcome you to our Chagga community in the foothills of Mount Kilimanjaro.",
      "",
      "Your requested experience details:",
      "Experience: {{experience}}",
      "Preferred date: {{booking_date}}",
      "Group size: {{guest_count}} guest(s)",
      "Booking reference: {{booking_reference}}",
      "",
      "Please note: This is an initial booking acknowledgement. Our local team is reviewing slot availability and guide arrangements, and will confirm your reservation shortly.",
      "",
      "What happens next:",
      "1. A host will review your request and confirm availability within a few hours.",
      "2. You will receive an official booking confirmation voucher with your guide details and meeting location.",
      "3. No payment is required right now; payment can be settled via secure link or on arrival.",
      "",
      "If you have any questions or need to arrange transport from Moshi or Arusha, simply reply to this email or message us on WhatsApp: {{whatsapp}}.",
      "",
      "Warm regards,",
      "{{host_name}}",
      "Materuni Hosts",
      "{{reply_email}}",
    ].join("\n");
    const guestSubject = renderReceivedTemplate(
      receivedTemplate?.subject,
      "Booking Request Received · " + experience + " (" + reference + ")",
      240,
    ).replace(/[\r\n\x00-\x1F\x7F]+/g, " ").trim().slice(0, 180);
    const guestMessage = renderReceivedTemplate(receivedTemplate?.body, defaultReceivedBody, 12_000);
    const hasReservationStatus = /not\s+(?:yet\s+)?a\s+confirmed\s+reservation|not\s+confirmed/i.test(guestMessage);
    const hasNoPaymentNotice = /no\s+payment\s+(?:has\s+been|was)\s+taken|payment\s+has\s+not\s+been\s+taken/i.test(guestMessage);
    const disclaimerParts = [
      ...(hasReservationStatus ? [] : ["This is a booking request awaiting host confirmation."]),
      ...(hasNoPaymentNotice ? [] : ["No payment has been charged."]),
    ];
    const reservationDisclaimer = disclaimerParts.length
      ? '<div style="background:#FAF7F2;border:1px solid #C5A059;padding:12px 16px;border-radius:6px;margin:18px 0;font-size:13px;color:#1A3322"><strong>Notice:</strong> ' + escapeHtml(disclaimerParts.join(" ")) + '</div>'
      : "";

    const dateDigits = bookingDate.replace(/[^0-9]/g, "");
    const calDate = dateDigits.length === 8 ? dateDigits : new Date().toISOString().slice(0, 10).replace(/[^0-9]/g, "");
    const gCalUrl = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(experience + " - Materuni Hosts") + "&dates=" + calDate + "T060000Z/" + calDate + "T130000Z&details=" + encodeURIComponent("Booking Ref: " + reference + "\nLead Host: Saidi Materu (+255 612 068 540)\nLocation: Materuni Village, Moshi, Tanzania\nWeb: https://materunihosts.com") + "&location=" + encodeURIComponent("Materuni Cultural Tourism Centre, Materuni Village, Moshi, Kilimanjaro, Tanzania");

    const manageUrl = "https://materunihosts.com/booking?ref=" + encodeURIComponent(reference) + "&manage=true";
    const whatsappUrl = "https://wa.me/255612068540?text=" + encodeURIComponent("Hello Materuni Hosts, I have a question regarding my booking reference: " + reference);
    const pickupDetail = String(booking.pickup ?? "").trim();

    const guestMessageParagraphs = guestMessage.split("\n")
      .map((line) => line ? `<p style="margin:0 0 12px;line-height:1.75;font-size:14px;color:#242421">${escapeHtml(line)}</p>` : '<div style="height:6px"></div>')
      .join("");

    const guestHtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>Booking Request Received · ${escapeHtml(reference)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F0E8;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#242421;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#F4F0E8" style="background-color:#F4F0E8;width:100%;margin:0;padding:24px 12px;">
  <tr>
    <td align="center">
      <!--[if (gte mso 9)|(IE)]>
      <table align="center" border="0" cellspacing="0" cellpadding="0" width="600"><tr><td align="center" valign="top" width="600">
      <![endif]-->
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;background-color:#FAF7F2;border:1px solid #E6DFD3;border-radius:12px;overflow:hidden;box-shadow:0 12px 36px rgba(26,51,34,0.08);">
        
        <!-- Luxury Brand Header -->
        <tr>
          <td bgcolor="#1A3322" style="background-color:#1A3322;padding:32px 28px;border-bottom:4px solid #C5A059;">
            <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td valign="middle" align="left">
                  <div style="font-size:11px;font-weight:800;letter-spacing:2.5px;color:#C5A059;text-transform:uppercase;">MATERUNI HOSTS</div>
                  <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:30px;font-weight:700;color:#FAF7F2;margin:6px 0 0;padding:0;">Booking Request Received</h1>
                  <div style="font-size:12px;color:#E6DFD3;margin-top:5px;letter-spacing:0.3px;">Authentic Chagga Hospitality · Mount Kilimanjaro</div>
                </td>
                <td valign="middle" align="right" style="padding-left:12px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="background-color:#FAF7F2;border:1px solid #C5A059;border-radius:6px;padding:8px 12px;text-align:right;">
                    <tr>
                      <td align="right">
                        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#7A756B;display:block;">BOOKING REF</span>
                        <strong style="font-family:'Courier New',Courier,monospace;font-size:14px;font-weight:800;color:#1A3322;display:block;letter-spacing:0.5px;">${escapeHtml(reference)}</strong>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Status Banner -->
        <tr>
          <td bgcolor="#F8F3EA" style="background-color:#F8F3EA;border-bottom:1px solid #E6DFD3;padding:11px 24px;text-align:center;">
            <span style="font-size:12px;font-weight:800;letter-spacing:1px;color:#8A6822;text-transform:uppercase;">
              ⏳ STATUS: REQUEST RECEIVED &middot; UNDER LOCAL HOST REVIEW
            </span>
          </td>
        </tr>

        <!-- Content Area -->
        <tr>
          <td style="padding:28px 24px 20px;background-color:#FAF7F2;">
            
            <p style="font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:26px;color:#1A3322;margin:0 0 14px;font-weight:600;">
              Habari ${escapeHtml(guestName)},
            </p>

            ${guestMessageParagraphs}

            <!-- Structured Booking Details Table -->
            <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;background-color:#FFFFFF;border:1px solid #E6DFD3;border-radius:10px;margin:20px 0 24px;overflow:hidden;box-shadow:0 4px 16px rgba(26,51,34,0.04);">
              <tr>
                <td colspan="2" bgcolor="#F8F5EE" style="background-color:#F8F5EE;padding:12px 18px;border-bottom:1px solid #E6DFD3;">
                  <span style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#1A3322;text-transform:uppercase;">
                    📋 RESERVATION SUMMARY
                  </span>
                </td>
              </tr>
              <tr>
                <td width="38%" style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:12px;font-weight:600;color:#7A756B;text-transform:uppercase;letter-spacing:0.5px;">Experience</td>
                <td width="62%" style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:14px;font-weight:700;color:#1A3322;">${escapeHtml(experience)}</td>
              </tr>
              <tr>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:12px;font-weight:600;color:#7A756B;text-transform:uppercase;letter-spacing:0.5px;">Preferred Date</td>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:14px;font-weight:700;color:#1A3322;">${escapeHtml(bookingDate)} <span style="font-size:11px;font-weight:400;color:#7A756B;">(East Africa Time)</span></td>
              </tr>
              <tr>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:12px;font-weight:600;color:#7A756B;text-transform:uppercase;letter-spacing:0.5px;">Party Size</td>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:14px;color:#1A3322;"><strong>${guests}</strong> guest${guests > 1 ? "s" : ""}</td>
              </tr>
              <tr>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:12px;font-weight:600;color:#7A756B;text-transform:uppercase;letter-spacing:0.5px;">Lead Traveler</td>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:14px;color:#1A3322;">${escapeHtml(guestName)}</td>
              </tr>
              <tr>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:12px;font-weight:600;color:#7A756B;text-transform:uppercase;letter-spacing:0.5px;">Meeting Location</td>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:13px;color:#1A3322;line-height:1.5;">
                  <strong>Materuni Cultural Tourism Centre</strong><br />
                  <span style="font-size:12px;color:#555;">Materuni Village, Moshi Rural, Kilimanjaro<br />GPS: -3.2505° S, 37.3912° E</span>
                </td>
              </tr>
              ${pickupDetail ? `<tr>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:12px;font-weight:600;color:#7A756B;text-transform:uppercase;letter-spacing:0.5px;">Private Transfer</td>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:13px;color:#1A3322;">${escapeHtml(pickupDetail)}</td>
              </tr>` : ""}
              <tr>
                <td style="padding:12px 18px;font-size:12px;font-weight:600;color:#7A756B;text-transform:uppercase;letter-spacing:0.5px;">Payment Terms</td>
                <td style="padding:12px 18px;font-size:13px;color:#1A3322;line-height:1.5;">
                  <strong>Pay on arrival</strong> (USD or TZS cash, or Vodacom M-Pesa). Zero prepayment required today.
                </td>
              </tr>
            </table>

            ${reservationDisclaimer}

            <!-- Primary Manage My Booking CTA -->
            <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:24px 0 14px;">
              <tr>
                <td align="center">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" bgcolor="#1A3322" style="background-color:#1A3322;border-radius:6px;box-shadow:0 6px 18px rgba(26,51,34,0.18);">
                        <a href="${manageUrl}" target="_blank" style="display:inline-block;padding:14px 34px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;color:#FAF7F2;text-decoration:none;letter-spacing:0.5px;border-radius:6px;">
                          Manage My Booking &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="font-size:12px;color:#6E7268;margin:8px 0 0;text-align:center;">
                    View live status, request date rescheduling, or update party size online.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Quick Action Links -->
            <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:12px 0 24px;">
              <tr>
                <td align="center" style="padding:4px;">
                  <a href="${gCalUrl}" target="_blank" style="display:inline-block;background-color:#FFFFFF;color:#1A3322;border:1px solid #1A3322;padding:10px 18px;border-radius:5px;text-decoration:none;font-size:13px;font-weight:700;">
                    &plus; Add to Google Calendar
                  </a>
                </td>
                <td align="center" style="padding:4px;">
                  <a href="${whatsappUrl}" target="_blank" style="display:inline-block;background-color:#25D366;color:#FFFFFF;border:1px solid #25D366;padding:10px 18px;border-radius:5px;text-decoration:none;font-size:13px;font-weight:700;">
                    💬 Chat on WhatsApp
                  </a>
                </td>
              </tr>
            </table>

            <!-- Traveler Checklist Card -->
            <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#F8F5EE;border:1px solid #E6DFD3;border-radius:8px;margin:16px 0 10px;">
              <tr>
                <td style="padding:16px 18px;">
                  <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#1A3322;text-transform:uppercase;margin-bottom:10px;">
                    🌿 ESSENTIAL PREPARATION FOR MATERUNI
                  </div>
                  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.6;color:#333;">
                    <tr>
                      <td width="24" valign="top" style="padding-bottom:6px;">👟</td>
                      <td valign="top" style="padding-bottom:6px;"><strong>Footwear:</strong> Sturdy walking shoes or sneakers with good traction (trails may be moist or rocky).</td>
                    </tr>
                    <tr>
                      <td width="24" valign="top" style="padding-bottom:6px;">🧥</td>
                      <td valign="top" style="padding-bottom:6px;"><strong>Clothing:</strong> Lightweight layers, light rain jacket, and comfortable modest village attire.</td>
                    </tr>
                    <tr>
                      <td width="24" valign="top" style="padding-bottom:6px;">🏊</td>
                      <td valign="top" style="padding-bottom:6px;"><strong>Waterfall Swim:</strong> Pack swimwear and a small towel if you wish to swim in the mountain pool.</td>
                    </tr>
                    <tr>
                      <td width="24" valign="top">💵</td>
                      <td valign="top"><strong>Village Cash:</strong> Small Tanzanian Shillings for fresh roasted village coffee beans or local crafts.</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Official Brand Footer -->
        <tr>
          <td bgcolor="#E6DFD3" style="background-color:#E6DFD3;padding:24px 28px;border-top:1px solid #D8CFC0;text-align:center;color:#555;font-size:12px;line-height:1.6;">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;font-style:italic;color:#1A3322;font-weight:600;margin-bottom:6px;">
              &ldquo;Come as a guest. Leave as a friend.&rdquo;
            </div>
            <div style="font-weight:700;color:#1A3322;font-size:13px;">
              Materuni Hosts &middot; Cultural Tourism &amp; Local Experiences
            </div>
            <div style="color:#666;margin:4px 0 10px;">
              Materuni Village, Moshi, Kilimanjaro, Tanzania<br />
              WhatsApp: <a href="https://wa.me/255612068540" style="color:#1A3322;text-decoration:underline;font-weight:700;">+255 612 068 540</a> &middot; Email: <a href="mailto:materunihosts@gmail.com" style="color:#1A3322;text-decoration:underline;font-weight:700;">materunihosts@gmail.com</a>
            </div>
            <div style="border-top:1px solid #D4CABC;padding-top:10px;font-size:11px;color:#777;">
              <a href="https://materunihosts.com" style="color:#1A3322;text-decoration:none;font-weight:700;">materunihosts.com</a> &middot;
              <a href="https://www.tripadvisor.com/34765809" target="_blank" style="color:#1A3322;text-decoration:none;">TripAdvisor Verified</a> &middot;
              <a href="https://g.page/r/CXy6M_Suiip9EBM/review" target="_blank" style="color:#1A3322;text-decoration:none;">Google Reviews</a>
            </div>
          </td>
        </tr>

      </table>
      <!--[if (gte mso 9)|(IE)]>
      </td></tr></table>
      <![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
    if (guestEmail) {
      await sendEmail(guestEmail, "guest_booking_acknowledgement", guestSubject, guestHtml, summary);
    } else outcomes.guest_booking_acknowledgement = "no_guest_email";

    if (adminEmail) {
      const adminHtml = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#242421">
          <h2>New Materuni Hosts booking request</h2><p><strong>Reference:</strong> ${escapeHtml(reference)}</p>
          <p><strong>Guest:</strong> ${escapeHtml(guestName)}</p><p><strong>Experience:</strong> ${escapeHtml(experience)}</p>
          <p><strong>Date:</strong> ${escapeHtml(bookingDate)}</p><p><strong>Guests:</strong> ${guests}</p>
          <p><strong>Email:</strong> ${escapeHtml(guestEmail || "Not supplied")}</p><p><strong>Phone:</strong> ${escapeHtml(phone || "Not supplied")}</p>
          <p><strong>Pickup:</strong> ${escapeHtml(booking.pickup || "To be arranged")}</p><p><strong>Notes:</strong> ${escapeHtml(booking.notes || "None")}</p>
          <p>Open the admin dashboard to review and confirm the request.</p>
        </div>`;
      await sendEmail(adminEmail, "admin_new_booking_alert", `New booking request · ${reference}`, adminHtml, summary);
    } else {
      outcomes.admin_new_booking_alert = "not_configured";
      await logSkipped("email", "admin_new_booking_alert", "ADMIN_NOTIFICATION_EMAIL", summary, "Admin notification email is not configured.");
    }

    // Guest WhatsApp acknowledgement is deliberately dormant until an approved
    // Meta template is configured. Email remains the fallback channel.
    const preferredContact = String(booking.preferred_contact ?? "").trim().toLowerCase();
    if (phone && preferredContact === "whatsapp") {
      const guestWaTemplate = Deno.env.get("WHATSAPP_GUEST_BOOKING_TEMPLATE");
      const guestWaLanguage = Deno.env.get("WHATSAPP_GUEST_BOOKING_TEMPLATE_LANGUAGE") || "en";
      if (!guestWaTemplate) {
        outcomes.guest_whatsapp_acknowledgement = "not_configured";
        await logSkipped("whatsapp", "guest_booking_acknowledgement", phone, summary,
          "Guest WhatsApp acknowledgement is prepared but disabled until an approved Meta template name is configured.");
      } else if (!Deno.env.get("WHATSAPP_ACCESS_TOKEN") || !Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")) {
        outcomes.guest_whatsapp_acknowledgement = "not_configured";
        await logSkipped("whatsapp", "guest_booking_acknowledgement", phone, summary,
          "WhatsApp Cloud API credentials are not configured.");
      } else {
        const reservation = await claim("whatsapp", "guest_booking_acknowledgement", phone, summary);
        if (reservation.duplicate) outcomes.guest_whatsapp_acknowledgement = reservation.state;
        else {
          try {
            const recipient = phone.replace(/\D/g, "");
            if (recipient.length < 8 || recipient.length > 15) throw new Error("Guest phone number is not in a valid international format.");
            const response = await fetch(`https://graph.facebook.com/v22.0/${Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
              method: "POST",
              headers: { Authorization: `Bearer ${Deno.env.get("WHATSAPP_ACCESS_TOKEN")}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                messaging_product: "whatsapp", to: recipient, type: "template",
                template: { name: guestWaTemplate, language: { code: guestWaLanguage },
                  components: [{ type: "body", parameters: [
                    { type: "text", text: guestName }, { type: "text", text: experience },
                    { type: "text", text: bookingDate }, { type: "text", text: String(guests) },
                    { type: "text", text: reference },
                  ] }],
                },
              }),
              signal: AbortSignal.timeout(10_000),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result?.error?.message || `WhatsApp returned ${response.status}`);
            await finish(reservation.id, "sent", result?.messages?.[0]?.id);
            outcomes.guest_whatsapp_acknowledgement = "sent";
          } catch (error) {
            const messageText = error instanceof Error ? error.message : "WhatsApp delivery failed.";
            await finish(reservation.id, "failed", undefined, messageText);
            outcomes.guest_whatsapp_acknowledgement = "failed";
          }
        }
      }
    } else {
      outcomes.guest_whatsapp_acknowledgement = phone ? "not_requested" : "no_guest_phone";
    }

    const waToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const adminNumber = Deno.env.get("WHATSAPP_ADMIN_NUMBER");
    const templateName = Deno.env.get("WHATSAPP_BOOKING_TEMPLATE");
    if (waToken && phoneNumberId && adminNumber && templateName) {
      const reservation = await claim("whatsapp", "admin_new_booking_alert", adminNumber, summary);
      if (reservation.duplicate) outcomes.admin_whatsapp_alert = reservation.state;
      else {
        try {
          const response = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
            method: "POST", headers: { Authorization: `Bearer ${waToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messaging_product: "whatsapp", to: adminNumber, type: "template",
              template: {
                name: templateName, language: { code: Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "en" },
                components: [{ type: "body", parameters: [
                  { type: "text", text: guestName }, { type: "text", text: experience },
                  { type: "text", text: bookingDate }, { type: "text", text: String(guests) },
                  { type: "text", text: phone || "Not supplied" },
                ] }],
              },
            }),
            signal: AbortSignal.timeout(10_000),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result?.error?.message || `WhatsApp returned ${response.status}`);
          await finish(reservation.id, "sent", result?.messages?.[0]?.id);
          outcomes.admin_whatsapp_alert = "sent";
        } catch (error) {
          const messageText = error instanceof Error ? error.message : "WhatsApp delivery failed.";
          await finish(reservation.id, "failed", undefined, messageText);
          outcomes.admin_whatsapp_alert = "failed";
        }
      }
    } else {
      outcomes.admin_whatsapp_alert = "not_configured";
      await logSkipped("whatsapp", "admin_new_booking_alert", adminNumber || "WHATSAPP_ADMIN_NUMBER", summary, "WhatsApp Cloud API credentials or approved template are not configured.");
    }

    return json({ success: true, booking_reference: reference, notifications: outcomes });
  } catch (error) {
    console.error("booking-notifications failed:", error instanceof Error ? error.name : "unknown_error");
    return json({ error: "Booking notification processing failed." }, 500);
  }
});
