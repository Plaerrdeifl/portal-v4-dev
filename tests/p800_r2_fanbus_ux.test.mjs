import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

test("P800-R2 loads scoped Fanbus UX modules", async () => {
  const [index, registration] = await Promise.all([
    read("index.html"),
    read("fanbus-anmeldung.html")
  ]);

  assert.match(index, /p800-r2-fanbus-ux\.js/);
  assert.match(registration, /p800-r2-fanbus-registration-ux\.js/);
});

test("public Fanbus registration preserves domain markup and accessible touch targets", async () => {
  const registration = await read("fanbus-anmeldung.html");

  assert.match(registration, /data-m320-add-guest="portal"[^>]*>Gast<\/button>/);
  assert.match(registration, /data-m325-open-companion-list[^>]*>Mitfahrerliste<\/button>/);
  assert.match(registration, />EGAL<\/option>/);
  assert.match(registration, /fanbus-companion-remove\{[^}]*width:44px!important;[^}]*min-width:44px!important;/);
});

test("public Fanbus UX renders user-facing labels review and compact standard stop", async () => {
  const ux = await read("js/p800-r2-fanbus-registration-ux.js");

  assert.match(ux, /EGAL: "Egal"/);
  assert.match(ux, /\+ Mitfahrer hinzufügen/);
  assert.match(ux, /Gespeicherte Mitfahrer/);
  assert.match(ux, /Deine Anmeldung im Überblick/);
  assert.match(ux, /Standard-Zustieg:/);
  assert.match(ux, /Gespeicherte Mitfahrer einrichten/);
  assert.match(ux, /Zurück zu den Fanbusfahrten/);
  assert.match(ux, /Anmeldung wird gesendet/);
  assert.match(ux, /Portaluser/);
  assert.match(ux, /badge\.remove\(\)/);
});

test("internal Fanbus UX collapses mobile filters and fixes action hierarchy", async () => {
  const ux = await read("js/p800-r2-fanbus-ux.js");

  assert.match(ux, /p800-fanbus-filter-disclosure/);
  assert.match(ux, /Filter · \$\{active\}/);
  assert.match(ux, /Teilnehmer anzeigen/);
  assert.match(ux, /Excel exportieren/);
  assert.match(ux, /Teilnehmer hinzufügen/);
  assert.match(ux, /0 \/"\)/);
});

test("P800-R2 Fanbus UX remains frontend-only", async () => {
  const [internalUx, publicUx] = await Promise.all([
    read("js/p800-r2-fanbus-ux.js"),
    read("js/p800-r2-fanbus-registration-ux.js")
  ]);
  const combined = `${internalUx}\n${publicUx}`;

  assert.doesNotMatch(combined, /pd_api\s*\(/);
  assert.doesNotMatch(combined, /supabase\./i);
  assert.doesNotMatch(combined, /fanbus_bus_assign/i);
  assert.doesNotMatch(combined, /automatic.*assign/i);
});
