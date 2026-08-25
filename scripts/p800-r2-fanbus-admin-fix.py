from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"Marker fehlt: {label}")
    return text.replace(old, new, 1)


def sub_once(text, pattern, replacement, label):
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"Regex-Marker fehlt: {label}")
    return next_text


fanbus_path = Path("js/modules/fanbuses.js")
source = fanbus_path.read_text()
source = source.replace('{ value: "EGAL", label: "EGAL" }', '{ value: "EGAL", label: "Egal" }')
source = source.replace('{ value: "RUHIG", label: "RUHIG" }', '{ value: "RUHIG", label: "Ruhig" }')
source = source.replace('{ value: "PARTY", label: "PARTY" }', '{ value: "PARTY", label: "Party" }')
source = source.replace("Buspräferenz", "Buswunsch")

source = replace_once(
    source,
    '''      <p class="subtle">Mitfahrer verwalten</p>
      <div class="v4-m310-registration-toolbar-actions">
        <button class="button small primary" type="button" data-m310-export-registrations>Excel exportieren</button>
        ${readOnly ? "" : '<button class="button small secondary" type="button" data-m310-add-registration>Mitfahrer hinzufügen</button>'}''',
    '''      <p class="subtle">Teilnehmer verwalten</p>
      <div class="v4-m310-registration-toolbar-actions">
        <button class="button small secondary" type="button" data-m310-export-registrations>Excel exportieren</button>
        ${readOnly ? "" : '<button class="button small primary" type="button" data-m310-add-registration>Teilnehmer hinzufügen</button>'}''',
    "Teilnehmer-Toolbar",
)

source = sub_once(
    source,
    r'''  const email = registration\.email\n    \? `<span class="v4-m310-registration-email">\$\{escapeHtml\(registration\.email\)\}</span>`\n    : "";\n''',
    "",
    "E-Mail-Anzeige der Teilnehmerkarte",
)

source = replace_once(
    source,
    '''  return `<article class="v4-m310-registration-record v4-interactive-card" tabindex="0" role="button"
    aria-label="Aktionen für ${escapeAttr(`${registration.firstName} ${registration.lastName}`)}"
    data-m320-registration-record="${escapeAttr(registration.id)}"
    data-m320-open-registration="${escapeAttr(registration.id)}">''',
    '''  return `<article class="v4-m310-registration-record"
    data-m320-registration-record="${escapeAttr(registration.id)}">''',
    "Teilnehmerkarte ohne versteckten Karten-Klick",
)
source = source.replace("    ${email}\n", "", 1)
source = replace_once(
    source,
    '''      ${cancelledAt}
      <span class="v4-row-chevron" aria-hidden="true">›</span>''',
    '''      ${cancelledAt}
      ${!readOnly && registration.status !== "CANCELLED" ? `<div class="v4-m310-registration-actions">
        <button class="button small secondary" type="button" data-m320-edit-registration="${escapeAttr(registration.id)}">Bearbeiten</button>
        <button class="button small ghost" type="button" data-m320-more-registration="${escapeAttr(registration.id)}">Weitere Aktionen</button>
      </div>` : ""}''',
    "explizite Teilnehmeraktionen",
)
source = source.replace('placeholder="Vorname, Nachname oder E-Mail"', 'placeholder="Teilnehmer suchen"', 1)

source = sub_once(
    source,
    r'''  body\.querySelectorAll\("\[data-m320-open-registration\]"\)\.forEach\(card => \{.*?\n  \}\);''',
    '''  const registrationItems = Array.isArray(data?.registrations) ? data.registrations : [];

  body.querySelectorAll("[data-m320-edit-registration]").forEach(button => {
    button.addEventListener("click", () => {
      const registration = registrationItems.find(item => item.id === button.dataset.m320EditRegistration);
      if (registration) void openRegistrationEdit(trip, registration, dialog);
    });
  });

  body.querySelectorAll("[data-m320-more-registration]").forEach(button => {
    button.addEventListener("click", () => {
      const registration = registrationItems.find(item => item.id === button.dataset.m320MoreRegistration);
      if (registration) openRegistrationActions(trip, registration, dialog);
    });
  });''',
    "Teilnehmerkarten-Klickbindung",
)

