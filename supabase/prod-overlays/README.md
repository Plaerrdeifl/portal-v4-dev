# PROD schema overlays

This directory records PROD-specific database/runtime state that must not be
blindly folded into the normal DEV migration chain.

## Recovered PROD-only baseline

- `20260917222446_liveticker_whatsapp_multichannel_prod_r1.sql`
  - recovered byte-for-byte from `supabase_migrations.schema_migrations`
  - original PROD SQL MD5 (without trailing newline):
    `b8441745f621401d2658a3af2232a8ab`
  - preserves TEST / MAIN / BOTH routing and per-channel delivery targets

## 2026-09-19 PROD reconcile

Supabase migration:

- version: `20260919201657`
- name: `prod_schema_reconcile_20260919_r1`

The exact tested SQL inputs are retained in `applied-set/`:

1. Fanbus booking operational groups
2. Public CANCELLED trip projection
3. PROD Liveticker reconcile (multichannel + IMAGE_WITH_CAPTION + manual graphics)

The combined SQL was first executed on the live PROD schema inside one
transaction ending in `ROLLBACK`, with assertions for the expected schema.
Only after that passed was the same set applied atomically as the migration
above.

## WhatsApp worker

- previous deployed source: `functions/liveticker-whatsapp-worker/index.prod-v5.ts`
- reconciled deployed source: `functions/liveticker-whatsapp-worker/index.prod-reconcile-r1.ts`
- deployed PROD version: `6`
- deployed SHA-256:
  `a2bdf1d49308787d71d115c8f39b88d181864be37afa287e31af02870021169b`

The PROD worker keeps multichannel target routing and adds the IMAGE component
used by `IMAGE_WITH_CAPTION`.

Local pre-reconcile snapshots are intentionally ignored under `backups/`.
