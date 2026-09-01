import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/dev-overlays/20260828_fanbus_user_default_bus_preference.sql", import.meta.url),
  "utf8"
);
const jointContract = readFileSync(
  new URL("../supabase/migrations/20260822074900_add_joint_fanbus_preferences_and_bus_control.sql", import.meta.url),
  "utf8"
);
const ux = readFileSync(new URL("../js/fanbus-user-standards.js", import.meta.url), "utf8");
const fanbusPage = readFileSync(new URL("../pages/fanbuses.html", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const registrationPage = readFileSync(new URL("../fanbus-anmeldung.html", import.meta.url), "utf8");

test("Portaluser bus preference defaults fail closed to EGAL", () => {
  assert.match(migration, /default_bus_preference text not null default 'EGAL'/);
  assert.match(migration, /default_bus_preference in \('EGAL', 'RUHIG', 'PARTY'\)/);
  assert.match(migration, /'defaultBusPreference', coalesce\(v_preference\.default_bus_preference, 'EGAL'\)/);
  assert.match(migration, /'defaultBusPreference', person\.default_bus_preference/);
  assert.match(migration, /coalesce\(preference\.default_bus_preference, 'EGAL'\) as default_bus_preference/);
});

test("Personal standards setter preserves the other preference and validates bus values", () => {
  assert.match(migration, /'defaultBoardingStopId', 'defaultBusPreference', 'expectedRevision'/);
  assert.match(migration, /when v_has_stop then v_stop_id\s+else v_existing\.default_boarding_stop_id/);
  assert.match(migration, /when v_has_bus then v_bus_preference\s+else v_existing\.default_bus_preference/);
  assert.match(migration, /v_bus_preference not in \('EGAL', 'RUHIG', 'PARTY'\)/);
});

test("Clearing the legacy boarding default cannot silently delete a non-EGAL bus standard", () => {
  assert.match(migration, /if v_existing\.default_bus_preference = 'EGAL' then/);
  assert.match(migration, /set default_boarding_stop_id = null,\s+revision = revision \+ 1/);
  assert.match(migration, /'defaultBusPreference', v_existing\.default_bus_preference/);
});

test("Linked members and Portalusers receive the Portaluser default while pure members stay EGAL", () => {
  assert.match(migration, /where preference\.user_id = v_portal\.id/);
  assert.match(migration, /'defaultBusPreference', coalesce\(v_default_bus, 'EGAL'\)/);
  assert.match(migration, /'effectiveType', 'MEMBER'/);
  assert.match(migration, /'defaultBusPreference', 'EGAL'/);
});

test("Trips without bus selection still normalize every concrete registration to EGAL", () => {
  assert.match(jointContract, /if not app_private\.fanbus_bus_preference_selection_enabled\(new\.trip_id\) then\s+new\.bus_preference := 'EGAL';/);
});

test("Fanbus standards use a native in-page workspace instead of a dialog", () => {
  assert.match(fanbusPage, /id="m325UserFanbusStandardsButton"[^>]*>Meine Fanbus-Standards<\/button>/);
  assert.match(ux, /STANDARDS_PANEL_ID = "m327FanbusStandardsPanel"/);
  assert.match(ux, /m327-standards-head/);
  assert.match(ux, /Standard-Zustieg/);
  assert.match(ux, /Standard-Buswunsch/);
  assert.match(ux, /Standards speichern/);
  assert.match(ux, /document\.getElementById\("m327TripsPanel"\)/);
  assert.match(ux, /data-m327-standards-back/);
  assert.match(ux, /runWrite\(/);
  assert.doesNotMatch(ux, /\bopenDialog\s*\(/);
});

test("Personal bus defaults are applied only after loading and only to selectable controls", () => {
  assert.match(ux, /let selfPreferenceLoaded = false;/);
  assert.match(ux, /if \(!selfPreferenceLoaded\) \{\s+void ensureSelfPreference\(\);\s+return;/);
  assert.match(ux, /if \(field\.hidden \|\| field\.closest\("\[hidden\]"\)\) return;/);
  assert.match(ux, /select\[data-m326-person-preference=/);
  assert.doesNotMatch(ux, /input\[data-m326-person-preference=/);
});

test("Personal standards portal workspace and public registration loader remain cache-versioned", () => {
  assert.match(
    index,
    /\.\/js\/fanbus-user-standards\.js\?v=20260830-m327-native-standards1/
  );
  assert.match(
    registrationPage,
    /\.\/js\/fanbus-user-standards\.js\?v=[^"\s]+/
  );
});
