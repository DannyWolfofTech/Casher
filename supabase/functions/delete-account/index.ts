import { createClient } from 'npm:@supabase/supabase-js@2.115.0';
import { assertStripeAccount, billingClients, currentSubscriptions } from '../_shared/billing.ts';
import { deleteAccount, DeletionError, verifyDeletionRequest } from '../_shared/account-deletion.ts';
import { boundedText, HttpError } from '../_shared/http-security.ts';

const origins = new Set(['https://trycasher.com','https://www.trycasher.com','https://localhost','capacitor://localhost', ...(Deno.env.get('ALLOWED_REDIRECT_ORIGINS') || '').split(',').map(s=>s.trim()).filter(Boolean)]);
Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const headers: Record<string,string> = { 'Content-Type':'application/json','Cache-Control':'no-store', Vary:'Origin', 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods':'POST, OPTIONS' };
  if (origin && origins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body),{status,headers});
  if (origin && !origins.has(origin)) return reply({error:'Origin is not allowed.'},403);
  if (req.method === 'OPTIONS') return new Response(null,{headers});
  if (req.method !== 'POST') return reply({error:'Use POST.'},405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  try {
    const jwt = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!jwt) return reply({error:'Please sign in.'},401);
    const {data:{user},error} = await admin.auth.getUser(jwt);
    if (error || !user?.email || !user.email_confirmed_at) return reply({error:'Please sign in again.'},401);
    const text = await boundedText(req,256);
    verifyDeletionRequest(JSON.parse(text),user.last_sign_in_at);
    const rpc = async (name:string,args:Record<string,unknown>) => { const result=await admin.rpc(name,args); if(result.error) throw new Error('Account operation unavailable'); return result.data; };
    // The billing client is created lazily, so a free account does not depend on Stripe.
    let client: ReturnType<typeof billingClients> | undefined;
    let customerDeleted = false;
    await deleteAccount(user.id,{
      acquire:id=>rpc('acquire_account_operation',{_user_id:id,_closing:true}),
      customer:async id=>{
        const {data,error}=await admin.from('profiles').select('stripe_customer_id').eq('user_id',id).single();
        if(error) throw new Error('Profile unavailable');
        return data.stripe_customer_id;
      },
      complete:(id,lease,customer)=>rpc('complete_account_deletion',{_user_id:id,_lease:lease,_customer_id:customer}),
      release:async(id,lease)=>{ await rpc('release_account_operation',{_user_id:id,_lease:lease}); },
    },{
      verifyCustomer:async(id,customerId)=>{
        client=billingClients(); await assertStripeAccount(client.stripe,client.config);
        const customer=await client.stripe.customers.retrieve(customerId);
        customerDeleted = customer.deleted === true;
        if (!customer.deleted && customer.metadata.user_id !== id) throw new DeletionError('Your billing account needs support before deletion. Contact privacy@trycasher.com.');
      },
      expireCheckouts:async customerId=>{
        if (customerDeleted) return; // Stripe prevents further operations on deleted customers.
        for await(const session of client!.stripe.checkout.sessions.list({customer:customerId,status:'open',limit:100})) {
          await client!.stripe.checkout.sessions.expire(session.id);
        }
      },
      cancelSubscriptions:async customerId=>{
        if (customerDeleted) return; // Stripe deletion already cancels active subscriptions.
        for(const sub of await currentSubscriptions(client!.stripe,customerId)) {
          if (!['canceled','incomplete_expired'].includes(sub.status)) await client!.stripe.subscriptions.cancel(sub.id,{invoice_now:false,prorate:false});
        }
      },
    });
    return reply({deleted:true});
  } catch(error) {
    if(error instanceof DeletionError || error instanceof HttpError) return reply({error:error.message},error.status);
    if(error instanceof SyntaxError) return reply({error:'Invalid request.'},400);
    console.error('[delete-account] Account closure could not complete');
    return reply({error:'Deletion could not be confirmed. Retry deletion, or contact privacy@trycasher.com. If deletion has started, new purchases remain blocked until it finishes.'},503);
  }
});
