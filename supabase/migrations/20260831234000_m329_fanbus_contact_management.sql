-- Plärrdeifl Digitalplattform V4
-- P300 / M329 – Zentrale Fanbus-Kontaktverwaltung und sichere Click-to-Contact-Projektion
-- DEV zuerst. Keine PROD-Aktion.

begin;

create or replace function app_private.fanbus_contact_e164(p_value text)
returns text
language sql
immutable
set search_path = ''
as $function$
  with compact as (
    select pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_value, '')), '[^0-9+]', '', 'g') as value
  )
  select case
    when compact.value ~ '^\+[1-9][0-9]{6,14}$' then compact.value
    when compact.value ~ '^00[1-9][0-9]{6,14}$' then '+' || pg_catalog.substr(compact.value, 3)
    when compact.value ~ '^0[1-9][0-9]{6,13}$' then '+49' || pg_catalog.substr(compact.value, 2)
    else null
  end
  from compact
$function$;

revoke all on function app_private.fanbus_contact_e164(text) from public, anon, authenticated;

-- Bestehende Daten in das additive V2-Modell überführen.
-- Der bisherige WhatsApp-Username wird bewusst nicht übernommen, weil wa.me einen numerischen Kontakt erwartet.
update app_portal.settings as setting
set value = setting.value || jsonb_build_object(
      'version', 2,
      'primary', jsonb_build_object(
        'name', 'Plärrdeifl',
        'phone', '',
        'whatsapp', false,
        'email', coalesce((
          select email.value ->> 'value'
          from jsonb_array_elements(
            case when jsonb_typeof(setting.value -> 'emails') = 'array'
              then setting.value -> 'emails'
              else '[]'::jsonb
            end
          ) with ordinality as email(value, position)
          where app_private.notification_email_is_valid(email.value ->> 'value')
          order by email.position
          limit 1
        ), '')
      ),
      'contacts', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'name', coalesce(nullif(btrim(phone.value ->> 'label'), ''), 'Kontakt'),
            'phone', btrim(phone.value ->> 'value'),
            'whatsapp', true,
            'email', ''
          )
          order by phone.position
        )
        from jsonb_array_elements(
          case when jsonb_typeof(setting.value -> 'phones') = 'array'
            then setting.value -> 'phones'
            else '[]'::jsonb
          end
        ) with ordinality as phone(value, position)
        where jsonb_typeof(phone.value) = 'object'
          and app_private.fanbus_contact_e164(
            coalesce(nullif(phone.value ->> 'href', ''), phone.value ->> 'value')
          ) is not null
      ), '[]'::jsonb),
      'whatsapp', '{}'::jsonb
    ),
    revision = setting.revision + 1,
    updated_at = now()
where setting.key = 'fanbus.organization_contact';

