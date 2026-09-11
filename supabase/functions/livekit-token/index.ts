import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AccessToken } from 'npm:livekit-server-sdk@2.13.3';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};

Deno.serve(async (req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  try{
    if(req.method!=='POST') throw new Error('POST required');
    const auth=req.headers.get('Authorization');
    if(!auth) throw new Error('Missing authorization');
    const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
    const {data:{user},error}=await supabase.auth.getUser();
    if(error||!user) throw new Error('Unauthorized');
    const {roomName,identity,canPublish=false}=await req.json();
    if(!roomName||typeof roomName!=='string') throw new Error('roomName is required');
    const safeIdentity=identity||user.id;
    if(safeIdentity!==user.id) throw new Error('Identity mismatch');
    const apiKey=Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret=Deno.env.get('LIVEKIT_API_SECRET');
    if(!apiKey||!apiSecret) throw new Error('LiveKit server secrets are not configured');
    const token=new AccessToken(apiKey,apiSecret,{identity:safeIdentity,ttl:'2h'});
    token.addGrant({roomJoin:true,room:roomName,canPublish:Boolean(canPublish),canSubscribe:true,canPublishData:true});
    return new Response(JSON.stringify({token:await token.toJwt()}),{headers:{...cors,'Content-Type':'application/json'}});
  }catch(e){
    return new Response(JSON.stringify({error:e instanceof Error?e.message:'Unknown error'}),{status:400,headers:{...cors,'Content-Type':'application/json'}});
  }
});
