-- Liveticker owns game-day scheduling. Preserve event UUIDs and all linked
-- fanbus / ticker / publishing references during the ownership transition.
-- No existing record is moved, deleted, or renumbered.
begin;

alter table app_modules.event_games
  add column if not exists matchday_number integer,
  add column if not exists game_status text not null default 'SCHEDULED';

do $check$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'app_modules.event_games'::regclass
      and conname = 'event_games_matchday_number_range'
  ) then
    alter table app_modules.event_games add constraint event_games_matchday_number_range
      check (matchday_number is null or matchday_number between 1 and 100);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'app_modules.event_games'::regclass
      and conname = 'event_games_game_status_valid'
  ) then
    alter table app_modules.event_games add constraint event_games_game_status_valid
      check (game_status in ('SCHEDULED','CANCELLED'));
  end if;
end $check$;

create or replace function app_private.api_liveticker_spieltage_list()
returns jsonb language plpgsql stable security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := app_private.require_capability('liveticker.manage');
begin
  return jsonb_build_object(
    'games',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'eventDate', e.event_date,
          'eventTime', e.event_time,
          'homeAway', g.home_away,
          'opponentName', g.opponent_name,
          'venue', e.venue,
          'matchdayNumber', g.matchday_number,
          'gameStatus', g.game_status,
          'revision', e.revision,
          'hasTrip', exists(select 1 from app_modules.fanbus_trips t where t.event_id = e.id),
          'hasFinal', exists(
            select 1 from app_modules.liveticker_game_states s
            where s.event_id = e.id and s.completed_at is not null
          )
        ) order by e.event_date, e.event_time nulls first, e.id
      )
      from app_modules.events e
      join app_modules.event_games g on g.event_id = e.id
      where e.event_type = 'GAME'
    ), '[]'::jsonb)
  );
end;
$fn$;

create or replace function app_private.api_liveticker_spieltage_save(p_payload jsonb)
returns jsonb language plpgsql security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := app_private.require_capability('liveticker.manage');
  v_id uuid := nullif(btrim(coalesce(p_payload->>'id','')),'')::uuid;
  v_revision integer := nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer;
  v_date date := nullif(btrim(coalesce(p_payload->>'eventDate','')),'')::date;
  v_time time := nullif(btrim(coalesce(p_payload->>'eventTime','')),'')::time;
  v_home_away text := upper(btrim(coalesce(p_payload->>'homeAway','')));
  v_opponent text := nullif(btrim(coalesce(p_payload->>'opponentName','')),'');
  v_venue text := nullif(btrim(coalesce(p_payload->>'venue','')),'');
  v_matchday integer := nullif(btrim(coalesce(p_payload->>'matchdayNumber','')),'')::integer;
  v_row app_modules.events%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if v_date is null or v_home_away not in ('HOME','AWAY')
    or v_opponent is null or length(v_opponent)>140
    or (v_venue is not null and length(v_venue)>240)
    or (v_matchday is not null and (v_matchday<1 or v_matchday>100)) then
    raise exception 'Bitte Datum, Heim/Auswärts und gültigen Gegner angeben.'
      using errcode='22023';
  end if;

  if v_id is null then
    if v_revision is not null then
      raise exception 'Neue Spiele dürfen keine Revision übergeben.' using errcode='22023';
    end if;
    insert into app_modules.events
      (event_type, title, event_date, event_time, venue, visibility, created_by, updated_by)
    values ('GAME', null, v_date, v_time, v_venue, 'PUBLIC', v_actor, v_actor)
    returning id into v_id;
    insert into app_modules.event_games
      (event_id, home_away, opponent_name, matchday_number)
    values (v_id, v_home_away, v_opponent, v_matchday);
    perform app_private.log_audit(v_actor,'LIVETICKER_SPIELTAG_CREATED','event',v_id::text,
      null, jsonb_build_object('date',v_date,'opponent',v_opponent,'matchday',v_matchday));
  else
    if v_revision is null then
      raise exception 'Die erwartete Revision fehlt.' using errcode='22023';
    end if;
    select * into v_row from app_modules.events where id=v_id for update;
    if v_row.id is null or v_row.event_type <> 'GAME' then
      raise exception 'Spiel nicht gefunden.' using errcode='P0002';
    end if;
    if v_row.revision <> v_revision then
      raise exception 'Spiel wurde geändert. Bitte Liste neu laden.' using errcode='40001';
    end if;
    if exists (select 1 from app_modules.liveticker_game_states s
               where s.event_id=v_id and s.completed_at is not null) then
      raise exception 'Abgeschlossene Spiele dürfen nicht geändert werden.' using errcode='42501';
    end if;
    -- Fanbus trips refer to the same UUID and derive their local departure
    -- times from the game. Never silently shift an existing trip by editing
    -- its scheduled date, time or home/away classification.
    if exists (
      select 1 from app_modules.fanbus_trips t
      join app_modules.event_games g on g.event_id=t.event_id
      where t.event_id=v_id
        and (v_date is distinct from v_row.event_date
          or v_time is distinct from v_row.event_time
          or v_home_away is distinct from g.home_away)
    ) then
      raise exception 'Fanbusfahrt verknüpft: Spieltermin nur nach Abstimmung mit Bus-Orga ändern.'
        using errcode='23503';
    end if;
    v_before := jsonb_build_object('date',v_row.event_date,'time',v_row.event_time,
      'venue',v_row.venue,'revision',v_row.revision);
    update app_modules.events
      set event_date=v_date, event_time=v_time, venue=v_venue,
          end_date=null, end_time=null, revision=revision+1, updated_at=statement_timestamp(),
          updated_by=v_actor
      where id=v_id;
    update app_modules.event_games set home_away=v_home_away,
      opponent_name=v_opponent, matchday_number=v_matchday
      where event_id=v_id;
    v_after := jsonb_build_object('date',v_date,'time',v_time,'venue',v_venue,
      'homeAway',v_home_away,'opponent',v_opponent,'matchday',v_matchday);
    perform app_private.log_audit(v_actor,'LIVETICKER_SPIELTAG_UPDATED','event',
      v_id::text,v_before,v_after);
  end if;
  return app_private.api_liveticker_spieltage_list();
