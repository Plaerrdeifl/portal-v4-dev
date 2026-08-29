-- Plaerrdeifl Digitalplattform V4
-- P300 / M328-R1 – Bus-Orga Buchungsverwaltung
-- Lesbare Buchungsnummern, Buchungsprojektion und atomare gemischte Erfassung.
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

-- Bestehende Teilnehmerprojektion additiv um die menschenlesbare Buchungsnummer
-- anreichern. Die bisherige Funktion bleibt fuer Rechte und Fachlogik zustaendig.
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
      item.value || jsonb_build_object(
        'bookingNumber', booking.booking_number
      )
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

-- Ein Bus-Orga-Speichervorgang darf mehrere echte Buchungen enthalten.
-- Jede Position ruft weiterhin den etablierten M326-Bulkvertrag auf; dadurch
-- bleiben M320-Kapazitaet, Identitaetsregeln, Zustiege, Warteliste und Audit
-- unveraendert zentral. Der aeussere SQL-Aufruf macht alle Positionen atomar.
create function app_private.api_fanbus_registration_create_manual_batches(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_trip uuid := app_private.m326_uuid(
    p_payload ->> 'tripId',
    'FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD'
  );
  v_key uuid := app_private.m326_uuid(
    p_payload ->> 'idempotencyKey',
    'FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD'
  );
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
     or not p_payload ?& array[
       'tripId', 'bookings', 'termsConfirmed', 'idempotencyKey'
     ]
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as key(name)
       where key.name <> all(array[
         'tripId', 'bookings', 'termsConfirmed', 'idempotencyKey'
       ])
     )
     or v_trip is null
     or v_key is null
     or (p_payload ->> 'termsConfirmed')::boolean is distinct from true
     or jsonb_typeof(v_bookings) <> 'array'
     or jsonb_array_length(v_bookings) not between 1 and 20 then
    raise exception 'FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  for v_booking in
    select value
    from jsonb_array_elements(v_bookings) with ordinality
      as booking(value, position)
    order by position
  loop
    if jsonb_typeof(v_booking) <> 'object'
       or not v_booking ? 'participants'
       or exists (
         select 1
         from jsonb_object_keys(v_booking) as key(name)
         where key.name <> 'participants'
       ) then
      raise exception 'FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD'
        using errcode = '22023';
    end if;

    v_participants := v_booking -> 'participants';
    if jsonb_typeof(v_participants) <> 'array'
       or jsonb_array_length(v_participants) not between 1 and 20 then
      raise exception 'FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD'
        using errcode = '22023';
    end if;

    v_booking_count := v_booking_count + 1;
    v_total_participants := v_total_participants + jsonb_array_length(v_participants);
    if v_total_participants > 20 then
      raise exception 'FANBUS_MANUAL_BATCHES_TOO_MANY_PARTICIPANTS'
        using errcode = '22023';
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
        'tripId', v_trip,
        'participants', v_participants,
        'termsConfirmed', true,
        'idempotencyKey', v_sub_key,
        'bookingMode', 'GROUP',
        'primaryParticipantIndex', 0
      )
    );

    if coalesce(v_result ->> 'outcome', '') not in ('CREATED', 'WAITLISTED') then
      raise exception 'FANBUS_MANUAL_BATCHES_UNEXPECTED_OUTCOME'
        using errcode = '55000';
    end if;

    select booking.booking_number
    into v_booking_number
    from app_modules.fanbus_bookings as booking
    where booking.id = nullif(v_result ->> 'bookingId', '')::uuid;

    if v_booking_number is null then
      raise exception 'FANBUS_BOOKING_NUMBER_MISSING'
        using errcode = '55000';
    end if;

    v_any_waitlisted := v_any_waitlisted
      or (v_result ->> 'outcome') = 'WAITLISTED';

    v_results := v_results || jsonb_build_array(
      v_result || jsonb_build_object(
        'bookingNumber', v_booking_number
      )
    );
  end loop;

  return jsonb_build_object(
    'outcome', case when v_any_waitlisted then 'WAITLISTED' else 'CREATED' end,
    'bookingCount', v_booking_count,
    'participantCount', v_total_participants,
    'bookings', v_results
  );
end;
$function$;

-- Bestehende Mailprojektion zentral ergaenzen: sobald Template-Daten eine
-- bookingId enthalten, wird automatisch die lesbare bookingNumber mitgegeben.
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
  v_data jsonb := coalesce(p_template_data, '{}'::jsonb);
  v_booking_id uuid;
  v_booking_number text;
begin
  begin
    v_booking_id := nullif(v_data ->> 'bookingId', '')::uuid;
  exception when others then
    v_booking_id := null;
  end;

  if v_booking_id is not null then
    select booking.booking_number
    into v_booking_number
    from app_modules.fanbus_bookings as booking
    where booking.id = v_booking_id;

    if v_booking_number is not null then
      v_data := v_data || jsonb_build_object(
        'bookingNumber', v_booking_number
      );
    end if;
  end if;

  perform app_private.notification_add_external_email_before_m328_r1(
    p_event,
    p_email,
    p_recipient_kind,
    p_target_key,
    p_template_key,
    v_data,
    p_deep_link,
    p_mandatory
  );
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_m328_r1_bookings;
create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_m328_r1_bookings()
    || array['fanbus_registration_create_manual_batches']::text[];
$function$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_m328_r1_bookings;
create function app_private.pd_api_dispatch_current(
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if lower(btrim(coalesce(p_action, ''))) =
     'fanbus_registration_create_manual_batches' then
    return app_private.api_fanbus_registration_create_manual_batches(
      coalesce(p_payload, '{}'::jsonb)
    );
  end if;

  return app_private.pd_api_dispatch_current_before_m328_r1_bookings(
    p_action,
    p_payload
  );
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
  app_private.pd_api_current_actions_before_m328_r1_bookings(),
  app_private.pd_api_current_actions(),
  app_private.pd_api_dispatch_current_before_m328_r1_bookings(text,jsonb),
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
  app_private.pd_api_current_actions_before_m328_r1_bookings(),
  app_private.pd_api_current_actions(),
  app_private.pd_api_dispatch_current_before_m328_r1_bookings(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
to postgres;

commit;
