import {describe,expect,it} from 'vitest';
import {boundedText,browserEndpoint} from '../../../supabase/functions/_shared/http-security';
import {isServiceRequest} from '../../../supabase/functions/_shared/service-auth';
describe('endpoint security',()=>{
  it('bounds bytes in a streamed body even without a truthful content length',async()=>{
    const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('ééé'));c.close();}});
    const request=new Request('https://trycasher.com',{method:'POST',body:stream,duplex:'half'} as RequestInit);
    await expect(boundedText(request,5)).rejects.toMatchObject({status:413});
    expect(await boundedText(new Request('https://trycasher.com',{method:'POST',body:'safe'}),4)).toBe('safe');
  });
  it('rejects hostile browser origins and returns specific CORS headers',async()=>{
    let calls=0;const run=browserEndpoint(async()=>{calls++;return Response.json({ok:true},{headers:{'Access-Control-Allow-Origin':'*'}});});
    const denied=await run(new Request('https://trycasher.com',{method:'POST',headers:{Origin:'https://attacker.test'}}));
    expect(denied.status).toBe(403);expect(calls).toBe(0);
    const allowed=await run(new Request('https://trycasher.com',{method:'POST',headers:{Origin:'https://trycasher.com'}}));
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://trycasher.com');
    expect(allowed.headers.get('Cache-Control')).toBe('no-store');
  });
  it('does not trust unsigned service-role claims or a missing configuration',async()=>{
    const request=(value:string,method='POST')=>new Request('https://trycasher.com',{method,headers:{Authorization:`Bearer ${value}`}});
    const forged=`x.${btoa(JSON.stringify({role:'service_role'}))}.x`;
    expect(await isServiceRequest(request(forged),'real-key')).toBe(false);
    expect(await isServiceRequest(request('real-key'),'real-key')).toBe(true);
    expect(await isServiceRequest(request('real-key','GET'),'real-key')).toBe(false);
    expect(await isServiceRequest(request('real-key'),undefined)).toBe(false);
  });
});
