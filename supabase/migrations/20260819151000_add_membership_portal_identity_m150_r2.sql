-- P100 / M150-R2 – Mitgliedschaft und Portalzugang
-- Forward-only.
--
-- Ziele:
-- - stabile, explizite Mitglied <-> Portalbenutzer-Verknüpfung
-- - Verknüpfung aus generischem save_user entfernen
-- - CAS / Row-Locking für Benutzer- und Access-Request-Änderungen
-- - bestehendes Berechtigungsmodell users.manage weiterverwenden
-- - keine neue Identitätstabelle und kein E-Mail-basiertes Auto-Merging

create function app_private.m150_member_portal_link_core(
  p_actor uuid,
  p_user_id uuid,
  p_member_id uuid,
  p_expected_user_revision integer,
  p_expected_member_id uuid,
  p_reason text default '',
  p_source text default 'ADMIN'
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user app_portal.users%rowtype;
  v_link app_portal.user_member_links%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_source text := left(btrim(coalesce(p_source, 'ADMIN')), 80);
  v_action text;
begin
  if p_actor is null
     or p_user_id is null
     or p_member_id is null
     or p_expected_user_revision is null
     or p_expected_user_revision <= 0 then
    raise exception 'M150_MEMBER_PORTAL_LINK_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  select portal_user.*
  into v_user
  from app_portal.users as portal_user
  where portal_user.id = p_user_id
  for update;

  if not found then
    raise exception 'Benutzer wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  select link.*
  into v_link
  from app_portal.user_member_links as link
  where link.user_id = p_user_id;

  -- Echte Idempotenz:
  -- Besteht exakt dieselbe Zuordnung bereits, wird nichts verändert.
  if v_link.user_id is not null
     and v_link.member_id = p_member_id then
    return;
  end if;

  if v_user.revision <> p_expected_user_revision then
    raise exception 'STALE_REVISION'
      using errcode = '40001';
  end if;

  if v_link.member_id is distinct from p_expected_member_id then
    raise exception 'STALE_MEMBER_LINK'
      using errcode = '40001';
  end if;

  -- Die Zielmitgliedschaft bleibt fuer die Dauer der Transaktion stabil.
  -- FOR SHARE verhindert insbesondere ein paralleles Umschalten auf INACTIVE,
  -- waehrend die Verknuepfung angelegt oder korrigiert wird.
  perform 1
  from app_fanclub.members as member
  where member.id = p_member_id
    and member.status = 'ACTIVE'
  for share;

  if not found then
    raise exception 'Aktives Mitglied wurde nicht gefunden.'
      using errcode = '23503';
  end if;

  if exists (
    select 1
    from app_portal.user_member_links as other_link
    where other_link.member_id = p_member_id
      and other_link.user_id <> p_user_id
  ) then
    raise exception 'Dieses Mitglied ist bereits mit einem anderen Portalbenutzer verknüpft.'
      using errcode = '23505';
  end if;

  if v_link.user_id is not null and length(v_reason) < 1 then
    raise exception 'Für eine Korrektur der Mitgliedsverknüpfung ist eine Begründung erforderlich.'
      using errcode = '22023';
  end if;

  if length(v_reason) > 500 then
    raise exception 'Die Begründung ist zu lang.'
      using errcode = '22023';
  end if;

  if v_link.user_id is null then
    insert into app_portal.user_member_links (
      user_id,
      member_id,
      linked_at,
      linked_by
    )
    values (
      p_user_id,
      p_member_id,
      clock_timestamp(),
      p_actor
    );

    v_action := 'MEMBER_PORTAL_LINKED';
  else
    update app_portal.user_member_links
    set member_id = p_member_id,
        linked_at = clock_timestamp(),
        linked_by = p_actor
    where user_id = p_user_id;

    v_action := 'MEMBER_PORTAL_RELINKED';
  end if;

  update app_portal.users
  set revision = revision + 1
  where id = p_user_id;

  perform app_private.log_audit(
    p_actor,
    v_action,
    'portal_user',
    p_user_id::text,
    jsonb_build_object(
      'memberId', v_link.member_id,
      'revision', v_user.revision
    ),
    jsonb_build_object(
      'memberId', p_member_id,
      'revision', v_user.revision + 1
    ),
    jsonb_strip_nulls(jsonb_build_object(
      'source', nullif(v_source, ''),
      'reason', nullif(v_reason, '')
    ))
  );
end;
$function$;


create function app_private.api_member_portal_link(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('users.manage');
  v_user_id uuid;
  v_member_id uuid;
  v_expected_revision integer;
  v_expected_member_id uuid;
  v_reason text;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array[
       'userId',
       'memberId',
       'expectedUserRevision',
       'expectedMemberId',
       'reason'
     ]
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array[
         'userId',
         'memberId',
         'expectedUserRevision',
         'expectedMemberId',
         'reason'
       ])
     ) then
    raise exception 'M150_MEMBER_PORTAL_LINK_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  begin
    v_user_id :=
      nullif(btrim(coalesce(p_payload ->> 'userId', '')), '')::uuid;

    v_member_id :=
      nullif(btrim(coalesce(p_payload ->> 'memberId', '')), '')::uuid;

    v_expected_revision :=
      nullif(
        btrim(coalesce(p_payload ->> 'expectedUserRevision', '')),
        ''
      )::integer;

    v_expected_member_id :=
      nullif(
        btrim(coalesce(p_payload ->> 'expectedMemberId', '')),
        ''
      )::uuid;

    v_reason := btrim(coalesce(p_payload ->> 'reason', ''));
  exception when others then
    raise exception 'M150_MEMBER_PORTAL_LINK_INVALID_PAYLOAD'
      using errcode = '22023';
  end;

  perform app_private.m150_member_portal_link_core(
    v_actor,
    v_user_id,
    v_member_id,
    v_expected_revision,
    v_expected_member_id,
    v_reason,
    'ADMIN'
  );

  return app_private.api_admin_snapshot();
