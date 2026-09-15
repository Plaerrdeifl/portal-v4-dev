-- Plaerrdeifl Portal V4
-- Reset bridge for the canonical M328 fanbus boarding stops.
--
-- The following migration depends on two operator-created boarding stops.
-- Existing databases that already applied it remain untouched. Fresh chains
-- receive only missing canonical rows, using the same append-only position
-- behavior as api_fanbus_boarding_stop_upsert().

begin;

do $m328_canonical_boarding_stops_reset_bridge$
declare
  v_target_applied boolean;
  v_icedome_total bigint;
  v_icedome_active bigint;
  v_pendler_total bigint;
  v_pendler_active bigint;
  v_next_position integer;
begin
  select exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260829225223'
  )
  into v_target_applied;

  -- An operational database already passed the dependent migration. Never
  -- reinterpret or modify its current business data from this reset bridge.
  if v_target_applied then
    return;
  end if;

  if pg_catalog.to_regclass('app_modules.fanbus_boarding_stops') is null then
    raise exception 'M328_CANONICAL_BOARDING_STOPS_RESET_BRIDGE_UNEXPECTED_STATE'
      using errcode = '55000';
  end if;

  lock table app_modules.fanbus_boarding_stops
    in share row exclusive mode;

  select
    count(*),
    count(*) filter (where stop.is_active)
  into
    v_icedome_total,
    v_icedome_active
  from app_modules.fanbus_boarding_stops as stop
  where lower(btrim(stop.label)) = 'icedome';

  select
    count(*),
    count(*) filter (where stop.is_active)
  into
    v_pendler_total,
    v_pendler_active
  from app_modules.fanbus_boarding_stops as stop
  where lower(btrim(stop.label)) = 'pendlerparkplatz';

  -- Never reactivate, rename, merge, or choose between existing business rows.
  if v_icedome_total > 1
     or (v_icedome_total = 1 and v_icedome_active <> 1)
     or v_pendler_total > 1
     or (v_pendler_total = 1 and v_pendler_active <> 1) then
    raise exception 'M328_CANONICAL_BOARDING_STOPS_RESET_BRIDGE_UNEXPECTED_STATE'
      using errcode = '55000';
  end if;

  select coalesce(max(stop.position), 0) + 1
  into v_next_position
  from app_modules.fanbus_boarding_stops as stop;

  if v_icedome_total = 0 then
    insert into app_modules.fanbus_boarding_stops (
      label,
      position,
      is_active
    )
    values (
      'Icedome',
      v_next_position,
      true
    );
    v_next_position := v_next_position + 1;
  end if;

  if v_pendler_total = 0 then
    insert into app_modules.fanbus_boarding_stops (
      label,
      position,
      is_active
    )
    values (
      'Pendlerparkplatz',
      v_next_position,
      true
    );
  end if;

  if (
    select count(*)
    from app_modules.fanbus_boarding_stops as stop
    where stop.is_active
      and lower(btrim(stop.label)) in ('icedome', 'pendlerparkplatz')
  ) <> 2 then
    raise exception 'M328_CANONICAL_BOARDING_STOPS_RESET_BRIDGE_UNEXPECTED_STATE'
      using errcode = '55000';
  end if;
end;
$m328_canonical_boarding_stops_reset_bridge$;

commit;
