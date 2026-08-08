\set ON_ERROR_STOP on

begin;

select plan(1);

do $bf_003_verification$
declare
  v_admin_id constant uuid := '00000000-0000-4003-8000-000000000001';
  v_reader_id constant uuid := '00000000-0000-4003-8000-000000000002';
  v_member_id uuid;
  v_revision integer;
  v_response jsonb;
  v_count bigint;
  v_privilege text;
begin
  if not exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'app_fanclub.members'::regclass
      and attribute.attname = 'birth_date'
      and attribute.atttypid = 'date'::regtype
      and not attribute.attnotnull
      and not attribute.atthasdef
      and attribute.attnum > 0
      and not attribute.attisdropped
  ) then
    raise exception
      'birth_date fehlt, ist nicht date, nicht nullable oder besitzt einen Default.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_definition
    where constraint_definition.conrelid = 'app_fanclub.members'::regclass
      and constraint_definition.conname = 'members_birth_date_reasonable_check'
      and constraint_definition.contype = 'c'
      and constraint_definition.convalidated
  ) then
    raise exception 'Validierte Plausibilitaetsgrenze fuer birth_date fehlt.';
  end if;

  begin
    insert into app_fanclub.members (
      first_name,
      last_name,
      birth_date
    )
    values ('BF003', 'Invalid', date '1899-12-31');

    raise exception 'Geburtsdatum vor 1900-01-01 wurde akzeptiert.';
  exception
    when check_violation then null;
  end;

  insert into app_fanclub.members (
    first_name,
    last_name,
    birth_date
  )
  values
    ('BF003', 'Nullable', null),
    ('BF003', 'Valid', date '1990-01-02'),
    ('BF003', 'FutureTableValue', current_date + 1);

  if not exists (
    select 1
    from app_fanclub.members as member
    where member.first_name = 'BF003'
      and member.last_name = 'Nullable'
      and member.birth_date is null
  ) or not exists (
    select 1
    from app_fanclub.members as member
    where member.first_name = 'BF003'
      and member.last_name = 'Valid'
      and member.birth_date = date '1990-01-02'
  ) or not exists (
    select 1
    from app_fanclub.members as member
    where member.first_name = 'BF003'
      and member.last_name = 'FutureTableValue'
      and member.birth_date = current_date + 1
  ) then
    raise exception
      'NULL oder ein von der Tabellenregel zugelassenes birth_date wurde abgelehnt.';
  end if;

  insert into auth.users (id, email)
  values
    (v_admin_id, 'bf003-admin@example.invalid'),
    (v_reader_id, 'bf003-reader@example.invalid');

  insert into app_portal.users (
    id,
    user_code,
    email,
    first_name,
    last_name,
    role_id
  )
  values
    (
      v_admin_id,
      'U-BF003-ADMIN',
      'bf003-admin@example.invalid',
      'BF003',
      'Admin',
      '00000000-0000-4000-8000-000000000001'
    ),
    (
      v_reader_id,
      'U-BF003-READER',
      'bf003-reader@example.invalid',
      'BF003',
      'Reader',
      '00000000-0000-4000-8000-000000000003'
    );

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_admin_id,
      'role', 'authenticated'
    )::text,
    true
  );

  v_response := public.pd_api(
    'save_member',
    jsonb_build_object(
      'firstName', 'BF003',
      'lastName', 'CreatedByApi',
      'birthDate', '1988-04-05',
      'status', 'ACTIVE'
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'api_save_member konnte birthDate nicht anlegen: %', v_response;
  end if;

  select member.id, member.revision
  into v_member_id, v_revision
  from app_fanclub.members as member
  where member.first_name = 'BF003'
    and member.last_name = 'CreatedByApi'
    and member.birth_date = date '1988-04-05';

  if v_member_id is null then
    raise exception 'API-Neuanlage hat birth_date nicht gespeichert.';
  end if;

  v_response := public.pd_api(
    'member_detail',
    jsonb_build_object('id', v_member_id)
  );

  if not coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{data,birthDate}' <> '1988-04-05' then
    raise exception 'api_member_detail liefert birthDate nicht korrekt: %', v_response;
  end if;

  v_response := public.pd_api(
    'save_member',
    jsonb_build_object(
      'id', v_member_id,
      'revision', v_revision,
      'firstName', 'BF003',
      'lastName', 'CreatedByApi',
      'birthDate', '1989-06-07',
      'status', 'ACTIVE'
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false)
     or not exists (
       select 1
       from app_fanclub.members as member
       where member.id = v_member_id
         and member.birth_date = date '1989-06-07'
         and member.revision = v_revision + 1
     ) then
    raise exception 'api_save_member konnte birthDate nicht aendern: %', v_response;
  end if;

  if not exists (
    select 1
    from app_portal.audit_events as audit
    where audit.action = 'MEMBER_CREATED'
      and audit.entity_id = v_member_id::text
      and audit.after_data -> 'changedFields' ? 'birthDate'
  ) or not exists (
    select 1
    from app_portal.audit_events as audit
    where audit.action = 'MEMBER_UPDATED'
      and audit.entity_id = v_member_id::text
      and audit.after_data -> 'changedFields' ? 'birthDate'
  ) then
    raise exception 'Bestehendes birthDate-Audit wurde nicht reproduziert.';
  end if;

  perform set_config('request.jwt.claim.sub', v_reader_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_reader_id,
      'role', 'authenticated'
    )::text,
    true
  );

  select count(*) into v_count
  from app_fanclub.members;

  v_response := public.pd_api(
    'member_detail',
    jsonb_build_object('id', v_member_id)
  );

  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501' then
    raise exception 'Unberechtigter Aufrufer konnte birthDate lesen: %', v_response;
  end if;

  v_response := public.pd_api(
    'save_member',
    jsonb_build_object(
      'firstName', 'BF003',
      'lastName', 'UnauthorizedCreate',
      'birthDate', '1991-08-09',
      'status', 'ACTIVE'
    )
  );

  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501'
     or (select count(*) from app_fanclub.members) <> v_count then
    raise exception 'Unberechtigter Aufrufer konnte Mitglied anlegen: %', v_response;
  end if;

  v_response := public.pd_api(
    'save_member',
    jsonb_build_object(
      'id', v_member_id,
      'revision', v_revision + 1,
      'firstName', 'BF003',
      'lastName', 'UnauthorizedUpdate',
      'birthDate', '1992-10-11',
      'status', 'ACTIVE'
    )
  );

  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501'
     or not exists (
       select 1
       from app_fanclub.members as member
       where member.id = v_member_id
         and member.last_name = 'CreatedByApi'
         and member.birth_date = date '1989-06-07'
         and member.revision = v_revision + 1
     ) then
    raise exception 'Unberechtigter Aufrufer konnte birthDate aendern: %', v_response;
  end if;

  if has_schema_privilege('anon', 'app_fanclub', 'USAGE')
     or has_schema_privilege('authenticated', 'app_fanclub', 'USAGE')
     or has_schema_privilege('anon', 'app_private', 'USAGE')
     or has_schema_privilege('authenticated', 'app_private', 'USAGE') then
    raise exception 'BF-003 hat private Schemas fuer Data-API-Rollen geoeffnet.';
  end if;

  foreach v_privilege in array array[
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'REFERENCES',
    'TRIGGER'
  ]
  loop
    if has_table_privilege('anon', 'app_fanclub.members', v_privilege)
       or has_table_privilege('authenticated', 'app_fanclub.members', v_privilege) then
      raise exception
        'Data-API-Rolle besitzt unerlaubtes Recht % auf members.',
        v_privilege;
    end if;
  end loop;

  if has_function_privilege(
       'anon',
       'app_private.api_member_detail(jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'app_private.api_member_detail(jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'app_private.api_save_member(jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'app_private.api_save_member(jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.pd_api(text,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.pd_api(text,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'Bestehende Funktionsgrenzen wurden veraendert.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure_definition
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        procedure_definition.proacl,
        pg_catalog.acldefault('f', procedure_definition.proowner)
      )
    ) as acl_item
    where procedure_definition.oid in (
      'app_private.api_member_detail(jsonb)'::regprocedure,
      'app_private.api_save_member(jsonb)'::regprocedure
    )
      and acl_item.grantee = 0
      and acl_item.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC darf interne Mitgliedsfunktionen ausfuehren.';
  end if;
end
$bf_003_verification$;

select pass('BF-003 birth_date Baseline und Sicherheitsgrenzen sind reproduzierbar');
select * from finish();

rollback;
