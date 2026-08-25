from pathlib import Path

FANBUSES = Path('js/modules/fanbuses.js')


def one(source, old, new, label):
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 marker, got {count}')
    return source.replace(old, new, 1)


def replace_function(source, signature, replacement, label):
    start = source.find(signature)
    if start < 0:
        raise RuntimeError(f'{label}: missing function {signature}')
    end = source.find('\nfunction ', start + len(signature))
    if end < 0:
        raise RuntimeError(f'{label}: missing following function marker')
    return source[:start] + replacement.rstrip() + '\n' + source[end:]


# Runtime compatibility/right preservation after the approved UX rewrite.
source = FANBUSES.read_text()
source = one(
    source,
    '''  const operationsAccess = fanbusOperationsAccess(trip);\n  const canEdit = canManage && ["DRAFT", "PUBLISHED"].includes(trip.status);\n  const moreActions = tripManagementActions(trip);\n\n  return `<nav class="v4-m310-trip-nav" aria-label="Arbeitsbereiche der Fanbusfahrt">\n    ${operationsAccess.canManageRegistrations ? `<button class="button small secondary" type="button" data-m310-participants="${escapeAttr(trip.id)}">Teilnehmer</button>` : ""}\n    ${canManage ? `<button class="button small secondary" type="button" data-m310-buses="${escapeAttr(trip.id)}">Busse</button>` : ""}\n    ${operationsAccess.canRead ? `<button class="button small secondary" type="button" data-m325-operations="${escapeAttr(trip.id)}">Fahrtbetrieb</button>` : ""}\n    ${canEdit ? `<button class="button small secondary" type="button" data-m310-edit-mode="${escapeAttr(trip.id)}">Bearbeiten</button>` : ""}''',
    '''  const operationsAccess = fanbusOperationsAccess(trip);\n  const canOpenOccupancy = canManage || operationsAccess.canManageRegistrations;\n  const canEdit = canManage && ["DRAFT", "PUBLISHED"].includes(trip.status);\n  const moreActions = tripManagementActions(trip);\n\n  return `<nav class="v4-m310-trip-nav" aria-label="Arbeitsbereiche der Fanbusfahrt">\n    ${operationsAccess.canManageRegistrations ? `<button class="button small secondary" type="button" data-m310-participants="${escapeAttr(trip.id)}">Teilnehmerliste</button>` : ""}\n    ${canOpenOccupancy ? `<button class="button small secondary" type="button" data-m310-occupancy="${escapeAttr(trip.id)}">${canManage ? "Busverwaltung" : "Belegung"}</button>` : ""}\n    ${operationsAccess.canRead ? `<button class="button small secondary" type="button" data-m325-operations="${escapeAttr(trip.id)}">Fahrtbetrieb</button>` : ""}\n    ${canEdit ? `<button class="button small secondary" type="button" data-m310-edit-mode="${escapeAttr(trip.id)}">Bearbeiten</button>` : ""}''',
    'navigation rights'
)
source = one(
    source,
    '  if (trip.status === "CLOSED") {\n    actions.push(`<button class="button small secondary" type="button" data-m310-reopen="${escapeAttr(trip.id)}">Wieder als Entwurf öffnen</button>`);\n  }',
    '  if (canManage && trip.status === "CLOSED") {\n    actions.push(`<button class="button small secondary" type="button" data-m310-reopen="${escapeAttr(trip.id)}">Wieder als Entwurf öffnen</button>`);\n  }',
    'reopen capability marker'
)

new_defaults = '''function bindTripEditorDateDefaults(form, trip) {
  const departure = form?.elements.namedItem("departureTime") || form?.elements.namedItem("departureAt");
  const registrationCloses = form?.elements.namedItem("registrationClosesAt");
  let registrationClosesAutoManaged = !trip.registrationClosesAt;

  const disableRegistrationClosesAutoManagement = () => {
    registrationClosesAutoManaged = false;
  };

  registrationCloses?.addEventListener("input", disableRegistrationClosesAutoManagement);
  registrationCloses?.addEventListener("change", disableRegistrationClosesAutoManagement);
  departure?.addEventListener("change", () => {
    if (!registrationCloses || !registrationClosesAutoManaged || !departure.value) return;
    try {
      const departureIso = departure.name === "departureTime"
        ? tripTimeToBerlinIso(trip, departure.value, "Die Abfahrt")
        : berlinLocalToIso(departure.value, "Die Abfahrt");
      registrationCloses.value = defaultRegistrationClosesInput(departureIso);
    } catch {
      // Native field validation remains authoritative while the value is incomplete.
    }
  });
}'''
source = replace_function(
    source,
    'function bindTripEditorDateDefaults(form, trip) {',
    new_defaults,
    'date defaults'
)
FANBUSES.write_text(source)

