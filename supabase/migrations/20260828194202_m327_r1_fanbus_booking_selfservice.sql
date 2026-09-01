-- Plärrdeifl Digitalplattform V4
-- P300 / M327-R1 – Meine Fanbus-Buchungen / Portaluser-Selbstservice
-- Master D-076. Additive DEV migration; no PROD action is performed here.

begin;

-- One central, structured source for public BUS_ORGA contact data.
insert into app_portal.settings(key, value, description)
values (
  'fanbus.organization_contact',
  '{"emails":[],"phones":[]}'::jsonb,
  'Öffentliche BUS_ORGA-Kontaktdaten für Fanbus-Success, E-Mail und Selfservice.'
)
on conflict (key) do nothing;

create function app_private.fanbus_public_organization_contact()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with source as (
    select case when jsonb_typeof(setting.value) = 'object'
      then setting.value else '{}'::jsonb end as value
    from app_portal.settings as setting
    where setting.key = 'fanbus.organization_contact'
  ), normalized as (
    select
      coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'label', nullif(btrim(item.value ->> 'label'), ''),
          'value', btrim(item.value ->> 'value')
        )) order by item.ordinality)
        from source
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(source.value -> 'emails') = 'array'
            then source.value -> 'emails' else '[]'::jsonb end
        ) with ordinality as item(value, ordinality)
        where jsonb_typeof(item.value) = 'object'
          and app_private.notification_email_is_valid(item.value ->> 'value')
      ), '[]'::jsonb) as emails,
      coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'label', nullif(btrim(item.value ->> 'label'), ''),
          'value', btrim(item.value ->> 'value')
        )) order by item.ordinality)
        from source
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(source.value -> 'phones') = 'array'
            then source.value -> 'phones' else '[]'::jsonb end
        ) with ordinality as item(value, ordinality)
        where jsonb_typeof(item.value) = 'object'
          and length(btrim(coalesce(item.value ->> 'value', ''))) between 3 and 40
          and (item.value ->> 'value') !~ E'[\\r\\n]'
      ), '[]'::jsonb) as phones
  )
  select jsonb_build_object(
    'emails', coalesce(normalized.emails, '[]'::jsonb),
    'phones', coalesce(normalized.phones, '[]'::jsonb)
  )
  from normalized
  union all
  select '{"emails":[],"phones":[]}'::jsonb
  where not exists (select 1 from normalized)
  limit 1
$function$;

create function public.pd_public_fanbus_contact()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select app_private.fanbus_public_organization_contact()
$function$;

revoke all on function app_private.fanbus_public_organization_contact()
  from public, anon, authenticated, service_role;
grant execute on function app_private.fanbus_public_organization_contact() to postgres;
revoke all on function public.pd_public_fanbus_contact()
  from public, anon, authenticated, service_role;
grant execute on function public.pd_public_fanbus_contact() to anon, authenticated;

