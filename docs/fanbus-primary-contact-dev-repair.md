# Slice 6: DEV repair and atomic PRIMARY contact

## Source and live preflight

Verified on 2026-10-07, read-only against DEV project `tpieykhhawszlzsoflnl`:

- `portal-v4-dev/main`: `71b413c13f9dc45772ec3f87e17f68e99f6f47a2`.
- No open portal PR at preflight; no parallel implementer visible through PRs.
- Fanbus PR #10: open, head `05b5f91f9c80dde9218ea44bd17f961295966f2f`.
- Latest DEV migration: `20261007051224_fanbus_draft_delete_default_stops`.
  Leading repository has the same migration name at version `20261006124809`.
  Full history comparison found 222 deployed migration names, all present in the
  leading repository. **35 existing names have different DEV/source version
  timestamps**, from `nextcloud_portal_group_sync` onward; no DEV-only names.
  Source has 224 names including these two unapplied new migrations. This compares
  history metadata, not the complete contents of all historical SQL statements.
  Existing discrepancies are recorded, not reconciled by this package. Before
  applying new migrations with the CLI, resolve the established history workflow;
  do not blindly db-push or alter historical source files/version records.
- Live PRIMARY function matches the existing two-field implementation: it demotes
  the old PRIMARY, then promotes the target without checking the required email.
  PostgreSQL's transaction prevents a lasting partial change, but the email check
  constraint produces an unsuitable user-facing failure.

## Backward-compatible action

`fanbus_booking_primary_set` still requires `bookingId` and `participantId`.
It additionally accepts optional `contactEmail`.

For a PORTAL/GUEST target with missing email:

- Missing/blank contact: `FANBUS_BOOKING_PRIMARY_EMAIL_REQUIRED` (`22023`).
- Invalid normalized contact: `FANBUS_EMAIL_INVALID` (`22023`).
- Same-trip ACTIVE/WAITLISTED email collision: `FANBUS_PARTICIPANT_DUPLICATE` (`22023`).
- Valid contact: trim and lowercase; fill email and switch roles atomically.

Existing email is retained, even when another contactEmail is supplied. MANUAL's
existing email exemption remains. No identity fields or general participant-edit
contract change. The existing capability and trip locks remain. Public pd_api
continues enforcing platform modes and returns the authoritative registrations
projection. The email unique/check constraints are retained; race violations are
mapped to domain errors and roll back all changes. Audit only adds the boolean
`contactEmailAdded`, not the email itself.

## Exact DEV repair

`20261007184230_fanbus_dev_restore_booking_000015.sql` restores only:

- booking `cfad5b80-2921-4790-839d-703d9bdf8fe6`, number `FB-26-000015`;
- trip `f1a464d2-5068-478c-80b5-58b6ce6feca6`;
- PRIMARY participant `ba837b6e-8d48-4c9b-8c05-04f573fd2e5d`;
- bus `f2c9b33f-9d78-479b-9c66-30e702b04ffd`;
- stop `000c602d-3e32-4622-ab87-e6b539ca55f2`.

Live preflight confirmed CANCELLED revision 2, cancelled_at set, no merge, no
assignment, active bus capacity 54/occupancy 0 and matching boarding stop, no
live identity/email collision. Cancellation audit IDs are 1320 (unassignment),
1321 (participant ACTIVE/1 -> CANCELLED/2), 1322 (booking cancellation).

All state/audit/identity/capacity assertions precede the mutations under locks.
Expected effect: ACTIVE revision 3, cancelled_at NULL, original IDs and number,
MANUAL assignment with NULL actor fields. Existing waitlist/promotion history
remains. A dedicated audit event includes the cancellation references and reason.
Any live DEV mismatch raises an exception. An entirely empty, unconfigured schema
rebuild is explicitly a no-op; this does not waive any assertion on DEV.

This migration has **not** been applied to DEV. Do not describe the booking as
repaired until the migration is applied and the authoritative state is checked.

## Verification and limits

- `node --test tests/run-fanbus-primary-contact-sql.mjs`: 36/36 passed on an
  isolated PostgreSQL 17 container. Executes actual migration SQL and existing
  email validator with real relevant constraints. Dependency doubles isolate
  capability, trip and list functions; this is not a full platform integration.
- `npm test`: 240/240 portal test files passed.
- `npm run check`: static and frontend checks passed.
- `npm run build`: DEV static build passed, not deployed.
- Full local Supabase rebuild could not start: the Supabase Postgres image
  exhausted available Docker layer storage. Existing pgTAP suites were therefore
  not run locally. The existing PR rebuild workflow remains enabled and includes
  `supabase/tests/fanbus_primary_contact_email.sql` for real public API, capability,
  platform-mode and authoritative-response tests without doubles.
  GitHub run `37670954619` subsequently **passed** the complete schema rebuild,
  all five selected pgTAP files (**160 assertions**), including the new suite,
  and DB lint. The local resource limitation is therefore covered by CI.
- Isolated SQL regressions are also wired into the existing quality CI workflow.
- Fanbus: test/typecheck/build/check passed, 129 tests; email-less PORTAL/GUEST
  promotion waits for confirmation, sends one primary write, maps domain errors,
  retains authoritative roles, discards conflict dialog after one reload, no retry.

## Coordinated next step after review

Check CI, reverify DEV repair assertions and migration history, apply the versioned
migrations through the approved DEV workflow, verify original booking/bus state,
then integrate the Fanbus build and run real Acer browser tests with and without
existing email. Both PRs require review; this package performs no merge or
deployment. PROD was neither accessed nor changed.
