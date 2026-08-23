# P900 – M900-R1 DEV Release Candidate Evidence

## Freeze Identity

- Code candidate: `1fd58f66bb999af98dac2afb5225bac9886c35fa`
- Code-candidate tree: `25f02302d8ba17282a22e1c13e125bdd52e312c4`
- Repository and branch: `Plaerrdeifl/portal-v4-dev`, `main`
- Supabase target: DEV `tpieykhhawszlzsoflnl`
- PROD `wplescvhlgctynkfwvrj`: untouched

## DEV Rollout

The remote preflight still ended at `20260822074900`. The following files were
then applied individually, with a one-file dry run and history/object/grant
check after every step:

1. `20260823002244_add_platform_mode_core_m900_r1.sql`
2. `20260823004248_harden_platform_mode_user_boundaries_m900_r1.sql`
3. `20260823073847_harden_security_boundaries_m900_r1.sql`
4. `20260823084306_consolidate_pd_api_and_targeted_indexes_m900_r1_f4.sql`

Final remote migration: `20260823084306`. The history matches the repository.

The existing Cloudflare Pages Git integration deployed code candidate
`1fd58f6` successfully as deployment `61517357-c2e1-405d-9278-9fdb45649ba7`.
The commit check and the dedicated preview were green. The custom DEV URL and
the preview both reached the DEV login gate without browser errors.

Edge Function versions after the DEV-only deployment:

| Function | Before | After | Status | verify_jwt |
|---|---:|---:|---|---|
| m150-membership-submit | 9 | 10 | ACTIVE | false |
| m210-ics-import | 7 | 8 | ACTIVE | false |
| m310-fanbus-register | 12 | 13 | ACTIVE | false |

No Edge secret was displayed, replaced or invented. WordPress was not
deployed; repository plugin versions remain 1.0.5.

## Platform Mode Evidence

The final stored value is `{"mode":"NORMAL","environment":"DEV"}` at
revision 5. `pd_public_platform_status()` confirms NORMAL.

Remote transactional E2E proved:

- NORMAL reaches existing domain validation for pd_api, M150, M210 and M310;
- READ_ONLY keeps all 29 reads open and blocks all 90 user mutations;
- M210 preview remains a read while M210 confirm is blocked;
- a short-lived bypass is environment-, run- and user-bound, preserves domain
  authorization and validation, writes a redacted audit event and is revoked;
- wrong, malformed, expired and revoked tokens fail closed;
- MAINTENANCE blocks writes and invalid settings return
  PLATFORM_WRITE_UNAVAILABLE;
- notification claim processing remains outside the user-write guard;
- every test mutation, token and test actor was rolled back.

Live browser checks proved the central READ_ONLY banner, the exclusive
MAINTENANCE shell, the restored NORMAL login gate and clean mobile (390 px)
and desktop smoke states without horizontal overflow or console errors.

## Regression Evidence

- Node and contract tests: 549/549 passed.
- Local isolated SQL suites: 14 files, 489 assertions, passed.
- Direct transactional suites: M010, M010-R2, M210, portal core, M900 core and
  M900 full integration passed.
- Remote F4 pgTAP: 19/19 passed.
- Remote M900 security pgTAP: 21/21 passed.
- Local database rebuild through all migrations, LOCAL build, diff check,
  secret scan and database lint passed.
- The lint output contains only the recorded pre-existing warning baseline;
  no F4 function introduced a new warning.

The SQL suites cover M010, M020, M150, M210, M310, M320, M325, M330, P800 and
all M900 layers. Together with the Node contracts this includes Capacity,
FIFO, waitlist, promotion, trip lifecycle, bookings, assignments, stops,
check-in, paid state, companion and identity flows, preferences,
notifications, portal modules, WordPress contracts, PWA, service worker and
offline fallback. Large fixture files were retained; only retired MEMBER-role
test UUIDs were corrected to the active PORTAL_USER fixture.

## Remote Security Evidence

- anon, authenticated and service_role have zero table privileges and zero
  schema usage across `app_*` schemas;
- the anonymous/authenticated Public RPC matrix has no difference from the
  approved matrix;
- pd_api is authenticated-only; M150/M210/M310 mutation RPCs are
  service_role-only;
- all historic pd_api routers are postgres-only;
- bootstrap, bypass-token and companion-rate-limit tables have RLS enabled and
  no client/service grants;
- all 20 M900-created or changed overloads have an empty search_path;
- all SECURITY DEFINER exposure is exactly the reviewed public/Edge matrix.

Security Advisor before/after: `62 INFO / 9 WARN / 0 ERROR` to
`65 INFO / 11 WARN / 0 ERROR`. The three INFO additions are deliberate
no-policy RLS defense-in-depth tables. The two WARN additions are the approved
anon and authenticated executions of `pd_public_platform_status()`. The
existing leaked-password WARN remains. No HIGH or CRITICAL finding is open.

Performance Advisor before/after: `103 INFO / 0 WARN / 0 ERROR` to
`103 INFO / 0 WARN / 0 ERROR`. The trip FK warning disappeared and the newly
deployed index is initially reported as unused, so the INFO total is unchanged.
At nine DEV booking rows, a before/after planner-time benchmark would be
misleading; the index is justified structurally by current trip filters and
the trip FK delete/update path. It occupies 16 kB. No index was removed.

## Hosted Auth Inventory

The privacy-safe DEV inventory found 11 Google identities and zero password
identities. Google is active, phone sign-in is inactive and no other OAuth
provider is active. The repository contract sets email signup false, SMS
signup false, minimum password length 12, lower/upper/digit/symbol requirements
and secure password change.

The public hosted settings endpoint does not expose every password-security or
provider-specific signup toggle. The available CLI can only push the complete
project config and offers no dry run; the browser management session was not
authenticated. Therefore no Hosted Auth setting was changed. Granular
verification/alignment of email signup, password length/requirements, secure
password change and leaked-password protection remains an Operations action.
Leaked-password protection is confirmed disabled by the Advisor WARN.

## Remaining Debt and RC Decision

Historic routers remain only for migration traceability. Some Fanbus domain
functions retain older internal delegation layers because semantic neutrality
was not mechanically provable. Remaining Advisor INFO items require workload
evidence. Hosted Auth alignment remains the only Operations follow-up; it is
not a HIGH/CRITICAL security finding and does not alter the reviewed Google
login path.

All mandatory DEV RC criteria are satisfied. M900-R1 is a DEV Release
Candidate. This statement does not authorize PROD-R4.
