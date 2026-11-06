import {handleShortcut} from './handler.mjs';
const base=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function request(path:string,init:RequestInit={}){
 const response=await fetch(base+path,{...init,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',...init.headers}});
 const data=await response.json();if(!response.ok)throw data;return data;
}
Deno.serve((req:Request)=>handleShortcut(req,{
 lookup:async(hash:string)=>(await request('/rest/v1/shortcut_connections?select=user_id,enabled&token_hash=eq.'+hash+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString())))[0],
 metadata:async(owner:string)=>(await request('/auth/v1/admin/users/'+owner)).user_metadata||{},
 insert:async(payload:unknown)=>request('/rest/v1/rpc/log_shortcut_transaction',{method:'POST',body:JSON.stringify(payload)})
}));