-- Shared server-authoritative selfservice guards.
create function app_private.fanbus_selfservice_until(p_departure_at timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $function$
  select p_departure_at - interval '72 hours'
$function$;

create function app_private.fanbus_assert_selfservice_mutable(
  p_trip app_modules.fanbus_trips
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  if p_trip.status <> 'PUBLISHED' then
    raise exception 'FANBUS_SELF_SERVICE_TRIP_READ_ONLY' using errcode = '55000';
  end if;
  if p_trip.departure_at is null
     or clock_timestamp() >= app_private.fanbus_selfservice_until(p_trip.departure_at) then
    raise exception 'FANBUS_SELF_SERVICE_CUTOFF_REACHED' using errcode = '55000';
  end if;
end;
$function$;

-- Capability-independent cancellation kernel shared by operator and selfservice
-- wrappers. It deliberately contains no waitlist promotion.
create function app_private.fanbus_participant_cancel_kernel(
  p_participant_id uuid,
  p_expected_revision integer,
  p_actor uuid,
  p_audit_action text
)
returns app_modules.fanbus_registrations
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing app_modules.fanbus_registrations%rowtype;
  v_assignment app_modules.fanbus_bus_assignments%rowtype;
  v_result app_modules.fanbus_registrations%rowtype;
begin
  select * into v_existing
  from app_modules.fanbus_registrations
  where id = p_participant_id
  for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if v_existing.revision <> p_expected_revision then
    raise exception 'STALE_REVISION' using errcode = '40001';
  end if;
  if v_existing.status not in ('ACTIVE','WAITLISTED') then
    raise exception 'FANBUS_PARTICIPANT_NOT_CANCELLABLE' using errcode = '22023';
  end if;

  delete from app_modules.fanbus_bus_assignments
  where participant_id = p_participant_id returning * into v_assignment;
  update app_modules.fanbus_registrations
  set status = 'CANCELLED', cancelled_at = clock_timestamp(),
      revision = revision + 1, updated_by = p_actor
  where id = p_participant_id
  returning * into v_result;

  if v_assignment.participant_id is not null then
    perform app_private.log_audit(
      p_actor, 'FANBUS_BUS_UNASSIGNED', 'fanbus_registration', p_participant_id::text,
      jsonb_build_object('busId',v_assignment.bus_id), null,
      jsonb_build_object('tripId',v_existing.trip_id,'bookingId',v_existing.booking_id,
        'participantId',p_participant_id,'busId',v_assignment.bus_id)
    );
  end if;
  perform app_private.log_audit(
    p_actor, p_audit_action, 'fanbus_registration', p_participant_id::text,
    jsonb_build_object('status',v_existing.status,'revision',v_existing.revision),
    jsonb_build_object('status','CANCELLED','revision',v_result.revision),
    jsonb_build_object('tripId',v_existing.trip_id,'bookingId',v_existing.booking_id,
      'participantId',p_participant_id,'source',v_existing.source)
  );
  return v_result;
end;
$function$;

alter function app_private.api_fanbus_registration_cancel(jsonb)
  rename to api_fanbus_registration_cancel_before_m327_r1;

create function app_private.api_fanbus_registration_cancel(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_id uuid;
  v_expected integer;
  v_trip_id uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['id','expectedRevision']
     or exists (select 1 from jsonb_object_keys(p_payload) as k(key)
       where k.key <> all(array['id','expectedRevision'])) then
    raise exception 'FANBUS_CANCELLATION_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  begin
    v_id := (p_payload ->> 'id')::uuid;
    v_expected := (p_payload ->> 'expectedRevision')::integer;
  exception when others then
    raise exception 'FANBUS_CANCELLATION_INVALID_PAYLOAD' using errcode = '22023';
  end;
  if v_expected is null or v_expected <= 0 then
    raise exception 'FANBUS_CANCELLATION_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  select trip_id into v_trip_id from app_modules.fanbus_registrations where id=v_id;
  if not found then raise exception 'Der Teilnehmer wurde nicht gefunden.' using errcode='P0002'; end if;
  perform app_private.m330_lock_mutable_fanbus_trip(v_trip_id);
  perform app_private.fanbus_participant_cancel_kernel(
    v_id,v_expected,v_actor,'FANBUS_PARTICIPANT_CANCELLED'
  );
  return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_trip_id));
end;
$function$;

create function app_private.api_fanbus_selfservice_participant_cancel(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_id uuid;
  v_expected integer;
  v_trip_id uuid;
  v_trip app_modules.fanbus_trips%rowtype;
  v_registration app_modules.fanbus_registrations%rowtype;
  v_booking app_modules.fanbus_bookings%rowtype;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['participantId','expectedRevision']
     or exists (select 1 from jsonb_object_keys(p_payload) as k(key)
       where k.key <> all(array['participantId','expectedRevision'])) then
    raise exception 'FANBUS_SELF_SERVICE_CANCEL_INVALID_PAYLOAD' using errcode='22023';
  end if;
  begin
    v_id := (p_payload ->> 'participantId')::uuid;
    v_expected := (p_payload ->> 'expectedRevision')::integer;
  exception when others then
    raise exception 'FANBUS_SELF_SERVICE_CANCEL_INVALID_PAYLOAD' using errcode='22023';
  end;
  if v_expected is null or v_expected <= 0 then
    raise exception 'FANBUS_SELF_SERVICE_CANCEL_INVALID_PAYLOAD' using errcode='22023';
  end if;
  select trip_id into v_trip_id from app_modules.fanbus_registrations where id=v_id;
  if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  select * into v_trip from app_modules.fanbus_trips where id=v_trip_id for update;
  select * into v_registration from app_modules.fanbus_registrations
    where id=v_id and trip_id=v_trip_id for update;
  select * into v_booking from app_modules.fanbus_bookings
    where id=v_registration.booking_id;
  if not app_private.fanbus_selfservice_owner(v_actor,v_registration,v_booking) then
    raise exception 'NOT_FOUND' using errcode='P0002';
  end if;
  perform app_private.fanbus_assert_selfservice_mutable(v_trip);
  perform app_private.fanbus_participant_cancel_kernel(
    v_id,v_expected,v_actor,'SELF_SERVICE_PARTICIPANT_CANCELLED'
  );
  return app_private.api_fanbus_my_bookings_list('{}'::jsonb);
end;
$function$;

-- Additive M020 expansion. Existing event semantics are delegated unchanged;
-- booking confirmation payloads are enriched from the central contact source.
alter function app_private.notification_expand_event(uuid)
  rename to notification_expand_event_before_m327_r1;
create function app_private.notification_expand_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $function$
declare
  e app_private.notification_events%rowtype;
  v_booking app_modules.fanbus_bookings%rowtype;
  v_trip app_modules.fanbus_trips%rowtype;
  v_title text; v_route text; v_data jsonb; v_user_id uuid;
  v_email text; v_email_enabled boolean := false;
begin
  select * into e from app_private.notification_events where id=p_event_id for update;
  if not found then raise exception 'M020_EVENT_NOT_FOUND' using errcode='P0002'; end if;
  if e.status in ('EXPANDED','COMPLETED','PARTIAL','SKIPPED') then return; end if;
  if e.notification_type <> 'FANBUS_BOOKING_EXTENDED' then
    perform app_private.notification_expand_event_before_m327_r1(p_event_id);
    if e.notification_type='FANBUS_BOOKING_CREATED' then
      update app_private.notification_outbox as outbox
      set payload=jsonb_set(outbox.payload,'{data,organizationContact}',
          app_private.fanbus_public_organization_contact(),true),
          updated_at=clock_timestamp()
      where outbox.event_id=p_event_id and outbox.channel='EMAIL'
        and outbox.payload->>'templateKey' in ('fanbus.booking.active','fanbus.booking.waitlisted');
    end if;
    return;
  end if;
  select * into v_booking from app_modules.fanbus_bookings where id::text=e.entity_id;
  if not found then
    update app_private.notification_events set status='SKIPPED',
      last_error_code='SOURCE_ENTITY_NOT_FOUND',updated_at=now() where id=e.id;
    return;
  end if;
  select * into v_trip from app_modules.fanbus_trips where id=v_booking.trip_id;
  select coalesce(event.title,'Fanbusfahrt') into v_title
  from app_modules.events as event where event.id=v_trip.event_id;
  v_route:='#/fanbuses?detail='||v_booking.trip_id::text;
  v_data:=jsonb_build_object('tripId',v_booking.trip_id,'bookingId',v_booking.id,
    'tripTitle',coalesce(v_title,'Fanbusfahrt'),
    'participantCount',coalesce((e.payload->>'participantCount')::integer,0),
    'status',coalesce(e.payload->>'status','ACTIVE'));
  select btrim(coalesce(setting.value#>>'{fanbusOrganization,email}','')),
    lower(coalesce(setting.value#>>'{fanbusOrganization,emailEnabled}','false'))='true'
  into v_email,v_email_enabled from app_portal.settings as setting
  where setting.key='notifications.m020';
  if v_email_enabled then
    perform app_private.notification_add_external_email(e,v_email,'FUNCTION',
      'function:fanbus-org:email','fanbus.internal_extended',v_data,v_route,false);
  end if;
  for v_user_id in select * from app_private.notification_config_user_ids(
    array['fanbusOrganization','userIds'])
  loop
    perform app_private.notification_add_user(e,v_user_id,'Fanbus – Buchung erweitert',
      (v_data->>'participantCount')||' Person(en) zu '||coalesce(v_title,'einer Fahrt')
        ||' hinzugefügt ('||(v_data->>'status')||').',
      'fanbus.internal_extended',v_data,v_route,false,true,true);
  end loop;
  update app_private.notification_events
  set status=case when exists(select 1 from app_private.notification_outbox o
        where o.event_id=e.id) then 'EXPANDED' else 'SKIPPED' end,
      expanded_at=coalesce(expanded_at,now()),
      last_error_code=case when exists(select 1 from app_private.notification_outbox o
        where o.event_id=e.id) then '' else 'NO_RECIPIENTS' end,updated_at=now()
  where id=e.id;
  if exists(select 1 from app_private.notification_outbox o where o.event_id=e.id) then
    perform app_private.notification_refresh_event_status(e.id);
  end if;
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_m327_r1;
create function app_private.pd_api_current_actions()
returns text[] language sql stable set search_path = '' as $function$
  select app_private.pd_api_current_actions_before_m327_r1() || array[
    'fanbus_my_bookings_list','fanbus_selfservice_participant_update',
    'fanbus_selfservice_participant_cancel','fanbus_selfservice_booking_append'
  ]::text[]
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_m327_r1;
create function app_private.platform_action_classification(p_action text)
returns text language sql stable set search_path = '' as $function$
  select case lower(btrim(coalesce(p_action,'')))
    when 'fanbus_my_bookings_list' then 'READ'
    when 'fanbus_selfservice_participant_update' then 'USER_MUTATION'
    when 'fanbus_selfservice_participant_cancel' then 'USER_MUTATION'
    when 'fanbus_selfservice_booking_append' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_m327_r1(p_action) end
$function$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_m327_r1;
create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_action text:=lower(btrim(coalesce(p_action,'')));
begin
  case v_action
    when 'fanbus_my_bookings_list' then
      return app_private.api_fanbus_my_bookings_list(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_selfservice_participant_update' then
      return app_private.api_fanbus_selfservice_participant_update(p_payload);
    when 'fanbus_selfservice_participant_cancel' then
      return app_private.api_fanbus_selfservice_participant_cancel(p_payload);
    when 'fanbus_selfservice_booking_append' then
      return app_private.api_fanbus_selfservice_booking_append(p_payload);
    else return app_private.pd_api_dispatch_current_before_m327_r1(p_action,p_payload);
  end case;
end;
$function$;

alter table app_private.fanbus_m325_idempotency
  add column operation text,
  add column actor_user_id uuid references app_portal.users(id) on delete set null,
  add column trip_id uuid references app_modules.fanbus_trips(id) on delete set null,
  add column booking_id uuid references app_modules.fanbus_bookings(id) on delete set null,
  add column response_payload jsonb;

create function app_private.api_fanbus_selfservice_booking_append(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_booking_id uuid;
  v_key uuid;
  v_trip_id uuid;
  v_trip app_modules.fanbus_trips%rowtype;
  v_booking app_modules.fanbus_bookings%rowtype;
  v_batch jsonb;
  v_item jsonb;
  v_canonical jsonb := '[]'::jsonb;
  v_hash_batch jsonb := '[]'::jsonb;
  v_context jsonb := '[]'::jsonb;
  v_hash text;
  v_existing app_private.fanbus_m325_idempotency%rowtype;
  v_template_id uuid;
  v_stop_id uuid;
  v_member app_modules.fanbus_companion_list_members%rowtype;
  v_linked uuid;
  v_member_id uuid;
  v_first text;
  v_last text;
  v_email text;
  v_preference text;
  v_sequence integer;
  v_batch_size integer;
  v_status text;
  v_waitlisted_at timestamptz;
  v_privacy text;
  v_terms text;
  v_inserted jsonb := '[]'::jsonb;
  v_registration app_modules.fanbus_registrations%rowtype;
  v_active_count integer;
  v_event_id uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['bookingId','idempotencyKey','participants']
     or exists (select 1 from jsonb_object_keys(p_payload) as k(key)
       where k.key <> all(array['bookingId','idempotencyKey','participants']))
     or jsonb_typeof(p_payload -> 'participants') <> 'array'
     or jsonb_array_length(p_payload -> 'participants') not between 1 and 19 then
    raise exception 'FANBUS_SELF_SERVICE_APPEND_INVALID_PAYLOAD' using errcode='22023';
  end if;
  begin
    v_booking_id := (p_payload ->> 'bookingId')::uuid;
    v_key := (p_payload ->> 'idempotencyKey')::uuid;
  exception when others then
    raise exception 'FANBUS_SELF_SERVICE_APPEND_INVALID_PAYLOAD' using errcode='22023';
  end;
  v_batch := p_payload -> 'participants';
  v_batch_size := jsonb_array_length(v_batch);
  select trip_id into v_trip_id from app_modules.fanbus_bookings where id=v_booking_id;
  if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;

  -- Canonical order: trip, then booking, then participant/identity resources.
  select * into v_trip from app_modules.fanbus_trips where id=v_trip_id for update;
  select * into v_booking from app_modules.fanbus_bookings
    where id=v_booking_id and trip_id=v_trip_id for update;
  if not found or v_booking.source <> 'PORTAL' or v_booking.created_by <> v_actor then
    raise exception 'NOT_FOUND' using errcode='P0002';
  end if;
  perform app_private.fanbus_assert_selfservice_mutable(v_trip);

  select coalesce(max(participant_sequence),0) into v_sequence
  from app_modules.fanbus_registrations where booking_id=v_booking_id;
  select privacy_reference,terms_reference into v_privacy,v_terms
  from app_modules.fanbus_registrations where booking_id=v_booking_id
  order by participant_sequence,id limit 1;

  for v_item in select value from jsonb_array_elements(v_batch)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or exists (select 1 from jsonb_object_keys(v_item) as k(key)
         where k.key <> all(array[
           'templateMemberId','firstName','lastName','email',
           'tripBoardingStopId','busPreference'
         ])) then
      raise exception 'FANBUS_SELF_SERVICE_APPEND_INVALID_PAYLOAD' using errcode='22023';
    end if;
    begin
      v_template_id := nullif(btrim(coalesce(v_item->>'templateMemberId','')),'')::uuid;
      v_stop_id := nullif(btrim(coalesce(v_item->>'tripBoardingStopId','')),'')::uuid;
    exception when others then
      raise exception 'FANBUS_SELF_SERVICE_APPEND_INVALID_PAYLOAD' using errcode='22023';
    end;
    v_sequence := v_sequence + 1;
    v_linked := null; v_member_id := null; v_member := null;
    v_email := nullif(lower(btrim(coalesce(v_item->>'email',''))),'');
    v_preference := upper(btrim(coalesce(v_item->>'busPreference','EGAL')));
    if v_preference not in ('EGAL','RUHIG','PARTY') then
      raise exception 'FANBUS_BUS_PREFERENCE_INVALID' using errcode='22023';
    end if;

    if v_template_id is not null then
      select companion.* into v_member
      from app_modules.fanbus_companion_list_members as companion
      join app_modules.fanbus_companion_lists as list on list.id=companion.list_id
      where companion.id=v_template_id and list.owner_user_id=v_actor
      for update of companion;
      if not found then raise exception 'FANBUS_COMPANION_MEMBER_UNAVAILABLE' using errcode='P0002'; end if;
      v_linked := v_member.linked_portal_user_id;
      if v_linked is not null then
        select btrim(portal_user.first_name),btrim(portal_user.last_name)
          into v_first,v_last
        from app_portal.users as portal_user
        where portal_user.id=v_linked and portal_user.status='ACTIVE'
        for share;
        if not found then raise exception 'FANBUS_PORTAL_USER_UNAVAILABLE' using errcode='22023'; end if;
        select link.member_id into v_member_id
        from app_portal.user_member_links as link
        join app_fanclub.members as member on member.id=link.member_id and member.status='ACTIVE'
        where link.user_id=v_linked;
        v_email := null;
      else
        v_first := btrim(v_member.first_name);
        v_last := btrim(v_member.last_name);
      end if;
      if not (v_item ? 'busPreference') then v_preference:=v_member.default_bus_preference; end if;
    else
      v_first := btrim(coalesce(v_item->>'firstName',''));
      v_last := btrim(coalesce(v_item->>'lastName',''));
      if length(v_first) not between 1 and 160 or length(v_last) not between 1 and 160
         or (v_email is not null and not app_private.notification_email_is_valid(v_email)) then
        raise exception 'FANBUS_SELF_SERVICE_APPEND_INVALID_PAYLOAD' using errcode='22023';
      end if;
    end if;

    if exists (
      select 1 from jsonb_array_elements(v_canonical) as previous(value)
      where (v_linked is not null and previous.value->>'portalUserId'=v_linked::text)
         or (v_member_id is not null and previous.value->>'memberId'=v_member_id::text)
         or (v_template_id is not null and previous.value->>'templateMemberId'=v_template_id::text)
         or (v_linked is null and v_member_id is null
           and lower(previous.value->>'firstName')=lower(v_first)
           and lower(previous.value->>'lastName')=lower(v_last))
    ) then
      raise exception 'FANBUS_COMPANION_CONFLICT' using errcode='P3251';
    end if;

    v_canonical := v_canonical || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'sequence',v_sequence,'templateMemberId',v_template_id,'portalUserId',v_linked,
      'memberId',v_member_id,'firstName',v_first,'lastName',v_last,'email',v_email,
      'tripBoardingStopId',v_stop_id,'busPreference',v_preference
    )));
    v_hash_batch := v_hash_batch || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'templateMemberId',v_template_id,'portalUserId',v_linked,'memberId',v_member_id,
      'firstName',v_first,'lastName',v_last,'email',v_email,
      'tripBoardingStopId',v_stop_id,'busPreference',v_preference
    )));
    v_context := v_context || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'sequence',v_sequence,'templateMemberId',v_template_id,
      'linkedPortalUserId',v_linked,'boardingStopId',v_stop_id
    )));
  end loop;

  -- The hash is based on the resolved canonical participant batch, but not on
  -- assigned sequence numbers so a successful retry stays stable.
  v_hash := encode(extensions.digest(jsonb_build_object(
    'operation','APPEND','actor',v_actor,'booking',v_booking_id,'trip',v_trip_id,
    'participants',v_hash_batch,'contractVersion','M327-R1-D076'
  )::text,'sha256'),'hex');
  perform pg_advisory_xact_lock((
    'x'||substr(encode(extensions.digest('M327-APPEND:'||v_key::text,'sha256'),'hex'),1,16)
  )::bit(64)::bigint);
  select * into v_existing from app_private.fanbus_m325_idempotency
    where idempotency_key=v_key for update;
  if found then
    if v_existing.request_hash<>v_hash or v_existing.operation is distinct from 'APPEND'
       or v_existing.actor_user_id is distinct from v_actor
       or v_existing.trip_id is distinct from v_trip_id
       or v_existing.booking_id is distinct from v_booking_id then
      raise exception 'FANBUS_IDEMPOTENCY_KEY_REUSED' using errcode='22023';
    end if;
    if v_existing.response_payload is not null then return v_existing.response_payload; end if;
  else
    if exists(select 1 from app_private.fanbus_registration_idempotency
      where idempotency_key=v_key) then
      raise exception 'FANBUS_IDEMPOTENCY_KEY_REUSED' using errcode='22023';
    end if;
    insert into app_private.fanbus_m325_idempotency(
      idempotency_key,request_hash,operation,actor_user_id,trip_id,booking_id
    ) values(v_key,v_hash,'APPEND',v_actor,v_trip_id,v_booking_id);
  end if;

  for v_item in select value from jsonb_array_elements(v_canonical)
  loop
    if app_private.m325_companion_conflict_status(
      v_trip_id,
      nullif(v_item->>'templateMemberId','')::uuid,
      nullif(v_item->>'portalUserId','')::uuid,
      nullif(v_item->>'memberId','')::uuid,
      v_item->>'firstName',v_item->>'lastName'
    ) is not null then
      raise exception 'FANBUS_COMPANION_CONFLICT' using errcode='P3251';
    end if;
  end loop;

  select count(*) into v_active_count from app_modules.fanbus_registrations
    where trip_id=v_trip_id and status='ACTIVE';
  if exists(select 1 from app_modules.fanbus_registrations
      where trip_id=v_trip_id and status='WAITLISTED')
     or v_active_count+v_batch_size>app_private.fanbus_effective_capacity(v_trip_id) then
    v_status:='WAITLISTED'; v_waitlisted_at:=clock_timestamp();
  else
    v_status:='ACTIVE'; v_waitlisted_at:=null;
  end if;

  perform set_config('app.m325_registration_context',v_context::text,true);
  for v_item in select value from jsonb_array_elements(v_canonical)
  loop
    insert into app_modules.fanbus_registrations(
      trip_id,portal_user_id,member_id,first_name,last_name,email,bus_preference,
      status,privacy_reference,terms_reference,privacy_accepted_at,terms_accepted_at,
      source,created_by,updated_by,booking_id,booking_role,participant_sequence,
      waitlisted_at,companion_list_member_id,trip_boarding_stop_id
    ) values(
      v_trip_id,nullif(v_item->>'portalUserId','')::uuid,nullif(v_item->>'memberId','')::uuid,
      v_item->>'firstName',v_item->>'lastName',nullif(v_item->>'email',''),
      v_item->>'busPreference',v_status,v_privacy,v_terms,clock_timestamp(),clock_timestamp(),
      'PORTAL',v_actor,v_actor,v_booking_id,'COMPANION',(v_item->>'sequence')::integer,
      v_waitlisted_at,nullif(v_item->>'templateMemberId','')::uuid,
      nullif(v_item->>'tripBoardingStopId','')::uuid
    ) returning * into v_registration;
    v_inserted:=v_inserted||jsonb_build_array(jsonb_build_object(
      'participantId',v_registration.id,'participantSequence',v_registration.participant_sequence,
      'status',v_registration.status,'revision',v_registration.revision
    ));
    perform app_private.log_audit(
      v_actor,'SELF_SERVICE_PARTICIPANT_ADDED','fanbus_registration',v_registration.id::text,
      null,jsonb_build_object('status',v_registration.status,'revision',v_registration.revision),
      jsonb_build_object('tripId',v_trip_id,'bookingId',v_booking_id,
        'participantId',v_registration.id,'participantSequence',v_registration.participant_sequence)
    );
  end loop;
  perform set_config('app.m325_registration_context','[]',true);

  v_event_id:=app_private.notification_event_enqueue(
    'FANBUS_BOOKING_EXTENDED','FANBUS',
    'fanbus-booking-extended:'||v_booking_id::text||':'||v_key::text,
    'M327','fanbus_booking',v_booking_id::text,v_actor,
    jsonb_build_object('tripId',v_trip_id,'bookingId',v_booking_id,
      'participantCount',v_batch_size,'status',v_status),clock_timestamp()
  );
  perform app_private.notification_expand_event(v_event_id);

  v_existing.response_payload:=jsonb_build_object(
    'bookingId',v_booking_id,'tripId',v_trip_id,'participantCount',v_batch_size,
    'status',v_status,'participants',v_inserted
  );
  update app_private.fanbus_m325_idempotency
  set response_payload=v_existing.response_payload where idempotency_key=v_key;
  return v_existing.response_payload;
