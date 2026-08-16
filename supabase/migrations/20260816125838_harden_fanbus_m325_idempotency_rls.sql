-- Plärrdeifl Digitalplattform V4
-- PROD R2 / D-046
-- Defense-in-depth hardening for the private M325 idempotency table.
-- Existing REVOKE boundaries remain unchanged.
-- No FORCE ROW LEVEL SECURITY and no RLS policies are introduced.

alter table app_private.fanbus_m325_idempotency
  enable row level security;