end;
$fn$;

create or replace function app_private.api_liveticker_spieltage_status(p_payload jsonb)
returns jsonb language plpgsql security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := app_private.require_capability('liveticker.manage');
  v_id uuid := nullif(btrim(coalesce(p_payload->>'id','')),'')::uuid;
  v_revision integer := nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer;
  v_status text := upper(btrim(coalesce(p_payload->>'gameStatus','')));
  v_row app_modules.events%rowtype;
  v_prior text;
begin
  if v_id is null or v_revision is null or v_status not in ('SCHEDULED','CANCELLED') then
    raise exception 'Spiel, Revision und gültiger Status erforderlich.' using errcode='22023';
  end if;
  select * into v_row from app_modules.events where id=v_id and event_type='GAME' for update;
  if v_row.id is null then
    raise exception 'Spiel nicht gefunden.' using errcode='P0002';
  end if;
  if v_revision <> v_row.revision then
    raise exception 'Spiel wurde geändert. Bitte Liste neu laden.' using errcode='40001';
  end if;
  if exists (select 1 from app_modules.liveticker_game_states s
             where s.event_id=v_id and s.completed_at is not null) then
    raise exception 'Abgeschlossene Spiele dürfen nicht verändert werden.' using errcode='42501';
  end if;
  if v_status='CANCELLED' and exists (
    select 1 from app_modules.fanbus_trips t where t.event_id=v_id
  ) then
    raise exception 'Spiel besitzt eine Fanbusfahrt. Bitte zuerst die Bus-Orga abstimmen.'
      using errcode='23503';
  end if;
  select game_status into v_prior from app_modules.event_games where event_id=v_id;
  if v_prior is null then
    raise exception 'Spieldetails fehlen.' using errcode='P0002';
  end if;
  if v_status <> v_prior then
    update app_modules.event_games set game_status=v_status where event_id=v_id;
    update app_modules.events set revision=revision+1,
      updated_at=statement_timestamp(), updated_by=v_actor where id=v_id;
    perform app_private.log_audit(v_actor,'LIVETICKER_SPIELTAG_STATUS','event',
      v_id::text,jsonb_build_object('status',v_prior),
      jsonb_build_object('status',v_status));
  end if;
  return app_private.api_liveticker_spieltage_list();
end;
$fn$;

-- Chain the current API dispatch and user-write classification. The new
-- actions do not grant direct table access or any generic events.manage power.
alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_before_spieltage_r1;

