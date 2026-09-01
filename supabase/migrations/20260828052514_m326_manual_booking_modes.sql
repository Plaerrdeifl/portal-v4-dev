-- DEV overlay: M326 manual booking modes
-- Applied in DEV as migration 20260828052514_m326_manual_booking_modes.
-- Before PROD release this overlay must be reconciled into the regular migration chain.

begin;

create or replace function app_private.api_fanbus_registration_create_manual_bulk(p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_trip uuid:=app_private.m326_uuid(p_payload->>'tripId','FANBUS_MANUAL_BULK_INVALID_PAYLOAD');
  v_key uuid:=app_private.m326_uuid(p_payload->>'idempotencyKey','FANBUS_MANUAL_BULK_INVALID_PAYLOAD');
  v_participants jsonb:=p_payload->'participants';
  v_booking_mode text:=upper(coalesce(nullif(btrim(p_payload->>'bookingMode'),''),'GROUP'));
  v_primary_index integer:=0;
  v_participant_count integer;
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
  v_core_items jsonb:='[]'::jsonb;
  v_primary jsonb;
  v_companions jsonb:='[]'::jsonb;
  v_m325_context jsonb:='[]'::jsonb;
  v_m326_context jsonb:='[]'::jsonb;
  v_has_stops boolean;
  v_result jsonb;
  v_outer_context jsonb;
  v_request_hash text;
  v_i integer;
  v_item_key uuid;
  v_item_result jsonb;
  v_item_m325 jsonb;
  v_item_m326 jsonb;
  v_individual_results jsonb:='[]'::jsonb;
  v_created_count integer:=0;
  v_waitlisted_count integer:=0;
begin
  if jsonb_typeof(p_payload)<>'object'
     or not p_payload?&array['tripId','participants','termsConfirmed','idempotencyKey']
     or exists(select 1 from jsonb_object_keys(p_payload) key(name)
       where key.name<>all(array['tripId','participants','termsConfirmed','idempotencyKey','bookingMode','primaryParticipantIndex']))
     or jsonb_typeof(v_participants)<>'array'
     or jsonb_array_length(v_participants) not between 1 and 20
     or (p_payload->>'termsConfirmed')::boolean is distinct from true
     or v_trip is null or v_key is null
     or v_booking_mode not in ('GROUP','INDIVIDUAL') then
    raise exception 'FANBUS_MANUAL_BULK_INVALID_PAYLOAD' using errcode='22023';
  end if;

  v_participant_count:=jsonb_array_length(v_participants);

  if p_payload ? 'primaryParticipantIndex' then
    if coalesce(p_payload->>'primaryParticipantIndex','') !~ '^[0-9]+$' then
      raise exception 'FANBUS_MANUAL_BULK_INVALID_PAYLOAD' using errcode='22023';
    end if;
    v_primary_index:=(p_payload->>'primaryParticipantIndex')::integer;
  end if;

  if v_booking_mode='GROUP' then
    if v_primary_index<0 or v_primary_index>=v_participant_count then
      raise exception 'FANBUS_MANUAL_BULK_INVALID_PAYLOAD' using errcode='22023';
    end if;
  elsif p_payload ? 'primaryParticipantIndex' then
    raise exception 'FANBUS_MANUAL_BULK_INVALID_PAYLOAD' using errcode='22023';
  end if;

  v_outer_context:=jsonb_build_object(
    'version',327,
    'source','MANUAL_BULK',
    'actor',v_actor,
    'request',p_payload-'idempotencyKey'
  );
  v_request_hash:=encode(extensions.digest(v_outer_context::text,'sha256'),'hex');

  perform app_private.m325_assert_idempotency(v_key,v_outer_context,true);
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

  if v_booking_mode='GROUP' and v_primary_index>0 then
    select jsonb_agg(entry.value order by
      case when entry.ordinality-1=v_primary_index then 0 else entry.ordinality end,
      entry.ordinality)
    into v_participants
    from jsonb_array_elements(v_participants) with ordinality as entry(value,ordinality);
  end if;

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
    v_core_items:=v_core_items||jsonb_build_array(v_core_item);
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

  if v_booking_mode='GROUP' then
    perform set_config('app.m325_registration_context',v_m325_context::text,true);
    perform set_config('app.m326_registration_context',v_m326_context::text,true);
    v_result:=app_private.fanbus_submit_booking_core(
      v_trip,'MANUAL',v_actor,v_primary,v_companions,true,true,v_key,null
    );
    return v_result||jsonb_build_object(
      'bookingMode','GROUP',
      'bookingCount',1,
      'primaryParticipantIndex',v_primary_index
    );
  end if;

  for v_i in 0..v_participant_count-1 loop
    v_item_key:=(
      substr(md5(v_key::text||':m326-individual:'||v_i::text),1,8)||'-'||
      substr(md5(v_key::text||':m326-individual:'||v_i::text),9,4)||'-'||
      substr(md5(v_key::text||':m326-individual:'||v_i::text),13,4)||'-'||
      substr(md5(v_key::text||':m326-individual:'||v_i::text),17,4)||'-'||
      substr(md5(v_key::text||':m326-individual:'||v_i::text),21,12)
    )::uuid;

    v_item_m325:=jsonb_set(v_m325_context->v_i,'{sequence}','1'::jsonb,true);
    v_item_m326:=jsonb_set(v_m326_context->v_i,'{sequence}','1'::jsonb,true);
    perform set_config('app.m325_registration_context',jsonb_build_array(v_item_m325)::text,true);
    perform set_config('app.m326_registration_context',jsonb_build_array(v_item_m326)::text,true);

    v_item_result:=app_private.fanbus_submit_booking_core(
      v_trip,'MANUAL',v_actor,v_core_items->v_i,'[]'::jsonb,true,true,v_item_key,null
    );

    if coalesce(v_item_result->>'outcome','') not in ('CREATED','WAITLISTED') then
      raise exception 'FANBUS_MANUAL_INDIVIDUAL_FAILED' using
        errcode='P0001',
        detail=coalesce(v_item_result->>'outcome','UNKNOWN');
    end if;

    if v_item_result->>'outcome'='WAITLISTED' then
      v_waitlisted_count:=v_waitlisted_count+1;
    else
      v_created_count:=v_created_count+1;
    end if;

    v_individual_results:=v_individual_results||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'outcome',v_item_result->>'outcome',
      'bookingId',v_item_result->>'bookingId',
      'registrationId',v_item_result->>'registrationId'
    )));
  end loop;

  v_result:=jsonb_build_object(
    'outcome',case when v_waitlisted_count=v_participant_count then 'WAITLISTED' else 'CREATED' end,
    'bookingMode','INDIVIDUAL',
    'participantCount',v_participant_count,
    'bookingCount',v_participant_count,
    'createdCount',v_created_count,
    'waitlistedCount',v_waitlisted_count,
    'results',v_individual_results
  );

  insert into app_private.fanbus_registration_idempotency(
    idempotency_key,request_hash,trip_id,registration_id,outcome,booking_id,response_payload
  ) values (
    v_key,v_request_hash,v_trip,null,v_result->>'outcome',null,v_result
  );

  return v_result;
end;
$function$;

revoke all on function app_private.api_fanbus_registration_create_manual_bulk(jsonb)
from public,anon,authenticated,service_role;

commit;
