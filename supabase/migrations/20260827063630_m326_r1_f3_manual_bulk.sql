-- Plaerrdeifl Digitalplattform V4
-- P300 / M326-R1 F3: atomare manuelle Mehrpersonenbuchung ueber M320

begin;

create function app_private.fanbus_registration_effective_key(
  p_portal_user_id uuid,
  p_member_id uuid,
  p_regular_rider_id uuid,
  p_email text,
  p_first_name text,
  p_last_name text,
  p_source text
)
returns text
language plpgsql stable security definer set search_path=''
as $function$
declare
  v_portal uuid;
begin
  if p_portal_user_id is not null and exists(
    select 1 from app_portal.users where id=p_portal_user_id and status='ACTIVE'
  ) then return 'PORTAL:'||p_portal_user_id; end if;
  if p_member_id is not null then
    select portal.id into v_portal
    from app_portal.user_member_links link
    join app_portal.users portal on portal.id=link.user_id and portal.status='ACTIVE'
    where link.member_id=p_member_id;
    if v_portal is not null then return 'PORTAL:'||v_portal; end if;
    return 'MEMBER:'||p_member_id;
  end if;
  if p_regular_rider_id is not null then
    select portal.id into v_portal
    from app_modules.fanbus_regular_riders rider
    join app_portal.users portal
      on portal.id=rider.linked_portal_user_id and portal.status='ACTIVE'
    where rider.id=p_regular_rider_id;
    if v_portal is not null then return 'PORTAL:'||v_portal; end if;
    return 'REGULAR_RIDER:'||p_regular_rider_id;
  end if;
  if nullif(lower(btrim(coalesce(p_email,''))),'') is not null then
    return 'GUEST_EMAIL:'||lower(btrim(p_email));
  end if;
  if upper(coalesce(p_source,''))='MANUAL' then
    return 'GUEST_NAME:'||lower(btrim(coalesce(p_first_name,'')))||':'||lower(btrim(coalesce(p_last_name,'')));
  end if;
  return null;
end;
$function$;

create function app_private.m326_registration_before_insert()
returns trigger
language plpgsql security definer set search_path=''
as $function$
declare
  v_context jsonb:=coalesce(nullif(current_setting('app.m326_registration_context',true),''),'[]')::jsonb;
  v_entry jsonb;
begin
  select value into v_entry from jsonb_array_elements(v_context)
  where (value->>'sequence')::integer=new.participant_sequence limit 1;
  if v_entry is null then return new; end if;

  new.portal_user_id:=nullif(v_entry->>'portalUserId','')::uuid;
  new.member_id:=nullif(v_entry->>'memberId','')::uuid;
  new.regular_rider_id:=nullif(v_entry->>'regularRiderId','')::uuid;
  new.first_name:=app_private.require_valid_name(app_private.clean_name(v_entry->>'firstName'),'Vorname');
  new.last_name:=app_private.require_valid_name(app_private.clean_name(v_entry->>'lastName'),'Nachname');
  new.email:=nullif(lower(btrim(coalesce(v_entry->>'email',''))),'');
  return new;
end;
$function$;

create trigger fanbus_registrations_m326_before_insert
before insert on app_modules.fanbus_registrations
for each row execute function app_private.m326_registration_before_insert();