end;
$function$;

create function app_private.fanbus_selfservice_owner(
  p_actor uuid,
  p_registration app_modules.fanbus_registrations,
  p_booking app_modules.fanbus_bookings
)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select coalesce(
    (p_booking.source = 'PORTAL' and p_booking.created_by = p_actor)
    or p_registration.portal_user_id = p_actor,
    false
  )
$function$;

-- Privacy-minimised read model. Creator sees the necessary booking detail;
-- non-creators see full self detail and only name/status for other people.
create function app_private.api_fanbus_my_bookings_list(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or p_payload <> '{}'::jsonb then
    raise exception 'FANBUS_MY_BOOKINGS_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'serverNow', clock_timestamp(),
    'organizationContact', app_private.fanbus_public_organization_contact(),
    'bookings', coalesce((
      with owned_bookings as (
        select booking.*,
          (booking.source = 'PORTAL' and booking.created_by = v_actor) as is_creator
        from app_modules.fanbus_bookings as booking
        where (booking.source = 'PORTAL' and booking.created_by = v_actor)
           or exists (
             select 1 from app_modules.fanbus_registrations as own
             where own.booking_id = booking.id and own.portal_user_id = v_actor
           )
      )
      select jsonb_agg(jsonb_build_object(
        'bookingId', booking.id,
        'tripId', trip.id,
        'isCreator', booking.is_creator,
        'source', booking.source,
        'trip', jsonb_build_object(
          'title', coalesce(
            nullif(btrim(game.opponent_name), ''),
            nullif(btrim(event.title), ''),
            'Fanbusfahrt'
          ),
          'eventDate', event.event_date,
          'eventTime', event.event_time,
          'departureAt', trip.departure_at,
          'departureInfo', trip.departure_info,
          'status', trip.status,
          'selfServiceUntil', app_private.fanbus_selfservice_until(trip.departure_at),
          'canMutate', trip.status = 'PUBLISHED'
            and trip.departure_at is not null
            and clock_timestamp() < app_private.fanbus_selfservice_until(trip.departure_at),
          'readOnlyReason', case
            when trip.status = 'DRAFT' then 'DRAFT'
            when trip.status = 'CLOSED' then 'CLOSED'
            when trip.status = 'CANCELLED' then 'CANCELLED'
            when trip.departure_at is null
              or clock_timestamp() >= app_private.fanbus_selfservice_until(trip.departure_at)
              then 'CUTOFF'
            else null end,
          'boardingStops', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', trip_stop.id,
              'label', stop.label,
              'departureAt', trip_stop.departure_at
            ) order by trip_stop.position, trip_stop.id)
            from app_modules.fanbus_trip_boarding_stops as trip_stop
            join app_modules.fanbus_boarding_stops as stop
              on stop.id = trip_stop.boarding_stop_id
            where trip_stop.trip_id = trip.id and trip_stop.is_active
          ), '[]'::jsonb),
          'allowedBusPreferences', app_private.fanbus_allowed_bus_preferences(trip.id)
        ),
        'participants', coalesce((
          select jsonb_agg(
            case
              when booking.is_creator or registration.portal_user_id = v_actor then
                jsonb_build_object(
                  'id', registration.id,
                  'revision', registration.revision,
                  'isSelf', registration.portal_user_id = v_actor,
                  'firstName', registration.first_name,
                  'lastName', registration.last_name,
                  'status', registration.status,
                  'bookingRole', registration.booking_role,
                  'participantSequence', registration.participant_sequence,
                  'tripBoardingStopId', registration.trip_boarding_stop_id,
                  'boardingStopLabel', boarding_stop.label,
                  'busPreference', registration.bus_preference,
                  'assignedBusLabel', bus.label,
                  'waitlistPosition', case when registration.status = 'WAITLISTED' then (
                    select count(*)::integer
                    from app_modules.fanbus_registrations as waiting
                    where waiting.trip_id = registration.trip_id
                      and waiting.status = 'WAITLISTED'
                      and (waiting.waitlisted_at, waiting.participant_sequence, waiting.id)
                        <= (registration.waitlisted_at, registration.participant_sequence, registration.id)
                  ) end
                )
              else jsonb_build_object(
                'id', registration.id,
                'revision', registration.revision,
                'isSelf', false,
                'firstName', registration.first_name,
                'lastName', registration.last_name,
                'status', registration.status,
                'redacted', true
              )
            end
            order by registration.participant_sequence, registration.id
          )
          from app_modules.fanbus_registrations as registration
          left join app_modules.fanbus_trip_boarding_stops as trip_stop
            on trip_stop.id = registration.trip_boarding_stop_id
          left join app_modules.fanbus_boarding_stops as boarding_stop
            on boarding_stop.id = trip_stop.boarding_stop_id
          left join app_modules.fanbus_bus_assignments as assignment
            on assignment.participant_id = registration.id
          left join app_modules.fanbus_buses as bus on bus.id = assignment.bus_id
          where registration.booking_id = booking.id
        ), '[]'::jsonb)
      ) order by trip.departure_at desc nulls last, booking.created_at desc)
      from owned_bookings as booking
      join app_modules.fanbus_trips as trip on trip.id = booking.trip_id
      join app_modules.events as event on event.id = trip.event_id
      left join app_modules.event_games as game on game.event_id = event.id
    ), '[]'::jsonb)
  );
