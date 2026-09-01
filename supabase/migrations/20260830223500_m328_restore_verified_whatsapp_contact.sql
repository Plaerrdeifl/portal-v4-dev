-- Plärrdeifl Digitalplattform V4
-- P300 / M328 – bestätigten BUS_ORGA-WhatsApp-Kontakt wiederherstellen.
-- Additive DEV migration. Keine PROD-Aktion.

begin;

update app_portal.settings
set value = (
      case
        when jsonb_typeof(value) = 'object' then value
        else '{}'::jsonb
      end
    ) || jsonb_build_object(
      'whatsapp', jsonb_build_object(
        'label', 'WhatsApp',
        'username', '@plaerrdeifl',
        'url', 'https://wa.me/plaerrdeifl'
      )
    ),
    updated_at = clock_timestamp()
where key = 'fanbus.organization_contact';

commit;