create function app_private.api_fanbus_registration_create_manual_bulk(p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_trip uuid:=app_private.m326_uuid(p_payload->>'tripId','FANBUS_MANUAL_BULK_INVALID_PAYLOAD');
  v_key uuid:=app_private.m326_uuid(p_payload->>'idempotencyKey','FANBUS_MANUAL_BULK_INVALID_PAYLOAD');
  v_participants jsonb:=p_payload->'participants';
  v_item jsonb;
  v_source text;
  v_portal uuid;
  v_member uuid;
  v_rider uuid;
  v_person jsonb;
  v_identity text;
  v_seen text[]:=array[]::text[];
  v_seen_emails text[]:=array[]::text[];
  v_sequence integer:=0;
  v_stop uuid;
  v_preference text;
  v_note text;
  v_first text;
  v_last text;
  v_email text;
  v_core_item jsonb;
  v_primary jsonb;
  v_companions jsonb:='[]'::jsonb;
  v_m325_context jsonb:='[]'::jsonb;
  v_m326_context jsonb:='[]'::jsonb;
  v_has_stops boolean;
  v_result jsonb;
begin
  if jsonb_typeof(p_payload)<>'object'
     or not p_payload?&array['tripId','participants','termsConfirmed','idempotencyKey']
     or exists(select 1 from jsonb_object_keys(p_payload) key(name)
       where key.name<>all(array['tripId','participants','termsConfirmed','idempotencyKey']))
     or jsonb_typeof(v_participants)<>'array'
     or jsonb_array_length(v_participants) not between 1 and 20
     or (p_payload->>'termsConfirmed')::boolean is distinct from true
     or v_trip is null or v_key is null then
    raise exception 'FANBUS_MANUAL_BULK_INVALID_PAYLOAD' using errcode='22023';
  end if;

  -- The M325 sidecar hashes the stable request before any mutable identity or
  -- default is resolved. A successful replay returns before those reads.
  perform app_private.m325_assert_idempotency(v_key,jsonb_build_object(
    'version',326,'source','MANUAL_BULK','actor',v_actor,
    'request',p_payload-'idempotencyKey'
  ),true);
  select coalesce(idempotency.response_payload,jsonb_build_object(
    'outcome',idempotency.outcome,'bookingId',idempotency.booking_id,
    'registrationId',idempotency.registration_id,'participantCount',null
  )) into v_result
  from app_private.fanbus_registration_idempotency as idempotency
  where idempotency.idempotency_key=v_key;
  if found then return v_result; end if;

  perform 1 from app_modules.fanbus_trips where id=v_trip for update;
  if not found then raise exception 'FANBUS_TRIP_UNAVAILABLE' using errcode='P0002'; end if;
  select exists(select 1 from app_modules.fanbus_trip_boarding_stops
    where trip_id=v_trip and is_active) into v_has_stops;

  for v_item in select value from jsonb_array_elements(v_participants) with ordinality
    as participant(value,position) order by position
  loop
    v_sequence:=v_sequence+1;
    if jsonb_typeof(v_item)<>'object' then
      raise exception 'FANBUS_MANUAL_BULK_PARTICIPANT_INVALID' using errcode='22023';
    end if;
    if exists(select 1 from jsonb_object_keys(v_item) as key(name)
      where key.name<>all(array[
        'source','portalUserId','memberId','regularRiderId','firstName','lastName',
        'email','boardingStopId','busPreference','operationalNote'
      ])) then
      raise exception 'FANBUS_MANUAL_BULK_PARTICIPANT_INVALID' using errcode='22023';
    end if;
    v_source:=upper(btrim(coalesce(v_item->>'source','')));
    v_portal:=app_private.m326_uuid(v_item->>'portalUserId','FANBUS_MANUAL_BULK_PARTICIPANT_INVALID');
    v_member:=app_private.m326_uuid(v_item->>'memberId','FANBUS_MANUAL_BULK_PARTICIPANT_INVALID');
    v_rider:=app_private.m326_uuid(v_item->>'regularRiderId','FANBUS_MANUAL_BULK_PARTICIPANT_INVALID');
    if v_source not in('PORTAL_USER','MEMBER','REGULAR_RIDER','GUEST')
       or not v_item?'busPreference'
       or (v_source='PORTAL_USER' and (v_portal is null or num_nonnulls(v_portal,v_member,v_rider)<>1))
       or (v_source='MEMBER' and (v_member is null or num_nonnulls(v_portal,v_member,v_rider)<>1))
       or (v_source='REGULAR_RIDER' and (v_rider is null or num_nonnulls(v_portal,v_member,v_rider)<>1))
       or (v_source='GUEST' and num_nonnulls(v_portal,v_member,v_rider)<>0)
       or (v_source<>'GUEST' and (v_item?'firstName' or v_item?'lastName' or v_item?'email')) then
      raise exception 'FANBUS_MANUAL_BULK_PARTICIPANT_INVALID' using errcode='22023';
    end if;

    if v_source='GUEST' then
      v_first:=app_private.require_valid_name(app_private.clean_name(v_item->>'firstName'),'Vorname');
      v_last:=app_private.require_valid_name(app_private.clean_name(v_item->>'lastName'),'Nachname');
      v_email:=nullif(lower(btrim(coalesce(v_item->>'email',''))),'');
      if v_email is not null and (length(v_email) not between 3 and 320
        or v_email!~*'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
        raise exception 'FANBUS_EMAIL_INVALID' using errcode='22023';
      end if;
      v_person:=jsonb_strip_nulls(jsonb_build_object(
        'available',true,'identityKey',case when v_email is not null then 'GUEST_EMAIL:'||v_email
          else 'GUEST_NAME:'||lower(v_first)||':'||lower(v_last) end,
        'firstName',v_first,'lastName',v_last,'email',v_email
      ));
    else
      v_person:=app_private.fanbus_effective_person(v_portal,v_member,v_rider);
      if (v_person->>'available')::boolean is distinct from true then
        raise exception 'FANBUS_MANUAL_BULK_PERSON_UNAVAILABLE' using errcode='22023';
      end if;
      v_first:=v_person->>'firstName'; v_last:=v_person->>'lastName';
      v_email:=nullif(lower(btrim(coalesce(v_person->>'email',''))),'');
    end if;

    v_identity:=v_person->>'identityKey';
    if v_identity is null or v_identity=any(v_seen)
       or (v_email is not null and v_email=any(v_seen_emails)) then
      raise exception 'FANBUS_BATCH_DUPLICATE' using errcode='P3201';
    end if;
    v_seen:=array_append(v_seen,v_identity);
    if v_email is not null then v_seen_emails:=array_append(v_seen_emails,v_email); end if;

    if exists(
      select 1 from app_modules.fanbus_registrations registration
      where registration.trip_id=v_trip and registration.status in('ACTIVE','WAITLISTED')
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

    v_stop:=app_private.m326_uuid(v_item->>'boardingStopId','FANBUS_BOARDING_STOP_INVALID');
    if v_stop is null and v_rider is not null and nullif(v_person->>'defaultBoardingStopId','') is not null then
      select stop.id into v_stop from app_modules.fanbus_trip_boarding_stops stop
      where stop.trip_id=v_trip
        and stop.boarding_stop_id=(v_person->>'defaultBoardingStopId')::uuid
        and stop.is_active;
    end if;
    if v_stop is not null and not exists(select 1 from app_modules.fanbus_trip_boarding_stops
      where id=v_stop and trip_id=v_trip and is_active) then
      raise exception 'FANBUS_BOARDING_STOP_UNAVAILABLE' using errcode='22023';
    end if;
    if v_has_stops and v_stop is null then
      raise exception 'FANBUS_BOARDING_STOP_REQUIRED' using errcode='22023';
    end if;

    v_preference:=upper(btrim(v_item->>'busPreference'));
    if v_preference not in('EGAL','RUHIG','PARTY') then
      raise exception 'FANBUS_BUS_PREFERENCE_INVALID' using errcode='22023';
    end if;
    v_note:=nullif(btrim(coalesce(v_item->>'operationalNote','')),'');
    if v_note is not null and length(v_note)>240 then
      raise exception 'FANBUS_OPERATIONAL_NOTE_TOO_LONG' using errcode='22023';
    end if;

    -- Keep the requested value in the legacy core; the existing M320-R2
    -- insertion trigger applies effective EGAL without changing idempotency.
    -- Stable identities use unique non-PII placeholders in the legacy core.
    -- The trusted trigger restores the resolved snapshot before constraints/indexes.
    if v_source='GUEST' then
      v_core_item:=jsonb_strip_nulls(jsonb_build_object(
        'firstName',v_first,'lastName',v_last,'email',v_email,'busPreference',v_preference
      ));
    else
      v_core_item:=jsonb_build_object(
        'firstName','M326','lastName',v_source||'-'||coalesce(v_portal,v_member,v_rider)::text,
        'busPreference',v_preference
      );
    end if;
    if v_sequence=1 then v_primary:=v_core_item;
    else v_companions:=v_companions||jsonb_build_array(v_core_item); end if;

    v_m325_context:=v_m325_context||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'sequence',v_sequence,'boardingStopId',v_stop,'operationalNote',v_note
    )));
    v_m326_context:=v_m326_context||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'sequence',v_sequence,'portalUserId',v_person->>'portalUserId',
      'memberId',v_person->>'memberId','regularRiderId',v_person->>'regularRiderId',
      'firstName',v_first,'lastName',v_last,'email',v_email,'identityKey',v_identity
    )));
  end loop;

  perform set_config('app.m325_registration_context',v_m325_context::text,true);
  perform set_config('app.m326_registration_context',v_m326_context::text,true);

  -- Mandatory M320 reuse: one call, no per-person booking loop.
  v_result:=app_private.fanbus_submit_booking_core(
    v_trip,'MANUAL',v_actor,v_primary,v_companions,true,true,v_key,null
  );
  return v_result;
