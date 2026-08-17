-- P800 / M020-R1 – Zentrales Benachrichtigungssystem
-- F1 implementation package. DEV baseline only. No PROD mutation is performed by this file generation.

begin;

create table if not exists app_private.notification_events (
  id uuid primary key default extensions.gen_random_uuid(),
  notification_type text not null,
  category text not null
    check (category in ('ACCOUNT_MEMBERSHIP','FANBUS','DATES','TASKS')),
  event_key text not null,
  source_module text not null,
  entity_type text not null,
  entity_id text not null,
  actor_user_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  status text not null default 'PENDING'
    check (status in ('PENDING','PROCESSING','EXPANDED','COMPLETED','PARTIAL','FAILED','SKIPPED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  claim_token uuid null,
  claimed_at timestamptz null,
  claim_expires_at timestamptz null,
  last_error_code text not null default '',
  expanded_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_type, event_key)
);

create index if not exists notification_events_pending_idx
  on app_private.notification_events (status, next_attempt_at, created_at);
create index if not exists notification_events_entity_idx
  on app_private.notification_events (entity_type, entity_id, created_at desc);

create table if not exists app_private.notification_outbox (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references app_private.notification_events(id) on delete cascade,
  notification_type text not null,
  category text not null
    check (category in ('ACCOUNT_MEMBERSHIP','FANBUS','DATES','TASKS')),
  event_key text not null,
  recipient_kind text not null
    check (recipient_kind in ('USER','EXTERNAL_EMAIL','FUNCTION','DOMAIN_GROUP')),
  recipient_user_id uuid null,
  recipient_address text null,
  push_subscription_id uuid null
    references app_portal.push_subscriptions(id) on delete set null,
  channel text not null check (channel in ('EMAIL','PUSH')),
  delivery_target_key text not null,
  preference_mode text not null
    check (preference_mode in ('MANDATORY','OPTIONAL')),
  status text not null default 'PENDING'
    check (status in ('PENDING','PROCESSING','RETRY','SENT','FAILED','SKIPPED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  next_attempt_at timestamptz not null default now(),
  claim_token uuid null,
  claimed_at timestamptz null,
  claim_expires_at timestamptz null,
  sent_at timestamptz null,
  provider_message_id text null,
  last_error_code text not null default '',
  payload jsonb not null default '{}'::jsonb,
  deep_link text not null default '',
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, channel, delivery_target_key)
);

create index if not exists notification_outbox_pending_idx
  on app_private.notification_outbox (status, next_attempt_at, created_at);
create index if not exists notification_outbox_event_idx
  on app_private.notification_outbox (event_id, created_at);
create index if not exists notification_outbox_user_idx
  on app_private.notification_outbox (recipient_user_id, created_at desc)
  where recipient_user_id is not null;

alter table app_private.notification_events enable row level security;
alter table app_private.notification_events force row level security;
alter table app_private.notification_outbox enable row level security;
alter table app_private.notification_outbox force row level security;

revoke all on app_private.notification_events from public, anon, authenticated, service_role;
revoke all on app_private.notification_outbox from public, anon, authenticated, service_role;

alter table app_portal.notification_preferences
  add column if not exists email_account_membership boolean not null default false,
  add column if not exists push_account_membership boolean not null default false,
  add column if not exists email_fanbus boolean not null default false,
  add column if not exists push_fanbus boolean not null default false,
  add column if not exists email_dates boolean not null default false,
  add column if not exists push_dates boolean not null default false,
  add column if not exists email_tasks boolean not null default false,
  add column if not exists push_tasks boolean not null default true;

insert into app_portal.settings(key, value)
values (
  'notifications.m020',
  jsonb_build_object(
    'fanbusOrganization', jsonb_build_object(
      'email', '',
      'emailEnabled', false,
      'userIds', '[]'::jsonb
    ),
    'accessReviewers', jsonb_build_object(
      'userIds', '[]'::jsonb
    )
  )
)
on conflict (key) do nothing;

create or replace function app_private.notification_email_is_valid(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    p_email is not null
    and length(btrim(p_email)) between 3 and 320
    and btrim(p_email) !~ E'[\\r\\n]'
    and btrim(p_email) ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$';
$$;

revoke all on function app_private.notification_email_is_valid(text) from public;
grant execute on function app_private.notification_email_is_valid(text) to postgres;

create or replace function app_private.notification_event_enqueue(
  p_notification_type text,
  p_category text,
  p_event_key text,
  p_source_module text,
  p_entity_type text,
  p_entity_id text,
  p_actor_user_id uuid default null,
  p_payload jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(btrim(p_notification_type), '') = ''
     or coalesce(btrim(p_event_key), '') = ''
     or coalesce(btrim(p_source_module), '') = ''
     or coalesce(btrim(p_entity_type), '') = ''
     or coalesce(btrim(p_entity_id), '') = '' then
    raise exception 'M020_NOTIFICATION_EVENT_INVALID' using errcode = '22023';
  end if;

  if p_category not in ('ACCOUNT_MEMBERSHIP','FANBUS','DATES','TASKS') then
    raise exception 'M020_NOTIFICATION_CATEGORY_INVALID' using errcode = '22023';
  end if;

  insert into app_private.notification_events(
    notification_type, category, event_key, source_module,
    entity_type, entity_id, actor_user_id, payload, occurred_at
  )
  values (
    btrim(p_notification_type), p_category, btrim(p_event_key), btrim(p_source_module),
    btrim(p_entity_type), btrim(p_entity_id), p_actor_user_id,
    coalesce(p_payload, '{}'::jsonb), coalesce(p_occurred_at, now())
  )
  on conflict (notification_type, event_key)
  do update set
    updated_at = app_private.notification_events.updated_at
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function app_private.notification_event_enqueue(
  text,text,text,text,text,text,uuid,jsonb,timestamptz
) from public, anon, authenticated, service_role;
grant execute on function app_private.notification_event_enqueue(
  text,text,text,text,text,text,uuid,jsonb,timestamptz
) to postgres;

create or replace function app_private.notification_task_subtype_enabled(
  p_user_id uuid,
  p_event_type text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_event_type = 'TASK_CREATED' then coalesce(np.new_tasks, true)
    when p_event_type like 'TASK_UPDATE_%' then coalesce(np.task_updates, true)
    when p_event_type = 'TASK_WAITING' then coalesce(np.task_status, true)
    when p_event_type like 'TASK_STATUS_%' then coalesce(np.task_status, true)
    when p_event_type like 'TASK_TRANSFER_%' then coalesce(np.task_transfers, true)
    when p_event_type like 'TASK_WAITING_DEADLINE_%' then coalesce(np.waiting_deadlines, true)
    else true
  end
  from app_portal.notification_preferences np
  where np.user_id = p_user_id;
$$;

revoke all on function app_private.notification_task_subtype_enabled(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function app_private.notification_task_subtype_enabled(uuid,text) to postgres;

create or replace function app_private.notification_preference_enabled(
  p_user_id uuid,
  p_category text,
  p_channel text,
  p_event_type text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pref app_portal.notification_preferences%rowtype;
  v_user_active boolean;
begin
  select (u.status = 'ACTIVE') into v_user_active
  from app_portal.users u
  where u.id = p_user_id;

  if not coalesce(v_user_active, false) then
    return false;
  end if;

  select * into v_pref
  from app_portal.notification_preferences np
  where np.user_id = p_user_id;

  if not found then
    return false;
  end if;

  if p_channel = 'PUSH' then
    if not v_pref.push_enabled then return false; end if;
    if p_category = 'ACCOUNT_MEMBERSHIP' then return v_pref.push_account_membership; end if;
    if p_category = 'FANBUS' then return v_pref.push_fanbus; end if;
    if p_category = 'DATES' then return v_pref.push_dates; end if;
    if p_category = 'TASKS' then
      return v_pref.push_tasks
        and coalesce(app_private.notification_task_subtype_enabled(p_user_id, p_event_type), true);
    end if;
  elsif p_channel = 'EMAIL' then
    if p_category = 'ACCOUNT_MEMBERSHIP' then return v_pref.email_account_membership; end if;
    if p_category = 'FANBUS' then return v_pref.email_fanbus; end if;
    if p_category = 'DATES' then return v_pref.email_dates; end if;
    if p_category = 'TASKS' then return v_pref.email_tasks; end if;
  end if;

  return false;
end;
$$;

revoke all on function app_private.notification_preference_enabled(uuid,text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function app_private.notification_preference_enabled(uuid,text,text,text) to postgres;

create or replace function app_private.notification_project_user(
  p_event app_private.notification_events,
  p_user_id uuid,
  p_title text,
  p_body text,
  p_route text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then return; end if;
  if not exists (
    select 1 from app_portal.users u
    where u.id = p_user_id and u.status = 'ACTIVE'
  ) then return; end if;

  insert into app_portal.notifications(
    user_id, event_key, event_type, title, body, route,
    entity_type, entity_id, actor_user_id,
    push_state, push_attempted_at, push_error
  )
  values (
    p_user_id,
    'm020:' || p_event.id::text || ':' || p_user_id::text,
    p_event.notification_type,
    left(coalesce(p_title, 'Plärrdeifl'), 180),
    left(coalesce(p_body, ''), 1000),
    coalesce(nullif(p_route, ''), '#/dashboard'),
    p_event.entity_type,
    nullif(p_event.entity_id, ''),
    p_event.actor_user_id,
    'SKIPPED',
    now(),
    'M020 zentrale Zustellung'
  )
  on conflict (user_id, event_key) do nothing;
end;
$$;

revoke all on function app_private.notification_project_user(
  app_private.notification_events,uuid,text,text,text
) from public, anon, authenticated, service_role;
grant execute on function app_private.notification_project_user(
  app_private.notification_events,uuid,text,text,text
) to postgres;

create or replace function app_private.notification_add_external_email(
  p_event app_private.notification_events,
  p_email text,
  p_recipient_kind text,
  p_target_key text,
  p_template_key text,
  p_template_data jsonb,
  p_deep_link text default '',
  p_mandatory boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_valid boolean;
begin
  v_valid := app_private.notification_email_is_valid(v_email);

  insert into app_private.notification_outbox(
    event_id, notification_type, category, event_key,
    recipient_kind, recipient_address, channel, delivery_target_key,
    preference_mode, status, last_error_code, payload, deep_link
  )
  values (
    p_event.id, p_event.notification_type, p_event.category, p_event.event_key,
    p_recipient_kind, case when v_valid then v_email else null end,
    'EMAIL', p_target_key,
    case when p_mandatory then 'MANDATORY' else 'OPTIONAL' end,
    case when v_valid then 'PENDING' else 'FAILED' end,
    case when v_valid then '' else 'RECIPIENT_EMAIL_INVALID' end,
    jsonb_build_object(
      'templateKey', p_template_key,
      'data', coalesce(p_template_data, '{}'::jsonb)
    ),
    coalesce(p_deep_link, '')
  )
  on conflict (event_id, channel, delivery_target_key) do nothing;
end;
$$;

revoke all on function app_private.notification_add_external_email(
  app_private.notification_events,text,text,text,text,jsonb,text,boolean
) from public, anon, authenticated, service_role;
grant execute on function app_private.notification_add_external_email(
  app_private.notification_events,text,text,text,text,jsonb,text,boolean
) to postgres;


create or replace function app_private.notification_push_ready_at(p_user_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
  v_start time;
  v_end time;
  v_zone text;
  v_local timestamp;
  v_local_date date;
  v_local_time time;
  v_target timestamp;
begin
  select np.quiet_hours_enabled,np.quiet_start,np.quiet_end,np.time_zone
  into v_enabled,v_start,v_end,v_zone
  from app_portal.notification_preferences np
  where np.user_id=p_user_id;

  if not coalesce(v_enabled,false) then return now(); end if;

  begin
    v_local := now() at time zone v_zone;
  exception when others then
    return now();
  end;

  v_local_date:=v_local::date;
  v_local_time:=v_local::time;

  if v_start=v_end then return now(); end if;

  if v_start < v_end then
    if v_local_time >= v_start and v_local_time < v_end then
      v_target:=v_local_date+v_end;
    else
      return now();
    end if;
  else
    if v_local_time >= v_start then
      v_target:=(v_local_date+1)+v_end;
    elsif v_local_time < v_end then
      v_target:=v_local_date+v_end;
    else
      return now();
    end if;
  end if;

  return v_target at time zone v_zone;
end;
$$;

revoke all on function app_private.notification_push_ready_at(uuid)
  from public, anon, authenticated, service_role;
grant execute on function app_private.notification_push_ready_at(uuid) to postgres;

create or replace function app_private.notification_add_user(
  p_event app_private.notification_events,
  p_user_id uuid,
  p_title text,
  p_body text,
  p_template_key text,
  p_template_data jsonb,
  p_deep_link text default '',
  p_email_mandatory boolean default false,
  p_email_allowed boolean default true,
  p_push_allowed boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user app_portal.users%rowtype;
  v_email_enabled boolean;
  v_push_enabled boolean;
  v_sub record;
  v_target text;
begin
  select * into v_user
  from app_portal.users u
  where u.id = p_user_id
    and u.status = 'ACTIVE';

  if not found then return; end if;

  perform app_private.notification_project_user(
    p_event, p_user_id, p_title, p_body, p_deep_link
  );

  v_email_enabled := p_email_allowed and (
    p_email_mandatory
    or app_private.notification_preference_enabled(
      p_user_id, p_event.category, 'EMAIL', p_event.notification_type
    )
  );

  if v_email_enabled then
    perform app_private.notification_add_external_email(
      p_event,
      v_user.email,
      'USER',
      'user:' || p_user_id::text || ':email',
      p_template_key,
      p_template_data,
      p_deep_link,
      p_email_mandatory
    );
  end if;

  v_push_enabled := p_push_allowed and app_private.notification_preference_enabled(
    p_user_id, p_event.category, 'PUSH', p_event.notification_type
  );

  if not v_push_enabled then return; end if;

  for v_sub in
    select ps.id
    from app_portal.push_subscriptions ps
    where ps.user_id = p_user_id
      and ps.is_active = true
    order by ps.created_at, ps.id
  loop
    v_target := 'push:' || v_sub.id::text;
    insert into app_private.notification_outbox(
      event_id, notification_type, category, event_key,
      recipient_kind, recipient_user_id, push_subscription_id,
      channel, delivery_target_key, preference_mode,
      next_attempt_at, payload, deep_link
    )
    values (
      p_event.id, p_event.notification_type, p_event.category, p_event.event_key,
      'USER', p_user_id, v_sub.id,
      'PUSH', v_target, 'OPTIONAL',
      app_private.notification_push_ready_at(p_user_id),
      jsonb_build_object(
        'title', left(coalesce(p_title, 'Plärrdeifl'), 120),
        'body', left(coalesce(p_body, ''), 240)
      ),
      coalesce(p_deep_link, '')
    )
    on conflict (event_id, channel, delivery_target_key) do nothing;
  end loop;
end;
$$;

revoke all on function app_private.notification_add_user(
  app_private.notification_events,uuid,text,text,text,jsonb,text,boolean,boolean,boolean
) from public, anon, authenticated, service_role;
grant execute on function app_private.notification_add_user(
  app_private.notification_events,uuid,text,text,text,jsonb,text,boolean,boolean,boolean
) to postgres;

create or replace function app_private.notification_config_user_ids(p_path text[])
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_value jsonb;
  v_item text;
  v_id uuid;
begin
  select s.value #> p_path into v_value
  from app_portal.settings s
  where s.key = 'notifications.m020';

  if jsonb_typeof(v_value) <> 'array' then return; end if;

  for v_item in
    select jsonb_array_elements_text(v_value)
  loop
    begin
      v_id := v_item::uuid;
    exception when others then
      continue;
    end;
    if exists (
      select 1 from app_portal.users u
      where u.id = v_id and u.status = 'ACTIVE'
    ) then
      return next v_id;
    end if;
  end loop;
end;
$$;

revoke all on function app_private.notification_config_user_ids(text[])
  from public, anon, authenticated, service_role;
grant execute on function app_private.notification_config_user_ids(text[]) to postgres;

create or replace function app_private.notification_refresh_event_status(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pending integer;
  v_sent integer;
  v_failed integer;
  v_skipped integer;
begin
  select
    count(*) filter (where o.status in ('PENDING','PROCESSING','RETRY')),
    count(*) filter (where o.status='SENT'),
    count(*) filter (where o.status='FAILED'),
    count(*) filter (where o.status='SKIPPED')
  into v_pending,v_sent,v_failed,v_skipped
  from app_private.notification_outbox o
  where o.event_id=p_event_id;

  if v_pending>0 then return; end if;

  update app_private.notification_events
  set status=case
    when v_failed>0 and v_sent>0 then 'PARTIAL'
    when v_failed>0 then 'FAILED'
    when v_sent>0 then 'COMPLETED'
    else 'SKIPPED'
  end,
  updated_at=now()
  where id=p_event_id;
end;
$$;

revoke all on function app_private.notification_refresh_event_status(uuid)
  from public, anon, authenticated, service_role;
grant execute on function app_private.notification_refresh_event_status(uuid) to postgres;

create or replace function app_private.notification_expand_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e app_private.notification_events%rowtype;
  a app_fanclub.membership_applications%rowtype;
  ar app_portal.access_requests%rowtype;
  t app_modules.tasks%rowtype;
  trip app_modules.fanbus_trips%rowtype;
  reg app_modules.fanbus_registrations%rowtype;
  contact app_modules.fanbus_registrations%rowtype;
  stop_record app_modules.fanbus_trip_boarding_stops%rowtype;
  v_booking_id uuid;
  v_user_id uuid;
  v_title text;
  v_body text;
  v_route text;
  v_template text;
  v_data jsonb;
  v_name text;
  v_trip_title text;
  v_email text;
  v_function_email text;
  v_function_enabled boolean := false;
  v_count integer := 0;
  r record;
begin
  select * into e
  from app_private.notification_events ne
  where ne.id = p_event_id
  for update;

  if not found then
    raise exception 'M020_EVENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if e.status in ('EXPANDED','COMPLETED','PARTIAL','SKIPPED') then
    return;
  end if;

  if e.notification_type in (
    'MEMBERSHIP_APPLICATION_RECEIVED',
    'MEMBERSHIP_APPLICATION_INTERNAL_NEW',
    'MEMBERSHIP_APPLICATION_REJECTED',
    'MEMBERSHIP_ADMISSION_COMPLETED'
  ) then
    select * into a
    from app_fanclub.membership_applications ma
    where ma.id::text = e.entity_id;

    if not found then
      update app_private.notification_events
      set status='SKIPPED', last_error_code='SOURCE_ENTITY_NOT_FOUND', updated_at=now()
      where id=e.id;
      return;
    end if;

    v_name := btrim(concat_ws(' ', a.first_name, a.last_name));
    v_data := jsonb_build_object(
      'firstName', a.first_name,
      'lastName', a.last_name,
      'name', v_name,
      'applicantNotice', coalesce(a.rejection_applicant_notice, '')
    );

    if e.notification_type = 'MEMBERSHIP_APPLICATION_RECEIVED' then
      perform app_private.notification_add_external_email(
        e, a.email, 'EXTERNAL_EMAIL',
        'membership-application:' || a.id::text || ':applicant',
        'membership.receipt', v_data, '', true
      );
    elsif e.notification_type = 'MEMBERSHIP_APPLICATION_REJECTED' then
      perform app_private.notification_add_external_email(
        e, a.email, 'EXTERNAL_EMAIL',
        'membership-application:' || a.id::text || ':applicant',
        'membership.rejection', v_data, '', true
      );
    elsif e.notification_type = 'MEMBERSHIP_ADMISSION_COMPLETED' then
      perform app_private.notification_add_external_email(
        e, a.email, 'EXTERNAL_EMAIL',
        'membership-application:' || a.id::text || ':applicant',
        'membership.admission', v_data, '', true
      );
      if a.converted_member_id is not null then
        for v_user_id in
          select uml.user_id
          from app_portal.user_member_links uml
          join app_portal.users u on u.id=uml.user_id and u.status='ACTIVE'
          where uml.member_id=a.converted_member_id
          order by uml.user_id
        loop
          perform app_private.notification_add_user(
            e,v_user_id,'Willkommen bei den Plärrdeifl',
            'Deine Aufnahme in den Fanclub wurde abgeschlossen.',
            'membership.admission',v_data,'#/dashboard',false,false,true
          );
        end loop;
      end if;
    else
      v_title := 'Neuer Mitgliedsantrag';
      v_body := v_name || ' hat einen Mitgliedsantrag gestellt.';
      v_route := '#/fanclub?applicationId=' || a.id::text;
      for v_user_id in
        select mabr.voter_user_id
        from app_fanclub.membership_application_board_roster mabr
        join app_portal.users u on u.id=mabr.voter_user_id and u.status='ACTIVE'
        where mabr.application_id=a.id
        order by mabr.office_code, mabr.voter_user_id
      loop
        perform app_private.notification_add_user(
          e, v_user_id, v_title, v_body,
          'membership.internal_new', v_data, v_route, false, true, true
        );
      end loop;
    end if;

  elsif e.notification_type in (
    'ACCESS_REQUEST_INTERNAL_NEW',
    'ACCESS_REQUEST_APPROVED',
    'ACCESS_REQUEST_REJECTED'
  ) then
    select * into ar
    from app_portal.access_requests x
    where x.id::text=e.entity_id;

    if not found then
      update app_private.notification_events
      set status='SKIPPED', last_error_code='SOURCE_ENTITY_NOT_FOUND', updated_at=now()
      where id=e.id;
      return;
    end if;

    v_name := btrim(concat_ws(' ', ar.first_name, ar.last_name));
    v_data := jsonb_build_object(
      'firstName', ar.first_name,
      'lastName', ar.last_name,
      'name', v_name
    );

    if e.notification_type='ACCESS_REQUEST_INTERNAL_NEW' then
      v_title := 'Neue Portal-Freischaltung';
      v_body := v_name || ' bittet um Portalzugang.';
      v_route := '#/admin?accessRequest=' || ar.id::text;
      for v_user_id in
        select * from app_private.notification_config_user_ids(
          array['accessReviewers','userIds']
        )
      loop
        perform app_private.notification_add_user(
          e, v_user_id, v_title, v_body,
          'access.internal_new', v_data, v_route, false, true, true
        );
      end loop;
    elsif e.notification_type='ACCESS_REQUEST_APPROVED' then
      perform app_private.notification_add_external_email(
        e, ar.email, 'EXTERNAL_EMAIL',
        'access-request:' || ar.id::text || ':applicant',
        'access.approved', v_data, '', true
      );
    else
      perform app_private.notification_add_external_email(
        e, ar.email, 'EXTERNAL_EMAIL',
        'access-request:' || ar.id::text || ':applicant',
        'access.rejected', v_data, '', true
      );
    end if;

  elsif e.category='TASKS' then
    select * into t from app_modules.tasks x where x.id::text=e.entity_id;
    if not found then
      update app_private.notification_events
      set status='SKIPPED', last_error_code='SOURCE_ENTITY_NOT_FOUND', updated_at=now()
      where id=e.id;
      return;
    end if;

    v_title := coalesce(nullif(e.payload->>'title',''), 'Aufgabe');
    v_body := coalesce(nullif(e.payload->>'body',''), t.title);
    v_route := '#/tasks?taskId=' || t.id::text;
    v_data := jsonb_build_object(
      'taskId', t.id,
      'taskTitle', t.title,
      'eventType', e.notification_type
    );

    if nullif(e.payload->>'targetUserId','') is not null then
      begin
        v_user_id := (e.payload->>'targetUserId')::uuid;
      exception when others then
        v_user_id := null;
      end;
      if v_user_id is not null and v_user_id is distinct from e.actor_user_id then
        perform app_private.notification_add_user(
          e, v_user_id, v_title, v_body, 'task.generic',
          v_data, v_route, false, true, true
        );
      end if;
    elsif e.notification_type in ('TASK_CREATED','TASK_WAITING_DEADLINE_SOON','TASK_WAITING_DEADLINE_OVERDUE') then
      if t.assigned_user_id is not null and t.assigned_user_id is distinct from e.actor_user_id then
        perform app_private.notification_add_user(
          e, t.assigned_user_id, v_title, v_body, 'task.generic',
          v_data, v_route, false, true, true
        );
      end if;
    else
      for v_user_id in
        select distinct x.user_id
        from (
          values (t.assigned_user_id), (t.created_by)
        ) as x(user_id)
        join app_portal.users u on u.id=x.user_id and u.status='ACTIVE'
        where x.user_id is not null
          and x.user_id is distinct from e.actor_user_id
      loop
        perform app_private.notification_add_user(
          e, v_user_id, v_title, v_body, 'task.generic',
          v_data, v_route, false, true, true
        );
      end loop;
    end if;

  elsif e.notification_type in (
    'FANBUS_BOOKING_CREATED',
    'FANBUS_WAITLIST_PROMOTED',
    'FANBUS_REGISTRATION_CANCELLED',
    'FANBUS_SELECTED_BOARDING_STOP_CHANGED'
  ) then
    select * into reg
    from app_modules.fanbus_registrations x
    where x.id::text=e.entity_id;

    if not found then
      update app_private.notification_events
      set status='SKIPPED', last_error_code='SOURCE_ENTITY_NOT_FOUND', updated_at=now()
      where id=e.id;
      return;
    end if;

    select * into contact
    from app_modules.fanbus_registrations x
    where x.booking_id=reg.booking_id and x.booking_role='PRIMARY'
    order by x.registered_at,x.id
    limit 1;
    if not found then contact:=reg; end if;

    select * into trip from app_modules.fanbus_trips x where x.id=reg.trip_id;
    select coalesce(ev.title, 'Fanbusfahrt') into v_trip_title
    from app_modules.events ev where ev.id=trip.event_id;
    v_booking_id := reg.booking_id;
    v_name := btrim(concat_ws(' ', reg.first_name, reg.last_name));
    v_data := jsonb_build_object(
      'firstName', contact.first_name,
      'lastName', contact.last_name,
      'name', btrim(concat_ws(' ', contact.first_name, contact.last_name)),
      'affectedName', v_name,
      'tripTitle', coalesce(v_trip_title,'Fanbusfahrt'),
      'status', reg.status,
      'bookingId', reg.booking_id,
      'tripId', reg.trip_id
    );
    v_route := '#/fanbuses?detail=' || reg.trip_id::text;

    if e.notification_type='FANBUS_BOOKING_CREATED' then
      if reg.status='WAITLISTED' then
        v_template := 'fanbus.booking.waitlisted';
        v_title := 'Fanbus – Warteliste';
        v_body := 'Deine Anmeldung für ' || coalesce(v_trip_title,'die Fanbusfahrt') || ' steht auf der Warteliste.';
      else
        v_template := 'fanbus.booking.active';
        v_title := 'Fanbus – Anmeldung bestätigt';
        v_body := 'Deine Anmeldung für ' || coalesce(v_trip_title,'die Fanbusfahrt') || ' ist erfasst.';
      end if;

      if app_private.notification_email_is_valid(contact.email) then
        perform app_private.notification_add_external_email(
          e, contact.email, case when contact.portal_user_id is null then 'EXTERNAL_EMAIL' else 'USER' end,
          'fanbus-booking:' || reg.booking_id::text || ':contact',
          v_template, v_data, case when contact.portal_user_id is null then '' else v_route end, true
        );
      end if;
      if contact.portal_user_id is not null then
        perform app_private.notification_add_user(
          e, contact.portal_user_id, v_title, v_body,
          v_template, v_data, v_route, false, false, true
        );
      end if;

      select
        btrim(coalesce(s.value #>> '{fanbusOrganization,email}','')),
        lower(coalesce(s.value #>> '{fanbusOrganization,emailEnabled}','false'))='true'
      into v_function_email,v_function_enabled
      from app_portal.settings s where s.key='notifications.m020';

      select count(*) into v_count
      from app_modules.fanbus_registrations x
      where x.booking_id=reg.booking_id and x.status <> 'CANCELLED';

      v_data := v_data || jsonb_build_object('participantCount', v_count);
      if v_function_enabled then
        perform app_private.notification_add_external_email(
          e, v_function_email, 'FUNCTION',
          'function:fanbus-org:email',
          'fanbus.internal_new', v_data, v_route, false
        );
      end if;

      for v_user_id in
        select * from app_private.notification_config_user_ids(
          array['fanbusOrganization','userIds']
        )
      loop
        perform app_private.notification_add_user(
          e, v_user_id,
          'Fanbus – neue Buchung',
          v_count::text || ' Person(en) für ' || coalesce(v_trip_title,'eine Fahrt') || ' angemeldet.',
          'fanbus.internal_new', v_data, v_route, false, true, true
        );
      end loop;

    elsif e.notification_type='FANBUS_WAITLIST_PROMOTED' then
      if app_private.notification_email_is_valid(contact.email) then
        perform app_private.notification_add_external_email(
          e, contact.email, case when contact.portal_user_id is null then 'EXTERNAL_EMAIL' else 'USER' end,
          'fanbus-booking:' || reg.booking_id::text || ':contact',
          'fanbus.waitlist_promoted', v_data, case when contact.portal_user_id is null then '' else v_route end, true
        );
      end if;
      if contact.portal_user_id is not null then
        perform app_private.notification_add_user(
          e, contact.portal_user_id,
          'Fanbus – Platz frei',
          'Deine Anmeldung für ' || coalesce(v_trip_title,'die Fahrt') || ' ist jetzt bestätigt.',
          'fanbus.waitlist_promoted', v_data, v_route, false, false, true
        );
      end if;

    elsif e.notification_type='FANBUS_REGISTRATION_CANCELLED' then
      if app_private.notification_email_is_valid(contact.email) then
        perform app_private.notification_add_external_email(
          e, contact.email, case when contact.portal_user_id is null then 'EXTERNAL_EMAIL' else 'USER' end,
          'fanbus-booking:' || reg.booking_id::text || ':contact',
          'fanbus.cancelled', v_data, case when contact.portal_user_id is null then '' else v_route end, true
        );
      end if;
      if contact.portal_user_id is not null then
        perform app_private.notification_add_user(
          e, contact.portal_user_id,
          'Fanbus – Anmeldung storniert',
          'Die Anmeldung für ' || coalesce(v_trip_title,'die Fahrt') || ' wurde storniert.',
          'fanbus.cancelled', v_data, v_route, false, false, true
        );
      end if;

      select
        btrim(coalesce(s.value #>> '{fanbusOrganization,email}','')),
        lower(coalesce(s.value #>> '{fanbusOrganization,emailEnabled}','false'))='true'
      into v_function_email,v_function_enabled
      from app_portal.settings s where s.key='notifications.m020';

      if v_function_enabled then
        perform app_private.notification_add_external_email(
          e, v_function_email, 'FUNCTION',
          'function:fanbus-org:email',
          'fanbus.internal_cancelled', v_data, v_route, false
        );
      end if;

      for v_user_id in
        select * from app_private.notification_config_user_ids(
          array['fanbusOrganization','userIds']
        )
      loop
        perform app_private.notification_add_user(
          e, v_user_id,
          'Fanbus – Stornierung',
          v_name || ' wurde bei ' || coalesce(v_trip_title,'einer Fahrt') || ' storniert.',
          'fanbus.internal_cancelled', v_data, v_route, false, true, true
        );
      end loop;
    else
      if app_private.notification_email_is_valid(contact.email) then
        perform app_private.notification_add_external_email(
          e, contact.email, case when contact.portal_user_id is null then 'EXTERNAL_EMAIL' else 'USER' end,
          'fanbus-booking:' || reg.booking_id::text || ':contact',
          'fanbus.selected_boarding_stop_changed', v_data, case when contact.portal_user_id is null then '' else v_route end, true
        );
      end if;
      if contact.portal_user_id is not null then
        perform app_private.notification_add_user(
          e, contact.portal_user_id,
          'Fanbus – Zustieg geändert',
          'Der Zustieg für ' || coalesce(v_trip_title,'deine Fahrt') || ' wurde geändert.',
          'fanbus.selected_boarding_stop_changed', v_data, v_route, false, false, true
        );
      end if;
    end if;

  elsif e.notification_type in (
    'FANBUS_TRIP_DEPARTURE_CHANGED',
    'FANBUS_BOARDING_TIME_CHANGED'
  ) then
    if e.notification_type='FANBUS_TRIP_DEPARTURE_CHANGED' then
      select * into trip from app_modules.fanbus_trips x where x.id::text=e.entity_id;
      if not found then
        update app_private.notification_events
        set status='SKIPPED', last_error_code='SOURCE_ENTITY_NOT_FOUND', updated_at=now()
        where id=e.id;
        return;
      end if;
      select coalesce(ev.title,'Fanbusfahrt') into v_trip_title
      from app_modules.events ev where ev.id=trip.event_id;

      for r in
        select distinct on (primary_reg.booking_id)
          primary_reg.booking_id, primary_reg.id as registration_id,
          primary_reg.portal_user_id, primary_reg.email,
          primary_reg.first_name, primary_reg.last_name, primary_reg.trip_id
        from app_modules.fanbus_registrations affected
        join app_modules.fanbus_registrations primary_reg
          on primary_reg.booking_id=affected.booking_id
         and primary_reg.booking_role='PRIMARY'
        where affected.trip_id=trip.id
          and affected.status in ('ACTIVE','WAITLISTED')
        order by primary_reg.booking_id, primary_reg.registered_at, primary_reg.id
      loop
        v_data := jsonb_build_object(
          'firstName',r.first_name,'lastName',r.last_name,
          'tripTitle',coalesce(v_trip_title,'Fanbusfahrt'),
          'tripId',r.trip_id,'bookingId',r.booking_id,
          'departureAt',trip.departure_at
        );
        v_route := '#/fanbuses?detail=' || r.trip_id::text;
        if app_private.notification_email_is_valid(r.email) then
          perform app_private.notification_add_external_email(
            e,r.email,case when r.portal_user_id is null then 'EXTERNAL_EMAIL' else 'USER' end,
            'fanbus-booking:'||r.booking_id::text||':contact',
            'fanbus.trip_departure_changed',v_data,case when r.portal_user_id is null then '' else v_route end,true
          );
        end if;
        if r.portal_user_id is not null then
          perform app_private.notification_add_user(
            e,r.portal_user_id,'Fanbus – Abfahrt geändert',
            'Die Abfahrt für '||coalesce(v_trip_title,'deine Fahrt')||' wurde geändert.',
            'fanbus.trip_departure_changed',v_data,v_route,false,false,true
          );
        end if;
      end loop;
    else
      select * into stop_record
      from app_modules.fanbus_trip_boarding_stops x where x.id::text=e.entity_id;
      if not found then
        update app_private.notification_events
        set status='SKIPPED', last_error_code='SOURCE_ENTITY_NOT_FOUND', updated_at=now()
        where id=e.id;
        return;
      end if;
      select * into trip from app_modules.fanbus_trips x where x.id=stop_record.trip_id;
      select coalesce(ev.title,'Fanbusfahrt') into v_trip_title
      from app_modules.events ev where ev.id=trip.event_id;

      for r in
        select distinct on (primary_reg.booking_id)
          primary_reg.booking_id, primary_reg.portal_user_id, primary_reg.email,
          primary_reg.first_name, primary_reg.last_name, primary_reg.trip_id
        from app_modules.fanbus_registrations affected
        join app_modules.fanbus_registrations primary_reg
          on primary_reg.booking_id=affected.booking_id
         and primary_reg.booking_role='PRIMARY'
        where affected.trip_id=stop_record.trip_id
          and affected.trip_boarding_stop_id=stop_record.id
          and affected.status in ('ACTIVE','WAITLISTED')
        order by primary_reg.booking_id,primary_reg.registered_at,primary_reg.id
      loop
        v_data:=jsonb_build_object(
          'firstName',r.first_name,'lastName',r.last_name,
          'tripTitle',coalesce(v_trip_title,'Fanbusfahrt'),
          'tripId',r.trip_id,'bookingId',r.booking_id,
          'boardingDepartureAt',stop_record.departure_at
        );
        v_route := '#/fanbuses?detail=' || r.trip_id::text;
        if app_private.notification_email_is_valid(r.email) then
          perform app_private.notification_add_external_email(
            e,r.email,case when r.portal_user_id is null then 'EXTERNAL_EMAIL' else 'USER' end,
            'fanbus-booking:'||r.booking_id::text||':contact',
            'fanbus.boarding_time_changed',v_data,case when r.portal_user_id is null then '' else v_route end,true
          );
        end if;
        if r.portal_user_id is not null then
          perform app_private.notification_add_user(
            e,r.portal_user_id,'Fanbus – Zustiegszeit geändert',
            'Die Zustiegszeit für '||coalesce(v_trip_title,'deine Fahrt')||' wurde geändert.',
            'fanbus.boarding_time_changed',v_data,v_route,false,false,true
          );
        end if;
      end loop;
    end if;
  else
    update app_private.notification_events
    set status='SKIPPED', last_error_code='NOTIFICATION_TYPE_UNSUPPORTED', updated_at=now()
    where id=e.id;
    return;
  end if;

  update app_private.notification_events
  set status=case
        when exists (
          select 1 from app_private.notification_outbox o where o.event_id=e.id
        ) then 'EXPANDED'
        else 'SKIPPED'
      end,
      expanded_at=coalesce(expanded_at,now()),
      last_error_code=case
        when exists (
          select 1 from app_private.notification_outbox o where o.event_id=e.id
        ) then ''
        else 'NO_RECIPIENTS'
      end,
      updated_at=now()
  where id=e.id;

  if exists (select 1 from app_private.notification_outbox o where o.event_id=e.id) then
    perform app_private.notification_refresh_event_status(e.id);
  end if;
end;
$$;

revoke all on function app_private.notification_expand_event(uuid)
  from public, anon, authenticated, service_role;
grant execute on function app_private.notification_expand_event(uuid) to postgres;

create or replace function app_private.notification_expand_pending_events(p_limit integer default 25)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select ne.id
    from app_private.notification_events ne
    where ne.status in ('PENDING','PROCESSING')
      and ne.next_attempt_at <= now()
      and (
        ne.status='PENDING'
        or ne.claim_expires_at is null
        or ne.claim_expires_at <= now()
      )
    order by ne.created_at,ne.id
    for update skip locked
    limit least(greatest(coalesce(p_limit,25),1),100)
  loop
    update app_private.notification_events
    set status='PROCESSING',attempt_count=attempt_count+1,
        claim_token=extensions.gen_random_uuid(),claimed_at=now(),
        claim_expires_at=now()+interval '10 minutes',updated_at=now()
    where id=r.id;

    begin
      perform app_private.notification_expand_event(r.id);
      v_count:=v_count+1;
    exception when others then
      update app_private.notification_events
      set status=case when attempt_count>=5 then 'FAILED' else 'PENDING' end,
          next_attempt_at=case
            when attempt_count=1 then now()+interval '1 minute'
            when attempt_count=2 then now()+interval '5 minutes'
            when attempt_count=3 then now()+interval '30 minutes'
            when attempt_count=4 then now()+interval '2 hours'
            else now()+interval '12 hours'
          end,
          last_error_code='EXPANSION_FAILED',
          claim_token=null,claimed_at=null,claim_expires_at=null,updated_at=now()
      where id=r.id;
    end;
  end loop;
  return v_count;
end;
$$;

revoke all on function app_private.notification_expand_pending_events(integer)
  from public, anon, authenticated, service_role;
grant execute on function app_private.notification_expand_pending_events(integer) to postgres;

create or replace function public.pd_notification_claim_batch(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
  r record;
begin
  perform app_private.notification_expand_pending_events(50);

  update app_private.notification_outbox o
  set status='RETRY', claim_token=null, claimed_at=null, claim_expires_at=null,
      next_attempt_at=now(), last_error_code='CLAIM_EXPIRED', updated_at=now()
  where o.status='PROCESSING'
    and o.claim_expires_at <= now()
    and o.attempt_count < o.max_attempts;

  update app_private.notification_outbox o
  set status='FAILED', claim_token=null, claimed_at=null, claim_expires_at=null,
      last_error_code='MAX_ATTEMPTS_REACHED', updated_at=now()
  where o.status='PROCESSING'
    and o.claim_expires_at <= now()
    and o.attempt_count >= o.max_attempts;

  update app_private.notification_outbox o
  set status='SKIPPED', last_error_code='DELIVERY_EXPIRED', updated_at=now()
  where o.status in ('PENDING','RETRY')
    and o.expires_at <= now();

  update app_private.notification_outbox o
  set status='SKIPPED',last_error_code='PUSH_SUBSCRIPTION_INACTIVE',updated_at=now()
  where o.channel='PUSH'
    and o.status in ('PENDING','RETRY')
    and not exists (
      select 1 from app_portal.push_subscriptions ps
      where ps.id=o.push_subscription_id and ps.is_active=true
    );

  for r in
    select ne.id
    from app_private.notification_events ne
    where ne.status='EXPANDED'
      and exists (
        select 1 from app_private.notification_outbox o where o.event_id=ne.id
      )
      and not exists (
        select 1 from app_private.notification_outbox o
        where o.event_id=ne.id and o.status in ('PENDING','PROCESSING','RETRY')
      )
  loop
    perform app_private.notification_refresh_event_status(r.id);
  end loop;

  with candidates as (
    select o.id
    from app_private.notification_outbox o
    where o.status in ('PENDING','RETRY')
      and o.next_attempt_at <= now()
      and o.expires_at > now()
    order by o.created_at,o.id
    for update skip locked
    limit least(greatest(coalesce(p_limit,20),1),50)
  ),
  claimed as (
    update app_private.notification_outbox o
    set status='PROCESSING',
        attempt_count=o.attempt_count+1,
        claim_token=extensions.gen_random_uuid(),
        claimed_at=now(),
        claim_expires_at=now()+interval '10 minutes',
        updated_at=now()
    from candidates c
    where o.id=c.id
    returning o.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'outboxId',c.id,
    'claimToken',c.claim_token,
    'eventId',c.event_id,
    'notificationType',c.notification_type,
    'category',c.category,
    'channel',c.channel,
    'recipientAddress',case when c.channel='EMAIL' then c.recipient_address else null end,
    'push',case when c.channel='PUSH' then (
      select jsonb_build_object(
        'subscriptionId',ps.id,
        'endpoint',ps.endpoint,
        'p256dh',ps.p256dh,
        'auth',ps.auth_key
      )
      from app_portal.push_subscriptions ps
      where ps.id=c.push_subscription_id and ps.is_active=true
    ) else null end,
    'payload',c.payload,
    'deepLink',c.deep_link,
    'attemptCount',c.attempt_count,
    'maxAttempts',c.max_attempts,
    'badgeCount',case
      when c.recipient_user_id is null then 0
      when not coalesce((
        select np.badge_enabled from app_portal.notification_preferences np
        where np.user_id=c.recipient_user_id
      ),true) then 0
      else (
        select count(*) from app_portal.notifications n
        where n.user_id=c.recipient_user_id and n.read_at is null
      )
    end
  ) order by c.created_at,c.id),'[]'::jsonb)
  into v_rows
  from claimed c;

  return v_rows;
end;
$$;

revoke all on function public.pd_notification_claim_batch(integer)
  from public, anon, authenticated;
grant execute on function public.pd_notification_claim_batch(integer) to service_role;

create or replace function public.pd_notification_complete(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_token uuid;
  v_success boolean;
  v_retryable boolean;
  v_disable_push boolean;
  v_error text;
  v_provider_id text;
  v_retry_after integer;
  o app_private.notification_outbox%rowtype;
  v_next timestamptz;
begin
  begin
    v_id := nullif(p_payload->>'outboxId','')::uuid;
    v_token := nullif(p_payload->>'claimToken','')::uuid;
  exception when others then
    raise exception 'M020_COMPLETE_INVALID_ID' using errcode='22023';
  end;

  v_success := coalesce((p_payload->>'success')::boolean,false);
  v_retryable := coalesce((p_payload->>'retryable')::boolean,false);
  v_disable_push := coalesce((p_payload->>'disablePushSubscription')::boolean,false);
  v_error := left(coalesce(p_payload->>'errorCode',''),160);
  v_provider_id := left(coalesce(p_payload->>'providerMessageId',''),300);
  begin
    v_retry_after := nullif(p_payload->>'retryAfterSeconds','')::integer;
  exception when others then
    v_retry_after := null;
  end;
  if v_retry_after is not null then
    v_retry_after := least(greatest(v_retry_after,1),43200);
  end if;

  select * into o
  from app_private.notification_outbox x
  where x.id=v_id and x.claim_token=v_token and x.status='PROCESSING'
  for update;

  if not found then
    raise exception 'M020_COMPLETE_CLAIM_NOT_FOUND' using errcode='P0002';
  end if;

  if v_disable_push and o.push_subscription_id is not null then
    update app_portal.push_subscriptions
    set is_active=false,disabled_at=coalesce(disabled_at,now()),
        failure_count=failure_count+1,updated_at=now()
    where id=o.push_subscription_id;
  end if;

  if v_success then
    update app_private.notification_outbox
    set status='SENT',sent_at=now(),provider_message_id=nullif(v_provider_id,''),
        last_error_code='',claim_token=null,claimed_at=null,claim_expires_at=null,
        updated_at=now()
    where id=o.id;

    if o.push_subscription_id is not null then
      update app_portal.push_subscriptions
      set last_success_at=now(),last_seen_at=now(),failure_count=0,updated_at=now()
      where id=o.push_subscription_id;
    end if;
  elsif v_retryable and o.attempt_count < o.max_attempts and o.expires_at > now() then
    v_next := now() + case
      when v_retry_after is not null then make_interval(secs=>v_retry_after)
      when o.attempt_count=1 then interval '1 minute'
      when o.attempt_count=2 then interval '5 minutes'
      when o.attempt_count=3 then interval '30 minutes'
      when o.attempt_count=4 then interval '2 hours'
      else interval '12 hours'
    end;
    update app_private.notification_outbox
    set status='RETRY',next_attempt_at=v_next,
        last_error_code=coalesce(nullif(v_error,''),'PROVIDER_TEMPORARY'),
        claim_token=null,claimed_at=null,claim_expires_at=null,updated_at=now()
    where id=o.id;

    if o.push_subscription_id is not null then
      update app_portal.push_subscriptions
      set failure_count=failure_count+1,updated_at=now()
      where id=o.push_subscription_id;
    end if;
  else
    update app_private.notification_outbox
    set status='FAILED',
        last_error_code=coalesce(nullif(v_error,''),
          case when o.attempt_count>=o.max_attempts then 'MAX_ATTEMPTS_REACHED' else 'PROVIDER_PERMANENT' end),
        claim_token=null,claimed_at=null,claim_expires_at=null,updated_at=now()
    where id=o.id;

    if o.push_subscription_id is not null then
      update app_portal.push_subscriptions
      set failure_count=failure_count+1,updated_at=now()
      where id=o.push_subscription_id;
    end if;
  end if;

  perform app_private.notification_refresh_event_status(o.event_id);

  return jsonb_build_object('ok',true,'status',(
    select status from app_private.notification_outbox where id=o.id
  ));
end;
$$;

revoke all on function public.pd_notification_complete(jsonb)
  from public, anon, authenticated;
grant execute on function public.pd_notification_complete(jsonb) to service_role;

create or replace function app_private.invoke_notification_dispatch()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := '';
  v_secret text := '';
  v_request_id bigint;
begin
  select ds.decrypted_secret into v_url
  from vault.decrypted_secrets ds
  where ds.name='pd_notification_dispatch_url'
  limit 1;

  select ds.decrypted_secret into v_secret
  from vault.decrypted_secrets ds
  where ds.name='pd_notification_dispatch_secret'
  limit 1;

  if coalesce(v_url,'')=''
     or coalesce(v_secret,'')='' then
    return null;
  end if;

  if v_url !~ '^https://[a-z0-9-]+\.supabase\.co/functions/v1/notification-dispatch$' then
    return null;
  end if;

  select net.http_post(
    url:=v_url,
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-m020-notification-dispatch-secret',v_secret
    ),
    body:=jsonb_build_object('source','database','requestedAt',now()),
    timeout_milliseconds:=120000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function app_private.invoke_notification_dispatch()
  from public, anon, authenticated, service_role;
grant execute on function app_private.invoke_notification_dispatch() to postgres;

create or replace function app_private.notification_retention_run()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outbox_minimized integer := 0;
  v_event_minimized integer := 0;
  v_outbox_deleted integer := 0;
  v_event_deleted integer := 0;
  v_devices_deleted integer := 0;
  v_projections_deleted integer := 0;
begin
  update app_private.notification_outbox
  set recipient_address=null,payload='{}'::jsonb,updated_at=now()
  where status in ('SENT','FAILED','SKIPPED')
    and created_at < now()-interval '30 days'
    and (recipient_address is not null or payload <> '{}'::jsonb);
  get diagnostics v_outbox_minimized = row_count;

  update app_private.notification_events
  set payload='{}'::jsonb,updated_at=now()
  where status in ('COMPLETED','PARTIAL','FAILED','SKIPPED')
    and created_at < now()-interval '30 days'
    and payload <> '{}'::jsonb;
  get diagnostics v_event_minimized = row_count;

  -- User-facing M020 projections can contain names in title/body. The central
  -- event/outbox metadata remains available for 90 days, so projections are
  -- removed after the 30-day PII window instead of being retained indefinitely.
  delete from app_portal.notifications
  where event_key like 'm020:%'
    and created_at < now()-interval '30 days';
  get diagnostics v_projections_deleted = row_count;

  delete from app_private.notification_outbox
  where status in ('SENT','FAILED','SKIPPED')
    and created_at < now()-interval '90 days';
  get diagnostics v_outbox_deleted = row_count;

  delete from app_private.notification_events
  where status in ('COMPLETED','PARTIAL','FAILED','SKIPPED')
    and created_at < now()-interval '90 days';
  get diagnostics v_event_deleted = row_count;

  delete from app_portal.push_subscriptions
  where is_active=false
    and coalesce(disabled_at,updated_at,created_at) < now()-interval '30 days';
  get diagnostics v_devices_deleted = row_count;

  return jsonb_build_object(
    'outboxMinimized',v_outbox_minimized,
    'eventsMinimized',v_event_minimized,
    'projectionsDeleted',v_projections_deleted,
    'outboxDeleted',v_outbox_deleted,
    'eventsDeleted',v_event_deleted,
    'pushDevicesDeleted',v_devices_deleted
  );
end;
$$;

revoke all on function app_private.notification_retention_run()
  from public, anon, authenticated, service_role;
grant execute on function app_private.notification_retention_run() to postgres;

-- M150 retention integration: a membership application must not be purged while
-- either a pre-M020 legacy email is actively claimed or a central M020 event/delivery
-- for that application is still non-terminal. Terminal M020 metadata stays under the
-- independent 30/90-day M020 retention policy and is not coupled to the business row.
create or replace function app_private.m150_membership_retention_run()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application record;
  v_cutoff timestamptz := clock_timestamp() - interval '12 months';
  v_purged integer := 0;
  v_pending integer := 0;
  v_rejected integer := 0;
  v_withdrawn integer := 0;
begin
  for v_application in
    select
      application.id,
      application.status,
      case application.status
        when 'PENDING' then application.submitted_at
        when 'REJECTED' then application.decided_at
        when 'WITHDRAWN' then application.updated_at
      end as retention_anchor,
      case application.status
        when 'PENDING' then 'STALE_PENDING'
        when 'REJECTED' then 'REJECTED_12_MONTHS'
        when 'WITHDRAWN' then 'WITHDRAWN_12_MONTHS'
      end as retention_reason
    from app_fanclub.membership_applications as application
    where (
      (application.status = 'PENDING' and application.submitted_at <= v_cutoff)
      or (application.status = 'REJECTED' and application.decided_at <= v_cutoff)
      or (application.status = 'WITHDRAWN' and application.updated_at <= v_cutoff)
    )
      and not exists (
        select 1
        from app_private.membership_application_email_outbox as sending_outbox
        where sending_outbox.application_id = application.id
          and sending_outbox.status = 'SENDING'
      )
      and not exists (
        select 1
        from app_private.notification_events as pending_event
        where pending_event.source_module = 'M150'
          and pending_event.entity_type = 'membership_application'
          and pending_event.entity_id = application.id::text
          and pending_event.status in ('PENDING','PROCESSING','EXPANDED')
      )
      and not exists (
        select 1
        from app_private.notification_outbox as pending_outbox
        join app_private.notification_events as pending_event
          on pending_event.id = pending_outbox.event_id
        where pending_event.source_module = 'M150'
          and pending_event.entity_type = 'membership_application'
          and pending_event.entity_id = application.id::text
          and pending_outbox.status in ('PENDING','PROCESSING','RETRY')
      )
    order by retention_anchor, application.id
    limit 100
    for update of application skip locked
  loop
    perform outbox.id
    from app_private.membership_application_email_outbox as outbox
    where outbox.application_id = v_application.id
    order by outbox.id
    for update;

    perform m020_event.id
    from app_private.notification_events as m020_event
    where m020_event.source_module = 'M150'
      and m020_event.entity_type = 'membership_application'
      and m020_event.entity_id = v_application.id::text
    order by m020_event.id
    for update;

    perform m020_outbox.id
    from app_private.notification_outbox as m020_outbox
    join app_private.notification_events as m020_event
      on m020_event.id = m020_outbox.event_id
    where m020_event.source_module = 'M150'
      and m020_event.entity_type = 'membership_application'
      and m020_event.entity_id = v_application.id::text
    order by m020_outbox.id
    for update of m020_outbox;

    if exists (
      select 1
      from app_private.membership_application_email_outbox as sending_outbox
      where sending_outbox.application_id = v_application.id
        and sending_outbox.status = 'SENDING'
    ) or exists (
      select 1
      from app_private.notification_events as pending_event
      where pending_event.source_module = 'M150'
        and pending_event.entity_type = 'membership_application'
        and pending_event.entity_id = v_application.id::text
        and pending_event.status in ('PENDING','PROCESSING','EXPANDED')
    ) or exists (
      select 1
      from app_private.notification_outbox as pending_outbox
      join app_private.notification_events as pending_event
        on pending_event.id = pending_outbox.event_id
      where pending_event.source_module = 'M150'
        and pending_event.entity_type = 'membership_application'
        and pending_event.entity_id = v_application.id::text
        and pending_outbox.status in ('PENDING','PROCESSING','RETRY')
    ) then
      continue;
    end if;

    delete from app_private.membership_application_intake_idempotency as intake
    where intake.application_id = v_application.id;

    delete from app_fanclub.membership_application_votes as vote
    where vote.application_id = v_application.id;

    perform app_private.log_audit(
      null,
      'MEMBERSHIP_APPLICATION_RETENTION_PURGED',
      'membership_application',
      v_application.id::text,
      null,
      null,
      jsonb_build_object(
        'status', v_application.status,
        'retentionReason', v_application.retention_reason
      )
    );

    delete from app_fanclub.membership_applications as application
    where application.id = v_application.id;

    v_purged := v_purged + 1;
    case v_application.status
      when 'PENDING' then v_pending := v_pending + 1;
      when 'REJECTED' then v_rejected := v_rejected + 1;
      when 'WITHDRAWN' then v_withdrawn := v_withdrawn + 1;
    end case;
  end loop;

  return jsonb_build_object(
    'purged', v_purged,
    'pending', v_pending,
    'rejected', v_rejected,
    'withdrawn', v_withdrawn
  );
end;
$$;

revoke all on function app_private.m150_membership_retention_run()
  from public, anon, authenticated, service_role;

-- M150: keep the existing, already accepted trigger timing but switch new entries to M020.
create or replace function app_private.m150_enqueue_membership_email(
  p_application_id uuid,
  p_email_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := upper(btrim(coalesce(p_email_type,'')));
begin
  if v_type='RECEIPT' then
    perform app_private.notification_event_enqueue(
      'MEMBERSHIP_APPLICATION_RECEIVED','ACCOUNT_MEMBERSHIP',
      'membership-application:'||p_application_id::text||':received',
      'M150','membership_application',p_application_id::text,null,'{}'::jsonb,now()
    );
  elsif v_type='REJECTION' then
    perform app_private.notification_event_enqueue(
      'MEMBERSHIP_APPLICATION_REJECTED','ACCOUNT_MEMBERSHIP',
      'membership-application:'||p_application_id::text||':rejected',
      'M150','membership_application',p_application_id::text,null,'{}'::jsonb,now()
    );
  elsif v_type='ADMISSION' then
    perform app_private.notification_event_enqueue(
      'MEMBERSHIP_ADMISSION_COMPLETED','ACCOUNT_MEMBERSHIP',
      'membership-application:'||p_application_id::text||':admission-completed',
      'M150','membership_application',p_application_id::text,null,'{}'::jsonb,now()
    );
  else
    raise exception 'M150_EMAIL_TYPE_INVALID' using errcode='22023';
  end if;
end;
$$;

revoke all on function app_private.m150_enqueue_membership_email(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function app_private.m150_enqueue_membership_email(uuid,text) to postgres;

create or replace function app_private.m020_membership_internal_new_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.notification_event_enqueue(
    'MEMBERSHIP_APPLICATION_INTERNAL_NEW','ACCOUNT_MEMBERSHIP',
    'membership-application:'||new.id::text||':internal-new',
    'M150','membership_application',new.id::text,null,'{}'::jsonb,new.submitted_at
  );
  return new;
end;
$$;

revoke all on function app_private.m020_membership_internal_new_trigger()
  from public, anon, authenticated, service_role;
grant execute on function app_private.m020_membership_internal_new_trigger() to postgres;

drop trigger if exists m020_membership_internal_new on app_fanclub.membership_applications;
create trigger m020_membership_internal_new
after insert on app_fanclub.membership_applications
for each row execute function app_private.m020_membership_internal_new_trigger();

create or replace function app_private.m020_access_request_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op='INSERT' and new.status='PENDING' then
    perform app_private.notification_event_enqueue(
      'ACCESS_REQUEST_INTERNAL_NEW','ACCOUNT_MEMBERSHIP',
      'access-request:'||new.id::text||':pending:r'||new.revision::text,
      'P100','access_request',new.id::text,new.auth_user_id,
      '{}'::jsonb,new.requested_at
    );
  elsif tg_op='UPDATE' then
    if new.status='PENDING' and (
      old.status is distinct from new.status
      or old.revision is distinct from new.revision
    ) then
      perform app_private.notification_event_enqueue(
        'ACCESS_REQUEST_INTERNAL_NEW','ACCOUNT_MEMBERSHIP',
        'access-request:'||new.id::text||':pending:r'||new.revision::text,
        'P100','access_request',new.id::text,new.auth_user_id,'{}'::jsonb,now()
      );
    elsif old.status is distinct from new.status and new.status='APPROVED' then
      perform app_private.notification_event_enqueue(
        'ACCESS_REQUEST_APPROVED','ACCOUNT_MEMBERSHIP',
        'access-request:'||new.id::text||':approved:r'||new.revision::text,
        'P100','access_request',new.id::text,new.reviewed_by,'{}'::jsonb,now()
      );
    elsif old.status is distinct from new.status and new.status='REJECTED' then
      perform app_private.notification_event_enqueue(
        'ACCESS_REQUEST_REJECTED','ACCOUNT_MEMBERSHIP',
        'access-request:'||new.id::text||':rejected:r'||new.revision::text,
        'P100','access_request',new.id::text,new.reviewed_by,'{}'::jsonb,now()
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.m020_access_request_trigger()
  from public, anon, authenticated, service_role;
grant execute on function app_private.m020_access_request_trigger() to postgres;

drop trigger if exists m020_access_request_events on app_portal.access_requests;
create trigger m020_access_request_events
after insert or update on app_portal.access_requests
for each row execute function app_private.m020_access_request_trigger();

create or replace function app_private.m020_fanbus_registration_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op='INSERT' and new.booking_role='PRIMARY' and new.status in ('ACTIVE','WAITLISTED') then
    perform app_private.notification_event_enqueue(
      'FANBUS_BOOKING_CREATED','FANBUS',
      'fanbus-booking:'||new.booking_id::text||':created',
      'M310','fanbus_registration',new.id::text,new.created_by,
      jsonb_build_object('bookingId',new.booking_id,'tripId',new.trip_id),new.registered_at
    );
  elsif tg_op='UPDATE' then
    if old.status='WAITLISTED' and new.status='ACTIVE' then
      perform app_private.notification_event_enqueue(
        'FANBUS_WAITLIST_PROMOTED','FANBUS',
        'fanbus-registration:'||new.id::text||':waitlist-promoted:r'||new.revision::text,
        'M320','fanbus_registration',new.id::text,new.updated_by,
        jsonb_build_object('bookingId',new.booking_id,'tripId',new.trip_id),now()
      );
    elsif old.status is distinct from new.status and new.status='CANCELLED' then
      perform app_private.notification_event_enqueue(
        'FANBUS_REGISTRATION_CANCELLED','FANBUS',
        'fanbus-registration:'||new.id::text||':cancelled:r'||new.revision::text,
        'M320','fanbus_registration',new.id::text,new.updated_by,
        jsonb_build_object('bookingId',new.booking_id,'tripId',new.trip_id),now()
      );
    end if;

    if old.trip_boarding_stop_id is distinct from new.trip_boarding_stop_id
       and new.status in ('ACTIVE','WAITLISTED') then
      perform app_private.notification_event_enqueue(
        'FANBUS_SELECTED_BOARDING_STOP_CHANGED','FANBUS',
        'fanbus-registration:'||new.id::text||':boarding-stop:r'||new.revision::text,
        'M325','fanbus_registration',new.id::text,new.updated_by,
        jsonb_build_object('bookingId',new.booking_id,'tripId',new.trip_id),now()
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.m020_fanbus_registration_trigger()
  from public, anon, authenticated, service_role;
grant execute on function app_private.m020_fanbus_registration_trigger() to postgres;

drop trigger if exists m020_fanbus_registration_events on app_modules.fanbus_registrations;
create trigger m020_fanbus_registration_events
after insert or update on app_modules.fanbus_registrations
for each row execute function app_private.m020_fanbus_registration_trigger();

create or replace function app_private.m020_fanbus_trip_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.departure_at is distinct from new.departure_at
     and new.status='PUBLISHED' then
    perform app_private.notification_event_enqueue(
      'FANBUS_TRIP_DEPARTURE_CHANGED','FANBUS',
      'fanbus-trip:'||new.id::text||':departure:r'||new.revision::text,
      'M310','fanbus_trip',new.id::text,new.updated_by,
      jsonb_build_object('oldDepartureAt',old.departure_at,'newDepartureAt',new.departure_at),now()
    );
  end if;
  return new;
end;
$$;

revoke all on function app_private.m020_fanbus_trip_trigger()
  from public, anon, authenticated, service_role;
grant execute on function app_private.m020_fanbus_trip_trigger() to postgres;

drop trigger if exists m020_fanbus_trip_events on app_modules.fanbus_trips;
create trigger m020_fanbus_trip_events
after update on app_modules.fanbus_trips
for each row execute function app_private.m020_fanbus_trip_trigger();

create or replace function app_private.m020_fanbus_boarding_time_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if old.departure_at is distinct from new.departure_at then
    select ft.status into v_status from app_modules.fanbus_trips ft where ft.id=new.trip_id;
    if v_status='PUBLISHED' then
      perform app_private.notification_event_enqueue(
        'FANBUS_BOARDING_TIME_CHANGED','FANBUS',
        'fanbus-trip-stop:'||new.id::text||':departure:r'||new.revision::text,
        'M325','fanbus_trip_boarding_stop',new.id::text,new.updated_by,
        jsonb_build_object('tripId',new.trip_id,'oldDepartureAt',old.departure_at,'newDepartureAt',new.departure_at),now()
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.m020_fanbus_boarding_time_trigger()
  from public, anon, authenticated, service_role;
grant execute on function app_private.m020_fanbus_boarding_time_trigger() to postgres;

drop trigger if exists m020_fanbus_boarding_time_events on app_modules.fanbus_trip_boarding_stops;
create trigger m020_fanbus_boarding_time_events
after update on app_modules.fanbus_trip_boarding_stops
for each row execute function app_private.m020_fanbus_boarding_time_trigger();

-- Existing task call sites keep their signatures, but recipient expansion is now responsibility-based.
create or replace function app_private.task_notification_queue(
  p_task_id uuid,
  p_actor uuid,
  p_event_type text,
  p_title text,
  p_body text,
  p_event_key text,
  p_target_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  v_id := app_private.notification_event_enqueue(
    p_event_type,'TASKS',p_event_key,'TASKS','task',p_task_id::text,p_actor,
    jsonb_build_object(
      'title',coalesce(p_title,''),
      'body',coalesce(p_body,''),
      'targetUserId',p_target_user_id
    ),now()
  );
  return case when v_id is null then 0 else 1 end;
end;
$$;

revoke all on function app_private.task_notification_queue(
  uuid,uuid,text,text,text,text,uuid
) from public, anon, authenticated, service_role;
grant execute on function app_private.task_notification_queue(
  uuid,uuid,text,text,text,text,uuid
) to postgres;

create or replace function app_private.queue_task_created_push_r1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_user_id is not null then
    perform app_private.task_notification_queue(
      new.id,new.created_by,'TASK_CREATED','Neue Aufgabe',
      coalesce(new.title,'Neue Aufgabe'),
      'task:'||new.id::text||':created:r'||new.revision::text,
      new.assigned_user_id
    );
  end if;
  return new;
end;
$$;

revoke all on function app_private.queue_task_created_push_r1()
  from public, anon, authenticated, service_role;
grant execute on function app_private.queue_task_created_push_r1() to postgres;

-- Harden subscription ownership and expose only safe device metadata to the browser.
create or replace function app_private.api_push_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_pref app_portal.notification_preferences%rowtype;
  v_key text := '';
begin
  perform app_private.require_active_user();

  insert into app_portal.notification_preferences(user_id)
  values(v_user) on conflict(user_id) do nothing;

  select * into v_pref
  from app_portal.notification_preferences
  where user_id=v_user;

  select coalesce(s.value->>'publicKey','') into v_key
  from app_portal.settings s where s.key='web_push';

  return jsonb_build_object(
    'supported',v_key<>'',
    'publicKey',v_key,
    'activeDeviceCount',(
      select count(*) from app_portal.push_subscriptions ps
      where ps.user_id=v_user and ps.is_active=true
    ),
    'devices',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',ps.id,
        'deviceLabel',ps.device_label,
        'lastSeenAt',ps.last_seen_at,
        'lastSuccessAt',ps.last_success_at,
        'createdAt',ps.created_at
      ) order by ps.last_seen_at desc,ps.id)
      from app_portal.push_subscriptions ps
      where ps.user_id=v_user and ps.is_active=true
    ),'[]'::jsonb),
    'unreadNotificationCount',(
      select count(*) from app_portal.notifications n
      where n.user_id=v_user and n.read_at is null
    ),
    'preferences',jsonb_build_object(
      'pushEnabled',v_pref.push_enabled,
      'newTasks',v_pref.new_tasks,
      'taskUpdates',v_pref.task_updates,
      'taskStatus',v_pref.task_status,
      'taskTransfers',v_pref.task_transfers,
      'waitingDeadlines',v_pref.waiting_deadlines,
      'badgeEnabled',v_pref.badge_enabled,
      'quietHoursEnabled',v_pref.quiet_hours_enabled,
      'quietStart',to_char(v_pref.quiet_start,'HH24:MI'),
      'quietEnd',to_char(v_pref.quiet_end,'HH24:MI'),
      'timeZone',v_pref.time_zone,
      'emailAccountMembership',v_pref.email_account_membership,
      'pushAccountMembership',v_pref.push_account_membership,
      'emailFanbus',v_pref.email_fanbus,
      'pushFanbus',v_pref.push_fanbus,
      'emailDates',v_pref.email_dates,
      'pushDates',v_pref.push_dates,
      'emailTasks',v_pref.email_tasks,
      'pushTasks',v_pref.push_tasks,
      'revision',v_pref.revision
    )
  );
end;
$$;

create or replace function app_private.api_save_notification_preferences(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_expected integer;
begin
  perform app_private.require_active_user();

  begin
    v_expected:=coalesce((p_payload->>'revision')::integer,1);
  exception when others then
    raise exception 'PUSH_PREFERENCE_INVALID_REVISION' using errcode='22023';
  end;

  insert into app_portal.notification_preferences(user_id)
  values(v_user) on conflict(user_id) do nothing;

  update app_portal.notification_preferences
  set
    push_enabled=coalesce((p_payload->>'pushEnabled')::boolean,push_enabled),
    new_tasks=coalesce((p_payload->>'newTasks')::boolean,new_tasks),
    task_updates=coalesce((p_payload->>'taskUpdates')::boolean,task_updates),
    task_status=coalesce((p_payload->>'taskStatus')::boolean,task_status),
    task_transfers=coalesce((p_payload->>'taskTransfers')::boolean,task_transfers),
    waiting_deadlines=coalesce((p_payload->>'waitingDeadlines')::boolean,waiting_deadlines),
    badge_enabled=coalesce((p_payload->>'badgeEnabled')::boolean,badge_enabled),
    quiet_hours_enabled=coalesce((p_payload->>'quietHoursEnabled')::boolean,quiet_hours_enabled),
    quiet_start=coalesce(nullif(p_payload->>'quietStart','')::time,quiet_start),
    quiet_end=coalesce(nullif(p_payload->>'quietEnd','')::time,quiet_end),
    time_zone=left(coalesce(nullif(btrim(p_payload->>'timeZone'),''),time_zone),80),
    email_account_membership=coalesce((p_payload->>'emailAccountMembership')::boolean,email_account_membership),
    push_account_membership=coalesce((p_payload->>'pushAccountMembership')::boolean,push_account_membership),
    email_fanbus=coalesce((p_payload->>'emailFanbus')::boolean,email_fanbus),
    push_fanbus=coalesce((p_payload->>'pushFanbus')::boolean,push_fanbus),
    email_dates=coalesce((p_payload->>'emailDates')::boolean,email_dates),
    push_dates=coalesce((p_payload->>'pushDates')::boolean,push_dates),
    email_tasks=coalesce((p_payload->>'emailTasks')::boolean,email_tasks),
    push_tasks=coalesce((p_payload->>'pushTasks')::boolean,push_tasks),
    revision=revision+1,updated_at=now()
  where user_id=v_user and revision=v_expected;

  if not found then
    raise exception 'PUSH_PREFERENCE_REVISION_CONFLICT' using errcode='40001';
  end if;

  return app_private.api_push_snapshot();
end;
$$;

create or replace function app_private.api_save_push_subscription(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_endpoint text := btrim(coalesce(p_payload->>'endpoint',''));
  v_p256dh text := btrim(coalesce(p_payload->>'p256dh',''));
  v_auth text := btrim(coalesce(p_payload->>'auth',''));
  v_existing_user uuid;
begin
  perform app_private.require_active_user();

  if length(v_endpoint) not between 20 and 4000
     or v_endpoint !~ '^https://'
     or v_endpoint ~ E'[\\r\\n]'
     or length(v_p256dh) not between 20 and 500
     or length(v_auth) not between 8 and 500 then
    raise exception 'PUSH_SUBSCRIPTION_INVALID' using errcode='22023';
  end if;

  select ps.user_id into v_existing_user
  from app_portal.push_subscriptions ps
  where ps.endpoint=v_endpoint
  for update;

  if found and v_existing_user is distinct from v_user then
    raise exception 'PUSH_SUBSCRIPTION_ENDPOINT_OWNED' using errcode='23505';
  end if;

  insert into app_portal.push_subscriptions(
    user_id,endpoint,p256dh,auth_key,device_label,user_agent,
    is_active,failure_count,last_seen_at,disabled_at,updated_at
  )
  values(
    v_user,v_endpoint,v_p256dh,v_auth,
    left(btrim(coalesce(p_payload->>'deviceLabel','')),120),
    left(btrim(coalesce(p_payload->>'userAgent','')),500),
    true,0,now(),null,now()
  )
  on conflict(endpoint) do update
    set p256dh=excluded.p256dh,
        auth_key=excluded.auth_key,
        device_label=excluded.device_label,
        user_agent=excluded.user_agent,
        is_active=true,failure_count=0,last_seen_at=now(),
        disabled_at=null,updated_at=now()
    where app_portal.push_subscriptions.user_id=v_user;

  if not found then
    -- Covers the concurrent ownership race between the SELECT above and INSERT.
    -- The unique endpoint can never be silently accepted for a different user.
    raise exception 'PUSH_SUBSCRIPTION_ENDPOINT_OWNED' using errcode='23505';
  end if;

  insert into app_portal.notification_preferences(user_id,push_enabled)
  values(v_user,true)
  on conflict(user_id) do update
    set push_enabled=true,revision=app_portal.notification_preferences.revision+1,
        updated_at=now();

  return app_private.api_push_snapshot();
end;
$$;

create or replace function app_private.api_remove_push_subscription(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_endpoint text := btrim(coalesce(p_payload->>'endpoint',''));
  v_id uuid;
begin
  perform app_private.require_active_user();

  begin
    v_id:=nullif(p_payload->>'id','')::uuid;
  exception when others then
    raise exception 'PUSH_SUBSCRIPTION_INVALID_ID' using errcode='22023';
  end;

  if v_id is null and v_endpoint='' then
    raise exception 'PUSH_SUBSCRIPTION_REQUIRED' using errcode='22023';
  end if;

  update app_portal.push_subscriptions
  set is_active=false,disabled_at=coalesce(disabled_at,now()),updated_at=now()
  where user_id=v_user
    and is_active=true
    and ((v_id is not null and id=v_id) or (v_id is null and endpoint=v_endpoint));

  if not exists (
    select 1 from app_portal.push_subscriptions
    where user_id=v_user and is_active=true
  ) then
    update app_portal.notification_preferences
    set push_enabled=false,revision=revision+1,updated_at=now()
    where user_id=v_user and push_enabled=true;
  end if;

  return app_private.api_push_snapshot();
end;
$$;

create or replace function app_private.m020_disable_push_on_user_inactive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status='ACTIVE' and new.status is distinct from 'ACTIVE' then
    update app_portal.push_subscriptions
    set is_active=false,disabled_at=coalesce(disabled_at,now()),updated_at=now()
    where user_id=new.id and is_active=true;
    update app_portal.notification_preferences
    set push_enabled=false,revision=revision+1,updated_at=now()
    where user_id=new.id and push_enabled=true;
  end if;
  return new;
end;
$$;

drop trigger if exists m020_disable_push_on_user_inactive on app_portal.users;
create trigger m020_disable_push_on_user_inactive
after update of status on app_portal.users
for each row execute function app_private.m020_disable_push_on_user_inactive();

revoke all on function app_private.api_push_snapshot() from public, anon, authenticated, service_role;
revoke all on function app_private.api_save_notification_preferences(jsonb) from public, anon, authenticated, service_role;
revoke all on function app_private.api_save_push_subscription(jsonb) from public, anon, authenticated, service_role;
revoke all on function app_private.api_remove_push_subscription(jsonb) from public, anon, authenticated, service_role;
revoke all on function app_private.m020_disable_push_on_user_inactive() from public, anon, authenticated, service_role;
grant execute on function app_private.api_push_snapshot() to postgres;
grant execute on function app_private.api_save_notification_preferences(jsonb) to postgres;
grant execute on function app_private.api_save_push_subscription(jsonb) to postgres;
grant execute on function app_private.api_remove_push_subscription(jsonb) to postgres;
grant execute on function app_private.m020_disable_push_on_user_inactive() to postgres;

-- Legacy push dispatcher remains unchanged for the existing PUSH_TEST path.
-- M020 projections are inserted with push_state='SKIPPED', so the legacy worker
-- will not deliver M020 provider traffic.

-- Cron is environment-neutral: without the two Vault values the dispatcher returns NULL.
do $$
declare
  v_job integer;
begin
  select jobid into v_job from cron.job where jobname='pd-notification-dispatch-m020-r1';
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule(
    'pd-notification-dispatch-m020-r1',
    '* * * * *',
    'select app_private.invoke_notification_dispatch();'
  );

  select jobid into v_job from cron.job where jobname='pd-notification-retention-m020-r1';
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule(
    'pd-notification-retention-m020-r1',
    '17 3 * * *',
    'select app_private.notification_retention_run();'
  );
end;
$$;

commit;