end;
$function$;

create function app_private.api_fanbus_selfservice_participant_update(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_id uuid;
  v_expected integer;
  v_trip_id uuid;
  v_stop uuid;
  v_preference text;
  v_trip app_modules.fanbus_trips%rowtype;
  v_registration app_modules.fanbus_registrations%rowtype;
  v_booking app_modules.fanbus_bookings%rowtype;
  v_assignment app_modules.fanbus_bus_assignments%rowtype;
  v_before jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['participantId','expectedRevision']
     or exists (select 1 from jsonb_object_keys(p_payload) as k(key)
       where k.key <> all(array[
         'participantId','expectedRevision','tripBoardingStopId','busPreference'
       ]))
     or not (p_payload ? 'tripBoardingStopId' or p_payload ? 'busPreference') then
    raise exception 'FANBUS_SELF_SERVICE_UPDATE_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  begin
    v_id := (p_payload ->> 'participantId')::uuid;
    v_expected := (p_payload ->> 'expectedRevision')::integer;
    if p_payload ? 'tripBoardingStopId' then
      v_stop := (p_payload ->> 'tripBoardingStopId')::uuid;
    end if;
  exception when others then
    raise exception 'FANBUS_SELF_SERVICE_UPDATE_INVALID_PAYLOAD' using errcode = '22023';
  end;
  if v_expected is null or v_expected <= 0 then
    raise exception 'FANBUS_SELF_SERVICE_UPDATE_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  if p_payload ? 'busPreference' then
    v_preference := upper(btrim(coalesce(p_payload ->> 'busPreference', '')));
    if v_preference not in ('EGAL','RUHIG','PARTY') then
      raise exception 'FANBUS_BUS_PREFERENCE_INVALID' using errcode = '22023';
    end if;
  end if;

  select registration.trip_id into v_trip_id
  from app_modules.fanbus_registrations as registration where registration.id = v_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  select * into v_trip from app_modules.fanbus_trips where id = v_trip_id for update;
  select * into v_registration
  from app_modules.fanbus_registrations where id = v_id and trip_id = v_trip_id for update;
  select * into v_booking
  from app_modules.fanbus_bookings where id = v_registration.booking_id;
  if not app_private.fanbus_selfservice_owner(v_actor, v_registration, v_booking) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_registration.status not in ('ACTIVE','WAITLISTED') then
    raise exception 'FANBUS_PARTICIPANT_NOT_MUTABLE' using errcode = '55000';
  end if;
  perform app_private.fanbus_assert_selfservice_mutable(v_trip);
  if v_registration.revision <> v_expected then
    raise exception 'STALE_REVISION' using errcode = '40001';
  end if;

  if p_payload ? 'tripBoardingStopId' then
    if not exists (select 1 from app_modules.fanbus_trip_boarding_stops as stop
      where stop.id = v_stop and stop.trip_id = v_trip_id and stop.is_active) then
      raise exception 'FANBUS_BOARDING_STOP_UNAVAILABLE' using errcode = '22023';
    end if;
    select * into v_assignment from app_modules.fanbus_bus_assignments
    where participant_id = v_id;
    if found and not exists (
      select 1 from app_modules.fanbus_bus_boarding_stops as mapping
      where mapping.trip_id = v_trip_id and mapping.bus_id = v_assignment.bus_id
        and mapping.trip_boarding_stop_id = v_stop
    ) then
      raise exception 'FANBUS_SELF_SERVICE_STOP_INCOMPATIBLE_CONTACT_BUS_ORGA'
        using errcode = '22023';
    end if;
  end if;
  if p_payload ? 'busPreference'
     and not app_private.fanbus_bus_preference_selection_enabled(v_trip_id)
     and v_preference <> 'EGAL' then
    raise exception 'FANBUS_BUS_PREFERENCE_UNAVAILABLE' using errcode = '22023';
  end if;

  v_before := jsonb_build_object(
    'tripBoardingStopId', v_registration.trip_boarding_stop_id,
    'busPreference', v_registration.bus_preference,
    'revision', v_registration.revision
  );
  update app_modules.fanbus_registrations
  set trip_boarding_stop_id = case when p_payload ? 'tripBoardingStopId'
        then v_stop else trip_boarding_stop_id end,
      bus_preference = case when p_payload ? 'busPreference'
        then v_preference else bus_preference end,
      revision = revision + 1,
      updated_by = v_actor
  where id = v_id;

  perform app_private.log_audit(
    v_actor, 'SELF_SERVICE_PARTICIPANT_UPDATED', 'fanbus_registration', v_id::text,
    v_before,
    jsonb_build_object(
      'tripBoardingStopId', case when p_payload ? 'tripBoardingStopId'
        then v_stop else v_registration.trip_boarding_stop_id end,
      'busPreference', case when p_payload ? 'busPreference'
        then v_preference else v_registration.bus_preference end,
      'revision', v_registration.revision + 1
    ),
    jsonb_build_object('tripId',v_trip_id,'bookingId',v_registration.booking_id,
      'participantId',v_id,'assignmentPreserved',v_assignment.participant_id is not null)
  );
  return app_private.api_fanbus_my_bookings_list('{}'::jsonb);
end;
$function$;

-- Preserve the accepted M320-R3 contract when BUS_ORGA explicitly confirms
-- an existing AUTO assignment without changing the concrete bus.
alter function app_private.api_fanbus_bus_assignment_set_before_m330_r1(jsonb)
  rename to api_fanbus_bus_assignment_set_before_m330_r1_before_m327_r1;
create function app_private.api_fanbus_bus_assignment_set_before_m330_r1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_participant_id uuid;
  v_bus_id uuid;
  v_trip_id uuid;
  v_booking_id uuid;
  v_result jsonb;
begin
  v_result := app_private.api_fanbus_bus_assignment_set_before_m330_r1_before_m327_r1(
    p_payload
  );
  begin
    v_participant_id := (p_payload ->> 'participantId')::uuid;
    v_bus_id := nullif(btrim(coalesce(p_payload ->> 'busId', '')), '')::uuid;
  exception when others then
    return v_result;
  end;
  if v_bus_id is null then return v_result; end if;

  update app_modules.fanbus_bus_assignments as assignment
  set assignment_source = 'MANUAL',
      revision = assignment.revision + 1,
      updated_by = v_actor
  where assignment.participant_id = v_participant_id
    and assignment.bus_id = v_bus_id
    and assignment.assignment_source = 'AUTO'
  returning assignment.trip_id into v_trip_id;
  if not found then return v_result; end if;

  select registration.booking_id into v_booking_id
  from app_modules.fanbus_registrations as registration
  where registration.id = v_participant_id;
  perform app_private.log_audit(
    v_actor, 'FANBUS_BUS_CHANGED', 'fanbus_registration', v_participant_id::text,
    jsonb_build_object('busId', v_bus_id, 'assignmentSource', 'AUTO'),
    jsonb_build_object('busId', v_bus_id, 'assignmentSource', 'MANUAL'),
    jsonb_build_object(
      'tripId', v_trip_id, 'bookingId', v_booking_id,
      'participantId', v_participant_id, 'busId', v_bus_id,
      'assignmentSource', 'MANUAL'
    )
  );
  return app_private.api_fanbus_registrations_list(
    jsonb_build_object('tripId', v_trip_id)
  );
end;
$function$;

-- M327 re-consolidates the active M900 dispatcher after the accepted
-- M326/M320 overlays and adds the D-076 actions as direct current calls.
create or replace function app_private.pd_api_dispatch_current(
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_data jsonb;
  v_trip_id uuid;
begin
  -- This compatibility alias has always been case-sensitive and is not an
  -- additional normalized action.
  if p_action = 'saveDashboardPreferences' then
    return app_private.api_save_dashboard_preferences(v_payload);
  end if;

  -- Preserve dashboard widget enrichment and its exact spelling condition.
  if v_action = 'dashboard' then
    v_data := app_private.api_dashboard();
    if p_action = 'dashboard' then
      v_data := pg_catalog.jsonb_set(
        v_data,
        '{preferences}',
        app_private.api_dashboard_preferences(),
        true
      );
    end if;
    return v_data;
  end if;

  -- Preserve the authenticated portal projection over the reviewed public
  -- boarding-stop RPC without routing through the P800/M330 wrappers.
  if v_action = 'fanbus_trip_boarding_stops_public' then
    perform app_private.require_active_user();
    begin
      v_trip_id := nullif(
        pg_catalog.btrim(coalesce(v_payload ->> 'tripId', '')),
        ''
      )::uuid;
    exception when others then
      raise exception 'FANBUS_TRIP_BOARDING_STOP_INVALID_PAYLOAD'
        using errcode = '22023';
    end;
    if v_trip_id is null then
      raise exception 'FANBUS_TRIP_BOARDING_STOP_INVALID_PAYLOAD'
        using errcode = '22023';
    end if;
    return public.pd_public_fanbus_trip_boarding_stops(v_trip_id);
  end if;

  case v_action
    when 'admin_snapshot' then
      return app_private.api_admin_snapshot();
    when 'approve_request' then
      return app_private.api_approve_request(v_payload);
    when 'archive_task' then
      return app_private.api_archive_task(v_payload);
    when 'bootstrap' then
      return app_private.api_bootstrap();
    when 'claim_initial_admin' then
      return app_private.api_claim_initial_admin(v_payload);
    when 'create_finance_entry' then
      return app_private.api_create_finance_entry(v_payload);
    when 'create_push_test' then
      return app_private.api_create_push_test();
    when 'delete_archived_task' then
      return app_private.api_delete_archived_task(v_payload);
    when 'delete_contribution_class' then
      return app_private.api_delete_contribution_class(v_payload);
    when 'delete_contribution_season' then
      return app_private.api_delete_contribution_season(v_payload);
    when 'delete_finance_account' then
      return app_private.api_delete_finance_account(v_payload);
    when 'delete_role' then
      return app_private.api_delete_role(v_payload);
    when 'delete_team' then
      return app_private.api_delete_team(v_payload);
    when 'event_create' then
      return app_private.api_event_create(v_payload);
    when 'event_delete' then
      return app_private.api_event_delete(v_payload);
    when 'event_update' then
      return app_private.api_event_update(v_payload);
    when 'events_list' then
      return app_private.api_events_list();
    when 'fanbus_available_events' then
      return app_private.api_fanbus_available_events();
    when 'fanbus_boarding_stop_upsert' then
      return app_private.api_fanbus_boarding_stop_upsert(v_payload);
    when 'fanbus_boarding_stops_list' then
      return app_private.api_fanbus_boarding_stops_list();
    when 'fanbus_boarding_stops_reorder' then
      return app_private.api_fanbus_boarding_stops_reorder(v_payload);
    when 'fanbus_bus_assignment_set' then
      return app_private.api_fanbus_bus_assignment_set(v_payload);
    when 'fanbus_bus_boarding_stops_list' then
      return app_private.api_fanbus_bus_boarding_stops_list(v_payload);
    when 'fanbus_bus_boarding_stops_set' then
      return app_private.api_fanbus_bus_boarding_stops_set(v_payload);
    when 'fanbus_bus_upsert' then
      return app_private.api_fanbus_bus_upsert(v_payload);
    when 'fanbus_buses_list' then
      return app_private.api_fanbus_buses_list(v_payload);
    when 'fanbus_checkin_set' then
      return app_private.api_fanbus_checkin_set(v_payload);
    when 'fanbus_companion_booking_submit' then
      return app_private.api_fanbus_companion_booking_submit(v_payload);
    when 'fanbus_companion_duplicate_preview' then
      return app_private.api_fanbus_companion_duplicate_preview(v_payload);
    when 'fanbus_companion_list_delete' then
      return app_private.api_fanbus_companion_list_delete(v_payload);
    when 'fanbus_companion_list_upsert' then
      return app_private.api_fanbus_companion_list_upsert(v_payload);
    when 'fanbus_companion_lists_list' then
      return app_private.api_fanbus_companion_lists_list();
    when 'fanbus_companion_member_delete' then
      return app_private.api_fanbus_companion_member_delete(v_payload);
    when 'fanbus_companion_member_upsert' then
      return app_private.api_fanbus_companion_member_upsert(v_payload);
    when 'fanbus_companion_members_reorder' then
      return app_private.api_fanbus_companion_members_reorder(v_payload);
    when 'fanbus_companion_person_link' then
      return app_private.api_fanbus_companion_person_link(v_payload);
    when 'fanbus_companion_person_search' then
      return app_private.api_fanbus_companion_person_search(v_payload);
    when 'fanbus_companion_person_unlink' then
      return app_private.api_fanbus_companion_person_unlink(v_payload);
    when 'fanbus_operations_snapshot' then
      return app_private.api_fanbus_operations_snapshot(v_payload);
    when 'fanbus_assignment_apply' then
      return app_private.api_fanbus_assignment_apply(v_payload);
    when 'fanbus_assignment_preview' then
      return app_private.api_fanbus_assignment_preview(v_payload);
    when 'fanbus_my_bookings_list' then
      return app_private.api_fanbus_my_bookings_list(v_payload);
    when 'fanbus_person_group_create' then
      return app_private.api_fanbus_person_group_create(v_payload);
    when 'fanbus_person_group_deactivate' then
      return app_private.api_fanbus_person_group_deactivate(v_payload);
    when 'fanbus_person_group_detail' then
      return app_private.api_fanbus_person_group_detail(v_payload);
    when 'fanbus_person_group_members_replace' then
      return app_private.api_fanbus_person_group_members_replace(v_payload);
    when 'fanbus_person_group_resolve' then
      return app_private.api_fanbus_person_group_resolve(v_payload);
    when 'fanbus_person_group_update' then
      return app_private.api_fanbus_person_group_update(v_payload);
    when 'fanbus_person_groups_list' then
      return app_private.api_fanbus_person_groups_list(v_payload);
    when 'fanbus_registration_create_manual_bulk' then
      return app_private.api_fanbus_registration_create_manual_bulk(v_payload);
    when 'fanbus_regular_rider_create' then
      return app_private.api_fanbus_regular_rider_create(v_payload);
    when 'fanbus_regular_rider_deactivate' then
      return app_private.api_fanbus_regular_rider_deactivate(v_payload);
    when 'fanbus_regular_rider_detail' then
      return app_private.api_fanbus_regular_rider_detail(v_payload);
    when 'fanbus_regular_rider_link' then
      return app_private.api_fanbus_regular_rider_link(v_payload);
    when 'fanbus_regular_rider_relink' then
      return app_private.api_fanbus_regular_rider_relink(v_payload);
    when 'fanbus_regular_rider_unlink' then
      return app_private.api_fanbus_regular_rider_unlink(v_payload);
    when 'fanbus_regular_rider_update' then
      return app_private.api_fanbus_regular_rider_update(v_payload);
    when 'fanbus_regular_riders_list' then
      return app_private.api_fanbus_regular_riders_list(v_payload);
    when 'fanbus_selfservice_booking_append' then
      return app_private.api_fanbus_selfservice_booking_append(v_payload);
    when 'fanbus_selfservice_participant_cancel' then
      return app_private.api_fanbus_selfservice_participant_cancel(v_payload);
    when 'fanbus_selfservice_participant_update' then
      return app_private.api_fanbus_selfservice_participant_update(v_payload);
    when 'fanbus_paid_set' then
      return app_private.api_fanbus_paid_set(v_payload);
    when 'fanbus_registration_cancel' then
      return app_private.api_fanbus_registration_cancel(v_payload);
    when 'fanbus_registration_create_manual' then
      return app_private.api_fanbus_registration_create_manual(v_payload);
    when 'fanbus_registration_identity_link' then
      return app_private.api_fanbus_registration_identity_link(v_payload);
    when 'fanbus_registration_identity_relink' then
      return app_private.api_fanbus_registration_identity_relink(v_payload);
    when 'fanbus_registration_identity_search' then
      return app_private.api_fanbus_registration_identity_search(v_payload);
    when 'fanbus_registration_identity_suggestion' then
      return app_private.api_fanbus_registration_identity_suggestion(v_payload);
    when 'fanbus_registration_identity_unlink' then
      return app_private.api_fanbus_registration_identity_unlink(v_payload);
    when 'fanbus_registration_operational_detail' then
      return app_private.api_fanbus_registration_operational_detail(v_payload);
    when 'fanbus_registration_operational_update' then
      return app_private.api_fanbus_registration_operational_update(v_payload);
    when 'fanbus_registration_people_list' then
      return app_private.api_fanbus_registration_people_list();
    when 'fanbus_registration_update' then
      return app_private.api_fanbus_registration_update(v_payload);
    when 'fanbus_registration_update_m325' then
      return app_private.api_fanbus_registration_update_m325(v_payload);
    when 'fanbus_registrations_list' then
      return app_private.api_fanbus_registrations_list(v_payload);
    when 'fanbus_self_register' then
      return app_private.api_fanbus_self_register(v_payload);
    when 'fanbus_trip_boarding_stop_upsert' then
      return app_private.api_fanbus_trip_boarding_stop_upsert(v_payload);
    when 'fanbus_trip_boarding_stops_list' then
      return app_private.api_fanbus_trip_boarding_stops_list(v_payload);
    when 'fanbus_trip_boarding_stops_reorder' then
      return app_private.api_fanbus_trip_boarding_stops_reorder(v_payload);
    when 'fanbus_trip_cancel' then
      return app_private.api_fanbus_trip_cancel(v_payload);
    when 'fanbus_trip_close' then
      return app_private.api_fanbus_trip_close(v_payload);
    when 'fanbus_trip_create' then
      return app_private.api_fanbus_trip_create(v_payload);
    when 'fanbus_trip_delete' then
      return app_private.api_fanbus_trip_delete(v_payload);
    when 'fanbus_trip_publish' then
      return app_private.api_fanbus_trip_publish(v_payload);
    when 'fanbus_trip_reopen' then
      return app_private.api_fanbus_trip_reopen(v_payload);
    when 'fanbus_trip_update' then
      return app_private.api_fanbus_trip_update(v_payload);
    when 'fanbus_trips_list' then
      return app_private.api_fanbus_trips_list();
    when 'fanbus_user_preference_delete' then
      return app_private.api_fanbus_user_preference_delete(v_payload);
    when 'fanbus_user_preference_get' then
      return app_private.api_fanbus_user_preference_get(v_payload);
    when 'fanbus_user_preference_set' then
      return app_private.api_fanbus_user_preference_set(v_payload);
    when 'fanbus_waitlist_promote' then
      return app_private.api_fanbus_waitlist_promote(v_payload);
    when 'fanclub_snapshot' then
      return app_private.api_fanclub_snapshot();
    when 'mark_notification_read' then
      return app_private.api_mark_notification_read(v_payload);
    when 'member_detail' then
      return app_private.api_member_detail(v_payload);
    when 'member_match' then
      return app_private.api_member_match(v_payload);
    when 'member_portal_link' then
      return app_private.api_member_portal_link(v_payload);
    when 'member_portal_unlink' then
      return app_private.api_member_portal_unlink(v_payload);
    when 'membership_application_convert' then
      return app_private.api_membership_application_convert(v_payload);
    when 'membership_application_detail' then
      return app_private.api_membership_application_detail(v_payload);
    when 'membership_application_manual_decide' then
      return app_private.api_membership_application_manual_decide(v_payload);
    when 'membership_application_vote' then
      return app_private.api_membership_application_vote(v_payload);
    when 'membership_application_withdraw' then
      return app_private.api_membership_application_withdraw(v_payload);
    when 'membership_applications_list' then
      return app_private.api_membership_applications_list();
    when 'push_snapshot' then
      return app_private.api_push_snapshot();
    when 'reject_request' then
      return app_private.api_reject_request(v_payload);
    when 'remove_member_contribution' then
      return app_private.api_remove_member_contribution(v_payload);
    when 'remove_push_subscription' then
      return app_private.api_remove_push_subscription(v_payload);
    when 'remove_team_member' then
      return app_private.api_remove_team_member(v_payload);
    when 'report_contribution_payment' then
      return app_private.api_report_contribution_payment(v_payload);
    when 'restore_task' then
      return app_private.api_restore_task(v_payload);
    when 'reverse_finance_entry' then
      return app_private.api_reverse_finance_entry(v_payload);
    when 'review_contribution_payment' then
      return app_private.api_review_contribution_payment(v_payload);
    when 'review_profile_change_request' then
      return app_private.api_review_profile_change_request(v_payload);
    when 'save_contribution_class' then
      return app_private.api_save_contribution_class(v_payload);
    when 'save_contribution_season' then
      return app_private.api_save_contribution_season(v_payload);
    when 'save_finance_account' then
      return app_private.api_save_finance_account(v_payload);
    when 'save_member' then
      return app_private.api_save_member(v_payload);
    when 'save_member_contribution' then
      return app_private.api_save_member_contribution(v_payload);
    when 'save_notification_preferences' then
      return app_private.api_save_notification_preferences(v_payload);
    when 'save_offices' then
      return app_private.api_save_offices(v_payload);
    when 'save_push_subscription' then
      return app_private.api_save_push_subscription(v_payload);
    when 'save_role' then
      return app_private.api_save_role(v_payload);
    when 'save_task' then
      return app_private.api_save_task(v_payload);
    when 'save_task_note' then
      return app_private.api_save_task_note(v_payload);
    when 'save_team' then
      return app_private.api_save_team(v_payload);
    when 'save_team_member' then
      return app_private.api_save_team_member(v_payload);
    when 'save_user' then
      return app_private.api_save_user(v_payload);
    when 'save_user_task_access' then
      return app_private.api_save_user_task_access(v_payload);
    when 'set_role_capabilities' then
      return app_private.api_set_role_capabilities(v_payload);
    when 'set_task_status' then
      return app_private.api_set_task_status(v_payload);
    when 'set_team_functions' then
      return app_private.api_set_team_functions(v_payload);
    when 'set_user_capabilities' then
      return app_private.api_set_user_capabilities(v_payload);
    when 'submit_access_request' then
      return app_private.api_submit_access_request(v_payload);
    when 'submit_profile_change_request' then
      return app_private.api_submit_profile_change_request(v_payload);
    when 'task_transfer' then
      return app_private.api_task_transfer(v_payload);
    when 'tasks_snapshot' then
      return app_private.api_tasks_snapshot();
    when 'teams_snapshot' then
      return app_private.api_teams_snapshot();
    when 'transfer_finance' then
      return app_private.api_transfer_finance(v_payload);
    when 'update_profile' then
      return app_private.api_update_profile(v_payload);
    else
      raise exception 'Unbekannte Portalaktion: %', v_action
        using errcode = '22023';
  end case;
end;
$function$;

revoke all on function
  app_private.fanbus_selfservice_until(timestamptz),
  app_private.fanbus_assert_selfservice_mutable(app_modules.fanbus_trips),
  app_private.fanbus_selfservice_owner(uuid,app_modules.fanbus_registrations,app_modules.fanbus_bookings),
  app_private.fanbus_participant_cancel_kernel(uuid,integer,uuid,text),
  app_private.api_fanbus_my_bookings_list(jsonb),
  app_private.api_fanbus_selfservice_participant_update(jsonb),
  app_private.api_fanbus_selfservice_participant_cancel(jsonb),
  app_private.api_fanbus_selfservice_booking_append(jsonb),
  app_private.api_fanbus_registration_cancel_before_m327_r1(jsonb),
  app_private.api_fanbus_registration_cancel(jsonb),
  app_private.api_fanbus_bus_assignment_set_before_m330_r1_before_m327_r1(jsonb),
  app_private.api_fanbus_bus_assignment_set_before_m330_r1(jsonb),
  app_private.notification_expand_event_before_m327_r1(uuid),
  app_private.notification_expand_event(uuid),
  app_private.pd_api_current_actions_before_m327_r1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_m327_r1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_m327_r1(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
from public, anon, authenticated, service_role;
grant execute on function
  app_private.fanbus_selfservice_until(timestamptz),
  app_private.fanbus_assert_selfservice_mutable(app_modules.fanbus_trips),
  app_private.fanbus_selfservice_owner(uuid,app_modules.fanbus_registrations,app_modules.fanbus_bookings),
  app_private.fanbus_participant_cancel_kernel(uuid,integer,uuid,text),
  app_private.api_fanbus_my_bookings_list(jsonb),
  app_private.api_fanbus_selfservice_participant_update(jsonb),
  app_private.api_fanbus_selfservice_participant_cancel(jsonb),
  app_private.api_fanbus_selfservice_booking_append(jsonb),
  app_private.api_fanbus_registration_cancel_before_m327_r1(jsonb),
  app_private.api_fanbus_registration_cancel(jsonb),
  app_private.api_fanbus_bus_assignment_set_before_m330_r1_before_m327_r1(jsonb),
  app_private.api_fanbus_bus_assignment_set_before_m330_r1(jsonb),
  app_private.notification_expand_event_before_m327_r1(uuid),
  app_private.notification_expand_event(uuid),
  app_private.pd_api_current_actions_before_m327_r1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_m327_r1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_m327_r1(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
to postgres;

comment on function app_private.api_fanbus_my_bookings_list(jsonb) is
  'M327-R1/D-076 authenticated own-bookings projection with creator/self privacy.';
comment on function app_private.api_fanbus_selfservice_booking_append(jsonb) is
  'M327-R1/D-076 atomic same-booking append with existing capacity/waitlist semantics.';
comment on function public.pd_public_fanbus_contact() is
  'Sanitized public projection of fanbus.organization_contact; no generic settings access.';

commit;
