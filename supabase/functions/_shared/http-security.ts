import { isAllowedOrigin } from './stripe-guard.ts';

export class HttpError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function boundedText(req: Request, maxBytes: number): Promise<string> {
  const reader = req.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = []; let length = 0;
  let expired=false;
  const timeout = setTimeout(() => { expired=true; void reader.cancel(); }, 15000);
  let finished = false;
  try {
    while (true) {
      const {done,value} = await reader.read();
      if(expired) throw new HttpError('Request timed out.',408);
      if (done) { finished = true; break; }
      length += value.byteLength;
      if (length > maxBytes) throw new HttpError('Request too large.',413);
      chunks.push(value);
    }
    const result = new Uint8Array(length); let offset=0;
    for(const chunk of chunks) {result.set(chunk,offset);offset+=chunk.byteLength;}
    return new TextDecoder('utf-8',{fatal:true}).decode(result);
  } finally {clearTimeout(timeout); if(!finished) await reader.cancel(); reader.releaseLock();}
}
export function browserEndpoint(handler:(req:Request)=>Promise<Response>, extraOrigins?:string) {
  return async(req:Request)=>{
    const origin=req.headers.get('origin');
    const allowed=!origin || isAllowedOrigin(origin,extraOrigins) || ['https://localhost','capacitor://localhost'].includes(origin);
    const headers:Record<string,string>={'Cache-Control':'no-store',Vary:'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
    if(origin && allowed) headers['Access-Control-Allow-Origin']=origin;
    if(!allowed) return Response.json({error:'Origin is not allowed.'},{status:403,headers});
    if(req.method==='OPTIONS') return new Response(null,{status:204,headers});
    let response:Response;
    try {response=await handler(req);}
    catch(error) {response=Response.json({error:error instanceof HttpError?error.message:'Request could not be completed.'},{status:error instanceof HttpError?error.status:503});}
    const merged=new Headers(response.headers); merged.delete('Access-Control-Allow-Origin');
    for(const [name,value] of Object.entries(headers)) merged.set(name,value);
    return new Response(response.body,{status:response.status,headers:merged});
  };
}
