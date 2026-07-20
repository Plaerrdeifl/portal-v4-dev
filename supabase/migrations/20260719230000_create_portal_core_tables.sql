create extension if not exists pgcrypto with schema extensions;

create sequence if not exists app_private.user_code_seq start with 1;
create sequence if not exists app_private.member_code_seq start with 1;

create or replace function app_private.next_user_code()
returns text
language sql
security definer
set search_path = ''
as $$
  select 'U-' || lpad(nextval('app_private.user_code_seq')::text, 4, '0');
$$;

create or replace function app_private.next_member_code()
returns text
language sql
security definer
set search_path = ''
as $$
  select 'PD-' || lpad(nextval('app_private.member_code_seq')::text, 3, '0');
$$;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table app_portal.portal_roles (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 100,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_roles_code_check
    check (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  constraint portal_roles_name_check
    check (length(btrim(name)) between 1 and 120)
);

create table app_portal.capabilities (
  code text primary key,
  name text not null,
  category text not null,
  description text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  constraint capabilities_code_check
    check (code ~ '^[a-z][a-z0-9_.-]{2,95}$'),
  constraint capabilities_name_check
    check (length(btrim(name)) between 1 and 160)
);

create table app_portal.role_capabilities (
  role_id uuid not null references app_portal.portal_roles(id) on delete cascade,
  capability_code text not null references app_portal.capabilities(code) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (role_id, capability_code)
);

create table app_portal.users (
  id uuid primary key references auth.users(id) on delete restrict,
  user_code text not null unique default app_private.next_user_code(),
  email text not null,
  first_name text not null,
  last_name text not null,
  status text not null default 'ACTIVE',
  role_id uuid not null references app_portal.portal_roles(id) on delete restrict,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_check
    check (length(btrim(email)) between 3 and 320),
  constraint users_first_name_check
    check (length(btrim(first_name)) between 1 and 160),
  constraint users_last_name_check
    check (length(btrim(last_name)) between 1 and 160),
  constraint users_status_check
    check (status in ('ACTIVE', 'INACTIVE', 'BLOCKED'))
);

create table app_portal.access_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  first_name text not null,
  last_name text not null,
  status text not null default 'PENDING',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references app_portal.users(id) on delete set null,
  decision_reason text not null default '',
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint access_requests_status_check
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
  constraint access_requests_first_name_check
    check (length(btrim(first_name)) between 1 and 160),
  constraint access_requests_last_name_check
    check (length(btrim(last_name)) between 1 and 160)
);

create table app_portal.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text not null default '',
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null
);

create table app_portal.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references app_portal.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null default '',
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table app_portal.operation_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  operation text not null,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint operation_runs_status_check
    check (status in ('RUNNING', 'SUCCEEDED', 'FAILED'))
);

create table app_private.bootstrap_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid,
  created_at timestamptz not null default now()
);

create table app_fanclub.members (
  id uuid primary key default extensions.gen_random_uuid(),
  member_code text not null unique default app_private.next_member_code(),
  first_name text not null,
  last_name text not null,
  email text not null default '',
  phone text not null default '',
  street text not null default '',
  house_number text not null default '',
  postal_code text not null default '',
  city text not null default '',
  joined_on date,
  left_on date,
  status text not null default 'ACTIVE',
  notes text not null default '',
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_first_name_check
    check (length(btrim(first_name)) between 1 and 160),
  constraint members_last_name_check
    check (length(btrim(last_name)) between 1 and 160),
  constraint members_status_check
    check (status in ('ACTIVE', 'INACTIVE'))
);

create table app_portal.user_member_links (
  user_id uuid primary key references app_portal.users(id) on delete cascade,
  member_id uuid not null unique references app_fanclub.members(id) on delete restrict,
  linked_at timestamptz not null default now(),
  linked_by uuid references app_portal.users(id) on delete set null
);

create table app_fanclub.office_slots (
  code text primary key,
  label text not null,
  sort_order integer not null,
  member_id uuid unique references app_fanclub.members(id) on delete restrict,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null
);

create table app_fanclub.office_capabilities (
  office_code text not null references app_fanclub.office_slots(code) on delete cascade,
  capability_code text not null references app_portal.capabilities(code) on delete cascade,
  primary key (office_code, capability_code)
);

create table app_portal.teams (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  is_active boolean not null default true,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_code_check
    check (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  constraint teams_name_check
    check (length(btrim(name)) between 1 and 160)
);

create table app_portal.team_memberships (
  team_id uuid not null references app_portal.teams(id) on delete cascade,
  user_id uuid not null references app_portal.users(id) on delete cascade,
  team_role text not null default 'MEMBER',
  is_active boolean not null default true,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id),
  constraint team_memberships_role_check
    check (team_role in ('LEAD', 'CO_LEAD', 'MEMBER'))
);

create unique index team_memberships_one_active_lead_idx
  on app_portal.team_memberships(team_id)
  where is_active and team_role = 'LEAD';