end;
$function$;

alter function app_private.pd_api_current_actions() rename to pd_api_current_actions_before_m326_r1_f3;
create function app_private.pd_api_current_actions() returns text[]
language sql stable set search_path=''
as $function$
  select app_private.pd_api_current_actions_before_m326_r1_f3()
    || array['fanbus_registration_create_manual_bulk']::text[]
$function$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_m326_r1_f3;
create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=''
as $function$
begin
  if lower(btrim(coalesce(p_action,'')))='fanbus_registration_create_manual_bulk' then
    return app_private.api_fanbus_registration_create_manual_bulk(coalesce(p_payload,'{}'::jsonb));
  end if;
  return app_private.pd_api_dispatch_current_before_m326_r1_f3(p_action,p_payload);
end;
$function$;

revoke all on function
  app_private.fanbus_registration_effective_key(uuid,uuid,uuid,text,text,text,text),
  app_private.m326_registration_before_insert(),
  app_private.api_fanbus_registration_create_manual_bulk(jsonb),
  app_private.pd_api_current_actions_before_m326_r1_f3(),
  app_private.pd_api_current_actions(),
  app_private.pd_api_dispatch_current_before_m326_r1_f3(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
from public,anon,authenticated,service_role;

grant execute on function
  app_private.pd_api_current_actions_before_m326_r1_f3(),
  app_private.pd_api_current_actions(),
  app_private.pd_api_dispatch_current_before_m326_r1_f3(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
to postgres;

commit;
