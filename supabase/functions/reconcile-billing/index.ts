import {billingClients,assertStripeAccount,syncCustomer,json} from '../_shared/billing.ts';
import {isServiceRequest} from '../_shared/service-auth.ts';
Deno.serve(async req=>{
  if(!await isServiceRequest(req,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))) return json({error:'Unauthorized'},401);
  try {
    const {stripe,admin,config}=billingClients();
    await assertStripeAccount(stripe,config);
    const candidates=await admin.rpc('billing_reconciliation_candidates');
    if(candidates.error) throw new Error('Candidates unavailable');
    let succeeded=0,failed=0;const started=Date.now();
    for(const row of candidates.data??[]) {
      if(Date.now()-started>40000) break;
      try {await syncCustomer(stripe,admin,row.stripe_customer_id,row.user_id);succeeded++;}
      catch {failed++;}
    }
    console.info('[reconcile-billing]',{succeeded,failed});
    return json({succeeded,failed},failed?503:200);
  } catch {
    console.error('[reconcile-billing] Scheduled reconciliation unavailable');
    return json({error:'Reconciliation unavailable'},503);
  }
});
