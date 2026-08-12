-- Plaerrdeifl Portal V4
-- P200 / M210-R2: kontrollierter ICS-Spielplanimport

create table app_modules.event_external_refs (
  event_id uuid not null
    references app_modules.events(id) on delete cascade,
  source_type text not null,
  source_key text not null,
  external_uid text not null,
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  last_seen_at timestamptz,
  constraint event_external_refs_source_type_check
    check (source_type = btrim(source_type) and length(source_type) between 1 and 32),
  constraint event_external_refs_source_key_check
    check (source_key = btrim(source_key) and length(source_key) between 1 and 120),
  constraint event_external_refs_external_uid_check
    check (external_uid = btrim(external_uid) and length(external_uid) between 1 and 512),
  constraint event_external_refs_source_identity_key
    unique (source_type, source_key, external_uid)
);

create index event_external_refs_event_idx
  on app_modules.event_external_refs(event_id);

create table app_modules.event_import_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  source_type text not null,
  source_key text not null,
  original_filename text not null,
  file_sha256 text not null,
  file_size integer not null,
  parsed_event_count integer not null,
  new_count integer not null,
  changed_count integer not null,
  unchanged_count integer not null,
  created_count integer not null,
  updated_count integer not null,
  actor uuid references app_portal.users(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  preview_fingerprint text not null,
  constraint event_import_runs_source_check
    check (source_type = 'ICS' and source_key = 'ERV_BAYERNLIGA_2026_27'),
  constraint event_import_runs_filename_check
    check (
      original_filename = btrim(original_filename)
      and length(original_filename) between 5 and 255
      and original_filename ~* '\.ics$'
      and original_filename !~ '[\\/]'
    ),
  constraint event_import_runs_sha256_check
    check (file_sha256 ~ '^[0-9a-f]{64}$'),
  constraint event_import_runs_fingerprint_check
    check (preview_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint event_import_runs_size_check
    check (file_size between 1 and 1048576),
  constraint event_import_runs_counts_check
    check (
      parsed_event_count > 0
      and new_count >= 0
      and changed_count >= 0
      and unchanged_count >= 0
      and created_count >= 0
      and updated_count >= 0
      and parsed_event_count = new_count + changed_count + unchanged_count
      and created_count = new_count
      and updated_count = changed_count
    )
);

create index event_import_runs_source_confirmed_idx
  on app_modules.event_import_runs(source_type, source_key, confirmed_at desc);

alter table app_modules.event_external_refs enable row level security;
alter table app_modules.event_import_runs enable row level security;

revoke all on table
  app_modules.event_external_refs,
  app_modules.event_import_runs
from public, anon, authenticated;

create or replace function public.m210_ics_import_preview(
  p_actor uuid,
  p_source_type text,
  p_source_key text,
  p_records jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record jsonb;
  v_uid text;
  v_event_date date;
  v_event_time time without time zone;
  v_end_date date;
  v_end_time time without time zone;
  v_venue text;
  v_home_away text;
  v_opponent_name text;
  v_ref app_modules.event_external_refs%rowtype;
  v_event app_modules.events%rowtype;
  v_game app_modules.event_games%rowtype;
  v_status text;
  v_diffs jsonb;
  v_items jsonb := '[]'::jsonb;
  v_state jsonb := '[]'::jsonb;
  v_new_count integer := 0;
  v_changed_count integer := 0;
  v_unchanged_count integer := 0;
  v_allowed_keys text[] := array[
    'uid', 'eventDate', 'eventTime', 'endDate', 'endTime',
    'venue', 'homeAway', 'opponentName'
  ];
begin
  if p_actor is null
     or not app_private.has_capability(p_actor, 'events.manage') then
    raise exception 'Die Berechtigung events.manage ist erforderlich.'
      using errcode = '42501';
  end if;

  if p_source_type is distinct from 'ICS'
     or p_source_key is distinct from 'ERV_BAYERNLIGA_2026_27' then
    raise exception 'Das Importprofil ist ungültig.' using errcode = '22023';
  end if;

  if p_records is null
     or jsonb_typeof(p_records) <> 'array'
     or jsonb_array_length(p_records) not between 1 and 500 then
    raise exception 'Die normalisierten Importdaten sind ungültig.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_records) as record(value)
    cross join lateral jsonb_object_keys(record.value) as key(name)
    where jsonb_typeof(record.value) <> 'object'
       or not (key.name = any(v_allowed_keys))
  ) or exists (
    select 1
    from jsonb_array_elements(p_records) as record(value)
    group by record.value ->> 'uid'
    having count(*) > 1
  ) then
    raise exception 'Die normalisierten Importdaten sind ungültig.' using errcode = '22023';
  end if;

  for v_record in select value from jsonb_array_elements(p_records)
  loop
    if not (v_record ?& v_allowed_keys)
       or jsonb_typeof(v_record -> 'uid') <> 'string'
       or jsonb_typeof(v_record -> 'eventDate') <> 'string'
       or jsonb_typeof(v_record -> 'eventTime') <> 'string'
       or jsonb_typeof(v_record -> 'homeAway') <> 'string'
       or jsonb_typeof(v_record -> 'opponentName') <> 'string'
       or jsonb_typeof(v_record -> 'endDate') not in ('string', 'null')
       or jsonb_typeof(v_record -> 'endTime') not in ('string', 'null')
       or jsonb_typeof(v_record -> 'venue') not in ('string', 'null') then
      raise exception 'Ein normalisierter Importdatensatz ist ungültig.' using errcode = '22023';
    end if;

    begin
      v_uid := btrim(v_record ->> 'uid');
      v_event_date := (v_record ->> 'eventDate')::date;
      v_event_time := (v_record ->> 'eventTime')::time;
      v_end_date := nullif(v_record ->> 'endDate', '')::date;
      v_end_time := nullif(v_record ->> 'endTime', '')::time;
    exception when others then
      raise exception 'Ein normalisierter Importzeitpunkt ist ungültig.' using errcode = '22023';
    end;

    v_venue := nullif(btrim(coalesce(v_record ->> 'venue', '')), '');
    v_home_away := v_record ->> 'homeAway';
    v_opponent_name := btrim(v_record ->> 'opponentName');
    if v_uid = '' or length(v_uid) > 512
       or v_event_time is null
       or (v_end_date is null) <> (v_end_time is null)
       or (v_end_date is not null and (v_end_date, v_end_time) <= (v_event_date, v_event_time))
       or v_home_away not in ('HOME', 'AWAY')
       or v_opponent_name = '' then
      raise exception 'Ein normalisierter Importdatensatz ist ungültig.' using errcode = '22023';
    end if;

    select * into v_ref
    from app_modules.event_external_refs as ref
    where ref.source_type = p_source_type
      and ref.source_key = p_source_key
      and ref.external_uid = v_uid;

    v_diffs := '[]'::jsonb;
    if v_ref.event_id is null then
      v_status := 'NEW';
      v_new_count := v_new_count + 1;
      v_event := null;
      v_game := null;
    else
      select * into strict v_event
      from app_modules.events as event
      where event.id = v_ref.event_id;

      select * into v_game
      from app_modules.event_games as game
      where game.event_id = v_ref.event_id;

      if v_event.event_type <> 'GAME' or v_game.event_id is null then
        raise exception 'Eine vorhandene ICS-Referenz zeigt nicht auf einen gültigen GAME-Termin.'
          using errcode = '22023';
      end if;

      if v_event.event_date is distinct from v_event_date then
        v_diffs := v_diffs || jsonb_build_array(jsonb_build_object('field', 'eventDate', 'old', v_event.event_date, 'new', v_event_date));
      end if;
      if v_event.event_time is distinct from v_event_time then
        v_diffs := v_diffs || jsonb_build_array(jsonb_build_object('field', 'eventTime', 'old', v_event.event_time, 'new', v_event_time));
      end if;
      if v_event.end_date is distinct from v_end_date then
        v_diffs := v_diffs || jsonb_build_array(jsonb_build_object('field', 'endDate', 'old', v_event.end_date, 'new', v_end_date));
      end if;
      if v_event.end_time is distinct from v_end_time then
        v_diffs := v_diffs || jsonb_build_array(jsonb_build_object('field', 'endTime', 'old', v_event.end_time, 'new', v_end_time));
      end if;
      if v_event.venue is distinct from v_venue then
        v_diffs := v_diffs || jsonb_build_array(jsonb_build_object('field', 'venue', 'old', v_event.venue, 'new', v_venue));
      end if;
      if v_game.home_away is distinct from v_home_away then
        v_diffs := v_diffs || jsonb_build_array(jsonb_build_object('field', 'homeAway', 'old', v_game.home_away, 'new', v_home_away));
      end if;
      if v_game.opponent_name is distinct from v_opponent_name then
        v_diffs := v_diffs || jsonb_build_array(jsonb_build_object('field', 'opponentName', 'old', v_game.opponent_name, 'new', v_opponent_name));
      end if;

      if jsonb_array_length(v_diffs) = 0 then
        v_status := 'UNCHANGED';
        v_unchanged_count := v_unchanged_count + 1;
      else
        v_status := 'CHANGED';
        v_changed_count := v_changed_count + 1;
      end if;
    end if;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'status', v_status,
      'uid', v_uid,
      'eventId', v_ref.event_id,
      'eventDate', v_event_date,
      'eventTime', v_event_time,
      'endDate', v_end_date,
      'endTime', v_end_time,
      'venue', v_venue,
      'homeAway', v_home_away,
      'opponentName', v_opponent_name,
      'displayTitle', case v_home_away
        when 'HOME' then 'Mighty Dogs Schweinfurt – ' || v_opponent_name
        else v_opponent_name || ' – Mighty Dogs Schweinfurt'
      end,
      'diffs', v_diffs
    ));
    v_state := v_state || jsonb_build_array(jsonb_build_object(
      'uid', v_uid,
      'status', v_status,
      'eventId', v_ref.event_id,
      'revision', case when v_ref.event_id is null then null else v_event.revision end
    ));
  end loop;

  return jsonb_build_object(
    'sourceType', p_source_type,
    'sourceKey', p_source_key,
    'sourceLabel', 'ERV Bayernliga 2026/27',
    'summary', jsonb_build_object(
      'new', v_new_count,
      'changed', v_changed_count,
      'unchanged', v_unchanged_count,
      'total', jsonb_array_length(p_records)
    ),
    'items', v_items,
    'state', v_state
  );
