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
  if (Number(request.headers.get("content-length") || "0") > 16_384) return json({ error: "Request is too large." }, 413);
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await request.json().catch(() => null);
    const bookingId = String(body?.booking_id ?? "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId)) {
      return json({ error: "A valid booking reference is required." }, 400);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Notification service is not configured." }, 503);
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: booking, error: bookingError } = await supabase.from("bookings")
      .select("id, booking_reference, experience, booking_date, guest_count, guests, guest, email, phone, pickup, notes, status, created_at")
      .eq("id", bookingId).maybeSingle();
    if (bookingError) throw bookingError;
    if (!booking || booking.status !== "New") return json({ error: "Booking not found or no longer eligible for notifications." }, 404);
    const createdAt = new Date(booking.created_at).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 30 * 60 * 1000 || createdAt > Date.now() + 60_000) {
      return json({ error: "This booking notification link has expired." }, 410);
    }

    const guestName = String(booking.guest ?? "Guest").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 120) || "Guest";
    const experience = String(booking.experience ?? "Materuni experience").replace(/[\\u0000-\\u001F\\u007F]/g, " ").trim().slice(0, 160);
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
      if (error?.code === "23505") return { duplicate: true, id: null };
      if (error) throw error;
      return { duplicate: false, id: data.id };
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
      if (reservation.duplicate) { outcomes[type] = "already_processed"; return; }
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
    const guestEmail = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(rawGuestEmail) ? rawGuestEmail : "";
    const rawAdminEmail = String(Deno.env.get("ADMIN_NOTIFICATION_EMAIL") ?? "").trim().slice(0, 254);
    const adminEmail = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(rawAdminEmail) ? rawAdminEmail : "";
    const guestHtml = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#242421;max-width:620px;margin:auto">
        <div style="background:#1A3322;color:#fff;padding:26px 30px"><div style="font-size:12px;letter-spacing:3px">MATERUNI HOSTS</div><h1 style="font-family:Georgia,serif;font-weight:500;margin:12px 0 0">Your Materuni experience</h1></div>
        <div style="padding:28px 30px;background:#FAF7F2">
          <p>Hello ${escapeHtml(guestName)},</p>
          <p>Thank you for sending a booking request. We have received your details and a local host will contact you to confirm availability and arrangements.</p>
          <div style="background:#fff;padding:18px;border:1px solid #E6DFD3">
            <p><strong>Reference:</strong> ${escapeHtml(reference)}</p><p><strong>Experience:</strong> ${escapeHtml(experience)}</p>
            <p><strong>Date:</strong> ${escapeHtml(bookingDate)}</p><p><strong>Guests:</strong> ${guests}</p>
            <p><strong>Status:</strong> Request received — awaiting host confirmation</p>
          </div>
          <p>This is not yet a confirmed reservation and no payment has been taken.</p>
          <p><strong>Getting here:</strong> <a href="https://www.google.com/maps/search/?api=1&amp;query=Materuni+Village+Moshi+Tanzania">Open Materuni Village in Google Maps</a>. Please confirm your exact meeting point and transport with your host before travelling.</p>
          <p><strong>Before you visit:</strong> wear comfortable walking shoes, bring a light rain layer, carry drinking water and tell your host in advance about dietary or mobility requirements.</p>
          <p>WhatsApp: +255 612 068 540<br>Email: hello@materunihosts.com</p>
          <p style="font-family:Georgia,serif;font-style:italic">Come as a guest. Leave as a friend.</p>
        </div>
      </div>`;
    if (guestEmail) {
      await sendEmail(guestEmail, "guest_booking_acknowledgement", "We received your Materuni Hosts booking request", guestHtml, summary);
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

    const waToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const adminNumber = Deno.env.get("WHATSAPP_ADMIN_NUMBER");
    const templateName = Deno.env.get("WHATSAPP_BOOKING_TEMPLATE");
    if (waToken && phoneNumberId && adminNumber && templateName) {
      const reservation = await claim("whatsapp", "admin_new_booking_alert", adminNumber, summary);
      if (reservation.duplicate) outcomes.admin_whatsapp_alert = "already_processed";
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
