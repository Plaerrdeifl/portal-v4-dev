from pathlib import Path

FANBUSES = Path('js/modules/fanbuses.js')


def one(source, old, new, label):
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 marker, got {count}')
    return source.replace(old, new, 1)


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

old_defaults = '''function bindTripEditorDateDefaults(form, trip) {\n  const departure = form?.elements.namedItem("departureAt");\n  const registrationCloses = form?.elements.namedItem("registrationClosesAt");\n  let registrationClosesAutoManaged = !trip.registrationClosesAt;\n\n  const disableRegistrationClosesAutoManagement = () => {\n    registrationClosesAutoManaged = false;\n  };\n\n  registrationCloses?.addEventListener("input", disableRegistrationClosesAutoManagement);\n  registrationCloses?.addEventListener("change", disableRegistrationClosesAutoManagement);\n  departure?.addEventListener("change", () => {\n    if (!registrationCloses || !registrationClosesAutoManaged || !departure.value) return;\n    try {\n      registrationCloses.value = defaultRegistrationClosesInput(\n        berlinLocalToIso(departure.value, "Die Abfahrt")\n      );\n    } catch {\n      // Native field validation remains authoritative while the value is incomplete.\n    }\n  });\n}'''
new_defaults = '''function bindTripEditorDateDefaults(form, trip) {\n  const departure = form?.elements.namedItem("departureTime") || form?.elements.namedItem("departureAt");\n  const registrationCloses = form?.elements.namedItem("registrationClosesAt");\n  let registrationClosesAutoManaged = !trip.registrationClosesAt;\n\n  const disableRegistrationClosesAutoManagement = () => {\n    registrationClosesAutoManaged = false;\n  };\n\n  registrationCloses?.addEventListener("input", disableRegistrationClosesAutoManagement);\n  registrationCloses?.addEventListener("change", disableRegistrationClosesAutoManagement);\n  departure?.addEventListener("change", () => {\n    if (!registrationCloses || !registrationClosesAutoManaged || !departure.value) return;\n    try {\n      const departureIso = departure.name === "departureTime"\n        ? tripTimeToBerlinIso(trip, departure.value, "Die Abfahrt")\n        : berlinLocalToIso(departure.value, "Die Abfahrt");\n      registrationCloses.value = defaultRegistrationClosesInput(departureIso);\n    } catch {\n      // Native field validation remains authoritative while the value is incomplete.\n    }\n  });\n}'''
source = one(source, old_defaults, new_defaults, 'date defaults')
FANBUSES.write_text(source)

# Update historical source-contract tests only where the approved UX changed the contract.
p = Path('tests/m310_m210_r1_contract.test.mjs')
s = p.read_text()
s = one(s, 'const tripFormStart = fanbuses.indexOf("function tripForm(trip)");', 'const tripFormStart = fanbuses.indexOf("function tripForm(");', 'm310 form marker')
s = one(s, '  assert.match(fanbuses, /registrationOpensAt: berlinLocalToIso/);', '  assert.match(fanbuses, /registrationOpensAt: values\\.registrationOpensAt[\\s\\S]+berlinLocalToIso/);', 'm310 opening preservation')
s = one(s, '  assert.match(tripFormSource, /v4-field-full">Abfahrt/);', '  assert.match(tripFormSource, /<label>Abfahrt[\\s\\S]+name="departureTime" type="time"/);', 'm310 responsive departure')
s = one(s, '  assert.match(tripFormSource, /v4-field-seven">Anmeldung beginnt[\\s\\S]+v4-field-seven">Anmeldung endet[\\s\\S]+v4-field-five">Fahrtpreis/);', '  assert.match(tripFormSource, /Fahrtpreis[\\s\\S]+Anmeldeschluss[\\s\\S]+Anmeldung beginnt/);\n  assert.match(tripFormSource, /v4-m310-editor-fields/);', 'm310 responsive fields')
s = one(s, '    /if \\(!registrationCloses \\|\\| !registrationClosesAutoManaged \\|\\| !departure\\.value\\) return/', '    /if \\(!registrationCloses \\|\\| !registrationClosesAutoManaged \\|\\| !departure\\.value\\) return/', 'keep auto managed marker')
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

p = Path('tests/p800_r2_fanbus_workflow_ux.test.mjs')
s = p.read_text()
s = one(s, '  assert.match(nav, /data-m310-buses/);\n  assert.match(nav, />Busse</);', '  assert.match(nav, /data-m310-occupancy/);\n  assert.match(nav, /Busverwaltung/);', 'new workflow bus management')
s = one(s, '  assert.match(nav, />Teilnehmer</);', '  assert.match(nav, />Teilnehmerliste</);', 'new workflow participant label')
p.write_text(s)

print('P800_R2_FANBUS_WORKFLOW_FOLLOWUP_OK')
