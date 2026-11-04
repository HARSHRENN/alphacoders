// Supabase Edge Function. Secrets and service-role credentials stay on the server.
import {createClient} from 'npm:@supabase/supabase-js@2';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const pushHeaders:Record<string,string>={'Content-Type':'application/json'};
if(Deno.env.get('EXPO_ACCESS_TOKEN')) pushHeaders.Authorization=`Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}`;
Deno.serve(async(req)=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const secret=Deno.env.get('CRON_SECRET');
 if(!secret||req.headers.get('x-cron-secret')!==secret)return new Response('Unauthorized',{status:401});
 try{
  const {error:enqueueError}=await db.rpc('enqueue_reminders');if(enqueueError)throw enqueueError;
  const {data:jobs,error}=await db.rpc('claim_notification_jobs');if(error)throw error;
  let accepted=0,failed=0;
  for(const job of jobs??[]){
   try{
    const {data:profile,error:pe}=await db.from('profiles').select('notifications_enabled').eq('id',job.user_id).single();if(pe)throw pe;
    const {data:tokens,error:te}=await db.from('push_tokens').select('token').eq('user_id',job.user_id);if(te)throw te;
    if(profile.notifications_enabled && tokens?.length){
     for(let i=0;i<tokens.length;i+=100){
      const chunk=tokens.slice(i,i+100);
      const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:pushHeaders,body:JSON.stringify(chunk.map(t=>({to:t.token,title:job.title,body:job.body,data:job.data,sound:'default',channelId:'work-updates',ttl:3600})))});
      const result=await response.json();
      if(!response.ok||result.errors||!Array.isArray(result.data))throw new Error('Push gateway unavailable');
      for(let j=0;j<result.data.length;j++){
       const ticket=result.data[j];
       if(ticket.status==='error'){
        if(ticket.details?.error==='DeviceNotRegistered')await db.from('push_tokens').delete().eq('token',chunk[j].token);
        else throw new Error(ticket.details?.error||'Push rejected');
       }
      }
     }
    }
    const {error:e}=await db.from('notification_jobs').update({status:'sent',locked_until:null}).eq('id',job.id);if(e)throw e;accepted++;
   }catch{
    const {error:e}=await db.from('notification_jobs').update({status:job.attempts>=5?'failed':'pending',locked_until:null,available_at:new Date(Date.now()+Math.min(3600,30*2**job.attempts)*1000).toISOString()}).eq('id',job.id);
    if(e)console.error('Could not release notification job',job.id);failed++;
   }
  }
  return Response.json({accepted,failed});
 }catch(e){console.error('Notification worker failed');return Response.json({error:'Notification worker failed'},{status:500});}
});
