import { createClient } from "npm:@supabase/supabase-js@2";
const cors={ "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods":"POST, OPTIONS", "Content-Type":"application/json" };
const reply=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const esc=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]??c));
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async req=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return reply({error:"Method not allowed"},405);
 try{
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token) return reply({error:"Authentication required."},401);
  const url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key) return reply({error:"Notification service is not configured."},503);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await db.auth.getUser(token);
  if(userError||!userData.user) return reply({error:"Invalid session."},401);
  const {data:admin,error:adminError}=await db.from("admin_users").select("user_id").eq("user_id",userData.user.id).maybeSingle();
  if(adminError||!admin) return reply({error:"Admin access required."},403);
  // Read the request with a hard byte limit; Content-Length may be missing or spoofed.
  const reader=req.body?.getReader(), chunks:Uint8Array[]=[];
  let totalBytes=0;
  if(reader){
   while(true){
    const {done,value}=await reader.read();
    if(done)break;
    totalBytes+=value.byteLength;
    if(totalBytes>16384){await reader.cancel();return reply({error:"Request is too large."},413);}
    chunks.push(value);
   }
  }
  const bytes=new Uint8Array(totalBytes);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let body:Record<string,unknown>|null;
  try{body=JSON.parse(new TextDecoder().decode(bytes));}
  catch{return reply({error:"Invalid JSON request."},400);}
  const id=String(body?.booking_id||""), event=String(body?.event||"");
  if(!uuid.test(id)||!["confirmed","cancelled","rescheduled"].includes(event)) return reply({error:"Invalid booking notification request."},400);
  const {data:b,error}=await db.from("bookings")
   .select("id,booking_reference,experience,booking_date,guest_count,guests,guest,email,phone,status,availability_slots(start_time,end_time)")
   .eq("id",id).maybeSingle();
  if(error) throw error;
  const expected={confirmed:"Confirmed",cancelled:"Cancelled",rescheduled:"Confirmed"}[event];
  if(!b||b.status!==expected) return reply({error:"Booking state does not match the requested notification."},409);
  const reference=b.booking_reference||b.id, recipient=String(b.email||"").trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return reply({success:false,status:"no_valid_guest_email",message:"Booking updated, but no valid guest email is recorded."});
  const slot=Array.isArray(b.availability_slots)?b.availability_slots[0]:b.availability_slots;
  const time=slot?.start_time?String(slot.start_time).slice(0,5):"To be arranged";
  const endTime=slot?.end_time?String(slot.end_time).slice(0,5):"";
  const count=Number(b.guest_count||b.guests||1), guest=String(b.guest||"Guest");
  const type="guest_booking_"+event, summary="Booking "+event+" · "+reference;
  const {data:existing,error:lookupError}=await db.from("notification_logs")
   .select("id,delivery_status,created_at").eq("booking_id",id).eq("channel","email").eq("notification_type",type)
   .in("delivery_status",["pending","sent"]).maybeSingle();
  if(lookupError) throw lookupError;
  if(existing?.delivery_status==="sent") return reply({success:true,status:"already_sent"});
  const apiKey=Deno.env.get("RESEND_API_KEY"), from=Deno.env.get("EMAIL_FROM");
  if(!apiKey||!from){
   if(existing?.delivery_status==="pending") await db.from("notification_logs").update({delivery_status:"skipped",error_message:"Resend API key or verified sender is not configured."}).eq("id",existing.id);
   else if(!existing) await db.from("notification_logs").insert({booking_id:id,recipient,channel:"email",notification_type:type,message:summary,delivery_status:"skipped",error_message:"Resend API key or verified sender is not configured."});
   return reply({success:false,status:"not_configured",message:"Booking updated; email provider is not configured."});
  }
  if(existing?.delivery_status==="pending"){
   const staleBefore=new Date(Date.now()-10*60*1000).toISOString();
   const {data:reclaimed,error:reclaimError}=await db.from("notification_logs").update({
    recipient,message:summary,created_at:new Date().toISOString(),error_message:null,provider_reference:null,sent_at:null
   }).eq("id",existing.id).eq("delivery_status","pending").lt("created_at",staleBefore).select("id").maybeSingle();
   if(reclaimError) throw reclaimError;
   if(!reclaimed) return reply({success:false,status:"in_progress",message:"A notification attempt is already in progress."},409);
  }
  const subjectFallback={confirmed:"Your Materuni Hosts booking is confirmed",cancelled:"An update to your Materuni Hosts booking",rescheduled:"Your Materuni Hosts booking has been rescheduled"}[event];
  const intro={confirmed:"We are pleased to confirm your booking.",cancelled:"Your booking has been cancelled. If you need help, please contact our local team.",rescheduled:"Your booking date and time have been updated. Please review the details below."}[event];
  const {data:templateSetting,error:templateError}=await db.from("site_settings").select("setting_value").eq("setting_key","email_templates").maybeSingle();
  if(templateError) throw templateError;
  let templates:Record<string,{subject?:string;body?:string}>={};
  try{templates=JSON.parse(templateSetting?.setting_value||"{}")}catch{templates={};}
  const templateKey=event;
  const savedTemplate=templates[templateKey];
  const mergeValues:Record<string,string>={
   guest_name:guest,partner_name:guest,experience:String(b.experience||"Materuni experience"),
   booking_date:String(b.booking_date||""),guest_count:String(count),booking_reference:String(reference),
   host_name:"Saidi Materu & Local Hosts",reply_email:"materunihosts@gmail.com",whatsapp:"+255 612 068 540"
  };
  const merge=(value:string)=>value.replace(/\{\{([a-z_]+)\}\}/g,(_,key)=>mergeValues[key]??"");
  const subject=merge(String(savedTemplate?.subject||subjectFallback)).slice(0,180);
  const customBody=String(savedTemplate?.body||"").trim();
  const messageBody=customBody?merge(customBody):[
   "Hello "+guest+",",intro,"Reference: "+reference,"Experience: "+b.experience,
   "Date: "+b.booking_date,"Time: "+time+(endTime?" – "+endTime:"")+" (Tanzania time)",
   "Guests: "+count,"Status: "+expected,"For assistance, reply to this email or WhatsApp +255 612 068 540.",
   "Warm regards,","Materuni Hosts"
  ].join("\n\n");
  let logId=existing?.id;
  if(logId){const {error:updateError}=await db.from("notification_logs").update({delivery_status:"pending",error_message:null,message:summary,recipient}).eq("id",logId);if(updateError)throw updateError;}
  else {
   const {data:log,error:logError}=await db.from("notification_logs")
    .insert({booking_id:id,recipient,channel:"email",notification_type:type,message:summary,delivery_status:"pending"})
    .select("id").single();
   if(logError){
    // A concurrent admin request may have claimed this same event after our lookup.
    // The unique index is the final guard against sending duplicate messages.
    if(logError.code==="23505")return reply({success:false,status:"in_progress",message:"A notification attempt is already in progress."},409);
    throw logError;
   }
   logId=log.id;
  }
  const eventTitle={confirmed:"Reservation Confirmed",cancelled:"Booking Cancelled",rescheduled:"Booking Rescheduled"}[event]||"Booking Update";
  const statusBadges: Record<string, {text:string;bg:string;color:string;border:string}> = {
    confirmed: { text: "✅ STATUS: RESERVATION CONFIRMED & GUARANTEED", bg: "#EBF3ED", color: "#1A3322", border: "#C5E0CB" },
    rescheduled: { text: "🔄 STATUS: RESERVATION RESCHEDULED & UPDATED", bg: "#F8F3EA", color: "#8A6822", border: "#E6DFD3" },
    cancelled: { text: "❌ STATUS: RESERVATION CANCELLED", bg: "#FDF2F2", color: "#8B342D", border: "#F5C2C7" }
  };
  const currentBadge = statusBadges[event] || statusBadges.confirmed;
  const dateDigits=String(b.booking_date||"").replace(/[^0-9]/g,"");
  const calDate=dateDigits.length===8?dateDigits:new Date().toISOString().slice(0,10).replace(/[^0-9]/g,"");
  const gCalUrl="https://calendar.google.com/calendar/render?action=TEMPLATE&text="+encodeURIComponent(String(b.experience||"Materuni Experience")+" - Materuni Hosts")+"&dates="+calDate+"T060000Z/"+calDate+"T130000Z&details="+encodeURIComponent("Booking Ref: "+reference+"\nHost: Saidi Materu (+255 612 068 540)\nLocation: Materuni Village, Moshi, Tanzania")+"&location="+encodeURIComponent("Materuni Cultural Tourism Centre, Materuni Village, Moshi, Kilimanjaro, Tanzania");
  const manageUrl = "https://materunihosts.com/booking?ref=" + encodeURIComponent(reference) + "&manage=true";
  const whatsappUrl = "https://wa.me/255612068540?text=" + encodeURIComponent("Hello Materuni Hosts, I have a question regarding my booking reference: " + reference);
  const pickupDetail = String(b.pickup || "").trim();

  const bodyParagraphs = messageBody.split("\n")
    .map(line => line ? `<p style="margin:0 0 12px;line-height:1.75;font-size:14px;color:#242421">${esc(line)}</p>` : '<div style="height:6px"></div>')
    .join("");

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(eventTitle)} · ${esc(reference)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F0E8;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#242421;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#F4F0E8" style="background-color:#F4F0E8;width:100%;margin:0;padding:24px 12px;">
  <tr>
    <td align="center">
      <!--[if (gte mso 9)|(IE)]>
      <table align="center" border="0" cellspacing="0" cellpadding="0" width="600"><tr><td align="center" valign="top" width="600">
      <![endif]-->
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;background-color:#FAF7F2;border:1px solid #E6DFD3;border-radius:12px;overflow:hidden;box-shadow:0 12px 36px rgba(26,51,34,0.08);">
        
        <!-- Header -->
        <tr>
          <td bgcolor="#1A3322" style="background-color:#1A3322;padding:32px 28px;border-bottom:4px solid #C5A059;">
            <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td valign="middle" align="left">
                  <div style="font-size:11px;font-weight:800;letter-spacing:2.5px;color:#C5A059;text-transform:uppercase;">MATERUNI HOSTS</div>
                  <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:30px;font-weight:700;color:#FAF7F2;margin:6px 0 0;padding:0;">${esc(eventTitle)}</h1>
                  <div style="font-size:12px;color:#E6DFD3;margin-top:5px;letter-spacing:0.3px;">Authentic Chagga Hospitality · Mount Kilimanjaro</div>
                </td>
                <td valign="middle" align="right" style="padding-left:12px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="background-color:#FAF7F2;border:1px solid #C5A059;border-radius:6px;padding:8px 12px;text-align:right;">
                    <tr>
                      <td align="right">
                        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#7A756B;display:block;">BOOKING REF</span>
                        <strong style="font-family:'Courier New',Courier,monospace;font-size:14px;font-weight:800;color:#1A3322;display:block;letter-spacing:0.5px;">${esc(reference)}</strong>
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
          <td bgcolor="${currentBadge.bg}" style="background-color:${currentBadge.bg};border-bottom:1px solid ${currentBadge.border};padding:11px 24px;text-align:center;">
            <span style="font-size:12px;font-weight:800;letter-spacing:1px;color:${currentBadge.color};text-transform:uppercase;">
              ${currentBadge.text}
            </span>
          </td>
        </tr>

        <!-- Content Area -->
        <tr>
          <td style="padding:28px 24px 20px;background-color:#FAF7F2;">
            
            <p style="font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:26px;color:#1A3322;margin:0 0 14px;font-weight:600;">
              Habari ${esc(guest)},
            </p>

            ${bodyParagraphs}

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
                <td width="62%" style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:14px;font-weight:700;color:#1A3322;">${esc(b.experience)}</td>
              </tr>
              <tr>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:12px;font-weight:600;color:#7A756B;text-transform:uppercase;letter-spacing:0.5px;">Date & Time</td>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:14px;font-weight:700;color:#1A3322;">${esc(b.booking_date)} &middot; ${esc(time)}${endTime ? ' &ndash; ' + esc(endTime) : ''} <span style="font-size:11px;font-weight:400;color:#7A756B;">(East Africa Time)</span></td>
              </tr>
              <tr>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:12px;font-weight:600;color:#7A756B;text-transform:uppercase;letter-spacing:0.5px;">Party Size</td>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:14px;color:#1A3322;"><strong>${count}</strong> guest${count > 1 ? "s" : ""}</td>
              </tr>
              <tr>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:12px;font-weight:600;color:#7A756B;text-transform:uppercase;letter-spacing:0.5px;">Lead Traveler</td>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:14px;color:#1A3322;">${esc(guest)}</td>
              </tr>
              <tr>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:12px;font-weight:600;color:#7A756B;text-transform:uppercase;letter-spacing:0.5px;">Status</td>
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:14px;font-weight:700;color:${event === 'cancelled' ? '#8B342D' : '#1A3322'};">${esc(expected)}</td>
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
                <td style="padding:12px 18px;border-bottom:1px solid #F0ECE1;font-size:13px;color:#1A3322;">${esc(pickupDetail)}</td>
              </tr>` : ""}
              <tr>
                <td style="padding:12px 18px;font-size:12px;font-weight:600;color:#7A756B;text-transform:uppercase;letter-spacing:0.5px;">Payment Terms</td>
                <td style="padding:12px 18px;font-size:13px;color:#1A3322;line-height:1.5;">
                  <strong>Pay on arrival</strong> (USD or TZS cash, or Vodacom M-Pesa). No online card fees.
                </td>
              </tr>
            </table>

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
                    View live status, request rescheduling, or update party size online.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Quick Action Links -->
            ${event !== "cancelled" ? `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:12px 0 24px;">
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
            </table>` : ''}

            <!-- Traveler Checklist Card -->
            ${event !== "cancelled" ? `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#F8F5EE;border:1px solid #E6DFD3;border-radius:8px;margin:16px 0 10px;">
              <tr>
                <td style="padding:16px 18px;">
                  <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#1A3322;text-transform:uppercase;margin-bottom:10px;">
                    🌿 ESSENTIAL PREPARATION FOR MATERUNI
                  </div>
                  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.6;color:#333;">
                    <tr>
                      <td width="24" valign="top" style="padding-bottom:6px;">👟</td>
                      <td valign="top" style="padding-bottom:6px;"><strong>Footwear:</strong> Sturdy walking shoes or sneakers with good traction.</td>
                    </tr>
                    <tr>
                      <td width="24" valign="top" style="padding-bottom:6px;">🧥</td>
                      <td valign="top" style="padding-bottom:6px;"><strong>Clothing:</strong> Lightweight layers, light rain jacket, and comfortable modest attire.</td>
                    </tr>
                    <tr>
                      <td width="24" valign="top" style="padding-bottom:6px;">🏊</td>
                      <td valign="top" style="padding-bottom:6px;"><strong>Waterfall Swim:</strong> Pack swimwear and a small towel if you wish to swim in the pool.</td>
                    </tr>
                    <tr>
                      <td width="24" valign="top">💵</td>
                      <td valign="top"><strong>Village Cash:</strong> Small Tanzanian Shillings for fresh roasted village coffee beans or local crafts.</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>` : ''}

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
  try{
   const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({from,to:[recipient],subject,html}),signal:AbortSignal.timeout(10000)});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(String(result?.message||"Email delivery failed."));
   const {error:finishError}=await db.from("notification_logs").update({delivery_status:"sent",provider_reference:result?.id||null,sent_at:new Date().toISOString(),error_message:null}).eq("id",logId);
   if(finishError)throw finishError;
   return reply({success:true,status:"sent"});
  }catch(sendError){
   const message=sendError instanceof Error?sendError.message:"Email delivery failed.";
   await db.from("notification_logs").update({delivery_status:"failed",error_message:message}).eq("id",logId);
   return reply({success:false,status:"failed",message:"Booking updated, but guest email failed to send."});
  }
 }catch(error){console.error("admin booking notification:",error instanceof Error?error.name:"unknown");return reply({error:"Could not process booking notification."},500);}
});
