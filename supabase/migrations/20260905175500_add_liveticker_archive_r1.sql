-- Plärrdeifl Portal V4
-- Liveticker R4: abgeschlossene Spiele zentral archivieren und geschützt zurücksetzen.
-- Der öffentliche Abschluss-Trigger bleibt strikt DEV-only; Portal-Archiv und Reset benötigen liveticker.manage.

alter table app_modules.liveticker_game_states
  add column completed_at timestamptz;

create index liveticker_game_states_completed_idx
  on app_modules.liveticker_game_states (completed_at desc)
  where completed_at is not null;

alter table app_modules.liveticker_journal
  drop constraint liveticker_journal_type_check;

alter table app_modules.liveticker_journal
  add constraint liveticker_journal_type_check
  check (mutation_type in ('ACTION_UPSERT','ACTION_REMOVE','MINUTE_SET','GAME_COMPLETED','GAME_RESET'));

create or replace function public.pd_public_liveticker_complete(
  p_event_id uuid,
  p_expected_revision integer,
  p_client_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state app_modules.liveticker_game_states%rowtype;
  v_new_revision integer;
  v_completed_at timestamptz;
begin
  perform app_private.liveticker_require_public_dev();
  perform app_private.liveticker_assert_supported_game(p_event_id);

  if p_expected_revision is null or p_expected_revision < 0
     or (p_client_id is not null and char_length(btrim(p_client_id)) not between 1 and 100) then
    raise exception 'LIVETICKER_INVALID_COMPLETE' using errcode = '22023';
  end if;

  select * into v_state
  from app_modules.liveticker_game_states
  where event_id = p_event_id
  for update;

  if not found then
    if p_expected_revision <> 0 then
      raise exception 'LIVETICKER_STALE_REVISION' using errcode = '40001';
    end if;

    insert into app_modules.liveticker_game_states(event_id, revision, minute)
    values (p_event_id, 0, 1)
    returning * into v_state;
  elsif v_state.revision <> p_expected_revision then
    raise exception 'LIVETICKER_STALE_REVISION' using errcode = '40001';
  end if;

  if v_state.completed_at is null then
    v_new_revision := v_state.revision + 1;
    v_completed_at := now();

    update app_modules.liveticker_game_states
    set completed_at = v_completed_at,
        revision = v_new_revision,
        updated_at = now()
    where event_id = p_event_id;

    insert into app_modules.liveticker_journal(
      event_id, game_revision, mutation_type, payload, client_id
    ) values (
      p_event_id,
      v_new_revision,
      'GAME_COMPLETED',
      jsonb_build_object('completedAt', v_completed_at),
      nullif(btrim(p_client_id), '')
    );
  else
    v_completed_at := v_state.completed_at;
  end if;

  return public.pd_public_liveticker_state(p_event_id)
    || jsonb_build_object('completedAt', v_completed_at);
end;
$$;

create or replace function app_private.api_liveticker_archive_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('liveticker.manage');
begin
  return jsonb_build_object(
    'games',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'eventId', state.event_id,
          'eventDate', event.event_date,
          'eventTime', event.event_time,
          'venue', event.venue,
          'homeAway', game.home_away,
          'displayTitle', case game.home_away
            when 'HOME' then coalesce(own_team.short_name, 'Mighty Dogs') || ' – ' || game.opponent_name
            else game.opponent_name || ' – ' || coalesce(own_team.short_name, 'Mighty Dogs')
          end,
          'revision', state.revision,
          'minute', state.minute,
          'completedAt', state.completed_at,
          'ownScore', stats.own_score
            + case when stats.shootout_count > 0 and stats.own_shootout > stats.opponent_shootout then 1 else 0 end,
          'opponentScore', stats.opponent_score
            + case when stats.shootout_count > 0 and stats.opponent_shootout > stats.own_shootout then 1 else 0 end,
          'suffix', case
            when stats.shootout_count > 0 and stats.own_shootout <> stats.opponent_shootout then 'n. P.'
            when stats.overtime_goals > 0 then 'n. V.'
            else ''
          end,
          'goalCount', stats.own_score + stats.opponent_score,
          'penaltyCount', stats.penalty_count,
          'shootoutCount', stats.shootout_count
        )
        order by state.completed_at desc, event.event_date desc, event.event_time desc nulls last
      )
      from app_modules.liveticker_game_states as state
      join app_modules.events as event on event.id = state.event_id
      join app_modules.event_games as game on game.event_id = event.id
      left join lateral (
        select team.short_name
        from app_modules.liveticker_teams as team
        where team.is_home_club
        order by team.is_active desc, team.updated_at desc
        limit 1
      ) as own_team on true
      left join lateral (
        select
          count(*) filter (
            where action.action_type = 'goal' and action.payload ->> 'team' = 'mighty'
          )::integer as own_score,
          count(*) filter (
            where action.action_type = 'goal' and action.payload ->> 'team' = 'opponent'
          )::integer as opponent_score,
          count(*) filter (
            where action.action_type = 'goal'
              and coalesce(action.payload ->> 'minute', '0') ~ '^[0-9]+$'
              and (action.payload ->> 'minute')::integer > 60
          )::integer as overtime_goals,
          count(*) filter (where action.action_type = 'shootout')::integer as shootout_count,
          count(*) filter (
            where action.action_type = 'shootout'
              and action.payload ->> 'team' = 'mighty'
              and action.payload ->> 'result' = 'scored'
          )::integer as own_shootout,
          count(*) filter (
            where action.action_type = 'shootout'
              and action.payload ->> 'team' = 'opponent'
              and action.payload ->> 'result' = 'scored'
          )::integer as opponent_shootout,
          coalesce(sum(
            case
              when action.action_type = 'penalty'
                and jsonb_typeof(action.payload -> 'penalties') = 'array'
              then jsonb_array_length(action.payload -> 'penalties')
              else 0
            end
          ), 0)::integer as penalty_count
        from app_modules.liveticker_actions as action
        where action.event_id = state.event_id
          and action.is_active
      ) as stats on true
      where state.completed_at is not null
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function app_private.api_liveticker_game_reset(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('liveticker.manage');
  v_event_id uuid := nullif(btrim(coalesce(p_payload ->> 'eventId', '')), '')::uuid;
  v_expected_revision integer := nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  v_state app_modules.liveticker_game_states%rowtype;
  v_action_count integer := 0;
  v_new_revision integer;
  v_before jsonb;
  v_after jsonb;
begin
  if v_event_id is null or v_expected_revision is null or v_expected_revision < 0 then
    raise exception 'Spiel und aktuelle Revision sind erforderlich.' using errcode = '22023';
  end if;

  select * into v_state
  from app_modules.liveticker_game_states
  where event_id = v_event_id
  for update;

  if not found or v_state.completed_at is null then
    raise exception 'Das Spiel ist nicht als abgeschlossen archiviert.' using errcode = 'P0002';
  end if;
  if v_state.revision <> v_expected_revision then
    raise exception 'Das Spiel wurde zwischenzeitlich geändert. Bitte Archiv aktualisieren.' using errcode = '40001';
  end if;

  v_before := jsonb_build_object(
    'revision', v_state.revision,
    'minute', v_state.minute,
    'completedAt', v_state.completed_at
  );

  select count(*)::integer into v_action_count
  from app_modules.liveticker_actions
  where event_id = v_event_id
    and is_active;

  update app_modules.liveticker_actions
  set is_active = false,
      revision = revision + 1,
      updated_at = now()
  where event_id = v_event_id
    and is_active;

  v_new_revision := v_state.revision + 1;

  update app_modules.liveticker_game_states
  set revision = v_new_revision,
      minute = 1,
      completed_at = null,
      updated_at = now()
  where event_id = v_event_id;

  v_after := jsonb_build_object(
    'revision', v_new_revision,
    'minute', 1,
    'completedAt', null
  );

  insert into app_modules.liveticker_journal(
    event_id, game_revision, mutation_type, payload, client_id
  ) values (
    v_event_id,
    v_new_revision,
    'GAME_RESET',
    jsonb_build_object('removedActions', v_action_count),
    'portal:' || v_actor::text
  );

  perform app_private.log_audit(
    v_actor,
    'LIVETICKER_GAME_RESET',
    'liveticker_game',
    v_event_id::text,
    v_before,
    v_after,
    jsonb_build_object('removedActions', v_action_count)
  );

  return app_private.api_liveticker_archive_list();
end;
$$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_liveticker_archive_r1;

create or replace function app_private.pd_api_dispatch_current(p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
begin
  case v_action
    when 'liveticker_archive_list' then return app_private.api_liveticker_archive_list();
    when 'liveticker_game_reset' then return app_private.api_liveticker_game_reset(coalesce(p_payload, '{}'::jsonb));
    else return app_private.pd_api_dispatch_current_before_liveticker_archive_r1(p_action, p_payload);
  end case;
end;
$$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_liveticker_archive_r1;

create or replace function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $$
  select case lower(btrim(coalesce(p_action, '')))
    when 'liveticker_archive_list' then 'READ'
    when 'liveticker_game_reset' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_liveticker_archive_r1(p_action)
  end;
$$;

revoke all on function public.pd_public_liveticker_complete(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.pd_public_liveticker_complete(uuid, integer, text) to anon, authenticated;

revoke all on function app_private.api_liveticker_archive_list() from public, anon, authenticated;
revoke all on function app_private.api_liveticker_game_reset(jsonb) from public, anon, authenticated;
revoke all on function app_private.pd_api_dispatch_current(text, jsonb) from public, anon, authenticated;
revoke all on function app_private.pd_api_dispatch_current_before_liveticker_archive_r1(text, jsonb) from public, anon, authenticated;
