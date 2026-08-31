import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

const [migration, actions, publicBootstrap, portalBootstrap] = await Promise.all([
  read("supabase/migrations/20260831234000_m329_fanbus_contact_management.sql"),
  read("js/m329-contact-actions.js"),
  read("js/m327-r1-guest-contact-polish.js"),
  read("js/m328-trip-subpage-back.js")
]);

test("M329 replaces username WhatsApp with a numeric central contact contract", () => {
  assert.match(migration, /'fanbus\.organization_contact'/);
  assert.match(migration, /'primary'/);
  assert.match(migration, /'contacts'/);
  assert.match(migration, /'whatsapp', false/);
  assert.match(migration, /'whatsapp', '\{\}'::jsonb/);
  assert.match(migration, /https:\/\/wa\.me\/['"]? \|\|/);
  assert.doesNotMatch(migration, /https:\/\/wa\.me\/plaerrdeifl/);
  assert.doesNotMatch(migration, /@plaerrdeifl/);
});

test("M329 contact writes are protected by existing fanbus management rights and platform write classification", () => {
  assert.match(migration, /require_capability\('fanbus\.manage'\)/);
  assert.match(migration, /when 'fanbus_contact_admin_get' then 'READ'/);
  assert.match(migration, /when 'fanbus_contact_admin_save' then 'USER_MUTATION'/);
  assert.match(migration, /FANBUS_CONTACTS_UPDATED/);
  assert.match(migration, /expectedRevision/);
});

test("public fanbus APIs expose the same organization contact projection", () => {
  assert.match(migration, /create or replace function public\.pd_public_fanbus_trips\(\)/);
  assert.match(migration, /create or replace function public\.pd_public_fanbus_trip\(p_trip_id uuid\)/);
  assert.match(migration, /'organizationContact', v_contact/);
  assert.match(migration, /'organizationContact', app_private\.fanbus_public_organization_contact\(\)/);
});

test("shared contact UI only accepts numeric wa.me links and derives board WhatsApp from member phone links", () => {
  assert.ok(actions.includes('return /^https:\\/\\/wa\\.me\\/[1-9][0-9]{6,14}$/u.test(raw) ? raw : "";'));
  assert.match(actions, /function numericWhatsAppHref\(value\)/);
  assert.match(actions, /`https:\/\/wa\.me\/\$\{raw\}`/);
  assert.match(actions, /a\.v4-board-phone/);
  assert.match(actions, /title=\"WhatsApp\"/);
  assert.match(actions, /title=\"Anrufen\"/);
  assert.doesNotMatch(actions, /0174 6681046/);
  assert.doesNotMatch(actions, /0172 9744908/);
  assert.doesNotMatch(actions, /@plaerrdeifl/);
});

test("Plärrdeifl WhatsApp is the prominent Fanbus action while personal contacts stay compact", () => {
  assert.match(actions, /m329-primary-whatsapp/);
  assert.match(actions, /Plärrdeifl WhatsApp/);
  assert.match(actions, /m329-contact-action/);
  assert.match(actions, /min-height:44px/);
  assert.match(actions, /#m327GuestOrganizationContact/);
  assert.match(actions, /\.m327-contact-block/);
  assert.match(actions, /m310FanbusList/);
  assert.match(actions, /m310PublicTrip/);
});

test("contact actions are bootstrapped in portal and public Fanbus without touching Liveticker", () => {
  assert.match(publicBootstrap, /m329-contact-actions\.js/);
  assert.match(portalBootstrap, /m329-contact-actions\.js/);
  assert.doesNotMatch(actions, /liveticker/i);
  assert.doesNotMatch(migration, /liveticker/i);
});