create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
begin
  case lower(btrim(coalesce(p_action,'')))
    when 'liveticker_spieltage_list' then
      return app_private.api_liveticker_spieltage_list();
    when 'liveticker_spieltage_save' then
      return app_private.api_liveticker_spieltage_save(p_payload);
    when 'liveticker_spieltage_status' then
      return app_private.api_liveticker_spieltage_status(p_payload);
    else
      return app_private.pd_api_dispatch_before_spieltage_r1(p_action,p_payload);
  end case;
end;
$fn$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_spieltage_r1;

create function app_private.platform_action_classification(p_action text)
returns text language plpgsql stable security definer set search_path=''
as $fn$
begin
  case lower(btrim(coalesce(p_action,'')))
    when 'liveticker_spieltage_list' then return 'READ';
    when 'liveticker_spieltage_save' then return 'USER_MUTATION';
    when 'liveticker_spieltage_status' then return 'USER_MUTATION';
    else return app_private.platform_action_classification_before_spieltage_r1(p_action);
  end case;
end;
$fn$;

revoke all on function app_private.api_liveticker_spieltage_list() from public,anon,authenticated;
revoke all on function app_private.api_liveticker_spieltage_save(jsonb) from public,anon,authenticated;
revoke all on function app_private.api_liveticker_spieltage_status(jsonb) from public,anon,authenticated;
revoke all on function app_private.pd_api_dispatch_current(text,jsonb) from public,anon,authenticated;
revoke all on function app_private.platform_action_classification(text) from public,anon,authenticated;


-- Cancelled matches are invisible to new ticker selections and Fanbus trip offers.
-- Existing ticker history, publishing links and Fanbus UUIDs are retained.
create or replace function public.pd_public_liveticker_games()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare v_result jsonb;
begin
  perform app_private.liveticker_require_operator();
  select jsonb_build_object('games',coalesce(jsonb_agg(jsonb_build_object(
    'eventId',e.id, 'eventDate',e.event_date, 'eventTime',e.event_time,
    'venue',e.venue, 'homeAway',g.home_away,
    'displayTitle',case g.home_away when 'HOME'
      then own.short_name||' – '||coalesce(opp.short_name,g.opponent_name)
      else coalesce(opp.short_name,g.opponent_name)||' – '||own.short_name end,
    'ownTeam',app_private.liveticker_team_json(own.id),
    'opponentTeam',coalesce(app_private.liveticker_team_json(opp.id),
      jsonb_build_object('id',null,'name',g.opponent_name,'shortName',
        g.opponent_name,'teamCode',null,'logoAssetPath',null,
        'logoUrl',null,'homeClub',false,'players','[]'::jsonb))
    ) order by e.event_date,e.event_time nulls first,e.id),'[]'::jsonb))
  into v_result
  from app_modules.events e
  join app_modules.event_games g on g.event_id=e.id
  join app_modules.liveticker_teams own on own.is_home_club and own.is_active
  left join lateral (
    select t.id,t.short_name from app_modules.liveticker_teams t
    where t.is_active and not t.is_home_club
      and (lower(btrim(t.name))=lower(btrim(g.opponent_name))
        or lower(btrim(t.short_name))=lower(btrim(g.opponent_name))
        or lower(g.opponent_name) like '%'||lower(btrim(t.short_name))||'%')
    order by case when lower(btrim(t.name))=lower(btrim(g.opponent_name))
      then 0 else 1 end,t.name limit 1
  ) opp on true
  left join app_modules.liveticker_game_states s on s.event_id=e.id
  where e.event_type='GAME' and e.visibility='PUBLIC'
    and g.game_status='SCHEDULED' and s.completed_at is null
    and e.event_date between
      ((now() at time zone 'Europe/Berlin')::date-14)
      and ((now() at time zone 'Europe/Berlin')::date+220);
  return v_result;
end;
$fn$;

create or replace function app_private.api_fanbus_available_events()
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
  v_actor uuid := app_private.require_capability('fanbus.manage');
