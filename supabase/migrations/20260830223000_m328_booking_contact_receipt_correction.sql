-- Plärrdeifl Digitalplattform V4
-- P300 / M328 – Korrektur nach DEV-Abnahme:
-- 1) unbestätigten WhatsApp-Platzhalter aus dem zentralen BUS_ORGA-Kontakt entfernen
-- 2) sichere Buchungsnummer-Projektion für den unmittelbaren Public-Receipt ergänzen
-- Additive DEV migration. Keine PROD-Aktion.

begin;

update app_portal.settings
set value = (
      case
        when jsonb_typeof(value) = 'object' then value
        else '{}'::jsonb
      end
    ) || jsonb_build_object('whatsapp', '{}'::jsonb),
    updated_at = clock_timestamp()
where key = 'fanbus.organization_contact';

create or replace function public.pd_public_fanbus_booking_reference(
  p_trip_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce((
    select jsonb_build_object(
      'bookingNumber', booking.booking_number
    )
    from app_private.fanbus_registration_idempotency as idempotency
    join app_modules.fanbus_bookings as booking
      on booking.id = idempotency.booking_id
    where idempotency.trip_id = p_trip_id
      and idempotency.idempotency_key = p_idempotency_key
      and idempotency.outcome in ('CREATED', 'WAITLISTED', 'ALREADY_ACTIVE')
      and booking.booking_number ~ '^(FB|DEV)-[0-9]{2}-[0-9]{6,}$'
    limit 1
  ), '{}'::jsonb);
$function$;

revoke all on function public.pd_public_fanbus_booking_reference(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.pd_public_fanbus_booking_reference(uuid, uuid)
to anon, authenticated;

comment on function public.pd_public_fanbus_booking_reference(uuid, uuid) is
  'M328: liefert ausschließlich die Buchungsnummer zum exakten Trip-/Idempotency-Key einer erfolgreichen Fanbus-Anmeldung.';

commit;