# Update historical source-contract tests only where the approved UX changed the contract.
p = Path('tests/m310_m210_r1_contract.test.mjs')
s = p.read_text()
s = one(s, 'const tripFormStart = fanbuses.indexOf("function tripForm(trip)");', 'const tripFormStart = fanbuses.indexOf("function tripForm(");', 'm310 form marker')
s = one(s, '  assert.match(fanbuses, /registrationOpensAt: berlinLocalToIso/);', '  assert.match(fanbuses, /registrationOpensAt: values\\.registrationOpensAt[\\s\\S]+berlinLocalToIso/);', 'm310 opening preservation')
s = one(s, '  assert.match(tripFormSource, /v4-field-full">Abfahrt/);', '  assert.match(tripFormSource, /<label>Abfahrt[\\s\\S]+name="departureTime" type="time"/);', 'm310 responsive departure')
s = one(s, '  assert.match(tripFormSource, /v4-field-seven">Anmeldung beginnt[\\s\\S]+v4-field-seven">Anmeldung endet[\\s\\S]+v4-field-five">Fahrtpreis/);', '  assert.match(tripFormSource, /Fahrtpreis[\\s\\S]+Anmeldeschluss[\\s\\S]+Anmeldung beginnt/);\n  assert.match(tripFormSource, /v4-m310-editor-fields/);', 'm310 responsive fields')
s = one(s, '    /registrationCloses\\.value = defaultRegistrationClosesInput\\([\\s\\S]+berlinLocalToIso\\(departure\\.value/', '    /registrationCloses\\.value = defaultRegistrationClosesInput\\(departureIso\\)/', 'm310 time-only close default')
p.write_text(s)

p = Path('tests/m310_operational_fix_contract.test.mjs')
s = p.read_text()
s = one(s, '  assert.match(ui, /berlinLocalToIso\\(values\\.departureAt/);', '  assert.match(ui, /tripTimeToBerlinIso\\(trip, values\\.departureTime/);', 'operational time-only departure')
p.write_text(s)

p = Path('tests/m325_r1_contract.test.mjs')
s = p.read_text()
s = one(s, '  assert.match(detail, /registrationWindowText\\(trip\\)/);', '  assert.match(detail, /tripRegistrationDeadlineMarkup\\(trip\\)/);', 'm325 detail deadline')
p.write_text(s)

p = Path('tests/p800_u2_ui_contract.test.mjs')
s = p.read_text()
s = one(s, '  assert.match(detailSource, /registrationWindowText\\(trip\\)/);', '  assert.match(detailSource, /tripRegistrationDeadlineMarkup\\(trip\\)/);', 'u2 detail deadline')
s = one(s, '  assert.match(navigationSource, />Belegung</);', '  assert.match(navigationSource, />Teilnehmerliste</);\n  assert.match(navigationSource, /Busverwaltung/);', 'u2 direct work areas')
s = one(s, '  assert.match(navigationSource, /data-m310-trip-settings/);', '  assert.doesNotMatch(navigationSource, /data-m310-trip-settings|⚙️/);\n  assert.match(navigationSource, /data-m310-edit-mode/);', 'u2 no gear')
p.write_text(s)

p = Path('tests/p800_u5_fanbus_contract.test.mjs')
s = p.read_text()
s = one(s, '  assert.match(nav, />Teilnehmer</);', '  assert.match(nav, />Teilnehmerliste</);', 'U5 participant work area')
p.write_text(s)

p = Path('tests/p800_r2_fanbus_workflow_ux.test.mjs')
s = p.read_text()
s = one(s, '  assert.match(nav, /data-m310-buses/);\n  assert.match(nav, />Busse</);', '  assert.match(nav, /data-m310-occupancy/);\n  assert.match(nav, /Busverwaltung/);', 'new workflow bus management')
s = one(s, '  assert.match(nav, />Teilnehmer</);', '  assert.match(nav, />Teilnehmerliste</);', 'new workflow participant label')
p.write_text(s)

print('P800_R2_FANBUS_WORKFLOW_FOLLOWUP_OK')
