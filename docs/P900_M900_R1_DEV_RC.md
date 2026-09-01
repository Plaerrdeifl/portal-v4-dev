# P900 – M900-R1 DEV Release Candidate Evidence

## Freeze Identity

- Master decision: `M900_R1_RELEASE_BYPASS_DECISION = B`
- Runtime/code candidate: `555c24c69076a56a25b021b877b414b4824713cf`
- Runtime/code-candidate tree: `b7c83e38d8c3f8341744e85c55168051b331c08e`
- Repository and branch: `Plaerrdeifl/portal-v4-dev`, `main`
- Supabase target: DEV `tpieykhhawszlzsoflnl`
- PROD `wplescvhlgctynkfwvrj`: untouched

This evidence replaces the previous M900-R1 DEV RC. The commit containing this
document is the authoritative RC evidence commit and is recorded in the final
release report.

## Strict User-Bound Decision

Every effective release-test bypass is now bound to exactly one ACTIVE portal
user. The additive migration aborts if any existing token has a NULL binding,
then makes `bound_user_id` schema-level NOT NULL. Create has no argument default,
rejects NULL, unknown and inactive users, and remains postgres-only. Use rejects
a missing actor immediately and matches only `bound_user_id = p_actor`.

The public actions `m150_submit_membership_application` and
`m310_submit_guest_fanbus_registration` are permanently denylisted inside the
bypass function. M150 and M310 Edge Functions no longer accept or forward the
three release-test headers. M310 CORS allows only `apikey, content-type`. The
public Fanbus frontend no longer opens in READ_ONLY for a release-test context.
M210 remains unchanged as the authenticated direct Edge test path.

## Migration and Preflight

Immediately before the DEV migration:

- remote migration ended exactly at `20260823084306`;
- platform mode was `NORMAL`, environment `DEV`, revision 5;
- token inventory was total 0, bound 0, unbound 0, active 0, expired 0,
  revoked 0.

The CLI dry run identified exactly one pending file. DEV then received only:

`20260823154611_harden_release_bypass_strict_user_bound_m900_r1.sql`

The final DEV migration is `20260823154611`. Post-migration catalog checks
confirmed NOT NULL, zero Create defaults, strict actor equality, both public
denylists, RLS, postgres-only management grants and empty search paths for all
four changed SECURITY DEFINER functions.

## Deployments

Only changed runtime components were deployed:

| Component | Before | After | Status | verify_jwt |
|---|---:|---:|---|---|
| m150-membership-submit | 10 | 11 | ACTIVE | false |
| m310-fanbus-register | 13 | 14 | ACTIVE | false |
| m210-ics-import | 8 | 8 | ACTIVE, unchanged | false |

No Edge secret was displayed, replaced or invented. WordPress was unchanged
and not deployed. Repository plugin versions remain 1.0.5.

The existing Cloudflare Pages Git integration deployed code candidate
`555c24c` successfully as deployment
`4d653daf-8418-4f5a-99aa-14e3a44c5370`. GitHub validation and Cloudflare Pages
checks passed. Both the custom DEV URL and its commit preview reached the DEV
login gate without browser warnings or errors. Desktop 1280x720 and mobile
390x844 had no horizontal overflow; neither showed maintenance or READ_ONLY UI
in the final NORMAL state.

## Regression and E2E Evidence

- Node and contract tests: 554/554 passed.
- Local SQL matrix: 20 suites, 535 assertions or transactional verification
  blocks, all passed.
- New strict suite: 41/41 locally and `1..41` on remote DEV.
- Existing exception-based M900 full integration passed on remote DEV.
- LOCAL build, static check, JavaScript syntax, diff check and secret scan
  passed.
- Application-schema DB lint contains only the established warnings; none of
  the four strict-user-bound functions introduced a lint finding.

Coverage includes NORMAL, READ_ONLY, MAINTENANCE and invalid configuration;
valid A/A, wrong user, no actor, wrong environment, wrong run, malformed,
unknown, expired and revoked tokens; M150/M310 public denial; M210 preview and
confirm; capability, ownership, CAS and domain validation; audit create/use/
revoke; notification, push and email workers; 29 READ and 90 USER_MUTATION
actions.

The remote exception-based strict run finished `PASS`. Every test user, token,
mode change, audit fixture and domain fixture was transactional and rolled
back. Final token inventory is total 0, unbound 0, active 0.

## Security Evidence

- anon/authenticated/service_role have zero schema usage and zero table grants
  across all `app_*` schemas;
- `public.pd_api(text,jsonb)` remains authenticated-only;
- historical `pd_api_before_*` routers have zero client/service_role grants;
- M150, M210 and M310 mutation RPCs remain service_role-only;
- bypass create/revoke remain postgres-only;
- the token table keeps RLS and has no client/service_role access;
- all four changed SECURITY DEFINER functions use `search_path = ''`;
- deployed M150/M310 sources contain no release-header helper or header names;
- deployed M210 retains all three headers and its authenticated actor contract;
- successful use audit is `PORTAL_USER`, includes `boundUserId`, and contains
  neither raw token nor digest.

Security Advisor before/after:
`65 INFO / 11 WARN / 0 ERROR` to `65 INFO / 11 WARN / 0 ERROR`.
The 11 WARN items remain the reviewed public SECURITY DEFINER reads plus leaked
password protection, which is explicitly outside this hardening block. No new
security warning or error exists.

Performance Advisor before/after:
`103 INFO / 0 WARN / 0 ERROR` to `101 INFO / 0 WARN / 0 ERROR`.
No index or query-plan change was made in this block. The current 101 INFO items
are 78 unindexed-FK and 23 unused-index notices. The two-item reduction is
consistent with usage counters changing during regression runs; it is not a
schema change and no Advisor suggestion was applied automatically.

## Final DEV State and RC Decision

- Migration: `20260823154611`
- Platform mode: `{"mode":"NORMAL","environment":"DEV"}`
- Platform revision: 5
- Active release-test tokens: 0
- M150 Edge: version 11 ACTIVE
- M310 Edge: version 14 ACTIVE
- M210 Edge: version 8 ACTIVE and unchanged
- Frontend: custom DEV and commit preview green
- WordPress: unchanged, not deployed
- PROD: unchanged

All criteria for the replacement strict-user-bound M900-R1 DEV Release
Candidate are satisfied. PROD-R4 remains a separate process.
