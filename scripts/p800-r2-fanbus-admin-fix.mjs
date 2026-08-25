import fs from "node:fs";

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Marker fehlt: ${label}`);
  return source.replace(from, to);
}

function replaceRegex(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Regex-Marker fehlt: ${label}`);
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

const fanbusPath = "js/modules/fanbuses.js";
let source = fs.readFileSync(fanbusPath, "utf8");

source = source
  .replace('{ value: "EGAL", label: "EGAL" }', '{ value: "EGAL", label: "Egal" }')
  .replace('{ value: "RUHIG", label: "RUHIG" }', '{ value: "RUHIG", label: "Ruhig" }')
  .replace('{ value: "PARTY", label: "PARTY" }', '{ value: "PARTY", label: "Party" }')
  .replaceAll("Buspräferenz", "Buswunsch");

source = replaceOnce(
  source,
  `      <p class="subtle">Mitfahrer verwalten</p>\n      <div class="v4-m310-registration-toolbar-actions">\n        <button class="button small primary" type="button" data-m310-export-registrations>Excel exportieren</button>\n        \${readOnly ? "" : '<button class="button small secondary" type="button" data-m310-add-registration>Mitfahrer hinzufügen</button>'}`,
  `      <p class="subtle">Teilnehmer verwalten</p>\n      <div class="v4-m310-registration-toolbar-actions">\n        <button class="button small secondary" type="button" data-m310-export-registrations>Excel exportieren</button>\n        \${readOnly ? "" : '<button class="button small primary" type="button" data-m310-add-registration>Teilnehmer hinzufügen</button>'}`,
  "Teilnehmer-Toolbar"
);

source = replaceRegex(
  source,
  /  const email = registration\.email\n    \? `<span class="v4-m310-registration-email">\$\{escapeHtml\(registration\.email\)\}<\/span>`\n    : "";\n/,
  "",
  "E-Mail-Anzeige der Teilnehmerkarte"
);

source = replaceOnce(
  source,
  `  return \`<article class="v4-m310-registration-record v4-interactive-card" tabindex="0" role="button"\n    aria-label="Aktionen für \${escapeAttr(\`\${registration.firstName} \${registration.lastName}\`)}"\n    data-m320-registration-record="\${escapeAttr(registration.id)}"\n    data-m320-open-registration="\${escapeAttr(registration.id)}">`,
  `  return \`<article class="v4-m310-registration-record"\n    data-m320-registration-record="\${escapeAttr(registration.id)}">`,
  "Teilnehmerkarte ohne versteckten Karten-Klick"
);

source = source.replace("    ${email}\n", "");
source = replaceOnce(
  source,
  `      \${cancelledAt}\n      <span class="v4-row-chevron" aria-hidden="true">›</span>`,
  `      \${cancelledAt}\n      \${!readOnly && registration.status !== "CANCELLED" ? \`<div class="v4-m310-registration-actions">\n        <button class="button small secondary" type="button" data-m320-edit-registration="\${escapeAttr(registration.id)}">Bearbeiten</button>\n        <button class="button small ghost" type="button" data-m320-more-registration="\${escapeAttr(registration.id)}">Weitere Aktionen</button>\n      </div>\` : ""}`,
  "explizite Teilnehmeraktionen"
);
source = source.replace('placeholder="Vorname, Nachname oder E-Mail"', 'placeholder="Teilnehmer suchen"');

source = replaceRegex(
  source,
  /  body\.querySelectorAll\("\[data-m320-open-registration\]"\)\.forEach\(card => \{[\s\S]*?\n  \}\);/,
  `  const registrationItems = Array.isArray(data?.registrations) ? data.registrations : [];\n\n  body.querySelectorAll("[data-m320-edit-registration]").forEach(button => {\n    button.addEventListener("click", () => {\n      const registration = registrationItems.find(item => item.id === button.dataset.m320EditRegistration);\n      if (registration) void openRegistrationEdit(trip, registration, dialog);\n    });\n  });\n\n  body.querySelectorAll("[data-m320-more-registration]").forEach(button => {\n    button.addEventListener("click", () => {\n      const registration = registrationItems.find(item => item.id === button.dataset.m320MoreRegistration);\n      if (registration) openRegistrationActions(trip, registration, dialog);\n    });\n  });`,
  "Teilnehmerkarten-Klickbindung"
);

source = replaceOnce(
  source,
  "  const busCards = buses.map(bus => {",
  "  const visibleBuses = buses.filter(bus => bus.isActive !== false);\n  const busCards = visibleBuses.map(bus => {",
  "aktive Buskarten"
);

