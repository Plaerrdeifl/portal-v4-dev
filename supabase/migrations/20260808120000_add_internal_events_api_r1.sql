-- Plärrdeifl Portal V4
-- M210-R1 / F1.2: Interne Portal-API für Termine und Spieltage

create or replace function app_private.api_events_list()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_can_manage boolean :=
    app_private.has_capability(v_actor, 'events.manage');
begin
  return jsonb_build_object(
    'events',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', event.id,
          'eventType', event.event_type,
          'title', event.title,
          'displayTitle', case event.event_type
            when 'GAME' then case game.home_away
              when 'HOME' then
                'Mighty Dogs Schweinfurt – ' || game.opponent_name
              when 'AWAY' then
                game.opponent_name || ' – Mighty Dogs Schweinfurt'
              else null
            end
            else event.title
          end,
          'eventDate', event.event_date,
          'eventTime', event.event_time,
          'endDate', event.end_date,
          'endTime', event.end_time,
          'venue', event.venue,
          'description', event.description,
          'visibility', event.visibility,
          'revision', event.revision,
          'homeAway', game.home_away,
          'opponentName', game.opponent_name,
          'canManage', v_can_manage
        )
        order by
          event.event_date,
          event.event_time asc nulls first,
          event.id
      )
      from app_modules.events as event
      left join app_modules.event_games as game
        on game.event_id = event.id
      where event.event_date >=
        (now() at time zone 'Europe/Berlin')::date
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function app_private.api_event_create(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('events.manage');
  v_id uuid;
  v_event_type text :=
    upper(btrim(coalesce(p_payload ->> 'eventType', '')));
  v_title text :=
    nullif(btrim(coalesce(p_payload ->> 'title', '')), '');
  v_event_date date :=
    nullif(btrim(coalesce(p_payload ->> 'eventDate', '')), '')::date;
  v_event_time time without time zone :=
    nullif(btrim(coalesce(p_payload ->> 'eventTime', '')), '')::time;
  v_end_date date :=
    nullif(btrim(coalesce(p_payload ->> 'endDate', '')), '')::date;
  v_end_time time without time zone :=
    nullif(btrim(coalesce(p_payload ->> 'endTime', '')), '')::time;
  v_venue text :=
    nullif(btrim(coalesce(p_payload ->> 'venue', '')), '');
  v_description text :=
    nullif(coalesce(p_payload ->> 'description', ''), '');
  v_visibility text :=
    upper(btrim(coalesce(p_payload ->> 'visibility', '')));
  v_home_away text :=
    upper(btrim(coalesce(p_payload ->> 'homeAway', '')));
  v_opponent_name text :=
    nullif(btrim(coalesce(p_payload ->> 'opponentName', '')), '');
  v_after jsonb;
begin
  if v_event_type not in ('GAME', 'FANCLUB', 'OTHER') then
    raise exception 'Der Termintyp ist ungültig.'
      using errcode = '22023';
  end if;

  if v_event_date is null then
    raise exception 'Das Termindatum ist erforderlich.'
      using errcode = '22023';
  end if;

  if v_visibility not in ('PUBLIC', 'INTERNAL') then
    raise exception 'Die Sichtbarkeit ist ungültig.'
      using errcode = '22023';
  end if;

  if v_event_type = 'GAME' then
    v_title := null;

    if v_home_away not in ('HOME', 'AWAY') then
      raise exception 'Heim- oder Auswärtsspiel ist erforderlich.'
        using errcode = '22023';
    end if;

    if v_opponent_name is null then
      raise exception 'Der Gegner ist erforderlich.'
        using errcode = '22023';
    end if;
  elsif v_title is null then
    raise exception 'Der Termintitel ist erforderlich.'
      using errcode = '22023';
  end if;

  insert into app_modules.events (
    event_type,
    title,
    event_date,
    event_time,
    end_date,
    end_time,
    venue,
    description,
    visibility,
    created_by,
    updated_by
  )
  values (
    v_event_type,
    v_title,
    v_event_date,
    v_event_time,
    v_end_date,
    v_end_time,
    v_venue,
    v_description,
    v_visibility,
    v_actor,
    v_actor
  )
  returning id into v_id;

  if v_event_type = 'GAME' then
    insert into app_modules.event_games (
      event_id,
      home_away,
      opponent_name
    )
    values (
      v_id,
      v_home_away,
      v_opponent_name
    );
  end if;

  select
    to_jsonb(event)
    || jsonb_build_object(
      'homeAway', game.home_away,
      'opponentName', game.opponent_name
    )
  into v_after
  from app_modules.events as event
  left join app_modules.event_games as game
    on game.event_id = event.id
  where event.id = v_id;

  perform app_private.log_audit(
    v_actor,
    'EVENT_CREATED',
    'event',
    v_id::text,
    null,
    v_after
  );

  return app_private.api_events_list();
end;
$$;

create or replace function app_private.api_event_update(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('events.manage');
  v_id uuid := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
  v_expected_revision integer :=
    nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  v_event_type text :=
    upper(btrim(coalesce(p_payload ->> 'eventType', '')));
  v_title text :=
    nullif(btrim(coalesce(p_payload ->> 'title', '')), '');
  v_event_date date :=
    nullif(btrim(coalesce(p_payload ->> 'eventDate', '')), '')::date;
  v_event_time time without time zone :=
    nullif(btrim(coalesce(p_payload ->> 'eventTime', '')), '')::time;
  v_end_date date :=
    nullif(btrim(coalesce(p_payload ->> 'endDate', '')), '')::date;
  v_end_time time without time zone :=
    nullif(btrim(coalesce(p_payload ->> 'endTime', '')), '')::time;
  v_venue text :=
    nullif(btrim(coalesce(p_payload ->> 'venue', '')), '');
  v_description text :=
    nullif(coalesce(p_payload ->> 'description', ''), '');
  v_visibility text :=
    upper(btrim(coalesce(p_payload ->> 'visibility', '')));
  v_home_away text :=
    upper(btrim(coalesce(p_payload ->> 'homeAway', '')));
  v_opponent_name text :=
    nullif(btrim(coalesce(p_payload ->> 'opponentName', '')), '');
  v_existing app_modules.events%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if v_id is null then
    raise exception 'Die Termin-ID ist erforderlich.'
      using errcode = '22023';
  end if;

  if v_expected_revision is null then
    raise exception 'Die erwartete Revision ist erforderlich.'
      using errcode = '22023';
  end if;

  if v_event_type not in ('GAME', 'FANCLUB', 'OTHER') then
    raise exception 'Der Termintyp ist ungültig.'
      using errcode = '22023';
  end if;

  if v_event_date is null then
    raise exception 'Das Termindatum ist erforderlich.'
      using errcode = '22023';
  end if;

  if v_visibility not in ('PUBLIC', 'INTERNAL') then
    raise exception 'Die Sichtbarkeit ist ungültig.'
      using errcode = '22023';
  end if;

  if v_event_type = 'GAME' then
    v_title := null;

    if v_home_away not in ('HOME', 'AWAY') then
      raise exception 'Heim- oder Auswärtsspiel ist erforderlich.'
        using errcode = '22023';
    end if;

    if v_opponent_name is null then
      raise exception 'Der Gegner ist erforderlich.'
        using errcode = '22023';
    end if;
  elsif v_title is null then
    raise exception 'Der Termintitel ist erforderlich.'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from app_modules.events
  where id = v_id
  for update;

  if v_existing.id is null then
    raise exception 'Der Termin wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_expected_revision <> v_existing.revision then
    raise exception
      'Der Termin wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  select
    to_jsonb(event)
    || jsonb_build_object(
      'homeAway', game.home_away,
      'opponentName', game.opponent_name
    )
  into v_before
  from app_modules.events as event
  left join app_modules.event_games as game
    on game.event_id = event.id
  where event.id = v_id;

  if v_existing.event_type = 'GAME'
     and v_event_type <> 'GAME' then
    delete from app_modules.event_games
    where event_id = v_id;
  end if;

  update app_modules.events
  set event_type = v_event_type,
      title = v_title,
      event_date = v_event_date,
      event_time = v_event_time,
      end_date = v_end_date,
      end_time = v_end_time,
      venue = v_venue,
      description = v_description,
      visibility = v_visibility,
      revision = revision + 1,
      updated_by = v_actor
  where id = v_id;

  if v_event_type = 'GAME' then
    insert into app_modules.event_games (
      event_id,
      home_away,
      opponent_name
    )
    values (
      v_id,
      v_home_away,
      v_opponent_name
    )
    on conflict (event_id)
    do update set
      home_away = excluded.home_away,
      opponent_name = excluded.opponent_name;
  end if;

  select
    to_jsonb(event)
    || jsonb_build_object(
      'homeAway', game.home_away,
      'opponentName', game.opponent_name
    )
  into v_after
  from app_modules.events as event
  left join app_modules.event_games as game
    on game.event_id = event.id
  where event.id = v_id;

  perform app_private.log_audit(
    v_actor,
    'EVENT_UPDATED',
    'event',
    v_id::text,
    v_before,
    v_after
  );

  return app_private.api_events_list();
end;
$$;

create or replace function app_private.api_event_delete(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('events.manage');
  v_id uuid := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
  v_expected_revision integer :=
    nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  v_existing app_modules.events%rowtype;
  v_before jsonb;
begin
  if v_id is null then
    raise exception 'Die Termin-ID ist erforderlich.'
      using errcode = '22023';
  end if;

  if v_expected_revision is null then
    raise exception 'Die erwartete Revision ist erforderlich.'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from app_modules.events
  where id = v_id
  for update;

  if v_existing.id is null then
    raise exception 'Der Termin wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_expected_revision <> v_existing.revision then
    raise exception
      'Der Termin wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  select
    to_jsonb(event)
    || jsonb_build_object(
      'homeAway', game.home_away,
      'opponentName', game.opponent_name
    )
  into v_before
  from app_modules.events as event
  left join app_modules.event_games as game
    on game.event_id = event.id
  where event.id = v_id;

  perform app_private.log_audit(
    v_actor,
    'EVENT_DELETED',
    'event',
    v_id::text,
    v_before,
    null
  );

  delete from app_modules.events
  where id = v_id;

  return app_private.api_events_list();
end;
$$;

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_events_r1;

create or replace function public.pd_api(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_data jsonb;
begin
  if auth.uid() is null then
    raise exception 'Anmeldung erforderlich.'
      using errcode = '42501';
  end if;

  case v_action
    when 'events_list' then
      v_data := app_private.api_events_list();
    when 'event_create' then
      v_data := app_private.api_event_create(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'event_update' then
      v_data := app_private.api_event_update(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'event_delete' then
      v_data := app_private.api_event_delete(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return public.pd_api_before_events_r1(
        p_action,
        p_payload
      );
  end case;

  return jsonb_build_object(
    'ok', true,
    'data', v_data
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', sqlstate,
        'message', sqlerrm
      )
    );
end;
$$;

revoke all on function app_private.api_events_list()
from public, anon, authenticated;

revoke all on function app_private.api_event_create(jsonb)
from public, anon, authenticated;

revoke all on function app_private.api_event_update(jsonb)
from public, anon, authenticated;

revoke all on function app_private.api_event_delete(jsonb)
from public, anon, authenticated;

revoke all on function public.pd_api_before_events_r1(text, jsonb)
from public, anon, authenticated;

revoke all on function public.pd_api(text, jsonb)
from public, anon, authenticated;

grant execute on function public.pd_api(text, jsonb)
to authenticated;