create table app_portal.team_functions (
  code text primary key,
  name text not null,
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table app_portal.team_function_assignments (
  team_id uuid not null,
  user_id uuid not null,
  function_code text not null references app_portal.team_functions(code) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  primary key (team_id, user_id, function_code),
  foreign key (team_id, user_id)
    references app_portal.team_memberships(team_id, user_id)
    on delete cascade
);

create table app_modules.tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  context_type text not null,
  team_id uuid references app_portal.teams(id) on delete restrict,
  title text not null,
  description text not null default '',
  priority text not null default 'NORMAL',
  status text not null default 'OPEN',
  assigned_user_id uuid references app_portal.users(id) on delete set null,
  assignment_reason text not null default '',
  created_by uuid not null references app_portal.users(id) on delete restrict,
  completed_at timestamptz,
  completed_by uuid references app_portal.users(id) on delete set null,
  archived_at timestamptz,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_context_check
    check (context_type in ('TEAM', 'BOARD')),
  constraint tasks_context_team_check
    check (
      (context_type = 'TEAM' and team_id is not null)
      or (context_type = 'BOARD' and team_id is null)
    ),
  constraint tasks_title_check
    check (length(btrim(title)) between 1 and 300),
  constraint tasks_priority_check
    check (priority in ('URGENT', 'HIGH', 'NORMAL', 'LOW')),
  constraint tasks_status_check
    check (status in ('OPEN', 'IN_PROGRESS', 'WAITING', 'DONE', 'ARCHIVED'))
);

create table app_modules.task_notes (
  task_id uuid not null references app_modules.tasks(id) on delete cascade,
  user_id uuid not null references app_portal.users(id) on delete cascade,
  content text not null default '',
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (task_id, user_id),
  constraint task_notes_content_check
    check (length(content) <= 4000)
);

create index role_capabilities_capability_idx
  on app_portal.role_capabilities(capability_code, role_id);
create index users_role_status_idx
  on app_portal.users(role_id, status);
create index access_requests_status_requested_idx
  on app_portal.access_requests(status, requested_at desc);
create index audit_events_occurred_idx
  on app_portal.audit_events(occurred_at desc);
create index members_status_name_idx
  on app_fanclub.members(status, last_name, first_name);
create index team_memberships_user_active_idx
  on app_portal.team_memberships(user_id, is_active);
create index tasks_team_status_idx
  on app_modules.tasks(team_id, status, updated_at desc);
create index tasks_assigned_status_idx
  on app_modules.tasks(assigned_user_id, status, updated_at desc);

create trigger portal_roles_set_updated_at
before update on app_portal.portal_roles
for each row execute function app_private.set_updated_at();

create trigger users_set_updated_at
before update on app_portal.users
for each row execute function app_private.set_updated_at();

create trigger access_requests_set_updated_at
before update on app_portal.access_requests
for each row execute function app_private.set_updated_at();

create trigger members_set_updated_at
before update on app_fanclub.members
for each row execute function app_private.set_updated_at();

create trigger teams_set_updated_at
before update on app_portal.teams
for each row execute function app_private.set_updated_at();

create trigger team_memberships_set_updated_at
before update on app_portal.team_memberships
for each row execute function app_private.set_updated_at();

create trigger tasks_set_updated_at
before update on app_modules.tasks
for each row execute function app_private.set_updated_at();

create trigger task_notes_set_updated_at
before update on app_modules.task_notes
for each row execute function app_private.set_updated_at();

alter table app_portal.portal_roles enable row level security;
alter table app_portal.capabilities enable row level security;
alter table app_portal.role_capabilities enable row level security;
alter table app_portal.users enable row level security;
alter table app_portal.access_requests enable row level security;
alter table app_portal.settings enable row level security;
alter table app_portal.audit_events enable row level security;
alter table app_portal.operation_runs enable row level security;
alter table app_fanclub.members enable row level security;
alter table app_portal.user_member_links enable row level security;
alter table app_fanclub.office_slots enable row level security;
alter table app_fanclub.office_capabilities enable row level security;
alter table app_portal.teams enable row level security;
alter table app_portal.team_memberships enable row level security;
alter table app_portal.team_functions enable row level security;
alter table app_portal.team_function_assignments enable row level security;
alter table app_modules.tasks enable row level security;
alter table app_modules.task_notes enable row level security;

revoke all on all tables in schema app_portal from public, anon, authenticated;
revoke all on all sequences in schema app_portal from public, anon, authenticated;
revoke all on all functions in schema app_portal from public, anon, authenticated;

revoke all on all tables in schema app_fanclub from public, anon, authenticated;
revoke all on all sequences in schema app_fanclub from public, anon, authenticated;
revoke all on all functions in schema app_fanclub from public, anon, authenticated;

revoke all on all tables in schema app_modules from public, anon, authenticated;
revoke all on all sequences in schema app_modules from public, anon, authenticated;
revoke all on all functions in schema app_modules from public, anon, authenticated;

revoke all on all tables in schema app_private from public, anon, authenticated;
revoke all on all sequences in schema app_private from public, anon, authenticated;
revoke all on all functions in schema app_private from public, anon, authenticated;
