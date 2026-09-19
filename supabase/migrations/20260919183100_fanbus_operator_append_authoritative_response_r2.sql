alter function app_private.api_fanbus_booking_operator_append(jsonb)
  rename to api_fanbus_booking_operator_append_before_authoritative_response_r2;

create function app_private.api_fanbus_booking_operator_append(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_append jsonb;
  v_trip_id uuid;
  v_list jsonb;
begin
  v_append := app_private.api_fanbus_booking_operator_append_before_authoritative_response_r2(p_payload);
  v_trip_id := nullif(v_append->>'tripId','')::uuid;

  if v_trip_id is null then
    raise exception 'FANBUS_BOOKING_OPERATOR_APPEND_INVALID_RESPONSE' using errcode='P0001';
  end if;

  v_list := app_private.api_fanbus_registrations_list(
    jsonb_build_object('tripId',v_trip_id)
  );

  return v_list || jsonb_strip_nulls(jsonb_build_object(
    'addedParticipantId',v_append->>'participantId',
    'addedParticipantSequence',v_append->>'participantSequence',
    'addedStatus',v_append->>'status',
    'addedRevision',v_append->>'revision'
  ));
end;
$function$;

revoke all on function app_private.api_fanbus_booking_operator_append(jsonb)
  from public, anon, authenticated;
