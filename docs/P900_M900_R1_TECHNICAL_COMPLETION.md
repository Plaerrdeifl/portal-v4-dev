# P900 – M900-R1 Technical Completion

## Current Architecture

The static portal uses one authenticated database boundary, reviewed public
read RPCs, private domain functions and narrowly scoped Edge Functions. Direct
browser table access remains disabled. Platform Mode is resolved in the
database and mirrored by fail-closed frontend and WordPress handling.

## Current pd_api Dispatch

public.pd_api(text,jsonb) remains the only authenticated browser mutation
entry. It authenticates the actor, classifies the action, applies the Platform
Mode guard before every user mutation, and calls
app_private.pd_api_dispatch_current(text,jsonb).

The internal dispatcher maps 119 normalized actions directly to their current
domain functions: 29 READ and 90 USER_MUTATION. Names, payloads, responses,
permissions and domain validation remain unchanged. The historic
case-sensitive saveDashboardPreferences spelling remains as a compatibility
alias. Unknown actions return the established 22023 error envelope.

All pd_api_before_* routers and pd_api_core_before_dashboard_widgets_r1 remain
in the database for forensic comparison, but are outside the active runtime
path and executable only by postgres.

## Platform Mode Contract

- NORMAL: reads and writes reach normal domain authorization and validation.
- READ_ONLY: reads remain available; user mutations fail with
  PLATFORM_READ_ONLY.
- MAINTENANCE: public status remains readable; the normal portal shell does
  not start and mutations fail with PLATFORM_MAINTENANCE.
- Missing or invalid state fails closed with PLATFORM_WRITE_UNAVAILABLE.
- Background worker functions do not pass through the user mutation guard.

The browser release-test context only transports headers. Database validation
of token digest, expiry, activity, environment, run and optional user binding
is the sole authorization decision.

## Security Hardening State

- private tables have no browser or generic service-role table grants;
- bootstrap, release-bypass and companion-rate-limit tables use RLS as defense
  in depth;
- current and historical dispatch functions have explicit grants;
- new and current privileged functions use empty search_path and qualified
  relations;
- Companion Search is prefix-bound, rate-limited and privacy-minimal;
- the dialog boundary validates inert markup before DOM insertion;
- no dynamic SQL or new secret-bearing configuration is introduced.

## Release Bypass

Creation and revocation remain postgres-only. Tokens are returned once, stored
only as SHA-256 digests, limited to one hour, environment and run-bound and
optionally user-bound. Create, successful use and revoke are audited without
raw token or digest disclosure.

## Public RPC Matrix

| RPC | Roles | Contract |
|---|---|---|
| pd_public_events() | anon | public events only |
| pd_public_fanbus_trip(uuid) | anon, authenticated | public trip projection |
| pd_public_fanbus_trip_boarding_stops(uuid) | anon, authenticated | active public trip stops |
| pd_public_fanbus_trips() | anon, authenticated | public trip list |
| pd_public_platform_status() | anon, authenticated | mode, message, expected end, revision |

## Grant Matrix

| Object group | anon | authenticated | service_role | postgres |
|---|---:|---:|---:|---:|
| pd_api(text,jsonb) | – | EXECUTE | – | owner/internal |
| reviewed public reads | exact matrix above | exact matrix above | – | owner/internal |
| current internal dispatcher | – | – | – | EXECUTE |
| historic portal routers | – | – | – | EXECUTE |
| release-bypass management | – | – | – | EXECUTE |
| private token/rate-limit tables | – | – | – | owner/internal |

Dedicated worker and Edge RPCs retain only their previously reviewed
service-role grants.

## Audit Policy

MUST AUDIT: authorization and capability changes, membership and identity
changes, critical Fanbus operations, finance, release-bypass management and
use, and security-relevant administrative actions.

OPTIONAL / NO FULL BEFORE-AFTER: personal UI preferences, read state and
low-risk self-service defaults already traceable through current state or
technical events.

Audit JSON must not duplicate passwords, tokens, digests, HMAC or Turnstile
secrets, or unnecessary contact data.

## Implemented Refactorings

- replaced runtime traversal through historic portal routers with one current
  internal dispatcher;
- centralized the canonical normalized action inventory for database and
  contract tests;
- preserved dashboard preference enrichment and the authenticated public-stop
  projection explicitly;
- promoted the existing unique ICS external-reference identity to a primary
  key;
- added one trip-scoped booking index for current reads and FK delete checks.

## Performance Decisions

fanbus_bookings(trip_id) is used by current trip-scoped booking paths and by
the fanbus_bookings_trip_id_fkey delete/update check. No existing index has
trip_id as its leading column, so fanbus_bookings_trip_id_idx is additive and
non-redundant.

Other Performance Advisor INFO findings were not applied automatically.
Existing participant, booking, bus, stop and waitlist indexes already cover
the leading columns used by current joins and locks, or the current DEV volume
does not justify a speculative index. No index was removed.

event_external_refs(source_type,source_key,external_uid) was already NOT NULL,
unique and the actual lookup and update identity. DEV preflight found 30 rows,
zero NULL identity parts and zero duplicates. F4 promotes exactly that
identity to the primary key without adding a new domain identifier.

## Remaining Technical Debt

- historical router functions remain for migration-history traceability;
- several final Fanbus domain functions still delegate to older internal
  implementation functions where removing the layer was not mechanically
  provable;
- repeated large SQL fixtures remain because deduplicating them would risk
  reducing regression independence;
- remaining unindexed-FK and unused-index Advisor INFO items require real
  workload evidence before modification;
- hosted Auth password-security alignment depends on supported DEV management
  tooling and an identity-impact inventory.

## Deliberately Untouched

Capacity, FIFO, waitlist and promotion, cancellation lifecycle, idempotency,
historic booking values, finance, authorization semantics, notifications,
membership decisions, event and ICS semantics, public Fanbus semantics and all
M320-R3 functionality remain unchanged. No frontend framework or backend
architecture was introduced. PROD remains out of scope.

## DEV Deployment Runbook

1. Require a clean main at the reviewed F4 commit.
2. Confirm project ref tpieykhhawszlzsoflnl and highest remote migration
   20260822074900.
3. Apply only the three pending M900 migrations and the F4 migration in order.
4. Verify each migration entry, core objects and exact grants.
5. Set platform.mode to NORMAL with environment DEV.
6. Deploy only m150-membership-submit, m210-ics-import and
   m310-fanbus-register to DEV using existing secrets.
7. Verify the existing Git-integrated DEV frontend deployment.
8. Run NORMAL, READ_ONLY, bypass, MAINTENANCE, fail-closed and background
   checks; always restore NORMAL and DEV.
9. Re-run Security and Performance Advisors and remote grant/RLS inventory.

## PROD-R4 Prerequisites

- approved DEV RC with consistent migration history;
- recorded Edge Function versions and frontend deployment;
- Platform Mode E2E, security, Fanbus and portal regression green;
- DEV final state NORMAL and DEV;
- no new unexplained advisor warning or high or critical finding;
- a separate authorized PROD-R4 plan, backup and change window, and rollback
  procedure.

This document does not authorize any PROD migration, deployment, Auth change,
WordPress rollout or test data.