end;
$$;

create or replace function public.m210_ics_import_confirm(
  p_actor uuid,
  p_source_type text,
  p_source_key text,
  p_original_filename text,
  p_file_sha256 text,
  p_file_size integer,
  p_records jsonb,
  p_expected_state jsonb,
  p_preview_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preview jsonb;
  v_record jsonb;
  v_state_item jsonb;
  v_index integer := 0;
  v_status text;
  v_event_id uuid;
  v_event_date date;
  v_event_time time without time zone;
  v_end_date date;
  v_end_time time without time zone;
  v_venue text;
  v_home_away text;
  v_opponent_name text;
  v_before jsonb;
  v_after jsonb;
  v_run_id uuid;
  v_created integer := 0;
  v_updated integer := 0;
  v_result_items jsonb := '[]'::jsonb;
begin
  if p_actor is null
     or not app_private.has_capability(p_actor, 'events.manage') then
    raise exception 'Die Berechtigung events.manage ist erforderlich.'
      using errcode = '42501';
  end if;
  if p_source_type is distinct from 'ICS'
     or p_source_key is distinct from 'ERV_BAYERNLIGA_2026_27'
     or p_original_filename is null
     or p_original_filename <> btrim(p_original_filename)
     or length(p_original_filename) not between 5 and 255
     or p_original_filename !~* '\.ics$'
     or p_original_filename ~ '[\\/]'
     or p_file_sha256 !~ '^[0-9a-f]{64}$'
     or p_preview_fingerprint !~ '^[0-9a-f]{64}$'
     or p_file_size not between 1 and 1048576
     or jsonb_typeof(p_expected_state) <> 'array' then
    raise exception 'Die Importmetadaten sind ungültig.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_source_type || ':' || p_source_key, 210)
  );

  perform 1
  from app_modules.event_external_refs as ref
  join app_modules.events as event on event.id = ref.event_id
  where ref.source_type = p_source_type
    and ref.source_key = p_source_key
    and ref.external_uid in (
      select record.value ->> 'uid'
      from jsonb_array_elements(p_records) as record(value)
    )
  for update of ref, event;

  v_preview := public.m210_ics_import_preview(
    p_actor, p_source_type, p_source_key, p_records
  );
  if v_preview -> 'state' is distinct from p_expected_state then
    raise exception 'PREVIEW_STALE' using errcode = 'P2101';
  end if;

  for v_record in select value from jsonb_array_elements(p_records)
  loop
    v_state_item := p_expected_state -> v_index;
    v_status := v_state_item ->> 'status';
    v_event_date := (v_record ->> 'eventDate')::date;
    v_event_time := (v_record ->> 'eventTime')::time;
    v_end_date := nullif(v_record ->> 'endDate', '')::date;
    v_end_time := nullif(v_record ->> 'endTime', '')::time;
    v_venue := nullif(btrim(coalesce(v_record ->> 'venue', '')), '');
    v_home_away := v_record ->> 'homeAway';
    v_opponent_name := btrim(v_record ->> 'opponentName');

    if v_status = 'NEW' then
      insert into app_modules.events (
        event_type, title, event_date, event_time, end_date, end_time,
        venue, description, visibility, created_by, updated_by
      ) values (
        'GAME', null, v_event_date, v_event_time, v_end_date, v_end_time,
        v_venue, null, 'PUBLIC', p_actor, p_actor
      ) returning id into v_event_id;

      insert into app_modules.event_games(event_id, home_away, opponent_name)
      values (v_event_id, v_home_away, v_opponent_name);

      insert into app_modules.event_external_refs(
        event_id, source_type, source_key, external_uid,
        created_by, last_seen_at
      ) values (
        v_event_id, p_source_type, p_source_key, v_record ->> 'uid',
        p_actor, now()
      );

      v_after := jsonb_build_object(
        'eventType', 'GAME', 'eventDate', v_event_date,
        'eventTime', v_event_time, 'endDate', v_end_date,
        'endTime', v_end_time, 'venue', v_venue,
        'homeAway', v_home_away, 'opponentName', v_opponent_name,
        'sourceType', p_source_type, 'sourceKey', p_source_key,
        'externalUid', v_record ->> 'uid'
      );
      perform app_private.log_audit(
        p_actor, 'EVENT_CREATED', 'event', v_event_id::text,
        null, v_after, jsonb_build_object('source', 'ICS_IMPORT')
      );
      v_created := v_created + 1;
    elsif v_status = 'CHANGED' then
      v_event_id := (v_state_item ->> 'eventId')::uuid;
      select jsonb_build_object(
        'eventDate', event.event_date, 'eventTime', event.event_time,
        'endDate', event.end_date, 'endTime', event.end_time,
        'venue', event.venue, 'homeAway', game.home_away,
        'opponentName', game.opponent_name
      ) into v_before
      from app_modules.events as event
      join app_modules.event_games as game on game.event_id = event.id
      where event.id = v_event_id;

      update app_modules.events
      set event_date = v_event_date,
          event_time = v_event_time,
          end_date = v_end_date,
          end_time = v_end_time,
          venue = v_venue,
          revision = revision + 1,
          updated_by = p_actor
      where id = v_event_id;

      update app_modules.event_games
      set home_away = v_home_away,
          opponent_name = v_opponent_name
      where event_id = v_event_id;

      v_after := jsonb_build_object(
        'eventDate', v_event_date, 'eventTime', v_event_time,
        'endDate', v_end_date, 'endTime', v_end_time,
        'venue', v_venue, 'homeAway', v_home_away,
        'opponentName', v_opponent_name
      );
      perform app_private.log_audit(
        p_actor, 'EVENT_UPDATED', 'event', v_event_id::text,
        v_before, v_after, jsonb_build_object(
          'source', 'ICS_IMPORT', 'sourceType', p_source_type,
          'sourceKey', p_source_key, 'externalUid', v_record ->> 'uid'
        )
      );
      v_updated := v_updated + 1;
    else
      v_event_id := (v_state_item ->> 'eventId')::uuid;
    end if;

    if v_status in ('CHANGED', 'UNCHANGED') then
      update app_modules.event_external_refs
      set last_seen_at = now()
      where source_type = p_source_type
        and source_key = p_source_key
        and external_uid = v_record ->> 'uid';
    end if;

    v_result_items := v_result_items || jsonb_build_array(jsonb_build_object(
      'uid', v_record ->> 'uid', 'status', v_status, 'eventId', v_event_id
    ));
    v_index := v_index + 1;
  end loop;

  insert into app_modules.event_import_runs (
    source_type, source_key, original_filename, file_sha256, file_size,
    parsed_event_count, new_count, changed_count, unchanged_count,
    created_count, updated_count, actor, preview_fingerprint
  ) values (
    p_source_type, p_source_key, p_original_filename, p_file_sha256, p_file_size,
    jsonb_array_length(p_records),
    (v_preview -> 'summary' ->> 'new')::integer,
    (v_preview -> 'summary' ->> 'changed')::integer,
    (v_preview -> 'summary' ->> 'unchanged')::integer,
    v_created, v_updated, p_actor, p_preview_fingerprint
  ) returning id into v_run_id;

  perform app_private.log_audit(
    p_actor,
    'EVENT_ICS_IMPORT_CONFIRMED',
    'event_import_run',
    v_run_id::text,
    null,
    jsonb_build_object(
      'sourceType', p_source_type,
      'sourceKey', p_source_key,
      'fileSha256', p_file_sha256,
      'fileSize', p_file_size,
      'parsedEventCount', jsonb_array_length(p_records),
      'newCount', (v_preview -> 'summary' ->> 'new')::integer,
      'changedCount', (v_preview -> 'summary' ->> 'changed')::integer,
      'unchangedCount', (v_preview -> 'summary' ->> 'unchanged')::integer,
      'createdCount', v_created,
      'updatedCount', v_updated
    )
  );

  return jsonb_build_object(
    'runId', v_run_id,
    'sourceType', p_source_type,
    'sourceKey', p_source_key,
    'summary', jsonb_build_object(
      'new', (v_preview -> 'summary' ->> 'new')::integer,
      'changed', (v_preview -> 'summary' ->> 'changed')::integer,
      'unchanged', (v_preview -> 'summary' ->> 'unchanged')::integer,
      'created', v_created,
      'updated', v_updated,
      'total', jsonb_array_length(p_records)
    ),
    'items', v_result_items
  );
end;
$$;

revoke all on function public.m210_ics_import_preview(uuid, text, text, jsonb)
from public, anon, authenticated;
revoke all on function public.m210_ics_import_confirm(uuid, text, text, text, text, integer, jsonb, jsonb, text)
from public, anon, authenticated;

grant execute on function public.m210_ics_import_preview(uuid, text, text, jsonb)
to service_role;
grant execute on function public.m210_ics_import_confirm(uuid, text, text, text, text, integer, jsonb, jsonb, text)
to service_role;
