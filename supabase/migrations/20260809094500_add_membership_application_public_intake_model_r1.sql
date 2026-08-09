create table app_private.membership_application_intake_idempotency (
  idempotency_key text primary key,
  payload_sha256 text not null,
  application_id uuid
    references app_fanclub.membership_applications(id) on delete restrict,
  outcome text not null,
  created_at timestamptz not null default now(),
  constraint membership_application_intake_idempotency_key_check
    check (
      idempotency_key = btrim(idempotency_key)
      and length(idempotency_key) between 1 and 200
    ),
  constraint membership_application_intake_payload_sha256_check
    check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  constraint membership_application_intake_outcome_check
    check (outcome in ('PROCESSING', 'CREATED', 'DUPLICATE_PENDING')),
  constraint membership_application_intake_result_check
    check (
      (outcome = 'PROCESSING' and application_id is null)
      or
      (outcome in ('CREATED', 'DUPLICATE_PENDING') and application_id is not null)
    )
);

create index membership_application_intake_application_idx
on app_private.membership_application_intake_idempotency (application_id)
where application_id is not null;

create unique index membership_applications_pending_email_unique
on app_fanclub.membership_applications (
  app_private.m150_normalize_email(email)
)
where status = 'PENDING';

create unique index membership_applications_pending_identity_unique
on app_fanclub.membership_applications (
  app_private.m150_normalize_name(first_name),
  app_private.m150_normalize_name(last_name),
  birth_date
)
where status = 'PENDING';

alter table app_private.membership_application_intake_idempotency
enable row level security;

revoke all on table app_private.membership_application_intake_idempotency
from public, anon, authenticated, service_role;