end;
$function$;


create function app_private.api_member_portal_unlink(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('users.manage');
  v_user_id uuid;
  v_expected_revision integer;
  v_expected_member_id uuid;
  v_reason text;
  v_user app_portal.users%rowtype;
  v_link app_portal.user_member_links%rowtype;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array[
       'userId',
       'expectedUserRevision',
       'expectedMemberId',
       'reason'
     ]
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array[
         'userId',
         'expectedUserRevision',
         'expectedMemberId',
         'reason'
       ])
     ) then
    raise exception 'M150_MEMBER_PORTAL_UNLINK_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  begin
    v_user_id :=
      nullif(btrim(coalesce(p_payload ->> 'userId', '')), '')::uuid;

    v_expected_revision :=
      nullif(
        btrim(coalesce(p_payload ->> 'expectedUserRevision', '')),
        ''
      )::integer;

    v_expected_member_id :=
      nullif(
        btrim(coalesce(p_payload ->> 'expectedMemberId', '')),
        ''
      )::uuid;

    v_reason := btrim(coalesce(p_payload ->> 'reason', ''));
  exception when others then
    raise exception 'M150_MEMBER_PORTAL_UNLINK_INVALID_PAYLOAD'
      using errcode = '22023';
  end;

  if v_user_id is null
     or v_expected_revision is null
     or v_expected_revision <= 0 then
    raise exception 'M150_MEMBER_PORTAL_UNLINK_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  select portal_user.*
  into v_user
  from app_portal.users as portal_user
  where portal_user.id = v_user_id
  for update;

  if not found then
    raise exception 'Benutzer wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  select link.*
  into v_link
  from app_portal.user_member_links as link
  where link.user_id = v_user_id;

  -- Kein Link + erwarteter Zustand ebenfalls "kein Link" = echtes No-op.
  if v_link.user_id is null and v_expected_member_id is null then
    return app_private.api_admin_snapshot();
  end if;

  if v_user.revision <> v_expected_revision then
    raise exception 'STALE_REVISION'
      using errcode = '40001';
  end if;

  if v_link.member_id is distinct from v_expected_member_id then
    raise exception 'STALE_MEMBER_LINK'
      using errcode = '40001';
  end if;

  if v_link.user_id is null then
    raise exception 'Mitgliedsverknüpfung wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if length(v_reason) < 1 or length(v_reason) > 500 then
    raise exception 'Für das Aufheben der Mitgliedsverknüpfung ist eine Begründung erforderlich.'
      using errcode = '22023';
  end if;

  delete from app_portal.user_member_links
  where user_id = v_user_id;

  update app_portal.users
  set revision = revision + 1
  where id = v_user_id;

  perform app_private.log_audit(
    v_actor,
    'MEMBER_PORTAL_UNLINKED',
    'portal_user',
    v_user_id::text,
    jsonb_build_object(
      'memberId', v_link.member_id,
      'revision', v_user.revision
    ),
    jsonb_build_object(
      'memberId', null,
      'revision', v_user.revision + 1
    ),
    jsonb_build_object(
      'source', 'ADMIN',
      'reason', v_reason
    )
  );

  return app_private.api_admin_snapshot();