source = replaceRegex(
  source,
  /    return `<article class="v4-m310-occupancy-bus-card v4-interactive-card"[\s\S]*?    <\/article>`;\n  \}\)\.join\(""\);/,
  `    const occupied = Number(bus.occupancy ?? bus.occupied ?? participants.length ?? 0);\n    return \`<article class="v4-m310-occupancy-bus-card">\n      <div class="v4-m310-occupancy-bus-heading">\n        <div><strong>\${escapeHtml(bus.label)}</strong><small>\${escapeHtml(busCategoryLabel(bus.category))}</small></div>\n        <span class="v4-m310-bus-card-meta"><span>\${escapeHtml(occupied)} / \${escapeHtml(bus.capacity)} Plätze</span></span>\n      </div>\n      <p><span>Zustiege</span><strong>\${escapeHtml(stopSummary)}</strong></p>\n      \${canManageBuses && !readOnly ? \`<div class="v4-m310-bus-card-actions">\n        <button class="button small secondary" type="button" data-m310-bus-edit="\${escapeAttr(bus.id)}">Bearbeiten</button>\n        <button class="button small secondary" type="button" data-m310-bus-stops="\${escapeAttr(bus.id)}"\${mapping ? "" : " disabled"}>Zustiege</button>\n        <button class="button small danger" type="button" data-m310-bus-delete="\${escapeAttr(bus.id)}"\${occupied > 0 ? " disabled" : ""}>Bus löschen</button>\n      </div>\${occupied > 0 ? '<small class="subtle v4-m310-bus-delete-note">Zum Löschen zuerst alle Teilnehmer einem anderen Bus zuordnen.</small>' : ""}\` : ""}\n    </article>`;\n  }).join("");`,
  "Buskarten ohne Teilnehmerdetails"
);

source = replaceRegex(
  source,
  /  return `<div class="v4-m310-occupancy">[\s\S]*?  <\/div>`;\n}\n\nfunction openBusActions/,
  `  return \`<div class="v4-m310-occupancy">\n    \${readOnly ? '<p class="notice error">Die Fahrt ist abgesagt. Busdaten bleiben historisch lesbar.</p>' : ""}\n    <div class="v4-m310-occupancy-actions">\${canManageBuses && !readOnly ? '<button class="button small primary" type="button" data-m310-create-bus>Bus anlegen</button>' : ""}</div>\n    <section class="v4-m310-occupancy-buses" aria-label="Busse">\${busCards || empty("Für diese Fahrt sind noch keine Busse angelegt.")}</section>\n  </div>`;\n}\n\nfunction openBusActions`,
  "Busverwaltung ohne Teilnehmerbereich"
);

source = replaceRegex(
  source,
  /    dialog\.querySelectorAll\("\[data-m310-open-bus-actions\]"\)\.forEach\(card => \{[\s\S]*?\n    \}\);/,
  `    dialog.querySelectorAll("[data-m310-bus-edit]").forEach(button => {\n      button.addEventListener("click", () => {\n        const bus = buses.find(item => item.id === button.dataset.m310BusEdit);\n        if (bus) openBusEditor(trip, data, bus, dialog);\n      });\n    });\n\n    dialog.querySelectorAll("[data-m310-bus-stops]").forEach(button => {\n      button.addEventListener("click", () => {\n        const bus = buses.find(item => item.id === button.dataset.m310BusStops);\n        if (!bus) return;\n        const mapping = (busMappings?.buses || []).find(item => item.busId === bus.id);\n        if (mapping) openBusStops(trip, bus, mapping, tripStops, dialog);\n      });\n    });\n\n    dialog.querySelectorAll("[data-m310-bus-delete]").forEach(button => {\n      button.addEventListener("click", async () => {\n        const bus = buses.find(item => item.id === button.dataset.m310BusDelete);\n        if (!bus || Number(bus.occupancy ?? bus.occupied ?? 0) > 0) return;\n        const confirmed = await confirmAction(\`Bus „\${bus.label}“ löschen?\`, {\n          danger: true,\n          title: "Bus löschen",\n          submitLabel: "Bus löschen"\n        });\n        if (!confirmed) return;\n        try {\n          await runWrite(() => call("fanbus_bus_upsert", {\n            id: bus.id,\n            tripId: trip.id,\n            expectedRevision: Number(bus.revision),\n            label: bus.label,\n            category: bus.category,\n            capacity: Number(bus.capacity),\n            isActive: false\n          }), "Bus wurde gelöscht.");\n          snapshot = await call("fanbus_trips_list");\n          await loadOccupancyInto(dialog, trip);\n        } catch (error) {\n          showToast(error?.message || "Bus konnte nicht gelöscht werden.", "error", 5200);\n        }\n      });\n    });`,
  "direkte Busaktionen"
);

fs.writeFileSync(fanbusPath, source);

const commonPath = "js/modules/common.js";
let common = fs.readFileSync(commonPath, "utf8");
common = replaceOnce(
  common,
  `  dialog.addEventListener("click", event => {\n    if (event.target === dialog || event.target.closest("[data-v4-dialog-close]")) {\n      closeDialog(dialog);\n    }\n  });`,
  `  dialog.addEventListener("click", event => {\n    const closeTarget = event.target.closest?.("[data-v4-dialog-close]");\n    if (event.target !== dialog && !closeTarget) return;\n\n    if (event.target === dialog || closeTarget?.closest("header")) {\n      dialogContexts.length = 0;\n      closeDialog(dialog, "", { restoreParent: false });\n      return;\n    }\n\n    closeDialog(dialog);\n  });`,
  "Dialog-X schließt gesamten Dialogstack"
);
fs.writeFileSync(commonPath, common);

const cssPath = "css/app.css";
let css = fs.readFileSync(cssPath, "utf8");
css = replaceOnce(
  css,
  `#v4DialogBody{\n  flex:0 1 auto!important;\n  height:auto!important;\n  min-height:0!important;\n  max-height:none!important;\n  overflow-x:hidden!important;\n  overflow-y:auto!important;\n  overscroll-behavior:contain;\n  -webkit-overflow-scrolling:touch;`,
  `#v4DialogBody{\n  flex:1 1 auto!important;\n  height:auto!important;\n  min-height:0!important;\n  max-height:calc(100dvh - 96px)!important;\n  overflow-x:hidden!important;\n  overflow-y:auto!important;\n  overscroll-behavior:contain;\n  -webkit-overflow-scrolling:touch;\n  touch-action:pan-y!important;`,
  "mobiler Dialog-Scroll"
);
css += `\n\n/* P800-R2 Fanbus Verwaltung – mobile Arbeitsflächen */\n.v4-m310-registration-actions,.v4-m310-bus-card-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}\n.v4-m310-registration-actions .button,.v4-m310-bus-card-actions .button{flex:1 1 130px}\n.v4-m310-bus-delete-note{display:block;margin-top:8px}\n@media(max-width:620px){\n  .v4-m310-registration-actions,.v4-m310-bus-card-actions{display:grid;grid-template-columns:1fr 1fr}\n  .v4-m310-bus-card-actions .button.danger{grid-column:1/-1}\n}\n`;
fs.writeFileSync(cssPath, css);

const testPath = "tests/p800_r2_fanbus_admin_cleanup.test.mjs";
fs.writeFileSync(testPath, `import assert from "node:assert/strict";\nimport fs from "node:fs/promises";\nimport path from "node:path";\nimport test from "node:test";\n\nconst root = path.resolve(import.meta.dirname, "..");\nconst read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");\n\ntest("P800-R2 Fanbus Verwaltung trennt Busse und Teilnehmer mobil sauber", async () => {\n  const [fanbuses, common, css] = await Promise.all([\n    read("js/modules/fanbuses.js"),\n    read("js/modules/common.js"),\n    read("css/app.css")\n  ]);\n  const occupancyStart = fanbuses.indexOf("function occupancyMarkup");\n  const occupancyEnd = fanbuses.indexOf("function openBusActions", occupancyStart);\n  const occupancy = fanbuses.slice(occupancyStart, occupancyEnd);\n  assert.ok(occupancyStart >= 0 && occupancyEnd > occupancyStart);\n  assert.doesNotMatch(occupancy, /Teilnehmer anzeigen/);\n  assert.doesNotMatch(occupancy, /<summary>Teilnehmer/);\n  assert.doesNotMatch(occupancy, /v4-m310-occupancy-groups/);\n  assert.match(occupancy, /data-m310-bus-edit/);\n  assert.match(occupancy, /data-m310-bus-delete/);\n  assert.match(fanbuses, /isActive: false/);\n  assert.doesNotMatch(fanbuses, /data-m320-open-registration/);\n  assert.doesNotMatch(fanbuses, /v4-m310-registration-email/);\n  assert.match(fanbuses, /data-m320-edit-registration/);\n  assert.match(fanbuses, /data-m320-more-registration/);\n  assert.match(fanbuses, /Buswunsch/);\n  assert.doesNotMatch(fanbuses, /Buspräferenz/);\n  assert.match(common, /restoreParent: false/);\n  assert.match(css, /touch-action:pan-y!important/);\n  assert.match(css, /max-height:calc\\(100dvh - 96px\\)!important/);\n});\n`);
