\set ON_ERROR_STOP on
begin;
select plan(1);
do $test$
declare
 actor uuid:='00000000-0000-4591-8000-000000000001';
 event uuid:='00000000-0000-4591-8000-000000000002';
 sticker uuid:='00000000-0000-4591-8000-000000000003';
 portal_role uuid;
 mode text; kind text; job uuid; selected_count integer; jobrow app_modules.liveticker_whatsapp_jobs%rowtype;
 target_a uuid; target_b uuid; result jsonb; before_targets jsonb;
begin
 if exists(select 1 from app_private.liveticker_whatsapp_channels where send_approved) then
  raise exception 'Migration must not approve existing live channels for DEV sends';
 end if;
 if not exists(select 1 from app_private.liveticker_whatsapp_channels where code='TEST' and waha_channel_id='120363407159499081@newsletter')
 or not exists(select 1 from app_private.liveticker_whatsapp_channels where code='MAIN' and waha_channel_id='120363419694534195@newsletter') then
  raise exception 'Existing Portal-1.0 channel identities were not preserved';
 end if;
 insert into auth.users(id,email) values(actor,'channels-local@example.invalid');
 select id into portal_role from app_portal.portal_roles where code='PORTAL_USER' and is_active;
 insert into app_portal.users(id,user_code,email,first_name,last_name,status,role_id)
 values(actor,'U-CHANNELS-001','channels-local@example.invalid','Channel','Fixture','ACTIVE',portal_role);
 insert into app_portal.cockpit_access(user_id,role,is_enabled,revision) values(actor,'USER',true,1);
 insert into app_portal.user_capabilities(user_id,capability_code,created_by) values(actor,'liveticker.manage',actor);
 insert into app_modules.events(id,event_type,title,event_date,event_time,venue,visibility)
 values(event,'GAME','Isolated channel SQL fixture','2036-01-01','18:00','Fixture','INTERNAL');
 insert into app_modules.liveticker_whatsapp_stickers(id,name,slug,storage_path,width,height,file_size,sha256)
 values(sticker,'Fixture','fixture-00000003','stickers/dev/'||sticker||'.webp',512,512,1,repeat('a',64));
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 update app_portal.settings set value=jsonb_build_object('mode','READ_ONLY','environment','DEV'),revision=revision+1 where key='platform.mode';
 update app_private.worker_runtime_controls set enabled=true,last_state='ACTIVE',last_seen_at=statement_timestamp(),updated_at=statement_timestamp() where worker_code='LIVETICKER_WHATSAPP';
 update app_private.liveticker_wpp_runtime_control set desired_connected=true,last_state='CONNECTED',last_seen_at=statement_timestamp(),updated_at=statement_timestamp();
 -- These are isolated, rollback-only IDs, never real channel destinations.
 update app_private.liveticker_whatsapp_channels set waha_channel_id=case code when 'TEST' then '111111111@newsletter' else '222222222@newsletter' end,send_approved=true;
 foreach mode in array array['TEST','MAIN','BOTH'] loop
  perform app_private.api_liveticker_whatsapp_routing_set(jsonb_build_object('mode',mode));
  foreach kind in array array['TEXT_ONLY','STICKER_ONLY','STICKER_THEN_TEXT','IMAGE_WITH_CAPTION'] loop
   job:=extensions.gen_random_uuid();
   insert into app_modules.liveticker_whatsapp_jobs(id,event_id,client_action_id,requested_by,delivery_mode,message,sticker_id,sticker_status,text_status,image_status,image_url,image_filename)
   values(job,event,job::text,actor,kind,case when kind='STICKER_ONLY' then null else 'Isolated fixture' end,
    case when kind in ('STICKER_ONLY','STICKER_THEN_TEXT') then sticker else null end,
    case when kind in ('STICKER_ONLY','STICKER_THEN_TEXT') then 'PENDING' else 'NOT_REQUESTED' end,
    case when kind in ('TEXT_ONLY','STICKER_THEN_TEXT') then 'PENDING' else 'NOT_REQUESTED' end,
    case when kind='IMAGE_WITH_CAPTION' then 'PENDING' else 'NOT_REQUESTED' end,
    case when kind='IMAGE_WITH_CAPTION' then 'https://cloud.plaerrdeifl.de/s/fixture123/download' else null end,
    case when kind='IMAGE_WITH_CAPTION' then 'fixture.png' else null end);
   select count(*) into selected_count from app_modules.liveticker_whatsapp_job_targets where job_id=job;
   if selected_count<>(case when mode='BOTH' then 2 else 1 end) then raise exception 'Wrong targets for %/%',mode,kind; end if;
   if exists(select 1 from app_modules.liveticker_whatsapp_job_targets where job_id=job and ((mode<>'BOTH' and channel_code<>mode) or (channel_code='TEST' and waha_channel_id<>'111111111@newsletter') or (channel_code='MAIN' and waha_channel_id<>'222222222@newsletter'))) then raise exception 'Target changed'; end if;
  end loop;
 end loop;
 -- Last job has BOTH targets and an image/caption component.
 select id into target_a from app_modules.liveticker_whatsapp_job_targets where job_id=job and channel_code='TEST';
 select id into target_b from app_modules.liveticker_whatsapp_job_targets where job_id=job and channel_code='MAIN';
 update app_modules.liveticker_whatsapp_job_targets set status='SUCCEEDED',image_status='SENT',image_waha_message_id='true_111111111@newsletter_fixture-A',image_sent_at=statement_timestamp(),completed_at=statement_timestamp() where id=target_a;
 update app_modules.liveticker_whatsapp_job_targets set status='FAILED',image_status='FAILED',last_error='known failure' where id=target_b;
 select * into jobrow from app_modules.liveticker_whatsapp_jobs where id=job;
 if jobrow.status<>'FAILED' then raise exception 'Mixed target failure must remain visible'; end if;
 result:=app_private.liveticker_whatsapp_delivery_json(jobrow);
 if jsonb_array_length(result->'targets')<>2 or result::text like '%@newsletter%' then raise exception 'Missing target status or leaked server channel ID'; end if;
 perform app_private.api_liveticker_whatsapp_routing_set('{"mode":"TEST"}'::jsonb);
 result:=app_private.api_liveticker_whatsapp_delivery_retry(jsonb_build_object('eventId',event,'jobId',job));
 if not exists(select 1 from app_modules.liveticker_whatsapp_job_targets where id=target_a and status='SUCCEEDED' and image_waha_message_id='true_111111111@newsletter_fixture-A') then raise exception 'Retry erased a sent target'; end if;
 if not exists(select 1 from app_modules.liveticker_whatsapp_job_targets where id=target_b and status='PENDING' and waha_channel_id='222222222@newsletter') then raise exception 'Retry retargeted or did not retry original MAIN'; end if;
 begin
  update app_modules.liveticker_whatsapp_job_targets set waha_channel_id='333333333@newsletter' where id=target_b;
  raise exception 'Target mutation allowed';
 exception when sqlstate '22023' then null; end;
 update app_modules.liveticker_whatsapp_job_targets set status='FAILED',image_status='FAILED',last_error='DELIVERY_OUTCOME_UNKNOWN: response lost' where id=target_b;
 begin
  perform app_private.api_liveticker_whatsapp_delivery_retry(jsonb_build_object('eventId',event,'jobId',job));
  raise exception 'Ambiguous send was retried';
 exception when sqlstate '55000' then
  if sqlerrm<>'LIVETICKER_WHATSAPP_DELIVERY_ACK_REQUIRED' then raise; end if;
 end;
 update app_private.liveticker_whatsapp_channels set send_approved=false where code='TEST';
 if app_private.liveticker_whatsapp_target_send_allowed(target_a) then raise exception 'Unapproved DEV destination allowed'; end if;
 update app_private.liveticker_whatsapp_channels set waha_channel_id=null where code='MAIN';
 begin
  perform app_private.api_liveticker_whatsapp_routing_set('{"mode":"BOTH"}');
  raise exception 'Missing target configuration accepted';
 exception when sqlstate '55000' then null; end;
 if has_function_privilege('anon','public.pd_liveticker_whatsapp_target_send_allowed(uuid)','EXECUTE')
 or has_table_privilege('authenticated','app_private.liveticker_whatsapp_channels','SELECT') then raise exception 'Browser gained private configuration/worker access'; end if;
end;
$test$;
select pass('channel selections, all delivery modes, immutable snapshots, partial states, retry, approval and privacy');
select * from finish();
rollback;
