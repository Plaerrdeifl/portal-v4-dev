# Slice 6: DEV repair and atomic PRIMARY contact

## Source and live preflight

Source state reverified on 2026-10-08 after PR #192; the DEV facts below are
the unchanged read-only preflight from 2026-10-07 against project
`tpieykhhawszlzsoflnl`:

- `portal-v4-dev/main`: `5fa4b3509e76d5b05f7e72e8c6d59b43d56f3a14`.
- PR #192 reconciled the 35 source migration timestamps with the already
  deployed DEV history. This branch preserves those filenames and adds only the
  two existing Slice 6 migrations; it does not rename historical migrations or
  introduce a third migration.
- Fanbus PR #10: open, head `05b5f91f9c80dde9218ea44bd17f961295966f2f`.
- Latest DEV migration: `20261007051224_fanbus_draft_delete_default_stops`.
  After #192 the leading repository uses this same reconciled version. The
  earlier comparison found 222 deployed names and no DEV-only names; source has
  224 names including the two unapplied Slice 6 migrations. This compares
  history metadata, not every historical SQL body.
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

The read-only live preflight confirmed CANCELLED revision 2, cancelled_at set,
no merge, no assignment, active historical bus capacity 54/occupancy 0 and a
matching boarding stop, no live identity/email collision. Cancellation audit
IDs are 1320 (unassignment), 1321 (participant ACTIVE/1 -> CANCELLED/2), 1322
(booking cancellation).

All state/audit/identity/capacity assertions precede the mutations under locks.
Immediately before the two mutations, the migration additionally requires the
trip-wide ACTIVE count to be below
`app_private.fanbus_effective_capacity(tripId)` and the WAITLISTED count to be
zero. This prevents restoring into a full trip merely because the historical
bus still has a seat, and prevents bypassing an existing waitlist. Violations
raise `FANBUS_DEV_REPAIR_EFFECTIVE_CAPACITY_EXHAUSTED` or
`FANBUS_DEV_REPAIR_WAITLIST_PRESENT` without changing data or audit rows.
Expected effect: ACTIVE revision 3, cancelled_at NULL, original IDs and number,
MANUAL assignment with NULL actor fields. Existing waitlist/promotion history
remains. A dedicated audit event includes the cancellation references and reason.
Any live DEV mismatch raises an exception. An entirely empty, unconfigured schema
rebuild is explicitly a no-op; this does not waive any assertion on DEV.

This migration has **not** been applied to DEV. Do not describe the booking as
repaired until the migration is applied and the authoritative state is checked.

## Verification and limits

- `node --test tests/run-fanbus-primary-contact-sql.mjs`: 38/38 passed on an
  isolated PostgreSQL 17 container. Executes actual migration SQL and existing
  email validator with real relevant constraints. Dependency doubles isolate
  capability, trip and list functions; the effective-capacity double reproduces
  the production function's sum of active bus capacities. Every repair abort
  compares all involved Fanbus rows and audit rows before/after. This remains an
  isolated regression suite, not a full platform integration.
- `npm test`: 240/240 portal test files passed.
- `npm run check`: static and frontend checks passed.
- `npm run build`: DEV static build passed, not deployed.
- Full local Supabase rebuild could not start: while registering the pinned
  Postgres 17.6 image, the managed Docker `vfs` store exhausted its layer space
  even after removal of all unused test images/volumes. No schema was started or
  changed. The PR rebuild workflow remains enabled and includes
  `supabase/tests/fanbus_primary_contact_email.sql` for the real public API,
  capability, platform-mode and authoritative-response coverage without doubles;
  its current-head result is recorded in the PR rather than hard-coded here.
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