end;
$function$;


-- Generische Benutzerpflege verwaltet ab M150-R2 ausschließlich
-- Rolle und Portalstatus. Mitgliedsverknüpfungen haben einen eigenen Lifecycle.
create or replace function app_private.api_save_user(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('users.manage');
  v_user_id uuid;
  v_role_id uuid;
  v_status text;
  v_expected_revision integer;
  v_user app_portal.users%rowtype;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or p_payload ? 'memberId'
     or not p_payload ?& array[
       'id',
       'roleId',
       'status',
       'expectedRevision'
     ] then
    raise exception 'USER_UPDATE_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  begin
    v_user_id :=
      nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;

    v_role_id :=
      nullif(btrim(coalesce(p_payload ->> 'roleId', '')), '')::uuid;

    v_status := upper(btrim(coalesce(p_payload ->> 'status', '')));

    v_expected_revision :=
      nullif(
        btrim(coalesce(p_payload ->> 'expectedRevision', '')),
        ''
      )::integer;
  exception when others then
    raise exception 'USER_UPDATE_INVALID_PAYLOAD'
      using errcode = '22023';
  end;

  if v_user_id is null
     or v_role_id is null
     or v_expected_revision is null
     or v_expected_revision <= 0
     or v_status not in ('ACTIVE', 'INACTIVE', 'BLOCKED') then
    raise exception 'USER_UPDATE_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from app_portal.portal_roles as role
    where role.id = v_role_id
      and role.is_active
  ) then
    raise exception 'Aktive Rolle wurde nicht gefunden.'
      using errcode = '23503';
  end if;

  select portal_user.*
  into v_user
  from app_portal.users as portal_user
  where portal_user.id = v_user_id
  for update;

  if not found then
    raise exception 'Benutzer wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_user.revision <> v_expected_revision then
    raise exception 'STALE_REVISION'
      using errcode = '40001';
  end if;

  -- Keine künstliche Revision und kein Audit bei unverändertem Zustand.
  if v_user.role_id = v_role_id
     and v_user.status = v_status then
    return app_private.api_admin_snapshot();
  end if;

  update app_portal.users
  set role_id = v_role_id,
      status = v_status,
      revision = revision + 1
  where id = v_user_id;

  perform app_private.assert_admin_survives();

  perform app_private.log_audit(
    v_actor,
    'USER_UPDATED',
    'portal_user',
    v_user_id::text,
    jsonb_build_object(
      'roleId', v_user.role_id,
      'status', v_user.status,
      'revision', v_user.revision
    ),
    jsonb_build_object(
      'roleId', v_role_id,
      'status', v_status,
      'revision', v_user.revision + 1
    )
  );

  return app_private.api_admin_snapshot();
end;
$function$;


