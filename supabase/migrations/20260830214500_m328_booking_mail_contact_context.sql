-- Plärrdeifl Digitalplattform V4
-- P300 / M328 – Zentrale Buchungsreferenz- und Kontaktprojektion für Fanbus-E-Mails
-- Additive DEV migration. Keine PROD-Aktion.

begin;

insert into app_portal.settings(key, value, description)
values (
  'fanbus.organization_contact',
  jsonb_build_object(
    'emails', jsonb_build_array(
      jsonb_build_object(
        'label', 'BUS_ORGA',
        'value', 'fanbus@plaerrdeifl.de'
      )
    ),
    'phones', jsonb_build_array(
      jsonb_build_object(
        'label', 'Luca',
        'value', '0174 6681046',
        'href', 'tel:+491746681046'
      ),
      jsonb_build_object(
        'label', 'Pascal',
        'value', '0172 9744908',
        'href', 'tel:+491729744908'
      )
    ),
    'whatsapp', jsonb_build_object(
      'label', 'WhatsApp',
      'username', '@plaerrdeifl',
      'url', 'https://wa.me/plaerrdeifl'
    )
  ),
  'Öffentliche BUS_ORGA-Kontaktdaten für Fanbus-Success, E-Mail und Selfservice.'
)
on conflict (key) do update
set value = excluded.value,
    description = excluded.description;

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
  ), normalized as (
    select
      coalesce((
        select jsonb_agg(
          jsonb_strip_nulls(jsonb_build_object(
            'label', nullif(btrim(item.value ->> 'label'), ''),
            'value', btrim(item.value ->> 'value'),
            'href', 'mailto:' || btrim(item.value ->> 'value')
          ))
          order by item.ordinality
        )
        from source
        cross join lateral jsonb_array_elements(
          case
            when jsonb_typeof(source.value -> 'emails') = 'array'
              then source.value -> 'emails'
            else '[]'::jsonb
          end
        ) with ordinality as item(value, ordinality)
        where jsonb_typeof(item.value) = 'object'
          and app_private.notification_email_is_valid(item.value ->> 'value')
      ), '[]'::jsonb) as emails,
      coalesce((
        select jsonb_agg(
          jsonb_strip_nulls(jsonb_build_object(
            'label', nullif(btrim(item.value ->> 'label'), ''),
            'value', btrim(item.value ->> 'value'),
            'href', case
              when btrim(coalesce(item.value ->> 'href', '')) ~ '^tel:\+[0-9]{7,15}$'
                then btrim(item.value ->> 'href')
              else null
            end
          ))
          order by item.ordinality
        )
        from source
        cross join lateral jsonb_array_elements(
          case
            when jsonb_typeof(source.value -> 'phones') = 'array'
              then source.value -> 'phones'
            else '[]'::jsonb
          end
        ) with ordinality as item(value, ordinality)
        where jsonb_typeof(item.value) = 'object'
          and length(btrim(coalesce(item.value ->> 'value', ''))) between 3 and 40
          and (item.value ->> 'value') !~ E'[\r\n]'
      ), '[]'::jsonb) as phones,
      case
        when jsonb_typeof(source.value -> 'whatsapp') = 'object'
          and length(btrim(coalesce(source.value #>> '{whatsapp,username}', ''))) between 2 and 80
          and (source.value #>> '{whatsapp,username}') !~ E'[\r\n]'
          and btrim(coalesce(source.value #>> '{whatsapp,url}', '')) ~ '^https://wa\.me/[A-Za-z0-9._-]+$'
        then jsonb_strip_nulls(jsonb_build_object(
          'label', nullif(btrim(source.value #>> '{whatsapp,label}'), ''),
          'username', btrim(source.value #>> '{whatsapp,username}'),
          'url', btrim(source.value #>> '{whatsapp,url}')
        ))
        else '{}'::jsonb
      end as whatsapp
    from source
  )
  select jsonb_build_object(
    'emails', coalesce(normalized.emails, '[]'::jsonb),
    'phones', coalesce(normalized.phones, '[]'::jsonb),
    'whatsapp', coalesce(normalized.whatsapp, '{}'::jsonb)
  )
  from normalized
  union all
  select '{"emails":[],"phones":[],"whatsapp":{}}'::jsonb
  where not exists (select 1 from normalized)
  limit 1
$function$;

alter function app_private.notification_add_external_email(
  app_private.notification_events,text,text,text,text,jsonb,text,boolean
) rename to notification_add_external_email_before_m328_booking_contact_context;

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
  v_booking_exists boolean := false;
begin
  begin
    v_booking_id := nullif(v_data ->> 'bookingId', '')::uuid;
  exception when others then
    v_booking_id := null;
  end;

  if p_template_key like 'fanbus.%' and v_booking_id is not null then
    select exists(
      select 1
      from app_modules.fanbus_bookings as booking
      where booking.id = v_booking_id
    )
    into v_booking_exists;

    if v_booking_exists then
      v_data := v_data || jsonb_build_object(
        'organizationContact', app_private.fanbus_public_organization_contact()
      );
    end if;
  end if;

  perform app_private.notification_add_external_email_before_m328_booking_contact_context(
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

revoke all on function app_private.notification_add_external_email(
  app_private.notification_events,text,text,text,text,jsonb,text,boolean
) from public, anon, authenticated, service_role;
grant execute on function app_private.notification_add_external_email(
  app_private.notification_events,text,text,text,text,jsonb,text,boolean
) to postgres;

commit;
