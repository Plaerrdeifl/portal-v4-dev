create or replace function app_private.liveticker_graphic_enqueue(p_event_id uuid, p_kind text, p_actor uuid default null::uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_kind text := upper(btrim(coalesce(p_kind,'')));
  v_state app_modules.liveticker_game_states%rowtype;
  v_event record;
  v_own record;
  v_opp record;
  v_history jsonb := '[]'::jsonb;
  v_snapshot jsonb;
  v_job app_modules.liveticker_graphic_jobs%rowtype;
begin
  if v_kind not in ('PERIOD_1','PERIOD_2','FINAL') then
    raise exception 'LIVETICKER_GRAPHIC_KIND_INVALID' using errcode='22023';
  end if;
  perform app_private.liveticker_assert_supported_game(p_event_id);

  select * into v_state
  from app_modules.liveticker_game_states
  where event_id=p_event_id;
  if not found then
    raise exception 'LIVETICKER_GRAPHIC_STATE_MISSING' using errcode='22023';
  end if;

  select e.event_date,e.title,g.opponent_name
    into v_event
  from app_modules.events e
  join app_modules.event_games g on g.event_id=e.id
  where e.id=p_event_id;

  select t.id,t.name,t.short_name,t.team_code,t.logo_asset_path
    into v_own
  from app_modules.liveticker_teams t
  where t.is_active and t.is_home_club
  order by t.name
  limit 1;
  if v_own.id is null or nullif(btrim(coalesce(v_own.logo_asset_path,'')),'') is null then
    raise exception 'LIVETICKER_GRAPHIC_OUR_ASSET_MISSING' using errcode='22023';
  end if;

  select t.id,t.name,t.short_name,t.team_code,t.logo_asset_path
    into v_opp
  from app_modules.liveticker_teams t
  where t.is_active and not t.is_home_club
    and (
      lower(btrim(t.name))=lower(btrim(v_event.opponent_name))
      or lower(btrim(t.short_name))=lower(btrim(v_event.opponent_name))
      or lower(v_event.opponent_name) like '%'||lower(btrim(t.short_name))||'%'
    )
  order by case when lower(btrim(t.name))=lower(btrim(v_event.opponent_name)) then 0 else 1 end,t.name
  limit 1;
  if v_opp.id is null or nullif(btrim(coalesce(v_opp.logo_asset_path,'')),'') is null then
    raise exception 'LIVETICKER_GRAPHIC_OPPONENT_ASSET_MISSING' using errcode='22023';
  end if;

  select coalesce(jsonb_agg(a.payload order by a.ordinal),'[]'::jsonb)
    into v_history
  from app_modules.liveticker_actions a
  where a.event_id=p_event_id and a.is_active;

  v_snapshot := jsonb_build_object(
    'schemaVersion',1,
    'kind',v_kind,
    'eventId',p_event_id,
    'eventDate',v_event.event_date,
    'eventTitle',coalesce(v_event.title,''),
    'revision',v_state.revision,
    'competitionLabel','',
    'seriesInfo','',
    'ourTeam',jsonb_build_object(
      'id',v_own.id,'name',v_own.name,'shortName',v_own.short_name,
      'teamCode',v_own.team_code,'logoAssetPath',v_own.logo_asset_path
    ),
    'opponentTeam',jsonb_build_object(
      'id',v_opp.id,'name',v_opp.name,'shortName',v_opp.short_name,
      'teamCode',v_opp.team_code,'logoAssetPath',v_opp.logo_asset_path
    ),
    'history',v_history
  );

  insert into app_modules.liveticker_graphic_jobs(
    event_id,graphic_kind,source_revision,request_snapshot,created_by,updated_by
  ) values (
    p_event_id,v_kind,v_state.revision,v_snapshot,p_actor,p_actor
  )
  on conflict do nothing
  returning * into v_job;

  if v_job.id is null then
    select * into v_job
    from app_modules.liveticker_graphic_jobs
    where event_id=p_event_id and graphic_kind=v_kind and status in ('QUEUED','PROCESSING')
    order by created_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'jobId',v_job.id,'eventId',v_job.event_id,'kind',v_job.graphic_kind,
    'status',v_job.status,'sourceRevision',v_job.source_revision,
    'createdAt',v_job.created_at
  );
end;
$$;