create or replace function app_private.api_approve_request(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('users.manage');
  v_request_id uuid;
  v_expected_revision integer;
  v_role_id uuid;
  v_member_id uuid;
  v_request app_portal.access_requests%rowtype;
begin
  begin
    v_request_id :=
      nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;

    v_expected_revision :=
      nullif(
        btrim(coalesce(p_payload ->> 'expectedRevision', '')),
        ''
      )::integer;

    v_role_id :=
      nullif(btrim(coalesce(p_payload ->> 'roleId', '')), '')::uuid;

    v_member_id :=
      nullif(btrim(coalesce(p_payload ->> 'memberId', '')), '')::uuid;
  exception when others then
    raise exception 'ACCESS_REQUEST_INVALID_PAYLOAD'
      using errcode = '22023';
  end;

  if v_request_id is null
     or v_expected_revision is null
     or v_expected_revision <= 0 then
    raise exception 'ACCESS_REQUEST_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  select request.*
  into v_request
  from app_portal.access_requests as request
  where request.id = v_request_id
  for update;

  if not found then
    raise exception 'Freischaltungsantrag wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_request.revision <> v_expected_revision then
    raise exception 'STALE_REVISION'
      using errcode = '40001';
  end if;

  if v_request.status <> 'PENDING' then
    raise exception 'Nur offene Anträge können freigegeben werden.'
      using errcode = '23514';
  end if;

  if v_role_id is null then
    select role.id
    into v_role_id
    from app_portal.portal_roles as role
    where role.code = 'PORTAL_USER'
      and role.is_active;
  end if;

  if not exists (
    select 1
    from app_portal.portal_roles as role
    where role.id = v_role_id
      and role.is_active
  ) then
    raise exception 'Aktive Zielrolle wurde nicht gefunden.'
      using errcode = '23503';
  end if;

  insert into app_portal.users (
    id,
    email,
    first_name,
    last_name,
    status,
    role_id
  )
  values (
    v_request.auth_user_id,
    v_request.email,
    app_private.require_valid_name(v_request.first_name, 'Vorname'),
    app_private.require_valid_name(v_request.last_name, 'Nachname'),
    'ACTIVE',
    v_role_id
  );

  if v_member_id is not null then
    perform app_private.m150_member_portal_link_core(
      v_actor,
      v_request.auth_user_id,
      v_member_id,
      1,
      null,
      '',
      'ACCESS_APPROVAL'
    );
  end if;

  update app_portal.access_requests
  set status = 'APPROVED',
      reviewed_at = clock_timestamp(),
      reviewed_by = v_actor,
      decision_reason = '',
      revision = revision + 1
  where id = v_request_id;

  perform app_private.log_audit(
    v_actor,
    'ACCESS_REQUEST_APPROVED',
    'access_request',
    v_request_id::text,
    jsonb_build_object(
      'status', 'PENDING',
      'revision', v_request.revision
    ),
    jsonb_build_object(
      'status', 'APPROVED',
      'revision', v_request.revision + 1,
      'userId', v_request.auth_user_id,
      'roleId', v_role_id,
      'memberId', v_member_id
    )
  );

  return app_private.api_admin_snapshot();
end;
$function$;


create or replace function app_private.api_reject_request(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('users.manage');
  v_request_id uuid;
  v_expected_revision integer;
  v_reason text;
  v_request app_portal.access_requests%rowtype;
begin
  begin
    v_request_id :=
      nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;

    v_expected_revision :=
      nullif(
        btrim(coalesce(p_payload ->> 'expectedRevision', '')),
        ''
      )::integer;

    v_reason := left(
      btrim(coalesce(p_payload ->> 'reason', '')),
      1000
    );
  exception when others then
    raise exception 'ACCESS_REQUEST_INVALID_PAYLOAD'
      using errcode = '22023';
  end;

  if v_request_id is null
     or v_expected_revision is null
     or v_expected_revision <= 0 then
    raise exception 'ACCESS_REQUEST_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  select request.*
  into v_request
  from app_portal.access_requests as request
  where request.id = v_request_id
  for update;

  if not found then
    raise exception 'Freischaltungsantrag wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_request.revision <> v_expected_revision then
    raise exception 'STALE_REVISION'
      using errcode = '40001';
  end if;

  if v_request.status <> 'PENDING' then
    raise exception 'Nur offene Anträge können abgelehnt werden.'
      using errcode = '23514';
  end if;

  update app_portal.access_requests
  set status = 'REJECTED',
      reviewed_at = clock_timestamp(),
      reviewed_by = v_actor,
      decision_reason = v_reason,
      revision = revision + 1
  where id = v_request_id;

  perform app_private.log_audit(
    v_actor,
    'ACCESS_REQUEST_REJECTED',
    'access_request',
    v_request_id::text,
    jsonb_build_object(
      'status', 'PENDING',
      'revision', v_request.revision
    ),
    jsonb_build_object(
      'status', 'REJECTED',
      'revision', v_request.revision + 1,
      'reason', v_reason
    )
  );

  return app_private.api_admin_snapshot();
end;
$function$;


-- Öffentlichen Dispatcher wie bei M330 forward-only umhüllen.
alter function public.pd_api(text, jsonb)
rename to pd_api_before_membership_access_m150_r2;

create function public.pd_api(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_data jsonb;
begin
  if v_action = 'member_portal_link' then
    if auth.uid() is null then
      raise exception 'Anmeldung erforderlich.'
        using errcode = '42501';
    end if;

    v_data := app_private.api_member_portal_link(
      coalesce(p_payload, '{}'::jsonb)
    );

    return jsonb_build_object('ok', true, 'data', v_data);
  end if;

  if v_action = 'member_portal_unlink' then
    if auth.uid() is null then
      raise exception 'Anmeldung erforderlich.'
        using errcode = '42501';
    end if;

    v_data := app_private.api_member_portal_unlink(
      coalesce(p_payload, '{}'::jsonb)
    );

    return jsonb_build_object('ok', true, 'data', v_data);
  end if;

  return public.pd_api_before_membership_access_m150_r2(
    p_action,
    p_payload
  );

exception when others then
  return jsonb_build_object(
    'ok', false,
    'error', jsonb_build_object(
      'code', sqlstate,
      'message', sqlerrm
    )
  );
end;
$function$;


revoke all on function
  public.pd_api_before_membership_access_m150_r2(text, jsonb)
from public, anon, authenticated, service_role;

revoke all on function public.pd_api(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function public.pd_api(text, jsonb)
to authenticated;


revoke all on function
  app_private.m150_member_portal_link_core(
    uuid,
    uuid,
    uuid,
    integer,
    uuid,
    text,
    text
  ),
  app_private.api_member_portal_link(jsonb),
  app_private.api_member_portal_unlink(jsonb),
  app_private.api_save_user(jsonb),
  app_private.api_approve_request(jsonb),
  app_private.api_reject_request(jsonb)
from public, anon, authenticated, service_role;


-- M150-R2: Listenprojektion ergänzt den fachlichen Transferzustand.
-- APPROVED + converted_at IS NULL = "Übernahme offen".
create or replace function app_private.api_membership_applications_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_result jsonb;
begin
  v_actor := app_private.m150_require_current_board_member();

  select coalesce(
    jsonb_agg(
      item.payload
      order by item.pending_rank, item.submitted_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      case
        when application.status = 'PENDING' then 0
        when application.status = 'APPROVED'
             and application.converted_at is null then 1
        else 2
      end as pending_rank,
      application.submitted_at,
      jsonb_build_object(
        'id', application.id,
        'name',
          btrim(application.first_name)
          || ' '
          || btrim(application.last_name),
        'submittedAt', application.submitted_at,
        'status', application.status,
        'convertedAt', application.converted_at,
        'convertedMemberId', application.converted_member_id,
        'transferPending',
          application.status = 'APPROVED'
          and application.converted_at is null,
        'yesVotes',
          count(vote.*) filter (where vote.vote = 'YES'),
        'noVotes',
          count(vote.*) filter (where vote.vote = 'NO'),
        'missingVotes',
          greatest(5 - count(vote.*), 0),
        'ownVote',
          max(vote.vote)
          filter (where vote.voter_user_id = v_actor),
        'sevenDayDecisionAvailable',
          app_private.m150_seven_day_available(application.id),
        'revision', application.revision
      ) as payload
    from app_fanclub.membership_applications as application
    left join app_fanclub.membership_application_votes as vote
      on vote.application_id = application.id
    group by application.id
  ) as item;

  return v_result;
end;
$function$;
