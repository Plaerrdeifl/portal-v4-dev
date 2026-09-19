create function app_private.api_fanbus_booking_operator_append(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_booking_id uuid;
  v_key uuid;
  v_booking app_modules.fanbus_bookings%rowtype;
  v_trip app_modules.fanbus_trips%rowtype;
  v_item jsonb;
  v_source text;
  v_portal uuid;
  v_member uuid;
  v_rider uuid;
  v_person jsonb;
  v_first text;
  v_last text;
  v_email text;
  v_identity text;
  v_stop uuid;
  v_preference text;
  v_note text;
  v_has_stops boolean;
  v_sequence integer;
  v_status text;
  v_waitlisted_at timestamptz;
  v_active_count integer;
  v_privacy text;
  v_terms text;
  v_hash text;
  v_existing app_private.fanbus_m325_idempotency%rowtype;
  v_registration app_modules.fanbus_registrations%rowtype;
  v_response jsonb;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['bookingId','idempotencyKey','participant','consentConfirmed']
     or exists (
       select 1 from jsonb_object_keys(p_payload) as key(name)
       where key.name <> all(array['bookingId','idempotencyKey','participant','consentConfirmed'])
     )
     or jsonb_typeof(p_payload->'participant') <> 'object'
     or coalesce((p_payload->>'consentConfirmed')::boolean,false) is distinct from true then
    raise exception 'FANBUS_BOOKING_OPERATOR_APPEND_INVALID_PAYLOAD' using errcode='22023';
  end if;

  begin
    v_booking_id := (p_payload->>'bookingId')::uuid;
    v_key := (p_payload->>'idempotencyKey')::uuid;
  exception when others then
    raise exception 'FANBUS_BOOKING_OPERATOR_APPEND_INVALID_PAYLOAD' using errcode='22023';
  end;

  select * into v_booking
  from app_modules.fanbus_bookings
  where id=v_booking_id
  for update;
  if not found then
    raise exception 'FANBUS_BOOKING_NOT_FOUND' using errcode='P0002';
  end if;

  select * into v_trip
  from app_modules.fanbus_trips
  where id=v_booking.trip_id
  for update;
  if not found then
    raise exception 'FANBUS_TRIP_UNAVAILABLE' using errcode='P0002';
  end if;

  v_item := p_payload->'participant';
  if exists (
    select 1 from jsonb_object_keys(v_item) as key(name)
    where key.name <> all(array[
      'source','portalUserId','memberId','regularRiderId','firstName','lastName',
      'email','boardingStopId','busPreference','operationalNote'
    ])
  ) then
    raise exception 'FANBUS_BOOKING_OPERATOR_APPEND_INVALID_PAYLOAD' using errcode='22023';
  end if;

  v_source := upper(btrim(coalesce(v_item->>'source','')));
  begin
    v_portal := nullif(btrim(coalesce(v_item->>'portalUserId','')),'')::uuid;
    v_member := nullif(btrim(coalesce(v_item->>'memberId','')),'')::uuid;
    v_rider := nullif(btrim(coalesce(v_item->>'regularRiderId','')),'')::uuid;
    v_stop := nullif(btrim(coalesce(v_item->>'boardingStopId','')),'')::uuid;
  exception when others then
    raise exception 'FANBUS_BOOKING_OPERATOR_APPEND_INVALID_PAYLOAD' using errcode='22023';
  end;

  if v_source not in ('PORTAL_USER','MEMBER','REGULAR_RIDER','GUEST')
     or (v_source='PORTAL_USER' and (v_portal is null or num_nonnulls(v_portal,v_member,v_rider)<>1))
     or (v_source='MEMBER' and (v_member is null or num_nonnulls(v_portal,v_member,v_rider)<>1))
     or (v_source='REGULAR_RIDER' and (v_rider is null or num_nonnulls(v_portal,v_member,v_rider)<>1))
     or (v_source='GUEST' and num_nonnulls(v_portal,v_member,v_rider)<>0)
     or (v_source<>'GUEST' and (v_item?'firstName' or v_item?'lastName' or v_item?'email')) then
    raise exception 'FANBUS_BOOKING_OPERATOR_APPEND_INVALID_PAYLOAD' using errcode='22023';
  end if;

  if v_source='GUEST' then
    v_first := app_private.require_valid_name(app_private.clean_name(v_item->>'firstName'),'Vorname');
    v_last := app_private.require_valid_name(app_private.clean_name(v_item->>'lastName'),'Nachname');
    v_email := nullif(lower(btrim(coalesce(v_item->>'email',''))),'');
    if v_email is not null and not app_private.notification_email_is_valid(v_email) then
      raise exception 'FANBUS_EMAIL_INVALID' using errcode='22023';
    end if;
  else
    v_person := app_private.fanbus_effective_person(v_portal,v_member,v_rider);
    if (v_person->>'available')::boolean is distinct from true then
      raise exception 'FANBUS_MANUAL_BULK_PERSON_UNAVAILABLE' using errcode='22023';
    end if;
    v_portal := nullif(v_person->>'portalUserId','')::uuid;
    v_member := nullif(v_person->>'memberId','')::uuid;
    v_rider := nullif(v_person->>'regularRiderId','')::uuid;
    v_first := v_person->>'firstName';
    v_last := v_person->>'lastName';
    v_email := nullif(lower(btrim(coalesce(v_person->>'email',''))),'');
  end if;

  if v_stop is null and v_rider is not null and nullif(v_person->>'defaultBoardingStopId','') is not null then
    select stop.id into v_stop
    from app_modules.fanbus_trip_boarding_stops as stop
    where stop.trip_id=v_booking.trip_id
      and stop.boarding_stop_id=(v_person->>'defaultBoardingStopId')::uuid
      and stop.is_active
    limit 1;
  end if;

  select exists(
    select 1 from app_modules.fanbus_trip_boarding_stops
    where trip_id=v_booking.trip_id and is_active
  ) into v_has_stops;

  if v_stop is not null and not exists(
    select 1 from app_modules.fanbus_trip_boarding_stops
    where id=v_stop and trip_id=v_booking.trip_id and is_active
  ) then
    raise exception 'FANBUS_BOARDING_STOP_UNAVAILABLE' using errcode='22023';
  end if;
  if v_has_stops and v_stop is null then
    raise exception 'FANBUS_BOARDING_STOP_REQUIRED' using errcode='22023';
  end if;

  v_preference := upper(btrim(coalesce(v_item->>'busPreference','EGAL')));
  if v_preference not in ('EGAL','RUHIG','PARTY') then
    raise exception 'FANBUS_BUS_PREFERENCE_INVALID' using errcode='22023';
  end if;

  v_note := nullif(btrim(coalesce(v_item->>'operationalNote','')),'');
  if v_note is not null and length(v_note)>240 then
    raise exception 'FANBUS_OPERATIONAL_NOTE_TOO_LONG' using errcode='22023';
  end if;

  v_identity := app_private.fanbus_registration_effective_key(
    v_portal,v_member,v_rider,v_email,v_first,v_last,'MANUAL'
  );
  if v_identity is null then
    raise exception 'FANBUS_BOOKING_OPERATOR_APPEND_INVALID_PAYLOAD' using errcode='22023';
  end if;

  v_hash := encode(extensions.digest(jsonb_build_object(
    'operation','OPERATOR_APPEND',
    'actor',v_actor,
    'bookingId',v_booking_id,
    'tripId',v_booking.trip_id,
    'participant',jsonb_strip_nulls(jsonb_build_object(
      'source',v_source,
      'portalUserId',v_portal,
      'memberId',v_member,
      'regularRiderId',v_rider,
      'firstName',v_first,
      'lastName',v_last,
      'email',v_email,
      'boardingStopId',v_stop,
      'busPreference',v_preference,
      'operationalNote',v_note,
      'identityKey',v_identity
    )),
    'contractVersion','FANBUS-OPERATOR-APPEND-R1'
  )::text,'sha256'),'hex');

  perform pg_advisory_xact_lock((
    'x'||substr(encode(extensions.digest('FANBUS-OPERATOR-APPEND:'||v_key::text,'sha256'),'hex'),1,16)
  )::bit(64)::bigint);

  select * into v_existing
  from app_private.fanbus_m325_idempotency
  where idempotency_key=v_key
  for update;

  if found then
    if v_existing.request_hash<>v_hash
       or v_existing.operation is distinct from 'OPERATOR_APPEND'
       or v_existing.actor_user_id is distinct from v_actor
       or v_existing.trip_id is distinct from v_booking.trip_id
       or v_existing.booking_id is distinct from v_booking_id then
      raise exception 'FANBUS_IDEMPOTENCY_KEY_REUSED' using errcode='22023';
    end if;
    if v_existing.response_payload is not null then
      return v_existing.response_payload;
    end if;
  else
    if exists(
      select 1 from app_private.fanbus_registration_idempotency
      where idempotency_key=v_key
    ) then
      raise exception 'FANBUS_IDEMPOTENCY_KEY_REUSED' using errcode='22023';
    end if;
    insert into app_private.fanbus_m325_idempotency(
      idempotency_key,request_hash,operation,actor_user_id,trip_id,booking_id
    ) values (
      v_key,v_hash,'OPERATOR_APPEND',v_actor,v_booking.trip_id,v_booking_id
    );
  end if;

  if v_trip.status='CANCELLED' then
    raise exception 'FANBUS_TRIP_CANCELLED' using errcode='22023';
  end if;

  if exists(
    select 1
    from app_modules.fanbus_registrations as registration
    where registration.trip_id=v_booking.trip_id
      and registration.status in ('ACTIVE','WAITLISTED')
      and (
        app_private.fanbus_registration_effective_key(
          registration.portal_user_id,registration.member_id,registration.regular_rider_id,
          registration.email,registration.first_name,registration.last_name,registration.source
        )=v_identity
        or (v_email is not null and lower(btrim(registration.email))=v_email)
      )
  ) then
    raise exception 'FANBUS_BATCH_DUPLICATE' using errcode='P3201';
  end if;

  select privacy_reference,terms_reference
    into v_privacy,v_terms
  from app_modules.fanbus_registrations
  where booking_id=v_booking_id
  order by participant_sequence,id
  limit 1;
  if not found then
    raise exception 'FANBUS_BOOKING_PARTICIPANT_NOT_FOUND' using errcode='P0002';
  end if;

  select coalesce(max(participant_sequence),0)+1
    into v_sequence
  from app_modules.fanbus_registrations
  where booking_id=v_booking_id;

  select count(*) into v_active_count
  from app_modules.fanbus_registrations
  where trip_id=v_booking.trip_id and status='ACTIVE';

  if exists(
      select 1 from app_modules.fanbus_registrations
      where trip_id=v_booking.trip_id and status='WAITLISTED'
    )
    or v_active_count>=app_private.fanbus_effective_capacity(v_booking.trip_id) then
    v_status := 'WAITLISTED';
    v_waitlisted_at := clock_timestamp();
  else
    v_status := 'ACTIVE';
    v_waitlisted_at := null;
  end if;

  insert into app_modules.fanbus_registrations(
    trip_id,portal_user_id,member_id,regular_rider_id,
    first_name,last_name,email,bus_preference,status,
    privacy_reference,terms_reference,privacy_accepted_at,terms_accepted_at,
    source,created_by,updated_by,booking_id,booking_role,participant_sequence,
    waitlisted_at,trip_boarding_stop_id,operational_note
  ) values (
    v_booking.trip_id,v_portal,v_member,v_rider,
    v_first,v_last,v_email,v_preference,v_status,
    v_privacy,v_terms,clock_timestamp(),clock_timestamp(),
    'MANUAL',v_actor,v_actor,v_booking_id,'COMPANION',v_sequence,
    v_waitlisted_at,v_stop,v_note
  ) returning * into v_registration;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_BOOKING_OPERATOR_PARTICIPANT_ADDED',
    'fanbus_registration',
    v_registration.id::text,
    null,
    jsonb_build_object('status',v_registration.status,'revision',v_registration.revision),
    jsonb_build_object(
      'tripId',v_booking.trip_id,
      'bookingId',v_booking_id,
      'participantId',v_registration.id,
      'participantSequence',v_registration.participant_sequence,
      'source',v_source
    )
  );

  v_response := jsonb_build_object(
    'bookingId',v_booking_id,
    'tripId',v_booking.trip_id,
    'participantId',v_registration.id,
    'participantSequence',v_registration.participant_sequence,
    'status',v_registration.status,
    'revision',v_registration.revision
  );

  update app_private.fanbus_m325_idempotency
  set response_payload=v_response
  where idempotency_key=v_key;

  return v_response;
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_fanbus_operator_append_r1;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_fanbus_operator_append_r1()
    || array['fanbus_booking_operator_append']::text[];
$function$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_fanbus_operator_append_r1;

create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if lower(btrim(coalesce(p_action,'')))='fanbus_booking_operator_append' then
    return app_private.api_fanbus_booking_operator_append(coalesce(p_payload,'{}'::jsonb));
  end if;
  return app_private.pd_api_dispatch_current_before_fanbus_operator_append_r1(p_action,p_payload);
end;
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_fanbus_operator_append_r1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $function$
  select case lower(btrim(coalesce(p_action,'')))
    when 'fanbus_booking_operator_append' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_fanbus_operator_append_r1(p_action)
  end;
$function$;

revoke all on function app_private.api_fanbus_booking_operator_append(jsonb)
  from public, anon, authenticated;