begin
  return jsonb_build_object('events',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',e.id,'eventType',e.event_type,
      'displayTitle',case g.home_away when 'HOME'
        then 'Mighty Dogs Schweinfurt – '||g.opponent_name
        else g.opponent_name||' – Mighty Dogs Schweinfurt' end,
      'eventDate',e.event_date,'eventTime',e.event_time,
      'venue',e.venue,'visibility',e.visibility
    ) order by e.event_date,e.event_time asc nulls first,e.id)
    from app_modules.events e
    join app_modules.event_games g on g.event_id=e.id
    where e.event_type='GAME'
      and g.home_away='AWAY' and g.game_status='SCHEDULED'
      and e.event_date >= (now() at time zone 'Europe/Berlin')::date
      and not exists(select 1 from app_modules.fanbus_trips t where t.event_id=e.id)
  ),'[]'::jsonb));
end;
$fn$;

revoke all on function public.pd_public_liveticker_games() from public,anon;
grant execute on function public.pd_public_liveticker_games() to authenticated;
revoke all on function app_private.api_fanbus_available_events() from public,anon,authenticated;

create or replace function app_private.require_platform_user_write_allowed(
  p_action text,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_state record;
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
  v_cockpit jsonb;
  v_role text;
begin
  select runtime.* into v_state
  from app_private.platform_runtime_state() as runtime;

  if v_state.is_valid is distinct from true then
    raise exception 'PLATFORM_WRITE_UNAVAILABLE' using errcode = 'P0901';
  end if;

  if v_state.mode = 'NORMAL' then
    return;
  end if;

  -- DEV only. An authenticated actor must have an independently assigned,
  -- active Cockpit account. No portal.admin/team wildcard grants admission.
  if v_state.mode = 'READ_ONLY'
     and app_private.platform_release_environment() = 'DEV'
     and p_actor is not null
     and p_actor = auth.uid()
     and app_private.cockpit_user_has_access(p_actor) then

    -- Cockpit administration: authorization, target-user checks, revision,
    -- audit and last-SYSTEM_ADMIN protection remain inside the action.
    if v_action in (
      'cockpit_admin_access_set',
      'cockpit_admin_personal_capabilities_set'
    ) then
      select access.role into v_role
      from app_portal.cockpit_access as access
      where access.user_id = p_actor
        and access.is_enabled;
      if v_role in ('ADMIN', 'SYSTEM_ADMIN') then
        return;
      end if;
    end if;

    -- Only the leading Liveticker's explicitly enumerated mutations.
    -- Neither unknown actions, generic worker controls nor other modules
    -- are eligible for this exception.
    if v_action = any (array[
      'liveticker_game_reset',
      'liveticker_spieltage_save',
      'liveticker_spieltage_status',
      'liveticker_graphics_enqueue',
      'liveticker_graphic_template_save',
      'liveticker_output_template_save',
      'liveticker_output_variant_delete',
      'liveticker_output_variant_save',
      'liveticker_player_delete',
      'liveticker_player_save',
      'liveticker_team_save',
      'liveticker_whatsapp_delivery_enqueue',
      'liveticker_whatsapp_delivery_link',
      'liveticker_whatsapp_delivery_retry',
      'liveticker_whatsapp_routing_set',
      'liveticker_whatsapp_sticker_enqueue',
      'liveticker_whatsapp_sticker_metadata_set',
      'liveticker_whatsapp_sticker_rename',
      'liveticker_whatsapp_sticker_set_active',
      'liveticker_wpp_runtime_set'
    ]::text[]) then
      v_cockpit := app_private.api_cockpit_access_get('{}'::jsonb);
      if (v_cockpit #>> '{permissions,liveticker,effectiveAllowed}') = 'true'
         and (v_cockpit ->> 'userId') = p_actor::text
         and (v_cockpit #>> '{cockpit,allowed}') = 'true'
         and (v_cockpit #>> '{portal,active}') = 'true' then
        return;
      end if;
    end if;
  end if;

  -- The existing strictly user-bound release bypass and error mapping
  -- are preserved for unrelated system workflows.
  if p_actor is not null
     and app_private.try_platform_release_bypass(p_action, p_actor) then
    return;
  end if;

  case v_state.mode
    when 'READ_ONLY' then
      raise exception 'PLATFORM_READ_ONLY' using errcode = 'P0902';
    when 'MAINTENANCE' then
      raise exception 'PLATFORM_MAINTENANCE' using errcode = 'P0903';
    else
      raise exception 'PLATFORM_WRITE_UNAVAILABLE' using errcode = 'P0901';
  end case;
end;
$function$;

commit;