create or replace function app_private.fanbus_public_organization_contact()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with source as (
    select case
      when jsonb_typeof(setting.value) = 'object' then setting.value
      else '{}'::jsonb
    end as value
    from app_portal.settings as setting
    where setting.key = 'fanbus.organization_contact'
  ), primary_source as (
    select case
      when jsonb_typeof(source.value -> 'primary') = 'object' then source.value -> 'primary'
      else '{}'::jsonb
    end as value
    from source
  ), primary_normalized as (
    select
      nullif(btrim(value ->> 'name'), '') as name,
      nullif(btrim(value ->> 'phone'), '') as phone,
      app_private.fanbus_contact_e164(value ->> 'phone') as e164,
      coalesce((value ->> 'whatsapp')::boolean, false) as whatsapp,
      case
        when app_private.notification_email_is_valid(value ->> 'email') then btrim(value ->> 'email')
        else null
      end as email
    from primary_source
  ), contact_source as (
    select contact.value, contact.position
    from source
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(source.value -> 'contacts') = 'array' then source.value -> 'contacts'
        else '[]'::jsonb
      end
    ) with ordinality as contact(value, position)
    where jsonb_typeof(contact.value) = 'object'
  ), contacts_normalized as (
    select
      position,
      nullif(btrim(value ->> 'name'), '') as name,
      nullif(btrim(value ->> 'phone'), '') as phone,
      app_private.fanbus_contact_e164(value ->> 'phone') as e164,
      coalesce((value ->> 'whatsapp')::boolean, false) as whatsapp,
      case
        when app_private.notification_email_is_valid(value ->> 'email') then btrim(value ->> 'email')
        else null
      end as email
    from contact_source
  ), public_contacts as (
    select coalesce(jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'name', contact.name,
        'phone', contact.phone,
        'phoneHref', case when contact.e164 is not null then 'tel:' || contact.e164 end,
        'whatsappHref', case
          when contact.whatsapp and contact.e164 is not null
            then 'https://wa.me/' || pg_catalog.replace(contact.e164, '+', '')
        end,
        'email', contact.email,
        'emailHref', case when contact.email is not null then 'mailto:' || contact.email end
      ))
      order by contact.position
    ), '[]'::jsonb) as value
    from contacts_normalized as contact
    where contact.name is not null
      and (contact.e164 is not null or contact.email is not null)
  ), public_primary as (
    select case
      when primary_contact.name is null then '{}'::jsonb
      else jsonb_strip_nulls(jsonb_build_object(
        'name', primary_contact.name,
        'phone', primary_contact.phone,
        'phoneHref', case when primary_contact.e164 is not null then 'tel:' || primary_contact.e164 end,
        'whatsappHref', case
          when primary_contact.whatsapp and primary_contact.e164 is not null
            then 'https://wa.me/' || pg_catalog.replace(primary_contact.e164, '+', '')
        end,
        'email', primary_contact.email,
        'emailHref', case when primary_contact.email is not null then 'mailto:' || primary_contact.email end
      ))
    end as value
    from primary_normalized as primary_contact
  ), emails as (
    select coalesce(jsonb_agg(email.value order by email.position, email.kind), '[]'::jsonb) as value
    from (
      select 0::bigint as position, 0 as kind,
        jsonb_build_object('label', primary_contact.name, 'value', primary_contact.email, 'href', 'mailto:' || primary_contact.email) as value
      from primary_normalized as primary_contact
      where primary_contact.name is not null and primary_contact.email is not null
      union all
      select contact.position, 1,
        jsonb_build_object('label', contact.name, 'value', contact.email, 'href', 'mailto:' || contact.email)
      from contacts_normalized as contact
      where contact.name is not null and contact.email is not null
    ) as email
  ), phones as (
    select coalesce(jsonb_agg(phone.value order by phone.position, phone.kind), '[]'::jsonb) as value
    from (
      select 0::bigint as position, 0 as kind,
        jsonb_build_object('label', primary_contact.name, 'value', primary_contact.phone, 'href', 'tel:' || primary_contact.e164) as value
      from primary_normalized as primary_contact
      where primary_contact.name is not null and primary_contact.e164 is not null
      union all
      select contact.position, 1,
        jsonb_build_object('label', contact.name, 'value', contact.phone, 'href', 'tel:' || contact.e164)
      from contacts_normalized as contact
      where contact.name is not null and contact.e164 is not null
    ) as phone
  ), whatsapp as (
    select case
      when primary_contact.whatsapp and primary_contact.e164 is not null
      then jsonb_build_object(
        'label', coalesce(primary_contact.name, 'Plärrdeifl WhatsApp'),
        'username', coalesce(primary_contact.phone, primary_contact.e164),
        'url', 'https://wa.me/' || pg_catalog.replace(primary_contact.e164, '+', '')
      )
      else '{}'::jsonb
    end as value
    from primary_normalized as primary_contact
  )
  select jsonb_build_object(
    'primary', coalesce(public_primary.value, '{}'::jsonb),
    'contacts', coalesce(public_contacts.value, '[]'::jsonb),
    'emails', coalesce(emails.value, '[]'::jsonb),
    'phones', coalesce(phones.value, '[]'::jsonb),
    'whatsapp', coalesce(whatsapp.value, '{}'::jsonb)
  )
  from public_primary
  cross join public_contacts
  cross join emails
  cross join phones
  cross join whatsapp
  union all
  select '{"primary":{},"contacts":[],"emails":[],"phones":[],"whatsapp":{}}'::jsonb
  where not exists (select 1 from source)
  limit 1
$function$;

