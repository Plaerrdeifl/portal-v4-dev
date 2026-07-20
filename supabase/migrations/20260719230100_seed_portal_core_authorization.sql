insert into app_portal.portal_roles (
  id,
  code,
  name,
  description,
  sort_order
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'ADMIN',
    'Admin',
    'Initiale Rolle mit vollständiger Portaladministration.',
    10
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'MEMBER',
    'Plärrdeifl Mitglied',
    'Initiale Rolle für verknüpfte Fanclub-Mitglieder.',
    20
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'PORTAL_USER',
    'Portaluser',
    'Initiale Rolle für freigeschaltete Portalbenutzer ohne Mitgliedschaft.',
    30
  );

insert into app_portal.capabilities (
  code,
  name,
  category,
  description,
  sort_order
)
values
  ('portal.access', 'Portal nutzen', 'Portal', 'Geschützten Portalbereich öffnen.', 10),
  ('portal.admin', 'Portal vollständig administrieren', 'Portal', 'Vollständiger administrativer Zugriff.', 20),
  ('roles.manage', 'Rollen verwalten', 'Administration', 'Rollen und Rollenrechte verwalten.', 30),
  ('users.manage', 'Benutzer verwalten', 'Administration', 'Benutzer und Freischaltungsanträge verwalten.', 40),
  ('audit.read', 'Audit lesen', 'Administration', 'Audit-Ereignisse einsehen.', 50),
  ('members.read', 'Mitglieder lesen', 'Fanclub', 'Mitgliedsdaten einsehen.', 60),
  ('members.manage', 'Mitglieder verwalten', 'Fanclub', 'Mitgliedsdaten anlegen und bearbeiten.', 70),
  ('offices.manage', 'Ämter verwalten', 'Fanclub', 'Die fünf festen Amtsplätze besetzen.', 80),
  ('finance.read', 'Finanzen lesen', 'Fanclub', 'Konten, Beiträge und Salden einsehen.', 90),
  ('finance.manage', 'Finanzen verwalten', 'Fanclub', 'Geschützte Finanzschreibvorgänge ausführen.', 100),
  ('teams.read', 'Teams lesen', 'Teams', 'Teamdaten einsehen.', 110),
  ('teams.manage', 'Teams verwalten', 'Teams', 'Teams und Teammitgliedschaften verwalten.', 120),
  ('tasks.read', 'Aufgaben lesen', 'Aufgaben', 'Zulässige Aufgaben einsehen.', 130),
  ('tasks.create', 'Aufgaben erstellen', 'Aufgaben', 'Zulässige Aufgaben erstellen.', 140),
  ('tasks.manage', 'Aufgaben verwalten', 'Aufgaben', 'Aufgaben übergreifend verwalten.', 150),
  ('settings.manage', 'Portaleinstellungen verwalten', 'Administration', 'Nicht geheime Portaleinstellungen verwalten.', 160);

insert into app_portal.role_capabilities (role_id, capability_code)
select
  '00000000-0000-4000-8000-000000000001'::uuid,
  capability.code
from app_portal.capabilities as capability;

insert into app_portal.role_capabilities (role_id, capability_code)
values
  ('00000000-0000-4000-8000-000000000002', 'portal.access'),
  ('00000000-0000-4000-8000-000000000003', 'portal.access');

insert into app_fanclub.office_slots (code, label, sort_order)
values
  ('VORSTAND_1', 'Vorstand 1', 10),
  ('VORSTAND_2', 'Vorstand 2', 20),
  ('VORSTAND_3', 'Vorstand 3', 30),
  ('KASSIER', 'Kassier', 40),
  ('SCHRIFTFUEHRER', 'Schriftführer', 50);

insert into app_fanclub.office_capabilities (office_code, capability_code)
select
  office.code,
  capability.code
from app_fanclub.office_slots as office
cross join (
  values
    ('members.read'),
    ('members.manage'),
    ('finance.read'),
    ('tasks.read'),
    ('tasks.create'),
    ('tasks.manage')
) as capability(code);

insert into app_fanclub.office_capabilities (office_code, capability_code)
values ('KASSIER', 'finance.manage');

insert into app_portal.team_functions (code, name, description)
values
  (
    'BUS_KASSE',
    'Bus-Kasse',
    'Vorbereitete Teamfunktion für spätere Bus-Zahlungsrechte.'
  );

insert into app_portal.settings (key, value, description)
values
  (
    'portal.core',
    jsonb_build_object(
      'version', '4.0.0-core',
      'architecture', 'supabase',
      'legacyBackendEnabled', false
    ),
    'Technischer Portal-Core-Status.'
  );
