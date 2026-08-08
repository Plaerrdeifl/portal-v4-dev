create table app_fanclub.membership_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  birth_date date not null,
  email text not null,
  phone text not null,
  street text not null,
  house_number text not null,
  postal_code text not null,
  city text not null,
  applicant_message text,
  status text not null default 'PENDING',
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references app_portal.users(id) on delete restrict,
  decision_method text,
  decision_reason_internal text,
  applicant_notice text,
  declaration_version text not null,
  statutes_version text not null,
  statutes_reference text not null,
  declaration_confirmed boolean not null,
  statutes_confirmed boolean not null,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_applications_first_name_check
    check (length(btrim(first_name)) between 1 and 160),
  constraint membership_applications_last_name_check
    check (length(btrim(last_name)) between 1 and 160),
  constraint membership_applications_birth_date_check
    check (birth_date >= date '1900-01-01'),
  constraint membership_applications_email_check
    check (length(btrim(email)) between 3 and 320),
  constraint membership_applications_phone_check
    check (length(btrim(phone)) between 3 and 80),
  constraint membership_applications_street_check
    check (length(btrim(street)) between 1 and 160),
  constraint membership_applications_house_number_check
    check (length(btrim(house_number)) between 1 and 40),
  constraint membership_applications_postal_code_check
    check (length(btrim(postal_code)) between 1 and 20),
  constraint membership_applications_city_check
    check (length(btrim(city)) between 1 and 160),
  constraint membership_applications_applicant_message_check
    check (applicant_message is null or length(btrim(applicant_message)) between 1 and 4000),
  constraint membership_applications_status_check
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
  constraint membership_applications_decision_method_check
    check (decision_method is null or decision_method in ('VOTE_MAJORITY', 'SEVEN_DAY_MANUAL')),
  constraint membership_applications_decision_state_check
    check (
      (status in ('PENDING', 'WITHDRAWN')
        and decided_at is null
        and decided_by is null
        and decision_method is null
        and decision_reason_internal is null
        and applicant_notice is null)
      or
      (status = 'APPROVED'
        and decided_at is not null
        and decided_by is not null
        and decision_method = 'VOTE_MAJORITY')
      or
      (status = 'APPROVED'
        and decided_at is not null
        and decided_by is not null
        and decision_method = 'SEVEN_DAY_MANUAL'
        and decision_reason_internal is not null
        and length(btrim(decision_reason_internal)) between 1 and 4000)
      or
      (status = 'REJECTED'
        and decided_at is not null
        and decided_by is not null
        and decision_method in ('VOTE_MAJORITY', 'SEVEN_DAY_MANUAL')
        and decision_reason_internal is not null
        and length(btrim(decision_reason_internal)) between 1 and 4000)
    ),
  constraint membership_applications_decision_reason_check
    check (decision_reason_internal is null or length(btrim(decision_reason_internal)) between 1 and 4000),
  constraint membership_applications_applicant_notice_check
    check (applicant_notice is null or length(btrim(applicant_notice)) between 1 and 4000),
  constraint membership_applications_declaration_version_check
    check (length(btrim(declaration_version)) between 1 and 80),
  constraint membership_applications_statutes_version_check
    check (length(btrim(statutes_version)) between 1 and 80),
  constraint membership_applications_statutes_reference_check
    check (length(btrim(statutes_reference)) between 1 and 500),
  constraint membership_applications_confirmations_check
    check (declaration_confirmed and statutes_confirmed),
  constraint membership_applications_revision_check
    check (revision >= 1)
);

