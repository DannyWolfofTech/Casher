// Exercise only an explicitly provisioned disposable release account on production.
// Never creates a charge, changes provider settings or uses a service key locally.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const user=JSON.parse(await readFile('.audit-results/production-test-user.json','utf8'));
assert(/^release-[0-9a-f-]{36}@example\.test$/.test(user.email),'Disposable test identity required');
const env=Object.fromEntries((await readFile('.env','utf8')).split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
const url=env.VITE_SUPABASE_URL;
assert.equal(url,'https://ewnjmvxildwmbdmosasz.supabase.co');
const client=createClient(url,env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const logged=await client.auth.signInWithPassword(user);assert.equal(logged.error,null);
const identity=logged.data.user;assert.equal(identity.email,user.email);assert.equal(identity.user_metadata.release_test,'20260907');
const token=logged.data.session.access_token;
const results=[];
const pass=name=>{results.push(name);console.log('PASS',name);};
const invoke=async(name,body,origin='https://trycasher.com')=>{
  const response=await fetch(`${url}/functions/v1/${name}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
  return{status:response.status,body:await response.json()};
};
const data=result=>{assert.equal(result.error,null);return result.data;};
try {
  if(process.argv.includes('--delete')) {
    const deleted=await invoke('delete-account',{confirmation:'DELETE'});
    assert.equal(deleted.status,200,JSON.stringify(deleted.body));assert.equal(deleted.body.deleted,true);
    assert((await client.auth.getUser(token)).error);
    pass('Production deletion removed the disposable account and invalidated its session');
  } else {
    assert.equal(data(await client.from('profiles').select('user_id')).length,1);
    assert.equal(data(await client.from('profiles').select('user_id'))[0].user_id,identity.id);
    pass('Production password authentication and profile isolation');
    const state=await invoke('check-subscription',{});assert.equal(state.status,200);assert.equal(state.body.tier,'free');
    const paused=await invoke('create-checkout-session',{tier:'pro'});assert.equal(paused.status,503);assert.equal(paused.body.code,'CHECKOUT_PAUSED');
    const origin=await invoke('process-csv',{},'https://untrusted.example');assert.equal(origin.status,403);
    assert.equal((await invoke('process-csv',{},'http://localhost:8080')).status,403);
    assert.equal((await invoke('reconcile-billing',{})).status,401);
    assert.equal((await invoke('process-email-queue',{})).status,403);
    pass('Production live checkout pause, origin policy and service-only boundaries');
    const csv='Date,Description,Money Out,Money In\n01/09/2026,Release test payroll,,3000.00\n02/09/2026,Release test coffee,4.50,\n02/09/2026,Release test coffee,4.50,\n03/09/2026,Netflix,10.99,\n';
    const imported=await invoke('process-csv',{csv});assert.equal(imported.status,200,JSON.stringify(imported.body));
    const rows=data(await client.from('transactions').select('*').order('date'));
    assert.equal(rows.length,4);assert.equal(rows.filter(r=>r.description==='Release test coffee').length,2);
    assert.equal(rows.filter(r=>r.direction==='debit').reduce((sum,r)=>sum+Math.round(Math.abs(r.amount)*100),0),1999);
    assert.equal(data(await client.from('upload_history').select('id')).length,1);
    assert.equal((await invoke('process-csv',{csv})).body.code,'REPLAY');
    assert.equal((await invoke('process-csv',{csv:'Date,Description,Amount\n04/09/2026,Release quota test,-1.00\n'})).status,429);
    pass('Production atomic import, repeated purchases, exact amounts, history, replay and free quota');
    const saved={};
    for(const table of ['profiles','transactions','detected_subscriptions','savings_goals','upload_history','statement_reviews'])saved[table]=data(await client.from(table).select('*'));
    assert.equal(saved.transactions.length,4);assert.equal(saved.profiles.length,1);
    await writeFile('.audit-results/production-test-export.json',JSON.stringify(saved,null,2));
    pass('All saved account data can be exported through owner-scoped production reads');
    data(await client.from('profiles').update({subscription_tier:'pro',stripe_customer_id:'cus_forged'}).eq('user_id',identity.id));
    const profile=data(await client.from('profiles').select('subscription_tier,stripe_customer_id').single());
    assert.equal(profile.subscription_tier,'free');assert.equal(profile.stripe_customer_id,null);
    assert.equal((await invoke('delete-account',{confirmation:'DELETE',userId:'someone-else'})).status,400);
    pass('Production profile mutation cannot grant entitlements; deletion rejects injected ownership');
  }
} finally {
  await client.auth.signOut();
  await writeFile(`.audit-results/production-${process.argv.includes('--delete')?'deletion':'account'}-acceptance.json`,JSON.stringify({time:new Date().toISOString(),source:'cd40d1d',disposableUserId:identity.id,results},null,2));
}
