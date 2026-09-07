/** Authenticate internal jobs even when a gateway configuration changes. */
export async function isServiceRequest(req:Request, secret:string|undefined):Promise<boolean> {
  const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if(req.method!=='POST' || !secret || !token || token.length>8192) return false;
  const digest=async(value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  const [a,b]=await Promise.all([digest(token),digest(secret)]);
  let different=0;for(let i=0;i<a.length;i++) different|=a[i]^b[i];
  return different===0;
}