create or replace function app_private.api_fanbus_contact_admin_get(p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_value jsonb;
  v_revision integer;
begin
  perform app_private.require_capability('fanbus.manage');

  select setting.value, setting.revision
  into v_value, v_revision
  from app_portal.settings as setting
  where setting.key = 'fanbus.organization_contact';

  return jsonb_build_object(
    'revision', coalesce(v_revision, 0),
    'primary', case
      when jsonb_typeof(v_value -> 'primary') = 'object' then v_value -> 'primary'
      else jsonb_build_object('name', 'Plärrdeifl', 'phone', '', 'whatsapp', false, 'email', '')
    end,
    'contacts', case
      when jsonb_typeof(v_value -> 'contacts') = 'array' then v_value -> 'contacts'
      else '[]'::jsonb
    end
  );
end;
$function$;

create or replace function app_private.api_fanbus_contact_admin_save(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.manage');
  v_expected_revision integer;
  v_current_revision integer;
  v_before jsonb;
  v_primary jsonb := coalesce(p_payload -> 'primary', '{}'::jsonb);
  v_contacts jsonb := coalesce(p_payload -> 'contacts', '[]'::jsonb);
  v_primary_normalized jsonb;
  v_contacts_normalized jsonb := '[]'::jsonb;
  v_emails jsonb := '[]'::jsonb;
  v_phones jsonb := '[]'::jsonb;
  v_whatsapp jsonb := '{}'::jsonb;
  v_new jsonb;
  v_item jsonb;
  v_name text;
  v_phone text;
  v_email text;
  v_e164 text;
  v_whatsapp_enabled boolean;
begin
  if jsonb_typeof(v_primary) <> 'object' then
    raise exception 'Der Plärrdeifl-Hauptkontakt ist ungültig.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_contacts) <> 'array' then
    raise exception 'Kontakte müssen als Liste übergeben werden.' using errcode = '22023';
  end if;
  if jsonb_array_length(v_contacts) > 20 then
    raise exception 'Es können maximal 20 Bus-Orga-Kontakte gespeichert werden.' using errcode = '22023';
  end if;

  begin
    v_expected_revision := nullif(p_payload ->> 'expectedRevision', '')::integer;
  exception when others then
    v_expected_revision := null;
  end;

  select setting.value, setting.revision
  into v_before, v_current_revision
  from app_portal.settings as setting
  where setting.key = 'fanbus.organization_contact'
  for update;

  if not found then
    raise exception 'Die Fanbus-Kontakteinstellung wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_expected_revision is null or v_expected_revision <> v_current_revision then
    raise exception 'Die Kontaktdaten wurden zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode = '40001';
  end if;

  v_name := btrim(coalesce(v_primary ->> 'name', ''));
  v_phone := btrim(coalesce(v_primary ->> 'phone', ''));
  v_email := btrim(coalesce(v_primary ->> 'email', ''));
  v_whatsapp_enabled := coalesce((v_primary ->> 'whatsapp')::boolean, false);
  v_e164 := app_private.fanbus_contact_e164(v_phone);

  if length(v_name) not between 1 and 80 or v_name ~ E'[\r\n]' then
    raise exception 'Der Name des Plärrdeifl-Hauptkontakts ist ungültig.' using errcode = '22023';
  end if;
  if length(v_phone) > 40 or v_phone ~ E'[\r\n]' then
    raise exception 'Die Telefonnummer des Plärrdeifl-Hauptkontakts ist ungültig.' using errcode = '22023';
  end if;
  if v_phone <> '' and v_e164 is null then
    raise exception 'Die Telefonnummer des Plärrdeifl-Hauptkontakts ist nicht eindeutig.' using errcode = '22023';
  end if;
  if v_email <> '' and not app_private.notification_email_is_valid(v_email) then
    raise exception 'Die E-Mail-Adresse des Plärrdeifl-Hauptkontakts ist ungültig.' using errcode = '22023';
  end if;

  v_primary_normalized := jsonb_build_object(
    'name', v_name,
    'phone', v_phone,
    'whatsapp', v_whatsapp_enabled,
    'email', v_email
  );

  if v_email <> '' then
    v_emails := v_emails || jsonb_build_array(jsonb_build_object('label', v_name, 'value', v_email));
  end if;
  if v_e164 is not null then
    v_phones := v_phones || jsonb_build_array(jsonb_build_object('label', v_name, 'value', v_phone, 'href', 'tel:' || v_e164));
    if v_whatsapp_enabled then
      v_whatsapp := jsonb_build_object(
        'label', v_name,
        'username', v_phone,
        'url', 'https://wa.me/' || replace(v_e164, '+', '')
      );
    end if;
  end if;

  for v_item in select item.value from jsonb_array_elements(v_contacts) as item(value)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Mindestens ein Bus-Orga-Kontakt ist ungültig.' using errcode = '22023';
    end if;

    v_name := btrim(coalesce(v_item ->> 'name', ''));
    v_phone := btrim(coalesce(v_item ->> 'phone', ''));
    v_email := btrim(coalesce(v_item ->> 'email', ''));
    v_whatsapp_enabled := coalesce((v_item ->> 'whatsapp')::boolean, false);
    v_e164 := app_private.fanbus_contact_e164(v_phone);

    if length(v_name) not between 1 and 80 or v_name ~ E'[\r\n]' then
      raise exception 'Mindestens ein Kontaktname ist ungültig.' using errcode = '22023';
    end if;
    if length(v_phone) not between 3 and 40 or v_phone ~ E'[\r\n]' or v_e164 is null then
      raise exception 'Für jeden Bus-Orga-Kontakt ist eine gültige Telefonnummer erforderlich.' using errcode = '22023';
    end if;
    if v_email <> '' and not app_private.notification_email_is_valid(v_email) then
      raise exception 'Mindestens eine Kontakt-E-Mail-Adresse ist ungültig.' using errcode = '22023';
    end if;

    v_contacts_normalized := v_contacts_normalized || jsonb_build_array(jsonb_build_object(
      'name', v_name,
      'phone', v_phone,
      'whatsapp', v_whatsapp_enabled,
      'email', v_email
    ));
    v_phones := v_phones || jsonb_build_array(jsonb_build_object('label', v_name, 'value', v_phone, 'href', 'tel:' || v_e164));
    if v_email <> '' then
      v_emails := v_emails || jsonb_build_array(jsonb_build_object('label', v_name, 'value', v_email));
    end if;
  end loop;

  v_new := jsonb_build_object(
    'version', 2,
    'primary', v_primary_normalized,
    'contacts', v_contacts_normalized,
    'emails', v_emails,
    'phones', v_phones,
    'whatsapp', v_whatsapp
  );

  update app_portal.settings as setting
  set value = v_new,
      revision = setting.revision + 1,
      updated_at = now(),
      updated_by = v_actor
  where setting.key = 'fanbus.organization_contact';

  perform app_private.log_audit(
    v_actor,
    'FANBUS_CONTACTS_UPDATED',
    'settings',
    'fanbus.organization_contact',
    v_before,
    v_new,
    jsonb_build_object('contactCount', jsonb_array_length(v_contacts_normalized))
  );

  return app_private.api_fanbus_contact_admin_get('{}'::jsonb);
end;
$function$;

revoke all on function app_private.api_fanbus_contact_admin_get(jsonb) from public, anon, authenticated;
revoke all on function app_private.api_fanbus_contact_admin_save(jsonb) from public, anon, authenticated;

alter function app_private.platform_action_classification(text)
rename to platform_action_classification_before_m329_contacts;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $function$
  select case lower(btrim(coalesce(p_action, '')))
    when 'fanbus_contact_admin_get' then 'READ'
    when 'fanbus_contact_admin_save' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_m329_contacts(p_action)
  end
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
rename to pd_api_dispatch_current_before_m329_contacts;

create function app_private.pd_api_dispatch_current(p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
begin
  if v_action = 'fanbus_contact_admin_get' then
    return app_private.api_fanbus_contact_admin_get(coalesce(p_payload, '{}'::jsonb));
  end if;
  if v_action = 'fanbus_contact_admin_save' then
    return app_private.api_fanbus_contact_admin_save(coalesce(p_payload, '{}'::jsonb));
  end if;
  return app_private.pd_api_dispatch_current_before_m329_contacts(p_action, p_payload);
end;
$function$;

-- Die öffentlichen Fahrten liefern die zentrale Kontaktprojektion direkt mit.
-- Damit können Portal und externe Homepage-Renderer dieselbe Quelle verwenden.
create or replace function public.pd_public_fanbus_trips()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_base jsonb := public.pd_public_fanbus_trips_before_joint_f1();
  v_contact jsonb := app_private.fanbus_public_organization_contact();
begin
  return jsonb_build_object(
    'trips', coalesce((
      select jsonb_agg(
        item.value || jsonb_build_object(
          'defaultTripBoardingStopId', resolved.trip_boarding_stop_id,
          'busPreferenceSelectionEnabled', app_private.fanbus_bus_preference_selection_enabled(trip.id),
          'allowedBusPreferences', app_private.fanbus_allowed_bus_preferences(trip.id),
          'organizationContact', v_contact
        ) order by item.ordinality
      )
      from jsonb_array_elements(coalesce(v_base -> 'trips', '[]'::jsonb))
        with ordinality as item(value, ordinality)
      join app_modules.fanbus_trips as trip
        on trip.id = (item.value ->> 'tripId')::uuid
      cross join lateral app_private.fanbus_resolve_trip_boarding_stop(
        trip.id, null, null, 'NONE'
      ) as resolved
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.pd_public_fanbus_trip(p_trip_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_base jsonb := public.pd_public_fanbus_trip_before_joint_f1(p_trip_id);
  v_default_trip_stop uuid;
begin
  if coalesce((v_base ->> 'available')::boolean, false) is not true then
    return v_base;
  end if;

  select resolved.trip_boarding_stop_id into v_default_trip_stop
  from app_private.fanbus_resolve_trip_boarding_stop(
    p_trip_id, null, null, 'NONE'
  ) as resolved;

  return v_base || jsonb_build_object(
    'defaultTripBoardingStopId', v_default_trip_stop,
    'busPreferenceSelectionEnabled', app_private.fanbus_bus_preference_selection_enabled(p_trip_id),
    'allowedBusPreferences', app_private.fanbus_allowed_bus_preferences(p_trip_id),
    'organizationContact', app_private.fanbus_public_organization_contact()
  );
end;
$function$;

commit;
