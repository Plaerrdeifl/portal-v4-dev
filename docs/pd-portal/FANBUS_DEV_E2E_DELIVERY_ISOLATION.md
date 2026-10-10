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

## Operator provenance

The browser modules `registrations.ts` and `operatorBookings.ts` call the shared
`pdApi` client with the authenticated session. `require_capability` returns
`require_active_user()`'s `auth.uid()`; it does not accept an actor from payload.
The affected notification-producing paths are:

- Manual booking creation: the M325 registration context carries that actor;
  the creation kernel writes `created_by` and `updated_by`. The M020 registration
  trigger enqueues the PRIMARY booking-created event using `new.created_by`.
- Participant edits, boarding-stop changes and waitlist promotion write
  `updated_by` from the capability-checked actor. M020 uses `new.updated_by`.
- Participant and whole-booking cancellation pass the checked actor into
  `fanbus_participant_cancel_kernel`, which writes `updated_by`; M020 uses it
  for the cancellation event. Whole-booking cancellation is exercised through
  `public.pd_api` as `authenticated` in the rollback-only pgTAP test, followed
  by real event expansion and inherited outbox-marker assertions.
- Bus assignment notifications use `log_audit(v_actor, ...)`; the audit trigger
  passes `new.actor_user_id` into enqueue.
- Operator append creates a COMPANION, so the PRIMARY-only booking-created
  trigger does not enqueue a new booking notification. PRIMARY switching changes
  only booking role/contact email and logs `FANBUS_BOOKING_PRIMARY_CHANGED`,
  which has no M020 notification branch. These actions do not introduce an
  external delivery path by themselves.

The SQL fixture supplies JWT claims at the database boundary; it tests the
actual RPC/capability/kernel/trigger/expansion chain, not cryptographic JWT
verification or the browser's real session. Real signed-session Acer acceptance
remains a separately approved step. No provenance correction is needed in the
reviewed operator paths.

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

For any other actor, the existing `NORMAL` delivery path is unchanged. For the
fixed E2E actor on the Fanbus path, however, `NORMAL` is never a fallback: a
missing or invalid JWT context raises `DEV_E2E_AUTH_CONTEXT_INVALID`, and a
missing, closed, expired or not-yet-started run raises
`DEV_E2E_RUN_NOT_OPEN`. Both errors occur before the notification event insert,
so no event can later expand into provider outbox work.

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
connection and web-push invocation as defense in depth. Completion checks stored isolation after locking the claimed row, even if
`terminalStatus` is missing. Unsafe success, retry and failure payloads are
rejected without changing the lease; subsequent claim processing terminalizes
the isolated row without returning it to a provider. Its terminal completion
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

The maximum run duration is two hours. Closing a run rejects new Fanbus events
from the fixed E2E actor but never removes the isolation marker from
already-created work.
Operational review can correlate `dev_e2e_delivery_runs`, `notification_events`
and `notification_outbox` by `dev_e2e_run_id`.

No activation, migration application, Edge deployment, cron change or real
delivery is part of this repository change. PROD must not be contacted during
activation or acceptance.
