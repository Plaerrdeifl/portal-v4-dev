-- Keep the M330 locking wrapper and the existing browser dispatch unchanged.
-- Only pristine M328 default stops belong to the disposable empty draft.
-- No FK action, table privilege or API grant is changed.
create or replace function app_private.api_fanbus_trip_delete_before_m330_r1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.manage');
  v_id uuid;
  v_expected_revision integer;
  v_existing app_modules.fanbus_trips%rowtype;
  v_fk record;
  v_has_child boolean;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Die Löschdaten sind ungültig.' using errcode = '22023';
  end if;
  if not (p_payload ?& array['id', 'expectedRevision'])
     or exists (
       select 1 from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array['id', 'expectedRevision'])
     ) then
    raise exception 'Für das Löschen sind ausschließlich id und expectedRevision zulässig.'
      using errcode = '22023';
  end if;
  begin
    v_id := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
    v_expected_revision :=
      nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  exception when others then
    raise exception 'Die Löschdaten haben ein ungültiges Format.' using errcode = '22023';
  end;
  if v_id is null or v_expected_revision is null then
    raise exception 'Fanbusfahrt-ID und erwartete Revision sind erforderlich.' using errcode = '22023';
  end if;

  select * into v_existing from app_modules.fanbus_trips where id = v_id for update;
  if not found then
    raise exception 'Die Fanbusfahrt wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_expected_revision <> v_existing.revision then
    raise exception 'Die Fanbusfahrt wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;
  if v_existing.status <> 'DRAFT' then
    raise exception 'Nur ein Entwurf darf gelöscht werden.' using errcode = '22023';
  end if;
  if exists (select 1 from app_modules.fanbus_registrations where trip_id = v_id) then
    raise exception 'Eine Fanbusfahrt mit Anmeldungen darf nicht gelöscht werden.' using errcode = '23503';
  end if;

  -- Protect ALL other referencing rows, including existing CASCADE/SET NULL
  -- history and idempotency FKs. Catalog-derived identifiers are quoted, and
  -- the UUID is passed as a parameter. Future FK children fail closed too.
  for v_fk in
    select n.nspname, t.relname, a.attname
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    join lateral unnest(c.conkey, c.confkey) as k(child_attnum, parent_attnum) on true
    join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.child_attnum
    join pg_catalog.pg_attribute p on p.attrelid = c.confrelid and p.attnum = k.parent_attnum
    where c.contype = 'f'
      and c.confrelid = 'app_modules.fanbus_trips'::regclass
      and c.conrelid <> 'app_modules.fanbus_trip_boarding_stops'::regclass
      and p.attname = 'id'
  loop
    execute format('select exists (select 1 from %I.%I where %I = $1)',
      v_fk.nspname, v_fk.relname, v_fk.attname)
      into v_has_child using v_id;
    if v_has_child then
      raise exception 'Eine Fanbusfahrt mit abhängigen Fachdaten darf nicht gelöscht werden.'
        using errcode = '23503';
    end if;
  end loop;

  -- M328 creates Pendlerparkplatz (-30 minutes, position 1) and Icedome
  -- (departure, position 2), active, revision 1 and without operational notes.
  -- Edited/custom/historical stop data must not be silently discarded.
  perform 1 from app_modules.fanbus_trip_boarding_stops where trip_id = v_id for update;
  if exists (
    select 1
    from app_modules.fanbus_trip_boarding_stops s
    join app_modules.fanbus_boarding_stops master on master.id = s.boarding_stop_id
    where s.trip_id = v_id
      and not (
        s.revision = 1 and s.is_active and s.trip_note is null
        and s.created_at = v_existing.created_at and s.updated_at = s.created_at
        and s.created_by is not distinct from v_existing.created_by
        and s.updated_by is not distinct from v_existing.created_by
        and (
          (lower(btrim(master.label)) = 'pendlerparkplatz' and s.position = 1
            and s.departure_at is not distinct from v_existing.departure_at - interval '30 minutes')
          or (lower(btrim(master.label)) = 'icedome' and s.position = 2
            and s.boarding_stop_id = v_existing.default_boarding_stop_id
            and s.departure_at is not distinct from v_existing.departure_at)
        )
      )
  ) then
    raise exception 'Eine Fanbusfahrt mit bearbeiteten Zustiegen darf nicht gelöscht werden.'
      using errcode = '23503';
  end if;

  -- Stop grandchildren remain protected by their unchanged RESTRICT FKs.
  -- Any failure rolls back cleanup and audit as part of the same transaction.
  delete from app_modules.fanbus_trip_boarding_stops where trip_id = v_id;
  perform app_private.log_audit(
    v_actor, 'FANBUS_TRIP_DELETED', 'fanbus_trip', v_id::text,
    jsonb_build_object('eventId', v_existing.event_id, 'status', v_existing.status,
      'revision', v_existing.revision), null
  );
  delete from app_modules.fanbus_trips where id = v_id;
  return app_private.api_fanbus_trips_list();
end;
$function$;
