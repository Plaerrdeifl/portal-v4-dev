-- Plaerrdeifl Digitalplattform V4
-- P300 / M328-R1 – Bus-Orga Buchungsverwaltung
-- Lesbare Buchungsnummern, Buchungsprojektion, atomare gemischte Erfassung
-- sowie Buchungsbearbeitung und atomare Stornierung.
-- DEV migration. PROD wird durch diesen Auftrag nicht beruehrt.

begin;

create sequence if not exists app_private.fanbus_booking_number_seq
  as bigint
  start with 1
  increment by 1
  no cycle;

revoke all on sequence app_private.fanbus_booking_number_seq
from public, anon, authenticated, service_role;

create or replace function app_private.fanbus_next_booking_number()
returns text
language sql
volatile
security definer
set search_path = ''
as $function$
  select
    'FB-'
    || pg_catalog.to_char(
      pg_catalog.clock_timestamp() at time zone 'Europe/Berlin',
      'YY'
    )
    || '-'
    || pg_catalog.lpad(
      pg_catalog.nextval('app_private.fanbus_booking_number_seq'::pg_catalog.regclass)::text,
      6,
      '0'
    );
$function$;

revoke all on function app_private.fanbus_next_booking_number()
from public, anon, authenticated, service_role;
grant execute on function app_private.fanbus_next_booking_number() to postgres;

alter table app_modules.fanbus_bookings
  add column if not exists booking_number text;

update app_modules.fanbus_bookings
set booking_number = app_private.fanbus_next_booking_number()
where booking_number is null;

alter table app_modules.fanbus_bookings
  alter column booking_number set default app_private.fanbus_next_booking_number(),
  alter column booking_number set not null;

create unique index if not exists fanbus_bookings_booking_number_uidx
  on app_modules.fanbus_bookings(booking_number);

alter table app_modules.fanbus_bookings
  drop constraint if exists fanbus_bookings_booking_number_check;
alter table app_modules.fanbus_bookings
  add constraint fanbus_bookings_booking_number_check
  check (booking_number ~ '^FB-[0-9]{2}-[0-9]{6,}$');

alter function app_private.api_fanbus_registrations_list(jsonb)
  rename to api_fanbus_registrations_list_before_m328_r1;

