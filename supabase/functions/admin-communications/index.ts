declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Response | Promise<Response>): void };
declare module "npm:@supabase/supabase-js@2" { export function createClient(...args: any[]): any; }
import { createClient } from "npm:@supabase/supabase-js@2";

const headers={ "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods":"POST, OPTIONS", "Content-Type":"application/json" };
const json=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers});
const clean=(v:unknown,max=500)=>String(v??"").replace(/[\x00-\x1F\x7F]/g," ").trim().slice(0,max);
const escapeHtml=(v:string)=>v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
const validEmail=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const interpolate=(value:string,vars:Record<string,string>)=>value.replace(/\{\{([a-z_]+)\}\}/g,(_,key)=>vars[key]??"");

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 if(Number(req.headers.get("content-length")||"0")>12000)return json({error:"Request too large"},413);
 try{
  const auth=req.headers.get("authorization")||"";
  const jwt=auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!jwt)return json({error:"Administrator sign-in required."},401);
  const url=Deno.env.get("SUPABASE_URL"), service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!service)return json({error:"Communication service is not configured."},503);
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await db.auth.getUser(jwt);
  if(userError||!userData?.user)return json({error:"Administrator session is invalid."},401);
  const {data:admin,error:adminError}=await db.from("admin_users").select("user_id").eq("user_id",userData.user.id).maybeSingle();
  if(adminError||!admin)return json({error:"This account is not authorised to send communications."},403);
  const body=await req.json().catch(()=>null);
  if(body?.action!=="partner_invitation")return json({error:"Unsupported communication action."},400);
  const partnerId=clean(body.partner_id,64);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(partnerId))return json({error:"A valid partner is required."},400);
  const {data:partner,error:partnerError}=await db.from("partners").select("id,business_name,contact_name,email,whatsapp,status").eq("id",partnerId).maybeSingle();
  if(partnerError)throw partnerError;
  if(!partner)return json({error:"Partner record not found."},404);
  if(partner.status==="archived")return json({error:"Archived partners cannot be invited."},409);
  const {data:setting}=await db.from("site_settings").select("setting_value").eq("setting_key","email_templates").maybeSingle();
  let templates:Record<string,any>={};
  try{templates=JSON.parse(setting?.setting_value||"{}")}catch{}
  const defaultTemplate={
   subject:"An invitation to collaborate with Materuni Hosts",
   body:"Hello {{partner_name}},\n\nWarm greetings from Materuni Hosts.\n\nWe would love to explore a thoughtful local partnership with {{partner_name}}. We host authentic Chagga coffee, waterfall, food and village experiences in Materuni Village, and value clear communication and guest care.\n\nIf you are open to a conversation, simply reply to this email or reach us on WhatsApp at {{whatsapp}}. We would be pleased to share our experiences and discuss how we can work together.\n\nWarm regards,\n{{host_name}}\nMateruni Hosts\n{{reply_email}}\nCome as a guest. Leave as a friend."
  };
  const template=templates.partner||defaultTemplate;
  const vars={partner_name:clean(partner.contact_name||partner.business_name,120),host_name:clean(Deno.env.get("HOST_CONTACT_NAME")||"Your local host",120),reply_email:clean(Deno.env.get("EMAIL_REPLY_TO")||"hello@materunihosts.com",254),whatsapp:clean(Deno.env.get("PUBLIC_WHATSAPP_NUMBER")||"+255 612 068 540",40)};
  const subject=interpolate(clean(template.subject||defaultTemplate.subject,180),vars);
  const message=interpolate(clean(template.body||defaultTemplate.body,8000),vars);
  const outcomes:Record<string,string>={};
  async function log(channel:string,recipient:string,status:string,providerRef?:string,errorMessage?:string){
   const {error}=await db.from("communication_logs").insert({partner_id:partner.id,recipient,channel,communication_type:"partner_invitation",delivery_status:status,provider_reference:providerRef||null,error_message:errorMessage||null,sent_at:status==="sent"?new Date().toISOString():null});
   if(error)console.error("Communication log insert failed:",error.message);
  }
  const email=clean(partner.email,254);
  if(email&&validEmail(email)){
   const apiKey=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("EMAIL_FROM");
   if(!apiKey||!from){outcomes.email="not_configured";await log("email",email,"skipped",undefined,"Resend API key or verified sender is missing.");}
   else{
    try{
     const html='<div style="max-width:620px;margin:auto;background:#FAF7F2;color:#242421;font:15px/1.75 Arial,sans-serif"><header style="background:#1A3322;color:#fff;padding:28px"><div style="letter-spacing:3px;font-size:12px">MATERUNI HOSTS</div><h1 style="font:500 30px Georgia,serif">An invitation to collaborate</h1></header><main style="padding:28px">'+message.split("\n").map(line=>line?'<p>'+escapeHtml(line)+'</p>':'<br>').join("")+'</main></div>';
     const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({from,to:[email],reply_to:vars.reply_email,subject,html}),signal:AbortSignal.timeout(12000)});
     const result=await response.json().catch(()=>({}));
     if(!response.ok)throw new Error(result?.message||"Resend delivery failed.");
     outcomes.email="sent";await log("email",email,"sent",result?.id);
    }catch(error){const msg=clean(error instanceof Error?error.message:"Email delivery failed.",500);outcomes.email="failed";await log("email",email,"failed",undefined,msg);}
   }
  }else{outcomes.email="missing_or_invalid_partner_email";await log("email",email||"missing email","skipped",undefined,"Add a valid partner email address before sending.");}
  const phone=clean(partner.whatsapp,40).replace(/[^0-9]/g,"");
  const waToken=Deno.env.get("WHATSAPP_ACCESS_TOKEN"),phoneId=Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"),waTemplate=Deno.env.get("WHATSAPP_PARTNER_INVITE_TEMPLATE");
  if(phone&&waToken&&phoneId&&waTemplate){
   try{
    const response=await fetch("https://graph.facebook.com/v22.0/"+phoneId+"/messages",{method:"POST",headers:{Authorization:"Bearer "+waToken,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to:phone,type:"template",template:{name:waTemplate,language:{code:Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE")||"en"},components:[{type:"body",parameters:[{type:"text",text:clean(partner.business_name,120)},{type:"text",text:clean(partner.contact_name||"Partner",120)},{type:"text",text:vars.whatsapp}]}]}}),signal:AbortSignal.timeout(12000)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result?.error?.message||"WhatsApp delivery failed.");
    outcomes.whatsapp="sent";await log("whatsapp",phone,"sent",result?.messages?.[0]?.id);
   }catch(error){const msg=clean(error instanceof Error?error.message:"WhatsApp delivery failed.",500);outcomes.whatsapp="failed";await log("whatsapp",phone,"failed",undefined,msg);}
  }else{outcomes.whatsapp=phone?"not_configured":"missing_partner_whatsapp";await log("whatsapp",phone||"missing WhatsApp","skipped",undefined,phone?"Meta WhatsApp Cloud API credentials or approved partner invitation template are missing.":"Add the partner WhatsApp number before sending.");}
  return json({success:true,partner:partner.business_name,outcomes});
 }catch(error){console.error("admin-communications failed:",error instanceof Error?error.name:"unknown");return json({error:"Communication could not be processed."},500);}
});
