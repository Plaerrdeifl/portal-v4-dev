# P900 – M900-R1 Strict User-Bound Release Bypass

## Decision

Master decision B is binding: a release-test bypass can be effective only for
one concrete ACTIVE portal user. Anonymous and optionally bound tokens are no
longer part of the contract.

## Additive Database Contract

Migration:

`20260823154611_harden_release_bypass_strict_user_bound_m900_r1.sql`

The migration first checks for NULL `bound_user_id` rows and aborts without
deleting, revoking, assigning or rewriting any token. It then establishes:

- `bound_user_id NOT NULL` with the existing portal-user foreign key;
- Create without a NULL default and with ACTIVE-user validation;
- immediate false for a missing actor;
- exact equality `bound_user_id = p_actor`;
- permanent denial of public M150 and M310 actions;
- unchanged digest-only storage, environment/run binding and one-hour TTL;
- postgres-only management, RLS and empty SECURITY DEFINER search paths.

## Runtime Boundaries

M150 membership intake and M310 guest Fanbus registration are public domain
paths and cannot carry a release-test bypass. Their deployed Edge sources do
not contain the release header helper or any of the three header names. M310
CORS permits only `apikey, content-type`. The standalone public Fanbus UI is
blocked in READ_ONLY and MAINTENANCE regardless of a client test context.

M210 ICS import is deliberately unchanged. It authenticates a bearer user,
derives the actor, keeps preview as a read and forwards release headers only to
confirm. The authenticated portal `pd_api` path also remains unchanged after
the platform guard: capability, ownership, CAS, domain validation and
idempotency continue to execute normally.

## Audit Contract

Create, successful use and revoke remain audited. Metadata includes the token
entity ID, environment, run, `boundUserId`, action/status fields and actor type.
Successful use is always `PORTAL_USER`. Raw tokens, digests, HMAC secrets and
other secrets are forbidden and were verified absent.

## Verification Summary

The new 41-assertion SQL suite covers schema, Create, A/A use, wrong user, no
actor, environment/run, malformed/unknown/expired/revoked tokens, public M150/
M310, M210 preview/confirm, capability, ownership, CAS, domain validation,
background workers, audit and the 29/90 action split.

Local Node/contracts, the complete SQL regression matrix and LOCAL build are
green. Remote DEV ran the strict suite, the existing M900 full integration and
an additional exception-based strict E2E transaction. All remote fixtures were
rolled back. DEV ends at migration `20260823154611`, platform NORMAL/DEV
revision 5 and zero active tokens.

## Deployment and Operations

- Runtime candidate: `555c24c69076a56a25b021b877b414b4824713cf`
- M150 DEV Edge: version 11 ACTIVE
- M310 DEV Edge: version 14 ACTIVE
- M210 DEV Edge: version 8 unchanged
- Cloudflare Pages code deployment:
  `4d653daf-8418-4f5a-99aa-14e3a44c5370`
- WordPress: no change and no deployment
- PROD: untouched

Future release-test tokens must always name the exact ACTIVE portal user and
must be revoked after use. No public token-management or portal-admin flow is
permitted.
