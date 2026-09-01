import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const fanbuses = await readFile(join(root, "js/modules/fanbuses.js"), "utf8");

function section(start, end) {
  const from = fanbuses.indexOf(start);
  const to = fanbuses.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `Start marker missing: ${start}`);
  assert.notEqual(to, -1, `End marker missing: ${end}`);
  return fanbuses.slice(from, to);
}

test("fanbus.manage independently retains occupancy bus and stop management", () => {
  const navigation = section("function fanbusOperationsAccess", "function tripDetailMarkup");
  assert.match(navigation, /canManage \? `[\s\S]*data-m310-occupancy/);
  assert.match(navigation, /operationsAccess\.canRead \? `[\s\S]*data-m325-operations/);

  const access = section("function occupancyAccess", "function occupancyMarkup");
  assert.match(access, /canManageBuses: hasCapability\("fanbus\.manage"\)/);
  assert.match(access, /canManageRegistrations: hasCapability\("fanbus\.registrations\.manage"\)/);

  const reads = section("async function occupancyData", "async function loadOccupancyInto");
  assert.match(reads, /access\.canManageBuses[\s\S]*call\("fanbus_buses_list"/);
  assert.doesNotMatch(reads, /fanbus_registrations_list/);
  assert.match(reads, /access\.canManageBuses[\s\S]*fanbus_bus_boarding_stops_list/);
  assert.match(reads, /access\.canManageBuses[\s\S]*fanbus_trip_boarding_stops_list/);

  const actions = section("function bindOccupancyActions", "function reloadOccupancyAfterChild");
  assert.match(actions, /if \(access\?\.canManageBuses\)/);
  assert.match(actions, /openBusCreator\(trip, dialog\)/);
  assert.match(actions, /openBusActions\(trip, data, bus, busMappings, tripStops, dialog\)/);

  const busActions = section("function openBusActions", "async function occupancyData");
  assert.match(busActions, /openBusEditor\(trip, data, bus, parentDialog, \{[\s\S]*replaceCurrent: true/);
  assert.match(
    busActions,
    /openBusStops\(trip, bus, mapping, tripStops\?\.stops \|\| \[\], parentDialog, \{[\s\S]*replaceCurrent: true/
  );
});

test("bus management stays bus-centered while participant actions live in the participant detail", () => {
  const markup = section("function occupancyMarkup", "async function occupancyData");
  assert.match(markup, /const occupancy = Number\(bus\.occupancy \?\? bus\.occupied \?\? 0\)/);
  assert.doesNotMatch(markup, /registrations|data-m310-manage-participants|Teilnehmer \(|Ohne Bus|Warteliste/);

  const participantBindings = section("function bindRegistrationActions", "function renderRegistrationsDialog");
  assert.match(participantBindings, /data-m320-open-registration/);
  assert.match(participantBindings, /openRegistrationDetail/);
  assert.doesNotMatch(participantBindings, /data-m320-edit-registration|data-m320-more-registration/);

  assert.match(fanbuses, /function openRegistrationDetail/);
  assert.match(fanbuses, /data-m320-detail-assignment/);
  assert.match(fanbuses, /data-m320-detail-edit/);
  assert.match(fanbuses, /data-m320-detail-more/);
  assert.match(fanbuses, /fanbus_bus_assignment_set/);
});

test("general desktop and mobile trip lists expose no registration or capacity values", () => {
  const table = section("function tripTable(items)", "function tripMobileList(items)");
  const mobile = section("function tripMobileList(items)", "function setStatus");

  for (const renderer of [table, mobile]) {
    assert.doesNotMatch(renderer, /capacityLabel/);
    assert.doesNotMatch(renderer, /activeRegistrationCount/);
    assert.doesNotMatch(renderer, /Anmeldungen/);
    assert.doesNotMatch(renderer, /Kapazität/);
    assert.doesNotMatch(renderer, /freie Plätze|Plätze frei/);
  }

  assert.doesNotMatch(fanbuses, /function capacityLabel\(/);
});
