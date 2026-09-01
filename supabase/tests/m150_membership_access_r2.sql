\set ON_ERROR_STOP on

begin;

select plan(1);

do $m150_r2_security$
begin
  if to_regprocedure('app_private.api_member_portal_link(jsonb)') is null
     or to_regprocedure('app_private.api_member_portal_unlink(jsonb)') is null
     or to_regprocedure(
       'app_private.m150_member_portal_link_core(uuid,uuid,uuid,integer,uuid,text,text)'
     ) is null then
    raise exception 'M150-R2 Link-/Unlink-Funktionen fehlen.';
  end if;

  if has_function_privilege(
       'authenticated',
       'app_private.api_member_portal_link(jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'app_private.api_member_portal_unlink(jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'app_private.m150_member_portal_link_core(uuid,uuid,uuid,integer,uuid,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'app_private.api_member_portal_link(jsonb)',
       'EXECUTE'
     ) then
    raise exception 'Private M150-R2-Funktionen sind direkt im Browser erreichbar.';
  end if;

  if has_function_privilege(
       'anon',
       'public.pd_api(text,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.pd_api(text,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'pd_api Browsergrenze ist nach M150-R2 falsch.';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.pd_api_before_membership_access_m150_r2(text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.pd_api_before_membership_access_m150_r2(text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.pd_api_before_membership_access_m150_r2(text,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'M150-R2 Dispatcher-Vorgaenger ist noch direkt erreichbar.';
  end if;
end
$m150_r2_security$;


do $m150_r2_link_lifecycle$
declare
  v_role_admin constant uuid :=
    '00000000-0000-4000-8000-000000000001';
  v_role_member constant uuid :=
    '00000000-0000-4000-8000-000000000003';

  v_admin constant uuid :=
    '15020000-0000-4000-8000-000000000001';
  v_user_1 constant uuid :=
    '15020000-0000-4000-8000-000000000002';
  v_user_2 constant uuid :=
    '15020000-0000-4000-8000-000000000003';

  v_member_1 constant uuid :=
    '15020000-0000-4001-8000-000000000001';
  v_member_2 constant uuid :=
    '15020000-0000-4001-8000-000000000002';
  v_member_3 constant uuid :=
    '15020000-0000-4001-8000-000000000003';

  v_response jsonb;
  v_revision integer;
  v_linked_at timestamptz;
  v_linked_by uuid;
  v_audit_count integer;
begin
  insert into auth.users (id, email)
  values
    (v_admin, 'm150-r2-admin@example.invalid'),
    (v_user_1, 'm150-r2-user1@example.invalid'),
    (v_user_2, 'm150-r2-user2@example.invalid');

  insert into app_portal.users (
    id,
    user_code,
    email,
    first_name,
    last_name,
    status,
    role_id
  )
  values
    (
      v_admin,
      'U-M150-R2-A',
      'm150-r2-admin@example.invalid',
      'M150',
      'Admin',
      'ACTIVE',
      v_role_admin
    ),
    (
      v_user_1,
      'U-M150-R2-1',
      'm150-r2-user1@example.invalid',
      'M150',
      'User Eins',
      'ACTIVE',
      v_role_member
    ),
    (
      v_user_2,
      'U-M150-R2-2',
      'm150-r2-user2@example.invalid',
      'M150',
      'User Zwei',
      'ACTIVE',
      v_role_member
    );

  insert into app_fanclub.members (
    id,
    member_code,
    first_name,
    last_name,
    birth_date,
    email,
    status
  )
  values
    (
      v_member_1,
      'M-M150-R2-1',
      'M150',
      'Mitglied Eins',
      date '1981-01-01',
      'member1@example.invalid',
      'ACTIVE'
    ),
    (
      v_member_2,
      'M-M150-R2-2',
      'M150',
      'Mitglied Zwei',
      date '1982-02-02',
      'member2@example.invalid',
      'ACTIVE'
    ),
    (
      v_member_3,
      'M-M150-R2-3',
      'M150',
      'Mitglied Drei',
      date '1983-03-03',
      'member3@example.invalid',
      'ACTIVE'
    );

  perform set_config(
    'request.jwt.claim.sub',
    v_admin::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_admin,
      'role', 'authenticated'
    )::text,
    true
  );

  -- Erstverknuepfung.
  v_response := public.pd_api(
    'member_portal_link',
    jsonb_build_object(
      'userId', v_user_1,
      'memberId', v_member_1,
      'expectedUserRevision', 1,
      'expectedMemberId', '',
      'reason', ''
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Erstverknuepfung fehlgeschlagen: %', v_response;
  end if;

  select portal_user.revision
  into v_revision
  from app_portal.users as portal_user
  where portal_user.id = v_user_1;

  if v_revision <> 2 then
    raise exception
      'Erstverknuepfung hat falsche User-Revision: %',
      v_revision;
  end if;

  select link.linked_at, link.linked_by
  into v_linked_at, v_linked_by
  from app_portal.user_member_links as link
  where link.user_id = v_user_1;

  if v_linked_at is null
     or v_linked_by is distinct from v_admin
     or not exists (
       select 1
       from app_portal.user_member_links as link
       where link.user_id = v_user_1
         and link.member_id = v_member_1
     ) then
    raise exception 'Erstverknuepfung wurde nicht korrekt gespeichert.';
  end if;

  select count(*)::integer
  into v_audit_count
  from app_portal.audit_events as audit
  where audit.action = 'MEMBER_PORTAL_LINKED'
    and audit.entity_type = 'portal_user'
    and audit.entity_id = v_user_1::text;

  if v_audit_count <> 1 then
    raise exception
      'Erstverknuepfung erzeugte nicht exakt ein Audit: %',
      v_audit_count;
  end if;

  -- Exaktes Replay derselben Link-Anforderung muss echtes No-op sein.
  v_response := public.pd_api(
    'member_portal_link',
    jsonb_build_object(
      'userId', v_user_1,
      'memberId', v_member_1,
      'expectedUserRevision', 1,
      'expectedMemberId', '',
      'reason', ''
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Idempotentes Link-Replay fehlgeschlagen: %', v_response;
  end if;

  if (
    select revision
    from app_portal.users
    where id = v_user_1
  ) <> 2 then
    raise exception 'Link-Replay hat User-Revision veraendert.';
  end if;

  if (
    select linked_at
    from app_portal.user_member_links
    where user_id = v_user_1
  ) is distinct from v_linked_at then
    raise exception 'Link-Replay hat linked_at veraendert.';
  end if;

  if (
    select count(*)
    from app_portal.audit_events
    where action = 'MEMBER_PORTAL_LINKED'
      and entity_id = v_user_1::text
  ) <> 1 then
    raise exception 'Link-Replay hat ein zusaetzliches Audit erzeugt.';
  end if;

  -- save_user darf die bestehende Verknuepfung nicht mehr anfassen.
  v_response := public.pd_api(
    'save_user',
    jsonb_build_object(
      'id', v_user_1,
      'roleId', v_role_member,
      'status', 'ACTIVE',
      'expectedRevision', 2
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'save_user No-op fehlgeschlagen: %', v_response;
  end if;

  if (
    select revision
    from app_portal.users
    where id = v_user_1
  ) <> 2 then
    raise exception 'save_user No-op hat Revision erhoeht.';
  end if;

  if (
    select linked_at
    from app_portal.user_member_links
    where user_id = v_user_1
  ) is distinct from v_linked_at
     or (
       select linked_by
       from app_portal.user_member_links
       where user_id = v_user_1
     ) is distinct from v_linked_by then
    raise exception 'save_user No-op hat Link-Metadaten veraendert.';
  end if;

  -- Auch eine echte Portalstatus-Aenderung darf den Link nicht neu schreiben.
  v_response := public.pd_api(
    'save_user',
    jsonb_build_object(
      'id', v_user_1,
      'roleId', v_role_member,
      'status', 'INACTIVE',
      'expectedRevision', 2
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'save_user Statusaenderung fehlgeschlagen: %', v_response;
  end if;

  if (
    select revision
    from app_portal.users
    where id = v_user_1
  ) <> 3 then
    raise exception 'save_user Statusaenderung hat falsche Revision.';
  end if;

  if (
    select linked_at
    from app_portal.user_member_links
    where user_id = v_user_1
  ) is distinct from v_linked_at
     or (
       select linked_by
       from app_portal.user_member_links
       where user_id = v_user_1
     ) is distinct from v_linked_by then
    raise exception 'save_user Statusaenderung hat Link-Metadaten veraendert.';
  end if;

  v_response := public.pd_api(
    'save_user',
    jsonb_build_object(
      'id', v_user_1,
      'roleId', v_role_member,
      'status', 'ACTIVE',
      'expectedRevision', 3
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false)
     or (
       select revision
       from app_portal.users
       where id = v_user_1
     ) <> 4 then
    raise exception 'Reaktivierung des Testusers fehlgeschlagen: %', v_response;
  end if;

  -- memberId im generischen save_user ist ab R2 verboten.
  v_response := public.pd_api(
    'save_user',
    jsonb_build_object(
      'id', v_user_1,
      'roleId', v_role_member,
      'status', 'ACTIVE',
      'expectedRevision', 4,
      'memberId', v_member_2
    )
  );

  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'USER_UPDATE_INVALID_PAYLOAD' then
    raise exception 'save_user akzeptiert weiterhin memberId: %', v_response;
  end if;

  -- Veraltete Revision bei echter Aenderung muss Konflikt liefern.
  v_response := public.pd_api(
    'save_user',
    jsonb_build_object(
      'id', v_user_1,
      'roleId', v_role_member,
      'status', 'BLOCKED',
      'expectedRevision', 2
    )
  );

  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '40001' then
    raise exception 'Stale save_user wurde nicht abgewehrt: %', v_response;
  end if;

  -- Dasselbe Mitglied darf nicht einem zweiten User zugeordnet werden.
  v_response := public.pd_api(
    'member_portal_link',
    jsonb_build_object(
      'userId', v_user_2,
      'memberId', v_member_1,
      'expectedUserRevision', 1,
      'expectedMemberId', '',
      'reason', ''
    )
  );

  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '23505' then
    raise exception 'Doppelte Mitgliedszuordnung wurde zugelassen: %', v_response;
  end if;

  -- Relink mit veraltetem Userzustand muss scheitern.
  v_response := public.pd_api(
    'member_portal_link',
    jsonb_build_object(
      'userId', v_user_1,
      'memberId', v_member_2,
      'expectedUserRevision', 2,
      'expectedMemberId', v_member_1,
      'reason', 'Test Korrektur'
    )
  );

  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '40001' then
    raise exception 'Stale Relink wurde nicht abgewehrt: %', v_response;
  end if;

  -- Kontrollierter Relink.
  v_response := public.pd_api(
    'member_portal_link',
    jsonb_build_object(
      'userId', v_user_1,
      'memberId', v_member_2,
      'expectedUserRevision', 4,
      'expectedMemberId', v_member_1,
      'reason', 'Fehlzuordnung korrigiert'
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false)
     or not exists (
       select 1
       from app_portal.user_member_links
       where user_id = v_user_1
         and member_id = v_member_2
     )
     or (
       select revision
       from app_portal.users
       where id = v_user_1
     ) <> 5 then
    raise exception 'Kontrollierter Relink fehlgeschlagen: %', v_response;
  end if;

  if not exists (
    select 1
    from app_portal.audit_events
    where action = 'MEMBER_PORTAL_RELINKED'
      and entity_id = v_user_1::text
      and metadata ->> 'reason' = 'Fehlzuordnung korrigiert'
  ) then
    raise exception 'Relink-Audit fehlt oder Begruendung fehlt.';
  end if;

  -- Relink-Korrektur ohne Begruendung ist unzulaessig.
  v_response := public.pd_api(
    'member_portal_link',
    jsonb_build_object(
      'userId', v_user_1,
      'memberId', v_member_3,
      'expectedUserRevision', 5,
      'expectedMemberId', v_member_2,
      'reason', ''
    )
  );

  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '22023' then
    raise exception 'Relink ohne Begruendung wurde zugelassen: %', v_response;
  end if;

  -- Unlink ohne Loeschen von User oder Mitglied.
  v_response := public.pd_api(
    'member_portal_unlink',
    jsonb_build_object(
      'userId', v_user_1,
      'expectedUserRevision', 5,
      'expectedMemberId', v_member_2,
      'reason', 'Verknuepfung bewusst aufgehoben'
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false)
     or exists (
       select 1
       from app_portal.user_member_links
       where user_id = v_user_1
     )
     or not exists (
       select 1 from app_portal.users where id = v_user_1
     )
     or not exists (
       select 1 from app_fanclub.members where id = v_member_2
     )
     or (
       select revision
       from app_portal.users
       where id = v_user_1
     ) <> 6 then
    raise exception 'Unlink-Lifecycle ist falsch: %', v_response;
  end if;

  if not exists (
    select 1
    from app_portal.audit_events
    where action = 'MEMBER_PORTAL_UNLINKED'
      and entity_id = v_user_1::text
      and metadata ->> 'reason' = 'Verknuepfung bewusst aufgehoben'
  ) then
    raise exception 'Unlink-Audit fehlt.';
  end if;
end
$m150_r2_link_lifecycle$;


do $m150_r2_access_requests$
declare
  v_role_admin constant uuid :=
    '00000000-0000-4000-8000-000000000001';
  v_role_member constant uuid :=
    '00000000-0000-4000-8000-000000000003';

  v_admin constant uuid :=
    '15021000-0000-4000-8000-000000000001';

  v_auth_approve constant uuid :=
    '15021000-0000-4000-8000-000000000002';
  v_auth_reject constant uuid :=
    '15021000-0000-4000-8000-000000000003';
  v_auth_race constant uuid :=
    '15021000-0000-4000-8000-000000000004';

  v_member constant uuid :=
    '15021000-0000-4001-8000-000000000001';

  v_request_approve constant uuid :=
    '15021000-0000-4002-8000-000000000001';
  v_request_reject constant uuid :=
    '15021000-0000-4002-8000-000000000002';
  v_request_race constant uuid :=
    '15021000-0000-4002-8000-000000000003';

  v_response jsonb;
begin
  insert into auth.users (id, email)
  values
    (v_admin, 'm150-r2-access-admin@example.invalid'),
    (v_auth_approve, 'm150-r2-approve@example.invalid'),
    (v_auth_reject, 'm150-r2-reject@example.invalid'),
    (v_auth_race, 'm150-r2-race@example.invalid');

  insert into app_portal.users (
    id,
    user_code,
    email,
    first_name,
    last_name,
    status,
    role_id
  )
  values (
    v_admin,
    'U-M150-R2-AR-A',
    'm150-r2-access-admin@example.invalid',
    'Access',
    'Admin',
    'ACTIVE',
    v_role_admin
  );

  insert into app_fanclub.members (
    id,
    member_code,
    first_name,
    last_name,
    birth_date,
    email,
    status
  )
  values (
    v_member,
    'M-M150-R2-AR',
    'Access',
    'Mitglied',
    date '1990-04-05',
    'm150-r2-approve@example.invalid',
    'ACTIVE'
  );

  insert into app_portal.access_requests (
    id,
    auth_user_id,
    email,
    first_name,
    last_name,
    status
  )
  values
    (
      v_request_approve,
      v_auth_approve,
      'm150-r2-approve@example.invalid',
      'Approve',
      'Person',
      'PENDING'
    ),
    (
      v_request_reject,
      v_auth_reject,
      'm150-r2-reject@example.invalid',
      'Reject',
      'Person',
      'PENDING'
    ),
    (
      v_request_race,
      v_auth_race,
      'm150-r2-race@example.invalid',
      'Race',
      'Person',
      'PENDING'
    );

  perform set_config(
    'request.jwt.claim.sub',
    v_admin::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_admin,
      'role', 'authenticated'
    )::text,
    true
  );

  -- Freigabe mit expliziter Revision und Link-Core.
  v_response := public.pd_api(
    'approve_request',
    jsonb_build_object(
      'id', v_request_approve,
      'expectedRevision', 1,
      'roleId', v_role_member,
      'memberId', v_member
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false)
     or (
       select status
       from app_portal.access_requests
       where id = v_request_approve
     ) <> 'APPROVED'
     or (
       select revision
       from app_portal.access_requests
       where id = v_request_approve
     ) <> 2
     or not exists (
       select 1
       from app_portal.user_member_links
       where user_id = v_auth_approve
         and member_id = v_member
     )
     or (
       select revision
       from app_portal.users
       where id = v_auth_approve
     ) <> 2 then
    raise exception 'Access-Request Freigabe ist falsch: %', v_response;
  end if;

  if not exists (
    select 1
    from app_portal.audit_events
    where action = 'MEMBER_PORTAL_LINKED'
      and entity_id = v_auth_approve::text
      and metadata ->> 'source' = 'ACCESS_APPROVAL'
  ) then
    raise exception 'Access-Approval verwendet den Link-Core nicht sichtbar.';
  end if;

  -- Wiederholung mit alter Revision muss Konflikt sein.
  v_response := public.pd_api(
    'approve_request',
    jsonb_build_object(
      'id', v_request_approve,
      'expectedRevision', 1,
      'roleId', v_role_member,
      'memberId', v_member
    )
  );

  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '40001' then
    raise exception 'Stale approve_request wurde nicht abgewehrt: %', v_response;
  end if;

  -- Ablehnung mit CAS.
  v_response := public.pd_api(
    'reject_request',
    jsonb_build_object(
      'id', v_request_reject,
      'expectedRevision', 1,
      'reason', 'Identitaet konnte nicht bestaetigt werden'
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false)
     or (
       select status
       from app_portal.access_requests
       where id = v_request_reject
     ) <> 'REJECTED'
     or (
       select revision
       from app_portal.access_requests
       where id = v_request_reject
     ) <> 2
     or (
       select decision_reason
       from app_portal.access_requests
       where id = v_request_reject
     ) <> 'Identitaet konnte nicht bestaetigt werden' then
    raise exception 'Access-Request Ablehnung ist falsch: %', v_response;
  end if;

  v_response := public.pd_api(
    'reject_request',
    jsonb_build_object(
      'id', v_request_reject,
      'expectedRevision', 1,
      'reason', 'Zweiter Versuch'
    )
  );

  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '40001' then
    raise exception 'Stale reject_request wurde nicht abgewehrt: %', v_response;
  end if;

  -- Approve/Reject-Race: nach der ersten Entscheidung darf die zweite
  -- Entscheidung mit demselben Ausgangsstand nicht mehr gewinnen.
  v_response := public.pd_api(
    'approve_request',
    jsonb_build_object(
      'id', v_request_race,
      'expectedRevision', 1,
      'roleId', v_role_member,
      'memberId', ''
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Race-Fixture Freigabe fehlgeschlagen: %', v_response;
  end if;

  v_response := public.pd_api(
    'reject_request',
    jsonb_build_object(
      'id', v_request_race,
      'expectedRevision', 1,
      'reason', 'Darf nicht mehr gewinnen'
    )
  );

  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '40001'
     or (
       select status
       from app_portal.access_requests
       where id = v_request_race
     ) <> 'APPROVED' then
    raise exception 'Approve/Reject-Race ist nicht CAS-sicher: %', v_response;
  end if;
end
$m150_r2_access_requests$;


do $m150_r2_transfer_pending$
declare
  v_role_member constant uuid :=
    '00000000-0000-4000-8000-000000000003';

  v_u1 constant uuid := '15022000-0000-4000-8000-000000000001';
  v_u2 constant uuid := '15022000-0000-4000-8000-000000000002';
  v_u3 constant uuid := '15022000-0000-4000-8000-000000000003';
  v_u4 constant uuid := '15022000-0000-4000-8000-000000000004';
  v_u5 constant uuid := '15022000-0000-4000-8000-000000000005';

  v_m1 constant uuid := '15022000-0000-4001-8000-000000000001';
  v_m2 constant uuid := '15022000-0000-4001-8000-000000000002';
  v_m3 constant uuid := '15022000-0000-4001-8000-000000000003';
  v_m4 constant uuid := '15022000-0000-4001-8000-000000000004';
  v_m5 constant uuid := '15022000-0000-4001-8000-000000000005';

  v_application constant uuid :=
    '15022000-0000-4002-8000-000000000001';

  v_response jsonb;
  v_item jsonb;
begin
  insert into auth.users (id, email)
  values
    (v_u1, 'm150-r2-board1@example.invalid'),
    (v_u2, 'm150-r2-board2@example.invalid'),
    (v_u3, 'm150-r2-board3@example.invalid'),
    (v_u4, 'm150-r2-board4@example.invalid'),
    (v_u5, 'm150-r2-board5@example.invalid');

  insert into app_portal.users (
    id,
    user_code,
    email,
    first_name,
    last_name,
    status,
    role_id
  )
  values
    (v_u1, 'U-M150-R2-B1', 'm150-r2-board1@example.invalid', 'Board', 'Eins', 'ACTIVE', v_role_member),
    (v_u2, 'U-M150-R2-B2', 'm150-r2-board2@example.invalid', 'Board', 'Zwei', 'ACTIVE', v_role_member),
    (v_u3, 'U-M150-R2-B3', 'm150-r2-board3@example.invalid', 'Board', 'Drei', 'ACTIVE', v_role_member),
    (v_u4, 'U-M150-R2-B4', 'm150-r2-board4@example.invalid', 'Board', 'Vier', 'ACTIVE', v_role_member),
    (v_u5, 'U-M150-R2-B5', 'm150-r2-board5@example.invalid', 'Board', 'Fuenf', 'ACTIVE', v_role_member);

  insert into app_fanclub.members (
    id,
    member_code,
    first_name,
    last_name,
    birth_date,
    status
  )
  values
    (v_m1, 'M-M150-R2-B1', 'Board', 'Eins', date '1971-01-01', 'ACTIVE'),
    (v_m2, 'M-M150-R2-B2', 'Board', 'Zwei', date '1972-02-02', 'ACTIVE'),
    (v_m3, 'M-M150-R2-B3', 'Board', 'Drei', date '1973-03-03', 'ACTIVE'),
    (v_m4, 'M-M150-R2-B4', 'Board', 'Vier', date '1974-04-04', 'ACTIVE'),
    (v_m5, 'M-M150-R2-B5', 'Board', 'Fuenf', date '1975-05-05', 'ACTIVE');

  insert into app_portal.user_member_links (user_id, member_id)
  values
    (v_u1, v_m1),
    (v_u2, v_m2),
    (v_u3, v_m3),
    (v_u4, v_m4),
    (v_u5, v_m5);

  update app_fanclub.office_slots
  set member_id = case code
    when 'VORSTAND_1' then v_m1
    when 'VORSTAND_2' then v_m2
    when 'VORSTAND_3' then v_m3
    when 'KASSIER' then v_m4
    when 'SCHRIFTFUEHRER' then v_m5
  end
  where code in (
    'VORSTAND_1',
    'VORSTAND_2',
    'VORSTAND_3',
    'KASSIER',
    'SCHRIFTFUEHRER'
  );

  insert into app_fanclub.membership_applications (
    id,
    first_name,
    last_name,
    birth_date,
    email,
    phone,
    street,
    house_number,
    postal_code,
    city,
    status,
    decided_at,
    decided_by,
    decision_method,
    declaration_version,
    statutes_version,
    statutes_reference,
    declaration_confirmed,
    statutes_confirmed
  )
  values (
    v_application,
    'Transfer',
    'Offen',
    date '1999-09-09',
    'transfer-offen@example.invalid',
    '0123456',
    'Teststrasse',
    '1',
    '97421',
    'Schweinfurt',
    'APPROVED',
    now(),
    v_u1,
    'VOTE_MAJORITY',
    'D1',
    'S1',
    'satzung-2026',
    true,
    true
  );

  perform set_config(
    'request.jwt.claim.sub',
    v_u1::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_u1,
      'role', 'authenticated'
    )::text,
    true
  );

  v_response := public.pd_api(
    'membership_applications_list',
    '{}'::jsonb
  );

  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception
      'membership_applications_list fehlgeschlagen: %',
      v_response;
  end if;

  select item.value
  into v_item
  from jsonb_array_elements(v_response -> 'data') as item(value)
  where item.value ->> 'id' = v_application::text;

  if v_item is null then
    raise exception 'Transfer-Pending-Antrag fehlt in der Liste.';
  end if;

  if coalesce((v_item ->> 'transferPending')::boolean, false) is not true
     or v_item ->> 'status' <> 'APPROVED'
     or v_item -> 'convertedAt' <> 'null'::jsonb
     or not (v_item ? 'convertedMemberId') then
    raise exception
      'Transfer-Pending-Projektion ist falsch: %',
      v_item;
  end if;
end
$m150_r2_transfer_pending$;

select pass(
  'M150_R2_MEMBERSHIP_PORTAL_IDENTITY_OK'
);
select * from finish();

rollback;
