# Liveticker DEV channel routing

Portal 1.0 is the business reference: `TEST` (Testkanal), `MAIN`
(Hauptkanal), or `BOTH`. The existing channel IDs are copied into private DEV
configuration by the migration. They are not included in browser responses.
The selection applies to future outputs, across sticker, text, combined and
image/caption jobs. Each job snapshots immutable target rows; a later routing
change never changes these rows.

## Safe rollout

1. Verify and merge the backend migration and gateway through normal DEV PR CI.
2. Apply the exact versioned migration only to the DEV project, retaining its
   version in the leading migration history. Existing jobs are not backfilled.
3. Deploy the DEV `liveticker-whatsapp-worker` Edge Function. Old fixed-channel
   workers cannot claim: new DEV claims require `targetProtocol: 1` and lifecycle
   operations require the immutable target ID. The existing DEV token and
   project-host checks are retained.
4. Deploy the matching leading `Plaerrdeifl/liveticker` worker modules on Acer,
   including `target-intent.mjs`, `delivery.mjs`, `environment.mjs` and
   `wpp-runtime.mjs`. Keep DEV a WPP observer; never restart/control the shared
   WPP or the PROD worker as part of this rollout. Verify actual source hashes.
5. Integrate the complete built leading frontend release using the existing
   versioned DEV release scripts and verify live hashes/browser behavior.

The copied destinations start with **send_approved=false**. UI routing selection
can be prepared, but no output is enqueued or claimed for a destination without
explicit DEV send approval. Existing channel reachability or a healthy queue
worker is not approval. Any future persistent configuration/approval changes
must use a separately reviewed migration after the actual test destination and
message scope have been authorized. Never change READ_ONLY or use real season
games as test fixtures. Use only a specifically approved GAME test fixture.

## Recovery and evidence

Each target owns its component states and provider message IDs. Browser status
contains target IDs, labels, component states, receipt-presence flags and safe
error codes; provider/channel identifiers and detailed private errors remain
server-side. `SENT` / `SUCCEEDED` means a successful send response, not a delivery
acknowledgement. No delivered/ack claim is synthesized.

Retry reopens only failed targets and unsent components. Sent targets/parts,
IDs, labels and routing remain fixed. A local send-intent is persisted in the
existing target journal before DEV dispatch. A timeout or process interruption
with unknown outcome is held as `DELIVERY_OUTCOME_UNKNOWN`; ordinary retry is
rejected until receipt reconciliation. This intentionally favors avoiding a
duplicate over automatically sending again. Definite newsletter-resolution
failures retain the bounded existing recovery path to the same target.

The frontend also retains an enqueue request ID across a lost HTTP reply.
Changing an unconfirmed payload is rejected rather than silently creating
another send. Explicit resend after a confirmed completed request remains a new
user intent. A failed graphic's retry uses the existing delivery ID.

A real acceptance record needs both approved target paths, target/job IDs,
provider message IDs and independently observed receipt/ack. Match the evidence
to the private target row and component. Until that proof exists, report delivery
as blocked/unconfirmed. The SQL pgTAP fixture is isolated and rolled back; gateway
and browser fixtures use only in-memory responses and never send messages.