source = replace_once(
    source,
    "  const busCards = buses.map(bus => {",
    "  const visibleBuses = buses.filter(bus => bus.isActive !== false);\n  const busCards = visibleBuses.map(bus => {",
    "aktive Buskarten",
)

source = sub_once(
    source,
    r'''    return `<article class="v4-m310-occupancy-bus-card v4-interactive-card".*?    </article>`;\n  \}\)\.join\(""\);''',
    '''    const occupied = Number(bus.occupancy ?? bus.occupied ?? participants.length ?? 0);
    return `<article class="v4-m310-occupancy-bus-card">
      <div class="v4-m310-occupancy-bus-heading">
        <div><strong>${escapeHtml(bus.label)}</strong><small>${escapeHtml(busCategoryLabel(bus.category))}</small></div>
        <span class="v4-m310-bus-card-meta"><span>${escapeHtml(occupied)} / ${escapeHtml(bus.capacity)} Plätze</span></span>
      </div>
      <p><span>Zustiege</span><strong>${escapeHtml(stopSummary)}</strong></p>
      ${canManageBuses && !readOnly ? `<div class="v4-m310-bus-card-actions">
        <button class="button small secondary" type="button" data-m310-bus-edit="${escapeAttr(bus.id)}">Bearbeiten</button>
        <button class="button small secondary" type="button" data-m310-bus-stops="${escapeAttr(bus.id)}"${mapping ? "" : " disabled"}>Zustiege</button>
        <button class="button small danger" type="button" data-m310-bus-delete="${escapeAttr(bus.id)}"${occupied > 0 ? " disabled" : ""}>Bus löschen</button>
      </div>${occupied > 0 ? '<small class="subtle v4-m310-bus-delete-note">Zum Löschen zuerst alle Teilnehmer einem anderen Bus zuordnen.</small>' : ""}` : ""}
    </article>`;
  }).join("");''',
    "Buskarten ohne Teilnehmerdetails",
)

source = sub_once(
    source,
    r'''  return `<div class="v4-m310-occupancy">.*?  </div>`;\n}\n\nfunction openBusActions''',
    '''  return `<div class="v4-m310-occupancy">
    ${readOnly ? '<p class="notice error">Die Fahrt ist abgesagt. Busdaten bleiben historisch lesbar.</p>' : ""}
    <div class="v4-m310-occupancy-actions">${canManageBuses && !readOnly ? '<button class="button small primary" type="button" data-m310-create-bus>Bus anlegen</button>' : ""}</div>
    <section class="v4-m310-occupancy-buses" aria-label="Busse">${busCards || empty("Für diese Fahrt sind noch keine Busse angelegt.")}</section>
  </div>`;
}

function openBusActions''',
    "Busverwaltung ohne Teilnehmerbereich",
)

source = sub_once(
    source,
    r'''    dialog\.querySelectorAll\("\[data-m310-open-bus-actions\]"\)\.forEach\(card => \{.*?\n    \}\);''',
    '''    dialog.querySelectorAll("[data-m310-bus-edit]").forEach(button => {
      button.addEventListener("click", () => {
        const bus = buses.find(item => item.id === button.dataset.m310BusEdit);
        if (bus) openBusEditor(trip, data, bus, dialog);
      });
    });

    dialog.querySelectorAll("[data-m310-bus-stops]").forEach(button => {
      button.addEventListener("click", () => {
        const bus = buses.find(item => item.id === button.dataset.m310BusStops);
        if (!bus) return;
        const mapping = (busMappings?.buses || []).find(item => item.busId === bus.id);
        if (mapping) openBusStops(trip, bus, mapping, tripStops, dialog);
      });
    });

    dialog.querySelectorAll("[data-m310-bus-delete]").forEach(button => {
      button.addEventListener("click", async () => {
        const bus = buses.find(item => item.id === button.dataset.m310BusDelete);
        if (!bus || Number(bus.occupancy ?? bus.occupied ?? 0) > 0) return;
        const confirmed = await confirmAction(`Bus „${bus.label}“ löschen?`, {
          danger: true,
          title: "Bus löschen",
          submitLabel: "Bus löschen"
        });
        if (!confirmed) return;
        try {
          await runWrite(() => call("fanbus_bus_upsert", {
            id: bus.id,
            tripId: trip.id,
            expectedRevision: Number(bus.revision),
            label: bus.label,
            category: bus.category,
            capacity: Number(bus.capacity),
            isActive: false
          }), "Bus wurde gelöscht.");
          snapshot = await call("fanbus_trips_list");
          await loadOccupancyInto(dialog, trip);
        } catch (error) {
          showToast(error?.message || "Bus konnte nicht gelöscht werden.", "error", 5200);
        }
      });
    });''',
    "direkte Busaktionen",
)
fanbus_path.write_text(source)

