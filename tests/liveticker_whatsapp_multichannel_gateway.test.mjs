import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const source=await readFile(new URL('../supabase/functions/liveticker-whatsapp-worker/index.ts',import.meta.url),'utf8');
const jobId='00000000-0000-4591-8000-000000000010';
const eventId='00000000-0000-4591-8000-000000000011';
const targetIds=['00000000-0000-4591-8000-000000000012','00000000-0000-4591-8000-000000000013'];
function fixture(approved=()=>true,mode='TEXT_ONLY') {
 const targets=targetIds.map((id,index)=>({id,job_id:jobId,channel_code:index?'MAIN':'TEST',channel_label:index?'Hauptkanal':'Testkanal',waha_channel_id:index?'222222222@newsletter':'111111111@newsletter',status:'PENDING',attempt_count:0,created_at:'2036-01-01T00:00:00Z',sticker_status:mode==='STICKER_ONLY'||mode==='STICKER_THEN_TEXT'?'PENDING':'NOT_REQUESTED',text_status:mode==='TEXT_ONLY'||mode==='STICKER_THEN_TEXT'?'PENDING':'NOT_REQUESTED',image_status:mode==='IMAGE_WITH_CAPTION'?'PENDING':'NOT_REQUESTED'}));
 const job={id:jobId,event_id:eventId,client_action_id:'fixture-goal',publication_version:1,message:mode==='STICKER_ONLY'?null:'Fixture text',sticker_id:mode==='STICKER_ONLY'||mode==='STICKER_THEN_TEXT'?'00000000-0000-4591-8000-000000000014':null,delivery_mode:mode,image_url:mode==='IMAGE_WITH_CAPTION'?'https://cloud.plaerrdeifl.de/s/fixture123/download':null,image_filename:mode==='IMAGE_WITH_CAPTION'?'fixture.png':null,created_at:'2036-01-01T00:00:00Z'};
 const calls=[];
 const matches=(row,query)=>[...query].every(([key,value])=>['select','order','limit'].includes(key)||!value.startsWith('eq.')||String(row[key])===value.slice(3));
 const fetch=async (raw,options={})=>{
  const url=new URL(raw);calls.push({url,method:options.method||'GET',body:options.body?JSON.parse(options.body):null});
  if(url.pathname.endsWith('/rpc/pd_liveticker_whatsapp_worker_can_claim'))return Response.json({ready:true});
  if(url.pathname.endsWith('/rpc/pd_liveticker_whatsapp_target_send_allowed'))return Response.json(approved(JSON.parse(options.body).p_target_id));
  if(url.pathname.endsWith('/pd_liveticker_whatsapp_job_targets_worker')){
   let rows=targets.filter(row=>matches(row,url.searchParams));
   if(url.searchParams.has('limit'))rows=rows.slice(0,Number(url.searchParams.get('limit')));
   if(options.method==='PATCH')for(const row of rows)Object.assign(row,JSON.parse(options.body));
   return Response.json(structuredClone(rows));
  }
  if(url.pathname.endsWith('/pd_liveticker_whatsapp_jobs_worker'))return Response.json(matches(job,url.searchParams)?[job]:[]);
  throw Error('Unexpected gateway network call '+url.origin+url.pathname);
 };
 const context={fetch,URLSearchParams,URL,Response,Request,TextEncoder,crypto,Date,console,Deno:{env:{get:name=>name==='SUPABASE_URL'?'https://tpieykhhawszlzsoflnl.supabase.co':name==='SUPABASE_SECRET_KEYS'?'{"default":"local-gateway-fixture"}':undefined},serve:()=>{}}};
 runInNewContext(stripTypeScriptTypes(source)+'\nglobalThis.gateway={validBody,claim,complete,fail,retrying};',context);
 return {gateway:context.gateway,targets,calls};
}

test('old fixed-channel protocol cannot claim or complete new target jobs',()=>{
 const {gateway}=fixture();
 assert.equal(gateway.validBody({action:'claim'}),false);
 assert.equal(gateway.validBody({action:'claim',targetProtocol:1}),true);
 assert.equal(gateway.validBody({action:'complete',jobId,attemptCount:1,wahaMessageId:'x',sentAt:'2036-01-01T00:00:00Z'}),false);
});
for(const mode of ['TEXT_ONLY','STICKER_ONLY','STICKER_THEN_TEXT','IMAGE_WITH_CAPTION'])test(mode+': claimed target and channel are preserved independently',async()=>{
 const {gateway,targets}=fixture(()=>true,mode);
 const a=await gateway.claim();const b=await gateway.claim();
 assert.equal(a.job.targetId,targetIds[0]);assert.equal(a.job.channelId,'111111111@newsletter');
 assert.equal(b.job.targetId,targetIds[1]);assert.equal(b.job.channelId,'222222222@newsletter');
 assert.equal(a.job.deliveryMode,mode);assert.equal(b.job.deliveryMode,mode);
 assert.equal(targets[0].status,'PROCESSING');assert.equal(targets[1].status,'PROCESSING');
});
test('partial success, repeated completion and failed other target retain message IDs and identity',async()=>{
 const {gateway,targets}=fixture();
 await gateway.claim();await gateway.claim();
 const receipt={messageId:'fixture-message-A',sentAt:'2036-01-01T00:00:00Z'};
 const complete={action:'complete',jobId,targetId:targetIds[0],attemptCount:1,wahaMessageId:receipt.messageId,sentAt:receipt.sentAt,components:{sticker:null,text:receipt,image:null}};
 await gateway.complete(complete);await gateway.complete(complete);
 await gateway.fail({action:'fail',jobId,targetId:targetIds[1],attemptCount:1,error:'known failure',failedComponent:'TEXT',components:{sticker:null,text:null,image:null}});
 assert.equal(targets[0].status,'SUCCEEDED');assert.equal(targets[0].text_waha_message_id,receipt.messageId);
 assert.equal(targets[1].status,'FAILED');assert.equal(targets[1].waha_channel_id,'222222222@newsletter');
});
test('revoked target fails visibly and does not reroute or starve an approved second target',async()=>{
 const {gateway,targets}=fixture(id=>id===targetIds[1]);
 const result=await gateway.claim();
 assert.equal(targets[0].status,'FAILED');assert.equal(targets[0].last_error,'DEV_TARGET_NOT_APPROVED');
 assert.equal(result.job.targetId,targetIds[1]);assert.equal(result.job.channelId,'222222222@newsletter');
});
