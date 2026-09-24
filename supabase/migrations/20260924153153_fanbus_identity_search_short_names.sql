-- Allow short Portaluser names such as Jan or Leon in the BUS_ORGA identity search.
-- The endpoint remains capability-gated, prefix-only, rate-limited and privacy-minimal.

create or replace function app_private.api_fanbus_registration_identity_search(
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability(
    'fanbus.participant_identity.manage'
  );
  v_query text;
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or not p_payload ? 'query'
     or exists (
       select 1
       from pg_catalog.jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> 'query'
     ) then
    raise exception 'FANBUS_PERSON_SEARCH_INVALID_QUERY' using errcode = '22023';
  end if;

  v_query := pg_catalog.lower(
    pg_catalog.regexp_replace(
      pg_catalog.btrim(coalesce(p_payload ->> 'query', '')),
      E'\\s+',
      ' ',
      'g'
    )
  );

  if pg_catalog.length(v_query) < 2
     or pg_catalog.length(v_query) > 120
     or v_query !~ '^[[:alpha:]][[:alpha:]''’.-]*( [[:alpha:]][[:alpha:]''’.-]*)*$'
     or exists (
       select 1
       from pg_catalog.regexp_split_to_table(v_query, ' ') as token(value)
       where pg_catalog.length(token.value) < 2
     ) then
    raise exception 'FANBUS_PERSON_SEARCH_INVALID_QUERY' using errcode = '22023';
  end if;

  perform app_private.consume_companion_person_search_rate_limit(v_actor);

  return pg_catalog.jsonb_build_object(
    'people', app_private.m325_portal_people_search(v_query)
  );
end;
$function$;
