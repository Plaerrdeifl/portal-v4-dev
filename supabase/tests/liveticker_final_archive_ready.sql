\set ON_ERROR_STOP on

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Isolated rollback-only fixtures. No real DEV or archived game is touched.
insert into auth.users(id,email)
values ('00000000-0000-4500-8800-000000000091','final-archive-fixture@example.invalid');

insert into app_portal.users(id,user_code,email,first_name,last_name,status,role_id)
select '00000000-0000-4500-8800-000000000091','U-LT-FINAL-091',
  'final-archive-fixture@example.invalid','FINAL','Fixture','ACTIVE',id
from app_portal.portal_roles where code='PORTAL_USER' and is_active limit 1;

insert into app_modules.events(id,event_type,title,event_date,event_time,venue,visibility)
select ('00000000-0000-4555-9700-0000000000'||suffix)::uuid,
  'GAME','FINAL lifecycle fixture '||suffix,'2036-11-02','18:00','DEV fixture','PUBLIC'
from (values ('11'),('12'),('13'),('14'),('15'),('16')) t(suffix);

insert into app_modules.liveticker_game_states(event_id,revision,minute)
select id,7,60 from app_modules.events
where title like 'FINAL lifecycle fixture %';

insert into app_social_media.liveticker_render_requests(
 id,owner_user_id,event_id,graphic_kind,source_revision,source_snapshot,status,
 attempt_count,max_attempts,result_manifest,claim_token,claimed_at,claim_expires_at
)
select
 ('00000000-0000-4555-9701-0000000000'||substring(id::text,35,2))::uuid,
 '00000000-0000-4500-8800-000000000091',id,'FINAL',7,'{}'::jsonb,
 case when right(id::text,2) in ('13') then 'FAILED'
      when right(id::text,2) in ('16') then 'PROCESSING'
      else 'SUCCEEDED' end,
 case when right(id::text,2)='16' then 1 else 0 end,3,
 case when right(id::text,2)='13' or right(id::text,2)='16' then null
      else jsonb_build_object('sourceRevision',7,'artifacts',
        jsonb_build_array(jsonb_build_object('kind','POST'),
                          jsonb_build_object('kind','STORY'))) end,
 case when right(id::text,2)='16' then '00000000-0000-4555-9702-000000000016'::uuid else null end,
 case when right(id::text,2)='16' then now() else null end,
 case when right(id::text,2)='16' then now()+interval '5 minutes' else null end
from app_modules.events where title like 'FINAL lifecycle fixture %';

insert into app_modules.liveticker_finalizations(
 event_id,request_id,requested_by,requested_revision,client_request_id,status
)
select r.event_id,r.id,r.owner_user_id,
 case when right(r.event_id::text,2)='14' then 6 else 7 end,
 ('00000000-0000-4555-9703-0000000000'||right(r.event_id::text,2))::uuid,
 case when right(r.event_id::text,2)='15' then 'RETRYABLE_ERROR' else 'RENDERING' end
from app_social_media.liveticker_render_requests r
where r.event_id in (
 select id from app_modules.events where title like 'FINAL lifecycle fixture %'
) and right(r.event_id::text,2)<>'11';

select lives_ok(
 $$ select app_private.liveticker_finalization_process('00000000-0000-4555-9701-000000000011') $$,
 'Old successful FINAL without intent does not implicitly authorize archival'
);
select is((select completed_at from app_modules.liveticker_game_states
 where event_id='00000000-0000-4555-9700-000000000011'),null::timestamptz,
 'Old successful graphic leaves game active');

select lives_ok(
 $$ select app_private.liveticker_finalization_process('00000000-0000-4555-9701-000000000012') $$,
 'Authorized successful POST+STORY atomically completes game'
);
select ok((select completed_at is not null from app_modules.liveticker_game_states
 where event_id='00000000-0000-4555-9700-000000000012'),
 'Authorized final has durable completed_at');
select is((select status from app_modules.liveticker_finalizations
 where event_id='00000000-0000-4555-9700-000000000012'),'COMPLETED',
 'Completion records durable FINAL lifecycle');
select lives_ok(
 $$ select app_private.liveticker_finalization_process('00000000-0000-4555-9701-000000000012') $$,
 'Repeated processing is idempotent'
);
select is((select count(*)::int from app_modules.liveticker_journal
 where event_id='00000000-0000-4555-9700-000000000012' and mutation_type='GAME_COMPLETED'),1,
 'Repeated completion never writes another GAME_COMPLETED journal entry');

select lives_ok(
 $$ select app_private.liveticker_finalization_process('00000000-0000-4555-9701-000000000013') $$,
 'Failed required graphics never finalize'
);
select is((select completed_at from app_modules.liveticker_game_states
 where event_id='00000000-0000-4555-9700-000000000013'),null::timestamptz,
 'FAILED graphics game remains active');

select lives_ok(
 $$ select app_private.liveticker_finalization_process('00000000-0000-4555-9701-000000000014') $$,
 'Stale revision does not create an invalid archive'
);
select is((select status from app_modules.liveticker_finalizations
 where event_id='00000000-0000-4555-9700-000000000014'),'REQUIRES_REVIEW',
 'Stale data requires explicit user correction');
select is((select completed_at from app_modules.liveticker_game_states
 where event_id='00000000-0000-4555-9700-000000000014'),null::timestamptz,
 'Stale revision does not auto rebase final score');

select is((public.pd_social_media_render_worker_work_status()->>'liveticker')::boolean,
 true,'Existing worker poll wakes on a successful graphic pending FINAL recovery');
select lives_ok(
 $$ select public.pd_social_media_liveticker_render_worker_claim() $$,
 'Existing worker claim path resumes a server-side FINAL without browser'
);
select is((select status from app_modules.liveticker_finalizations
 where event_id='00000000-0000-4555-9700-000000000015'),'COMPLETED',
 'Worker polling recovery completes previously successful FINAL');

select lives_ok(
 $$ select public.pd_social_media_liveticker_render_worker_complete(
 '00000000-0000-4555-9701-000000000016',
 '00000000-0000-4555-9702-000000000016',
 true,null,
 '{"sourceRevision":7,"artifacts":[{"kind":"POST"},{"kind":"STORY"}]}'::jsonb) $$,
 'Worker completion also finalizes associated authorized intent'
);
select lives_ok(
 $$ select public.pd_social_media_liveticker_render_worker_complete(
 '00000000-0000-4555-9701-000000000016',
 '00000000-0000-4555-9702-000000000016',
 true,null,
 '{"sourceRevision":7,"artifacts":[{"kind":"POST"},{"kind":"STORY"}]}'::jsonb) $$,
 'Lost worker ACK can safely repeat completion on same claim token'
);
select is((select count(*)::int from app_modules.liveticker_journal
 where event_id='00000000-0000-4555-9700-000000000016' and mutation_type='GAME_COMPLETED'),1,
 'Duplicate worker completion preserves exactly-once journal semantics');

select ok(not has_function_privilege('authenticated',
 'app_private.liveticker_finalization_process(uuid)','EXECUTE'),
 'Browser users cannot invoke internal game completion');
select ok(not has_table_privilege('authenticated',
 'app_modules.liveticker_finalizations','INSERT'),
 'Browser users cannot forge a finalization intent');
select ok('liveticker_finalization_start'=any(app_private.pd_api_current_actions()),
 'FINAL start is explicitly allowlisted in pd_api');
select ok('liveticker_finalization_status'=any(app_private.pd_api_current_actions()),
 'FINAL status is explicitly allowlisted in pd_api');

select * from finish();
rollback;