create function app_private.api_fanbus_registrations_list(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_base jsonb := app_private.api_fanbus_registrations_list_before_m328_r1(p_payload);
  v_registrations jsonb;
begin
  select coalesce(
    jsonb_agg(
      item.value || jsonb_build_object('bookingNumber', booking.booking_number)
      order by item.ordinality
    ),
    '[]'::jsonb
  )
  into v_registrations
  from jsonb_array_elements(coalesce(v_base -> 'registrations', '[]'::jsonb))
    with ordinality as item(value, ordinality)
  left join app_modules.fanbus_bookings as booking
    on booking.id = nullif(item.value ->> 'bookingId', '')::uuid;

  return jsonb_set(v_base, '{registrations}', v_registrations, true);
end;
$function$;

create function app_private.api_fanbus_registration_create_manual_batches(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_trip uuid := app_private.m326_uuid(p_payload ->> 'tripId','FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD');
  v_key uuid := app_private.m326_uuid(p_payload ->> 'idempotencyKey','FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD');
  v_bookings jsonb := p_payload -> 'bookings';
  v_booking jsonb;
  v_participants jsonb;
  v_total_participants integer := 0;
  v_booking_count integer := 0;
  v_index integer := 0;
  v_sub_key uuid;
  v_result jsonb;
  v_booking_number text;
  v_results jsonb := '[]'::jsonb;
  v_any_waitlisted boolean := false;
begin
  if jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['tripId','bookings','termsConfirmed','idempotencyKey']
     or exists (
       select 1 from jsonb_object_keys(p_payload) as key(name)
       where key.name <> all(array['tripId','bookings','termsConfirmed','idempotencyKey'])
     )
     or v_trip is null or v_key is null
     or (p_payload ->> 'termsConfirmed')::boolean is distinct from true
     or jsonb_typeof(v_bookings) <> 'array'
     or jsonb_array_length(v_bookings) not between 1 and 20 then
    raise exception 'FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD' using errcode='22023';
  end if;

  for v_booking in
    select value from jsonb_array_elements(v_bookings) with ordinality as booking(value, position)
    order by position
  loop
    if jsonb_typeof(v_booking) <> 'object'
       or not v_booking ? 'participants'
       or exists (select 1 from jsonb_object_keys(v_booking) as key(name) where key.name <> 'participants') then
      raise exception 'FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD' using errcode='22023';
    end if;

    v_participants := v_booking -> 'participants';
    if jsonb_typeof(v_participants) <> 'array'
       or jsonb_array_length(v_participants) not between 1 and 20 then
      raise exception 'FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD' using errcode='22023';
    end if;

    v_booking_count := v_booking_count + 1;
    v_total_participants := v_total_participants + jsonb_array_length(v_participants);
    if v_total_participants > 20 then
      raise exception 'FANBUS_MANUAL_BATCHES_TOO_MANY_PARTICIPANTS' using errcode='22023';
    end if;

    v_index := v_index + 1;
    v_sub_key := (
      substr(md5(v_key::text || ':m328-booking:' || v_index::text), 1, 8) || '-' ||
      substr(md5(v_key::text || ':m328-booking:' || v_index::text), 9, 4) || '-' ||
      substr(md5(v_key::text || ':m328-booking:' || v_index::text), 13, 4) || '-' ||
      substr(md5(v_key::text || ':m328-booking:' || v_index::text), 17, 4) || '-' ||
      substr(md5(v_key::text || ':m328-booking:' || v_index::text), 21, 12)
    )::uuid;

    v_result := app_private.api_fanbus_registration_create_manual_bulk(
      jsonb_build_object(
        'tripId',v_trip,'participants',v_participants,'termsConfirmed',true,
        'idempotencyKey',v_sub_key,'bookingMode','GROUP','primaryParticipantIndex',0
      )
    );

    if coalesce(v_result ->> 'outcome','') not in ('CREATED','WAITLISTED') then
      raise exception 'FANBUS_MANUAL_BATCHES_UNEXPECTED_OUTCOME' using errcode='55000';
    end if;

    select booking.booking_number into v_booking_number
    from app_modules.fanbus_bookings as booking
    where booking.id = nullif(v_result ->> 'bookingId','')::uuid;

    if v_booking_number is null then
      raise exception 'FANBUS_BOOKING_NUMBER_MISSING' using errcode='55000';
    end if;

    v_any_waitlisted := v_any_waitlisted or (v_result ->> 'outcome')='WAITLISTED';
    v_results := v_results || jsonb_build_array(v_result || jsonb_build_object('bookingNumber',v_booking_number));
  end loop;

  return jsonb_build_object(
    'outcome',case when v_any_waitlisted then 'WAITLISTED' else 'CREATED' end,
    'bookingCount',v_booking_count,'participantCount',v_total_participants,'bookings',v_results
  );
end;
$function$;

alter function app_private.notification_add_external_email(
  app_private.notification_events,text,text,text,text,jsonb,text,boolean
) rename to notification_add_external_email_before_m328_r1;

create function app_private.notification_add_external_email(
  p_event app_private.notification_events,
  p_email text,
  p_recipient_kind text,
  p_target_key text,
  p_template_key text,
  p_template_data jsonb,
  p_deep_link text default '',
  p_mandatory boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_data jsonb := coalesce(p_template_data,'{}'::jsonb);
  v_booking_id uuid;
  v_booking_number text;
begin
  begin
    v_booking_id := nullif(v_data ->> 'bookingId','')::uuid;
  exception when others then
    v_booking_id := null;
  end;

  if v_booking_id is not null then
    select booking.booking_number into v_booking_number
    from app_modules.fanbus_bookings as booking where booking.id=v_booking_id;
    if v_booking_number is not null then
      v_data := v_data || jsonb_build_object('bookingNumber',v_booking_number);
    end if;
  end if;

  perform app_private.notification_add_external_email_before_m328_r1(
    p_event,p_email,p_recipient_kind,p_target_key,p_template_key,v_data,p_deep_link,p_mandatory
  );
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_m328_r1_bookings;
create function app_private.pd_api_current_actions()
returns text[] language sql stable set search_path = '' as $function$
  select app_private.pd_api_current_actions_before_m328_r1_bookings()
    || array['fanbus_registration_create_manual_batches']::text[];
$function$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_m328_r1_bookings;
create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
begin
  if lower(btrim(coalesce(p_action,'')))='fanbus_registration_create_manual_batches' then
    return app_private.api_fanbus_registration_create_manual_batches(coalesce(p_payload,'{}'::jsonb));
  end if;
  return app_private.pd_api_dispatch_current_before_m328_r1_bookings(p_action,p_payload);
end;
$function$;

create function app_private.api_fanbus_booking_operator_update(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_booking_id uuid;
  v_trip_id uuid;
  v_items jsonb;
  v_item jsonb;
  v_id uuid;
  v_expected integer;
  v_row app_modules.fanbus_registrations%rowtype;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['bookingId','participants']
     or exists (select 1 from jsonb_object_keys(p_payload) k(key)
       where k.key <> all(array['bookingId','participants'])) then
    raise exception 'FANBUS_BOOKING_OPERATOR_UPDATE_INVALID_PAYLOAD' using errcode='22023';
  end if;
  v_booking_id := app_private.m325_parse_uuid(p_payload->>'bookingId','FANBUS_BOOKING_OPERATOR_UPDATE_INVALID_PAYLOAD');
  v_items := p_payload->'participants';
  if v_booking_id is null or jsonb_typeof(v_items) <> 'array'
     or jsonb_array_length(v_items) not between 1 and 20 then
    raise exception 'FANBUS_BOOKING_OPERATOR_UPDATE_INVALID_PAYLOAD' using errcode='22023';
  end if;
  select trip_id into v_trip_id from app_modules.fanbus_bookings where id=v_booking_id for update;
  if not found then raise exception 'FANBUS_BOOKING_NOT_FOUND' using errcode='P0002'; end if;

  for v_item in select value from jsonb_array_elements(v_items) with ordinality x(value,n) order by n loop
    if jsonb_typeof(v_item) <> 'object'
       or not v_item ?& array['id','expectedRevision','firstName','lastName','email','busPreference','tripBoardingStopId','operationalNote']
       or exists (select 1 from jsonb_object_keys(v_item) k(key)
         where k.key <> all(array['id','expectedRevision','firstName','lastName','email','busPreference','tripBoardingStopId','operationalNote'])) then
      raise exception 'FANBUS_BOOKING_OPERATOR_UPDATE_INVALID_PAYLOAD' using errcode='22023';
    end if;
    v_id := app_private.m325_parse_uuid(v_item->>'id','FANBUS_BOOKING_OPERATOR_UPDATE_INVALID_PAYLOAD');
    begin v_expected := (v_item->>'expectedRevision')::integer;
    exception when others then raise exception 'FANBUS_BOOKING_OPERATOR_UPDATE_INVALID_PAYLOAD' using errcode='22023'; end;
    select * into v_row from app_modules.fanbus_registrations
      where id=v_id and booking_id=v_booking_id and trip_id=v_trip_id for update;
    if not found then raise exception 'FANBUS_BOOKING_PARTICIPANT_NOT_FOUND' using errcode='P0002'; end if;
    if v_row.revision<>v_expected then raise exception 'STALE_REVISION' using errcode='40001'; end if;
    if v_row.status not in ('ACTIVE','WAITLISTED') then
      raise exception 'FANBUS_BOOKING_PARTICIPANT_NOT_EDITABLE' using errcode='22023';
    end if;
    perform app_private.api_fanbus_registration_update_m325(jsonb_build_object(
      'id',v_id,'expectedRevision',v_expected,
      'firstName',v_item->'firstName','lastName',v_item->'lastName','email',v_item->'email',
      'busPreference',v_item->'busPreference','tripBoardingStopId',v_item->'tripBoardingStopId',
      'operationalNote',v_item->'operationalNote'
    ));
  end loop;

  perform app_private.log_audit(v_actor,'FANBUS_BOOKING_OPERATOR_UPDATED','fanbus_booking',v_booking_id::text,null,null,
    jsonb_build_object('tripId',v_trip_id,'bookingId',v_booking_id,'participantCount',jsonb_array_length(v_items)));
  return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_trip_id));
end;
$function$;

create function app_private.api_fanbus_booking_operator_cancel(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_booking_id uuid;
  v_trip_id uuid;
  v_items jsonb;
  v_item jsonb;
  v_id uuid;
  v_expected integer;
  v_row app_modules.fanbus_registrations%rowtype;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['bookingId','participants']
     or exists (select 1 from jsonb_object_keys(p_payload) k(key)
       where k.key <> all(array['bookingId','participants'])) then
    raise exception 'FANBUS_BOOKING_OPERATOR_CANCEL_INVALID_PAYLOAD' using errcode='22023';
  end if;
  v_booking_id := app_private.m325_parse_uuid(p_payload->>'bookingId','FANBUS_BOOKING_OPERATOR_CANCEL_INVALID_PAYLOAD');
  v_items := p_payload->'participants';
  if v_booking_id is null or jsonb_typeof(v_items) <> 'array'
     or jsonb_array_length(v_items) not between 1 and 20 then
    raise exception 'FANBUS_BOOKING_OPERATOR_CANCEL_INVALID_PAYLOAD' using errcode='22023';
  end if;
  select trip_id into v_trip_id from app_modules.fanbus_bookings where id=v_booking_id for update;
  if not found then raise exception 'FANBUS_BOOKING_NOT_FOUND' using errcode='P0002'; end if;

  for v_item in select value from jsonb_array_elements(v_items) with ordinality x(value,n) order by n loop
    if jsonb_typeof(v_item) <> 'object'
       or not v_item ?& array['id','expectedRevision']
       or exists (select 1 from jsonb_object_keys(v_item) k(key)
         where k.key <> all(array['id','expectedRevision'])) then
      raise exception 'FANBUS_BOOKING_OPERATOR_CANCEL_INVALID_PAYLOAD' using errcode='22023';
    end if;
    v_id := app_private.m325_parse_uuid(v_item->>'id','FANBUS_BOOKING_OPERATOR_CANCEL_INVALID_PAYLOAD');
    begin v_expected := (v_item->>'expectedRevision')::integer;
    exception when others then raise exception 'FANBUS_BOOKING_OPERATOR_CANCEL_INVALID_PAYLOAD' using errcode='22023'; end;
    select * into v_row from app_modules.fanbus_registrations
      where id=v_id and booking_id=v_booking_id and trip_id=v_trip_id for update;
    if not found then raise exception 'FANBUS_BOOKING_PARTICIPANT_NOT_FOUND' using errcode='P0002'; end if;
    if v_row.revision<>v_expected then raise exception 'STALE_REVISION' using errcode='40001'; end if;
    if v_row.status not in ('ACTIVE','WAITLISTED') then
      raise exception 'FANBUS_PARTICIPANT_NOT_CANCELLABLE' using errcode='22023';
    end if;
    perform app_private.fanbus_participant_cancel_kernel(v_id,v_expected,v_actor,'FANBUS_PARTICIPANT_CANCELLED');
  end loop;

  perform app_private.log_audit(v_actor,'FANBUS_BOOKING_OPERATOR_CANCELLED','fanbus_booking',v_booking_id::text,null,null,
    jsonb_build_object('tripId',v_trip_id,'bookingId',v_booking_id,'participantCount',jsonb_array_length(v_items)));
  return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_trip_id));
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_m328_r1_booking_actions;
create function app_private.pd_api_current_actions()
returns text[] language sql stable set search_path = '' as $function$
  select app_private.pd_api_current_actions_before_m328_r1_booking_actions()
    || array['fanbus_booking_operator_update','fanbus_booking_operator_cancel']::text[];
$function$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_m328_r1_booking_actions;
create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
begin
  case lower(btrim(coalesce(p_action,'')))
    when 'fanbus_booking_operator_update' then
      return app_private.api_fanbus_booking_operator_update(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_booking_operator_cancel' then
      return app_private.api_fanbus_booking_operator_cancel(coalesce(p_payload,'{}'::jsonb));
    else
      return app_private.pd_api_dispatch_current_before_m328_r1_booking_actions(p_action,p_payload);
  end case;
end;
$function$;

revoke all on function
  app_private.api_fanbus_registrations_list_before_m328_r1(jsonb),
  app_private.api_fanbus_registrations_list(jsonb),
  app_private.api_fanbus_registration_create_manual_batches(jsonb),
  app_private.notification_add_external_email_before_m328_r1(
    app_private.notification_events,text,text,text,text,jsonb,text,boolean
  ),
  app_private.notification_add_external_email(
    app_private.notification_events,text,text,text,text,jsonb,text,boolean
  ),
  app_private.api_fanbus_booking_operator_update(jsonb),
  app_private.api_fanbus_booking_operator_cancel(jsonb),
  app_private.pd_api_current_actions_before_m328_r1_bookings(),
  app_private.pd_api_current_actions_before_m328_r1_booking_actions(),
  app_private.pd_api_current_actions(),
  app_private.pd_api_dispatch_current_before_m328_r1_bookings(text,jsonb),
  app_private.pd_api_dispatch_current_before_m328_r1_booking_actions(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.api_fanbus_registrations_list_before_m328_r1(jsonb),
  app_private.api_fanbus_registrations_list(jsonb),
  app_private.api_fanbus_registration_create_manual_batches(jsonb),
  app_private.notification_add_external_email_before_m328_r1(
    app_private.notification_events,text,text,text,text,jsonb,text,boolean
  ),
  app_private.notification_add_external_email(
    app_private.notification_events,text,text,text,text,jsonb,text,boolean
  ),
  app_private.api_fanbus_booking_operator_update(jsonb),
  app_private.api_fanbus_booking_operator_cancel(jsonb),
  app_private.pd_api_current_actions_before_m328_r1_bookings(),
  app_private.pd_api_current_actions_before_m328_r1_booking_actions(),
  app_private.pd_api_current_actions(),
  app_private.pd_api_dispatch_current_before_m328_r1_bookings(text,jsonb),
  app_private.pd_api_dispatch_current_before_m328_r1_booking_actions(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
to postgres;

commit;

-- M328-R1 – Stammfahrer reaktivieren
-- Derselbe DEV-Vertrag ist bereits als eigenständige Migration in DEV angewendet.
-- Für frische Umgebungen wird er in den bestehenden M328-R1-Migrationsvertrag gefaltet.

begin;

create function app_private.api_fanbus_regular_rider_activate(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_id uuid := app_private.m326_uuid(
    p_payload ->> 'id',
    'FANBUS_REGULAR_RIDER_INVALID_PAYLOAD'
  );
  v_expected integer;
  v_old app_modules.fanbus_regular_riders%rowtype;
begin
  begin
    v_expected := (p_payload ->> 'expectedRevision')::integer;
  exception when others then
    raise exception 'FANBUS_REGULAR_RIDER_INVALID_PAYLOAD' using errcode = '22023';
  end;

  if jsonb_typeof(p_payload) <> 'object'
     or v_id is null
     or v_expected is null
     or not p_payload ?& array['id','expectedRevision']
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as key(name)
       where key.name <> all(array['id','expectedRevision'])
     ) then
    raise exception 'FANBUS_REGULAR_RIDER_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  select * into v_old
  from app_modules.fanbus_regular_riders
  where id = v_id
  for update;

  if not found then
    raise exception 'FANBUS_REGULAR_RIDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_old.revision <> v_expected then
    raise exception 'STALE_REVISION' using errcode = '40001';
  end if;
  if v_old.is_active then
    return app_private.api_fanbus_regular_rider_detail(jsonb_build_object('id', v_id));
  end if;

  update app_modules.fanbus_regular_riders
  set
    is_active = true,
    revision = revision + 1,
    updated_by = v_actor
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_REGULAR_RIDER_ACTIVATED',
    'fanbus_regular_rider',
    v_id::text,
    jsonb_build_object('revision', v_old.revision, 'isActive', false),
    jsonb_build_object('revision', v_old.revision + 1, 'isActive', true),
    jsonb_build_object('regularRiderId', v_id)
  );

  return app_private.api_fanbus_regular_rider_detail(jsonb_build_object('id', v_id));
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_m328_r1_rider_reactivate;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_m328_r1_rider_reactivate()
    || array['fanbus_regular_rider_activate']::text[];
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_m328_r1_rider_reactivate;

create function app_private.pd_api_dispatch_current(p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if lower(btrim(coalesce(p_action, ''))) = 'fanbus_regular_rider_activate' then
    return app_private.api_fanbus_regular_rider_activate(coalesce(p_payload, '{}'::jsonb));
  end if;

  return app_private.pd_api_dispatch_current_before_m328_r1_rider_reactivate(
    p_action,
    p_payload
  );
end;
$function$;

revoke all on function
  app_private.api_fanbus_regular_rider_activate(jsonb),
  app_private.pd_api_current_actions_before_m328_r1_rider_reactivate(),
  app_private.pd_api_current_actions(),
  app_private.pd_api_dispatch_current_before_m328_r1_rider_reactivate(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.pd_api_current_actions_before_m328_r1_rider_reactivate(),
  app_private.pd_api_current_actions(),
  app_private.pd_api_dispatch_current_before_m328_r1_rider_reactivate(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

commit;