create table app_fanclub.membership_application_board_roster (
  application_id uuid not null
    references app_fanclub.membership_applications(id) on delete cascade,
  office_code text not null
    references app_fanclub.office_slots(code) on delete restrict,
  voter_user_id uuid not null
    references app_portal.users(id) on delete restrict,
  member_id uuid not null
    references app_fanclub.members(id) on delete restrict,
  captured_at timestamptz not null default now(),
  primary key (application_id, office_code),
  constraint membership_application_board_roster_user_unique
    unique (application_id, voter_user_id),
  constraint membership_application_board_roster_office_check
    check (office_code in (
      'VORSTAND_1',
      'VORSTAND_2',
      'VORSTAND_3',
      'KASSIER',
      'SCHRIFTFUEHRER'
    ))
);

create table app_fanclub.membership_application_votes (
  application_id uuid not null
    references app_fanclub.membership_applications(id) on delete restrict,
  voter_user_id uuid not null
    references app_portal.users(id) on delete restrict,
  vote text not null,
  reason_internal text,
  voted_at timestamptz not null default now(),
  primary key (application_id, voter_user_id),
  constraint membership_application_votes_vote_check
    check (vote in ('YES', 'NO')),
  constraint membership_application_votes_reason_check
    check (reason_internal is null or length(btrim(reason_internal)) between 1 and 4000)
);

create index membership_applications_review_order_idx
on app_fanclub.membership_applications (status, submitted_at desc);

create index membership_applications_decided_by_idx
on app_fanclub.membership_applications (decided_by)
where decided_by is not null;

create index membership_application_votes_voter_idx
on app_fanclub.membership_application_votes (voter_user_id);

create index membership_application_board_roster_office_idx
on app_fanclub.membership_application_board_roster (office_code);

create index membership_application_board_roster_voter_idx
on app_fanclub.membership_application_board_roster (voter_user_id);

create index membership_application_board_roster_member_idx
on app_fanclub.membership_application_board_roster (member_id);

create or replace function app_private.m150_guard_application_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.submitted_at is distinct from old.submitted_at then
    raise exception 'M150_SUBMITTED_AT_IMMUTABLE'
      using errcode = '22000';
  end if;
  return new;
end;
$$;

create trigger membership_applications_submitted_at_immutable
before update on app_fanclub.membership_applications
for each row execute function app_private.m150_guard_application_timestamps();

create or replace function app_private.m150_reject_vote_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'M150_VOTE_IMMUTABLE'
    using errcode = '22000';
end;
$$;

create trigger membership_application_votes_immutable
before update on app_fanclub.membership_application_votes
for each row execute function app_private.m150_reject_vote_update();

create or replace function app_private.m150_reject_board_roster_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'M150_BOARD_SNAPSHOT_IMMUTABLE'
    using errcode = '22000';
end;
$$;

create trigger membership_application_board_roster_immutable
before update on app_fanclub.membership_application_board_roster
for each row execute function app_private.m150_reject_board_roster_update();

create or replace function app_private.m150_require_pending_application_for_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from app_fanclub.membership_applications as application
    where application.id = new.application_id
      and application.status = 'PENDING'
  ) then
    raise exception 'M150_VOTE_REQUIRES_PENDING_APPLICATION'
      using errcode = 'P1503';
  end if;
  return new;
end;
$$;

create trigger membership_application_votes_pending_only
before insert on app_fanclub.membership_application_votes
for each row execute function app_private.m150_require_pending_application_for_vote();

alter table app_fanclub.membership_applications enable row level security;
alter table app_fanclub.membership_application_board_roster enable row level security;
alter table app_fanclub.membership_application_votes enable row level security;

revoke all on table app_fanclub.membership_applications
from public, anon, authenticated;

revoke all on table app_fanclub.membership_application_votes
from public, anon, authenticated;

revoke all on table app_fanclub.membership_application_board_roster
from public, anon, authenticated;

revoke all on function app_private.m150_guard_application_timestamps()
from public, anon, authenticated;

revoke all on function app_private.m150_reject_vote_update()
from public, anon, authenticated;

revoke all on function app_private.m150_reject_board_roster_update()
from public, anon, authenticated;

revoke all on function app_private.m150_require_pending_application_for_vote()
from public, anon, authenticated;
