# Fanbus DEV-E2E delivery isolation

This package adds a server-enforced delivery boundary for controlled Fanbus
browser E2E runs on the DEV project. The migration is inert after application:
it creates no active run, changes no cron job and deploys no Edge Function.

## Delivery-path inventory

The Fanbus Slice-6 operator actions use the authenticated `public.pd_api`
boundary. Their registration and audit writes can create M020 Fanbus events.
M020 expands those events into `app_private.notification_outbox` rows. These are
the only external notification paths found for the affected actions:

- `EMAIL`: `public.pd_notification_claim_batch(integer)` →
  `notification-dispatch` → TLS SMTP.
- `PUSH`: `public.pd_notification_claim_batch(integer)` →
  `notification-dispatch` → `web-push` and the subscription endpoint.

The legacy `send-web-push` function is used by the older task-push outbox and is
not reached by the Fanbus actions. No direct Fanbus SMTP, push, webhook or worker
provider call was found. Platform mode still controls mutations at the existing
API boundary; the isolation does not bypass or weaken platform-mode checks.

## Trusted classification

An event is classified as `DEV_E2E_ISOLATED` only when all conditions hold in
the database transaction that created it:

1. its category is `FANBUS`;
2. its server-recorded actor is the fixed E2E user
   `00000000-0000-4555-8555-000000000042`;
3. the signed JWT subject is that same user and its role is `authenticated`;
4. the signed JWT issuer is exactly the DEV Auth issuer for
   `tpieykhhawszlzsoflnl`;
5. a time-bounded, postgres-only audited run is open.

Run activation also checks the server-side Vault dispatch URL against the exact
DEV Edge Function URL. Missing, malformed or PROD configuration fails closed.
Request headers, browser globals, payload flags, claimed run IDs and foreign
actor IDs are never inputs to the classification decision.

`delivery_mode` and `dev_e2e_run_id` are immutable on the event and inherited by
every outbox row through a database trigger. The marker therefore survives run
closure, retries, cron calls and manual dispatch calls.

## Terminal result

Before selecting any provider candidate, the claim RPC changes every marked
`PENDING`, `PROCESSING` or `RETRY` row to:

```text
status          = SKIPPED
last_error_code = DEV_E2E_DELIVERY_ISOLATED
sent_at         = NULL
provider_message_id = NULL
```

This is a terminal, queryable result and is deliberately not `SENT`. The normal
event status refresh consequently produces `SKIPPED` when all deliveries were
isolated. The dispatcher has the same check before template construction, SMTP
connection and web-push invocation as defense in depth. Its terminal completion
is accepted only for a row already marked `DEV_E2E_ISOLATED`; a normal delivery
cannot be falsely completed through that branch.

Existing rows receive the `NORMAL` default and are not reclassified. Existing
claim tokens, retries, provider errors, idempotency keys, `SKIP LOCKED` claim
concurrency and normal delivery semantics remain unchanged.

## Controlled activation (separate approval required)

Schema migration and Edge Function deployment must be reviewed and performed as
a separate DEV change. Deploy the migration before the matching dispatcher
version. Do not activate a run until both are verified on DEV.

Only a postgres database operator can open or close a run; `anon`,
`authenticated` and `service_role` have no table access or execute permission:

```sql
select app_private.dev_e2e_delivery_run_open(
  '00000000-0000-4555-8555-000000000042'::uuid,
  interval '30 minutes',
  'Approved Acer Fanbus Slice 6 acceptance run'
);

select app_private.dev_e2e_delivery_run_close('<returned-run-id>'::uuid);
```

The maximum run duration is two hours. Closing a run prevents classification of
new events but never removes the isolation marker from already-created work.
Operational review can correlate `dev_e2e_delivery_runs`, `notification_events`
and `notification_outbox` by `dev_e2e_run_id`.

No activation, migration application, Edge deployment, cron change or real
delivery is part of this repository change. PROD must not be contacted during
activation or acceptance.
