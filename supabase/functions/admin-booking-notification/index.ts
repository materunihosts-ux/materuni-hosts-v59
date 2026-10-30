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
   const eventTitle={confirmed:"Booking Confirmed",cancelled:"Booking Cancelled",rescheduled:"Booking Rescheduled"}[event]||"Booking Update";
   const dateDigits=String(b.booking_date||"").replace(/[^0-9]/g,"");
   const calDate=dateDigits.length===8?dateDigits:new Date().toISOString().slice(0,10).replace(/[^0-9]/g,"");
   const gCalUrl="https://calendar.google.com/calendar/render?action=TEMPLATE&text="+encodeURIComponent(String(b.experience||"Materuni Experience")+" - Materuni Hosts")+"&dates="+calDate+"T060000Z/"+calDate+"T130000Z&details="+encodeURIComponent("Booking Ref: "+reference+"\nHost: Saidi Materu (+255 612 068 540)\nLocation: Materuni Village, Moshi, Tanzania")+"&location="+encodeURIComponent("Materuni Cultural Tourism Centre, Materuni Village, Moshi, Kilimanjaro, Tanzania");
   const html='<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.7;color:#242421;max-width:620px;margin:20px auto;border:1px solid #E6DFD3;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 8px 30px rgba(26,51,34,0.08)">'+
    '<div style="background:#1A3322;padding:32px 30px;border-bottom:4px solid #C5A059;color:#FAF7F2">'+
    '<table style="width:100%;border-collapse:collapse"><tr>'+
    '<td style="vertical-align:middle">'+
    '<div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#C5A059">MATERUNI HOSTS</div>'+
    '<h1 style="font-family:Georgia,serif;font-size:26px;font-weight:600;margin:6px 0 0;line-height:1.2;color:#FAF7F2">'+esc(eventTitle)+'</h1>'+
    '<div style="font-size:12px;color:#E6DFD3;margin-top:6px">Materuni Village · Kilimanjaro Foothills, Tanzania</div>'+
    '</td>'+
    '<td style="vertical-align:middle;text-align:right">'+
    '<div style="display:inline-block;background:#FAF7F2;padding:8px 14px;border-radius:6px;border:1px solid #C5A059;text-align:right">'+
    '<span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#7A756B;display:block">REFERENCE</span>'+
    '<strong style="font-family:monospace;font-size:15px;color:#1A3322">'+esc(reference)+'</strong>'+
    '</div>'+
    '</td>'+
    '</tr></table>'+
    '</div>'+
    '<div style="padding:30px;background:#FAF7F2">'+
    '<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #E6DFD3;border-radius:8px;margin-bottom:22px">'+
    '<tr><td style="padding:12px 16px;border-bottom:1px solid #E6DFD3;font-size:12px;color:#7A756B;width:120px">Experience:</td><td style="padding:12px 16px;border-bottom:1px solid #E6DFD3;font-size:14px;font-weight:700;color:#1A3322">'+esc(b.experience)+'</td></tr>'+
    '<tr><td style="padding:12px 16px;border-bottom:1px solid #E6DFD3;font-size:12px;color:#7A756B">Date & Time:</td><td style="padding:12px 16px;border-bottom:1px solid #E6DFD3;font-size:14px;font-weight:700;color:#1A3322">'+esc(b.booking_date)+' · '+esc(time)+(endTime?'–'+esc(endTime):'')+' (EAT)</td></tr>'+
    '<tr><td style="padding:12px 16px;border-bottom:1px solid #E6DFD3;font-size:12px;color:#7A756B">Guests:</td><td style="padding:12px 16px;border-bottom:1px solid #E6DFD3;font-size:14px;color:#1A3322">'+count+' Guest(s)</td></tr>'+
    '<tr><td style="padding:12px 16px;border-bottom:1px solid #E6DFD3;font-size:12px;color:#7A756B">Status:</td><td style="padding:12px 16px;border-bottom:1px solid #E6DFD3;font-size:14px;font-weight:700;color:'+(event==='cancelled'?'#8B342D':'#1A3322')+'">'+esc(expected)+'</td></tr>'+
    '<tr><td style="padding:12px 16px;font-size:12px;color:#7A756B">Meeting point:</td><td style="padding:12px 16px;font-size:13px;color:#1A3322">Materuni Cultural Tourism Centre (GPS: -3.2505° S, 37.3912° E)</td></tr>'+
    '</table>'+
    messageBody.split("\n").map(line=>line?'<p style="margin:0 0 12px;line-height:1.7;font-size:14px;color:#333">'+esc(line)+'</p>':'<div style="height:6px"></div>').join('')+
    (event!=="cancelled"?'<div style="margin:24px 0 10px;text-align:center">'+
    '<a href="'+gCalUrl+'" style="display:inline-block;background:#1A3322;color:#FAF7F2;padding:12px 20px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:700;margin-right:10px">📅 Add to Calendar</a>'+
    '<a href="https://wa.me/255612068540?text='+encodeURIComponent("Hello Materuni Hosts, I have a question regarding my booking reference: " + reference)+'" style="display:inline-block;background:#C5A059;color:#1A3322;padding:12px 20px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:700">💬 Chat on WhatsApp</a>'+
    '</div>':'')+
    '</div>'+
    '<div style="background:#E6DFD3;padding:20px 30px;color:#555;font-size:12px;border-top:1px solid #d9d1c4;text-align:center">'+
    '<strong>Materuni Hosts Cultural Tourism</strong> · Materuni Village, Moshi, Kilimanjaro, Tanzania<br>'+
    'WhatsApp: +255 612 068 540 · materunihosts@gmail.com · <a href="https://materunihosts.com" style="color:#1A3322;text-decoration:none;font-weight:700">materunihosts.com</a><br>'+
    '<em style="color:#80652F;font-family:Georgia,serif;font-style:italic;display:block;margin-top:6px">Come as a guest. Leave as a friend.</em>'+
    '</div>'+
    '</div>';
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
