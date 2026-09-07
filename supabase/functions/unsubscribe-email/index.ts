import {createClient} from 'npm:@supabase/supabase-js@2.115.0';
import {setEmailUnsubscribe} from 'npm:@lovable.dev/email-js@0.3.0';
import {boundedText,browserEndpoint} from '../_shared/http-security.ts';

Deno.serve(browserEndpoint(async req=>{
  if(req.method!=='POST') return Response.json({error:'Method not allowed.'},{status:405});
  let body:Record<string,unknown>;
  try {body=JSON.parse(await boundedText(req,256));} catch {return Response.json({error:'Invalid request.'},{status:400});}
  if(!body || Object.keys(body).length!==1 || typeof body.token!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.token)) return Response.json({error:'Invalid link.'},{status:400});
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const result=await admin.rpc('unsubscribe_app_email',{_token:body.token});
  if(result.error) return Response.json({error:'Email preferences unavailable.'},{status:503});
  // Identical response for unknown and already-used tokens; never expose the address.
  if(result.data) {
    const apiKey=Deno.env.get('LOVABLE_API_KEY');
    if(apiKey) try {await setEmailUnsubscribe({recipient:result.data,domain:'notify.trycasher.com',subscribed:false},{apiKey});}
    catch {console.error('[unsubscribe-email] Provider preference sync failed; local suppression is active.');}
  }
  return Response.json({unsubscribed:true});
}));
