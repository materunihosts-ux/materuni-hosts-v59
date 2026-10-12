import { createClient } from "npm:@supabase/supabase-js@2";
const cors={ "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods":"POST, OPTIONS", "Content-Type":"application/json" };
const reply=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const esc=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]??c));
Deno.serve(async req=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return reply({error:"Method not allowed"},405);
 try{
  const auth=req.headers.get("authorization")||"";
  const token=auth.replace(/^Bearer\s+/i,"");
  if(!token) return reply({error:"Authentication required."},401);
  const url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key) return reply({error:"Notification service is not configured."},503);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await db.auth.getUser(token);
  if(userError||!userData.user) return reply({error:"Invalid session."},401);
  const {data:admin}=await db.from("admin_users").select("user_id").eq("user_id",userData.user.id).maybeSingle();
  if(!admin) return reply({error:"Admin access required."},403);
  const body=await req.json().catch(()=>null);
  const id=String(body?.booking_id||"");
  const event=String(body?.event||"");
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||!["confirmed","cancelled","rescheduled"].includes(event)) return reply({error:"Invalid booking notification request."},400);
  const {data:b,error}=await db.from("bookings").select("id,booking_reference,experience,booking_date,guest_count,guests,guest,email,phone,preferred_contact,status").eq("id",id).maybeSingle();
  if(error) throw error;
  const expected={confirmed:"Confirmed",cancelled:"Cancelled",rescheduled:"Confirmed"}[event];
  if(!b||b.status!==expected) return reply({error:"Booking state does not match the requested notification."},409);
  const reference=b.booking_reference||b.id;
  const guest=String(b.guest||"Guest");
  const date=String(b.booking_date||"");
  const count=Number(b.guest_count||b.guests||1);
  const recipient=String(b.email||"").trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return reply({success:false,status:"no_valid_guest_email",message:"Booking updated, but no valid guest email is recorded."});
  const type="guest_booking_"+event;
  const {data:existing}=await db.from("notification_logs").select("id,delivery_status").eq("booking_id",id).eq("channel","email").eq("notification_type",type).maybeSingle();
  if(existing?.delivery_status==="sent") return reply({success:true,status:"already_sent"});
  const apiKey=Deno.env.get("RESEND_API_KEY"), from=Deno.env.get("EMAIL_FROM");
  if(!apiKey||!from){
    if(!existing) await db.from("notification_logs").insert({booking_id:id,recipient,channel:"email",notification_type:type,message:"Booking "+event+" · "+reference,delivery_status:"skipped",error_message:"Resend API key or verified sender is not configured."});
    return reply({success:false,status:"not_configured",message:"Booking updated; email provider is not configured."});
  }
  const subject={confirmed:"Your Materuni Hosts booking is confirmed",cancelled:"An update to your Materuni Hosts booking",rescheduled:"Your Materuni Hosts booking has been rescheduled"}[event];
  const intro={confirmed:"We are pleased to confirm your booking.",cancelled:"Your booking has been cancelled. If you need help, please contact our local team.",rescheduled:"Your booking date has been updated. Please review the details below."}[event];
  const html='<div style="font-family:Arial,sans-serif;line-height:1.7;color:#242421;max-width:620px;margin:auto"><header style="background:#1A3322;color:white;padding:26px"><div style="letter-spacing:3px;font-size:12px">MATERUNI HOSTS</div><h1 style="font-family:Georgia,serif;font-weight:500">Booking update</h1></header><main style="background:#FAF7F2;padding:28px"><p>Hello '+esc(guest)+',</p><p>'+intro+'</p><p><b>Reference:</b> '+esc(reference)+'<br><b>Experience:</b> '+esc(b.experience)+'<br><b>Date:</b> '+esc(date)+'<br><b>Guests:</b> '+count+'<br><b>Status:</b> '+esc(expected)+'</p><p>For assistance, reply to this email or WhatsApp +255 612 068 540.</p><p>Warm regards,<br>Materuni Hosts</p></main></div>';
  let logId=existing?.id;
  if(logId) await db.from("notification_logs").update({delivery_status:"pending",error_message:null,message:"Booking "+event+" · "+reference}).eq("id",logId);
  else {const {data:log,error:logError}=await db.from("notification_logs").insert({booking_id:id,recipient,channel:"email",notification_type:type,message:"Booking "+event+" · "+reference,delivery_status:"pending"}).select("id").single();if(logError) throw logError;logId=log.id;}
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({from,to:[recipient],subject,html}),signal:AbortSignal.timeout(10000)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok){await db.from("notification_logs").update({delivery_status:"failed",error_message:String(result?.message||"Email delivery failed.")}).eq("id",logId);return reply({success:false,status:"failed",message:"Booking updated, but guest email failed to send."});}
  await db.from("notification_logs").update({delivery_status:"sent",provider_reference:result?.id||null,sent_at:new Date().toISOString(),error_message:null}).eq("id",logId);
  return reply({success:true,status:"sent"});
 }catch(e){console.error("admin booking notification:",e);return reply({error:"Could not process booking notification."},500);}
});