common_path = Path("js/modules/common.js")
common = common_path.read_text()
common = replace_once(
    common,
    '''  dialog.addEventListener("click", event => {
    if (event.target === dialog || event.target.closest("[data-v4-dialog-close]")) {
      closeDialog(dialog);
    }
  });''',
    '''  dialog.addEventListener("click", event => {
    const closeTarget = event.target.closest?.("[data-v4-dialog-close]");
    if (event.target !== dialog && !closeTarget) return;

    if (event.target === dialog || closeTarget?.closest("header")) {
      dialogContexts.length = 0;
      closeDialog(dialog, "", { restoreParent: false });
      return;
    }

    closeDialog(dialog);
  });''',
    "Dialog-X schließt gesamten Dialogstack",
)
common_path.write_text(common)

css_path = Path("css/app.css")
css = css_path.read_text()
css = replace_once(
    css,
    '''#v4DialogBody{
  flex:0 1 auto!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  overflow-x:hidden!important;
  overflow-y:auto!important;
  overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;''',
    '''#v4DialogBody{
  flex:1 1 auto!important;
  height:auto!important;
  min-height:0!important;
  max-height:calc(100dvh - 96px)!important;
  overflow-x:hidden!important;
  overflow-y:auto!important;
  overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;
  touch-action:pan-y!important;''',
    "mobiler Dialog-Scroll",
)
css += '''\n\n/* P800-R2 Fanbus Verwaltung – mobile Arbeitsflächen */
.v4-m310-registration-actions,.v4-m310-bus-card-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.v4-m310-registration-actions .button,.v4-m310-bus-card-actions .button{flex:1 1 130px}
.v4-m310-bus-delete-note{display:block;margin-top:8px}
@media(max-width:620px){
  .v4-m310-registration-actions,.v4-m310-bus-card-actions{display:grid;grid-template-columns:1fr 1fr}
  .v4-m310-bus-card-actions .button.danger{grid-column:1/-1}
}
'''
css_path.write_text(css)

test_path = Path("tests/p800_r2_fanbus_admin_cleanup.test.mjs")
test_path.write_text('''import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

test("P800-R2 Fanbus Verwaltung trennt Busse und Teilnehmer mobil sauber", async () => {
  const [fanbuses, common, css] = await Promise.all([
    read("js/modules/fanbuses.js"),
    read("js/modules/common.js"),
    read("css/app.css")
  ]);
  const occupancyStart = fanbuses.indexOf("function occupancyMarkup");
  const occupancyEnd = fanbuses.indexOf("function openBusActions", occupancyStart);
  const occupancy = fanbuses.slice(occupancyStart, occupancyEnd);
  assert.ok(occupancyStart >= 0 && occupancyEnd > occupancyStart);
  assert.doesNotMatch(occupancy, /Teilnehmer anzeigen/);
  assert.doesNotMatch(occupancy, /<summary>Teilnehmer/);
  assert.doesNotMatch(occupancy, /v4-m310-occupancy-groups/);
  assert.match(occupancy, /data-m310-bus-edit/);
  assert.match(occupancy, /data-m310-bus-delete/);
  assert.match(fanbuses, /isActive: false/);
  assert.doesNotMatch(fanbuses, /data-m320-open-registration/);
  assert.doesNotMatch(fanbuses, /v4-m310-registration-email/);
  assert.match(fanbuses, /data-m320-edit-registration/);
  assert.match(fanbuses, /data-m320-more-registration/);
  assert.match(fanbuses, /Buswunsch/);
  assert.doesNotMatch(fanbuses, /Buspräferenz/);
  assert.match(common, /restoreParent: false/);
  assert.match(css, /touch-action:pan-y!important/);
  assert.match(css, /max-height:calc\\(100dvh - 96px\\)!important/);
});
''')
