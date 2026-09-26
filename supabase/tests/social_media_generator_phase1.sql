\set ON_ERROR_STOP on

begin;

do $social_media_generator_phase1$
declare
  v_admin uuid := '00000000-0000-4110-8000-000000000001';
  v_capability_user uuid := '00000000-0000-4110-8000-000000000002';
  v_team_user uuid := '00000000-0000-4110-8000-000000000003';
  v_denied_user uuid := '00000000-0000-4110-8000-000000000004';
  v_team_id uuid;
  v_response jsonb;
  v_draft_id uuid;
  v_document jsonb := jsonb_build_object(
    'schemaVersion', 1,
    'id', 'document-game-day-square',
    'title', 'Spieltag Quadrat',
    'format', jsonb_build_object(
      'width', 1080,
      'height', 1080
    ),
    'elements', jsonb_build_array(
      jsonb_build_object(
        'id', 'content',
        'type', 'group',
        'x', 80,
        'y', 120,
        'width', 920,
        'height', 360,
        'rotation', 0,
        'children', jsonb_build_array(
          jsonb_build_object(
            'id', 'headline',
            'type', 'text',
            'x', 0,
            'y', 0,
            'width', 920,
            'height', 160,
            'rotation', 0,
            'text', 'Heimspiel',
            'binding', jsonb_build_object(
              'key', 'event.title',
              'source', 'central',
              'lastSyncedValue', 'Heimspiel'
            ),
            'style', jsonb_build_object(
              'fill', '#ffffff',
              'stroke', '#000000',
              'strokeWidth', 0,
              'opacity', 1,
              'fontFamily', 'Inter',
              'fontSize', 64,
              'fontWeight', 700,
              'lineHeight', 1.1,
              'textAlign', 'center'
            )
          )
        )
      )
    ),
    'metadata', jsonb_build_object(
      'createdAt', '2026-09-26T10:00:00.000Z',
      'updatedAt', '2026-09-26T10:00:00.000Z'
    )
  );
  v_invalid_document jsonb;
  v_nested_element jsonb;
  v_limit_children jsonb;
  v_index integer;
  v_saved_document jsonb;
  v_privilege text;
begin
  if app_private.social_media_generator_document_schema_version(v_document) <> 1 then
    raise exception 'Echtes graphics-core-Dokument wurde nicht akzeptiert.';
  end if;

  v_invalid_document := jsonb_set(
    v_document,
    '{elements}',
    jsonb_build_array(
      jsonb_build_object('id', 'duplicate', 'type', 'text'),
      jsonb_build_object('id', 'duplicate', 'type', 'image')
    )
  );
  begin
    perform app_private.social_media_generator_document_schema_version(
      v_invalid_document
    );
    raise exception 'Doppelte Top-Level-ID wurde akzeptiert.';
  exception when sqlstate '22023' then
    if sqlerrm <> 'SOCIAL_MEDIA_DOCUMENT_ELEMENT_ID_DUPLICATE' then
      raise;
    end if;
  end;

  v_invalid_document := jsonb_set(
    v_document,
    '{elements}',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'group-with-duplicate-children',
        'type', 'group',
        'children', jsonb_build_array(
          jsonb_build_object('id', 'nested-duplicate', 'type', 'text'),
          jsonb_build_object('id', 'nested-duplicate', 'type', 'image')
        )
      )
    )
  );
  begin
    perform app_private.social_media_generator_document_schema_version(
      v_invalid_document
    );
    raise exception 'Doppelte ID innerhalb einer Gruppe wurde akzeptiert.';
  exception when sqlstate '22023' then
    if sqlerrm <> 'SOCIAL_MEDIA_DOCUMENT_ELEMENT_ID_DUPLICATE' then
      raise;
    end if;
  end;

  v_invalid_document := jsonb_set(
    v_document,
    '{elements}',
    jsonb_build_array(
      jsonb_build_object('id', 'shared-id', 'type', 'text'),
      jsonb_build_object(
        'id', 'group-with-shared-id',
        'type', 'group',
        'children', jsonb_build_array(
          jsonb_build_object('id', 'shared-id', 'type', 'image')
        )
      )
    )
  );
  begin
    perform app_private.social_media_generator_document_schema_version(
      v_invalid_document
    );
    raise exception 'Top-Level-/Nested-ID-Kollision wurde akzeptiert.';
  exception when sqlstate '22023' then
    if sqlerrm <> 'SOCIAL_MEDIA_DOCUMENT_ELEMENT_ID_DUPLICATE' then
      raise;
    end if;
  end;

  v_invalid_document := jsonb_set(
    v_document,
    '{elements}',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'group-with-invalid-child',
        'type', 'group',
        'children', jsonb_build_array(
          jsonb_build_object('type', 'text')
        )
      )
    )
  );
  begin
    perform app_private.social_media_generator_document_schema_version(
      v_invalid_document
    );
    raise exception 'Nested Child ohne ID wurde akzeptiert.';
  exception when sqlstate '22023' then
    if sqlerrm <> 'SOCIAL_MEDIA_DOCUMENT_ELEMENT_ID_INVALID' then
      raise;
    end if;
  end;

  v_invalid_document := jsonb_set(
    v_document,
    '{elements}',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'group-with-invalid-children',
        'type', 'group',
        'children', jsonb_build_object('id', 'not-an-array')
      )
    )
  );
  begin
    perform app_private.social_media_generator_document_schema_version(
      v_invalid_document
    );
    raise exception 'GroupElement mit ungueltigen children wurde akzeptiert.';
  exception when sqlstate '22023' then
    if sqlerrm <> 'SOCIAL_MEDIA_DOCUMENT_GROUP_CHILDREN_INVALID' then
      raise;
    end if;
  end;

  select jsonb_agg(
    jsonb_build_object('id', 'nested-' || item.number, 'type', 'text')
    order by item.number
  )
  into v_limit_children
  from generate_series(1, 5000) as item(number);

  v_invalid_document := jsonb_set(
    v_document,
    '{elements}',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'limit-group',
        'type', 'group',
        'children', v_limit_children
      )
    )
  );
  begin
    perform app_private.social_media_generator_document_schema_version(
      v_invalid_document
    );
    raise exception 'Elementlimit wurde durch GroupElement umgangen.';
  exception when sqlstate '22023' then
    if sqlerrm <> 'SOCIAL_MEDIA_DOCUMENT_ELEMENTS_LIMIT_EXCEEDED' then
      raise;
    end if;
  end;

  v_nested_element := jsonb_build_object(
    'id', 'deep-leaf',
    'type', 'text'
  );
  for v_index in 1..32 loop
    v_nested_element := jsonb_build_object(
      'id', 'deep-group-' || v_index,
      'type', 'group',
      'children', jsonb_build_array(v_nested_element)
    );
  end loop;
  v_invalid_document := jsonb_set(
    v_document,
    '{elements}',
    jsonb_build_array(v_nested_element)
  );
  begin
    perform app_private.social_media_generator_document_schema_version(
      v_invalid_document
    );
    raise exception 'Zu tiefe GroupElement-Verschachtelung wurde akzeptiert.';
  exception when sqlstate '22023' then
    if sqlerrm <> 'SOCIAL_MEDIA_DOCUMENT_NESTING_TOO_DEEP' then
      raise;
    end if;
  end;

  v_invalid_document := jsonb_set(
    v_document,
    '{schemaVersion}',
    '2'::jsonb
  );
  begin
    perform app_private.social_media_generator_document_schema_version(
      v_invalid_document
    );
    raise exception 'Unbekannte schemaVersion wurde akzeptiert.';
  exception when sqlstate '22023' then
    if sqlerrm <> 'SOCIAL_MEDIA_DOCUMENT_SCHEMA_VERSION_UNSUPPORTED' then
      raise;
    end if;
  end;

  if to_regclass('app_social_media.user_preferences') is null
     or to_regclass('app_social_media.drafts') is null then
    raise exception 'Social-Media-Generator-Tabellen fehlen.';
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid = 'app_social_media.user_preferences'::regclass
  ) or not (
    select relrowsecurity
    from pg_class
    where oid = 'app_social_media.drafts'::regclass
  ) then
    raise exception 'RLS fehlt auf Generator-Tabellen.';
  end if;

  foreach v_privilege in array array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE',
    'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ] loop
    if has_table_privilege(
      'anon', 'app_social_media.user_preferences', v_privilege
    ) or has_table_privilege(
      'authenticated', 'app_social_media.user_preferences', v_privilege
    ) or has_table_privilege(
      'anon', 'app_social_media.drafts', v_privilege
    ) or has_table_privilege(
      'authenticated', 'app_social_media.drafts', v_privilege
    ) then
      raise exception 'Browserrolle besitzt % auf Generator-Tabellen.',
        v_privilege;
    end if;
  end loop;

  if has_schema_privilege('anon', 'app_social_media', 'USAGE')
     or has_schema_privilege('authenticated', 'app_social_media', 'USAGE') then
    raise exception 'Browserrolle besitzt USAGE auf app_social_media.';
  end if;

  if has_function_privilege(
    'authenticated',
    'app_private.api_social_media_generator_draft_save(jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'app_private.api_social_media_generator_bootstrap()',
    'EXECUTE'
  ) then
    raise exception 'Private Generator-Funktion ist direkt erreichbar.';
  end if;

  if has_function_privilege(
    'anon', 'public.pd_api(text,jsonb)', 'EXECUTE'
  ) or not has_function_privilege(
    'authenticated', 'public.pd_api(text,jsonb)', 'EXECUTE'
  ) then
    raise exception 'pd_api-Browsergrenze ist falsch.';
  end if;

  insert into auth.users (id, email)
  values
    (v_admin, 'social-generator-admin@example.invalid'),
    (v_capability_user, 'social-generator-capability@example.invalid'),
    (v_team_user, 'social-generator-team@example.invalid'),
    (v_denied_user, 'social-generator-denied@example.invalid');

  insert into app_portal.users (
    id, user_code, email, first_name, last_name, status, role_id
  )
  values
    (
      v_admin, 'U-SMG-ADMIN', 'social-generator-admin@example.invalid',
      'Generator', 'Admin', 'ACTIVE',
      '00000000-0000-4000-8000-000000000001'
    ),
    (
      v_capability_user, 'U-SMG-CAP',
      'social-generator-capability@example.invalid',
      'Generator', 'Capability', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_team_user, 'U-SMG-TEAM', 'social-generator-team@example.invalid',
      'Generator', 'Team', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_denied_user, 'U-SMG-DENIED',
      'social-generator-denied@example.invalid',
      'Generator', 'Denied', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    );

  insert into app_portal.user_capabilities (
    user_id, capability_code, created_by
  )
  values (
    v_capability_user, 'social_media_generator.use', v_admin
  );

  insert into app_portal.teams (code, name, description, is_active)
  values (
    'SOCIAL_MEDIA', 'Social Media',
    'Testteam fuer den Social-Media-Generator.', true
  )
  on conflict (code) do update
  set is_active = true
  returning id into v_team_id;

  insert into app_portal.team_memberships (
    team_id, user_id, team_role, is_active
  )
  values (v_team_id, v_team_user, 'MEMBER', true);

  perform set_config('request.jwt.claim.sub', v_capability_user::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_capability_user,
      'role', 'authenticated'
    )::text,
    true
  );
  v_response := public.pd_api(
    'social_media_generator_bootstrap', '{}'::jsonb
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or not coalesce(
       (v_response #>> '{data,accessAllowed}')::boolean,
       false
     )
     or coalesce(
       (v_response #>> '{data,preferences,expertMode}')::boolean,
       true
     ) then
    raise exception 'Capability-Bootstrap ist falsch: %', v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_team_user::text, true);
  v_response := public.pd_api(
    'social_media_generator_bootstrap', '{}'::jsonb
  );
  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'SOCIAL_MEDIA-Teamzugriff fehlt: %', v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  v_response := public.pd_api(
    'social_media_generator_bootstrap', '{}'::jsonb
  );
  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'portal.admin-Zugriff fehlt: %', v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_denied_user::text, true);
  v_response := public.pd_api(
    'social_media_generator_bootstrap', '{}'::jsonb
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501'
     or v_response #>> '{error,message}' <>
       'SOCIAL_MEDIA_GENERATOR_ACCESS_REQUIRED' then
    raise exception 'Unberechtigter Bootstrap wurde nicht abgewiesen: %',
      v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_capability_user::text, true);
  v_response := public.pd_api(
    'social_media_generator_preferences_update',
    jsonb_build_object(
      'expertMode', true,
      'userId', v_denied_user
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or not coalesce(
       (v_response #>> '{data,preferences,expertMode}')::boolean,
       false
     )
     or not exists (
       select 1
       from app_social_media.user_preferences as preference
       where preference.user_id = v_capability_user
         and preference.expert_mode
     )
     or exists (
       select 1
       from app_social_media.user_preferences as preference
       where preference.user_id = v_denied_user
     ) then
    raise exception 'Eigene Praeferenzen sind nicht sicher: %', v_response;
  end if;

  v_response := public.pd_api(
    'social_media_generator_draft_create',
    jsonb_build_object(
      'title', 'Spieltag Quadrat',
      'document', v_document,
      'ownerUserId', v_denied_user
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or (v_response #>> '{data,version}')::bigint <> 1
     or v_response #> '{data,document}' <> v_document then
    raise exception 'Draft-Anlage ist falsch: %', v_response;
  end if;
  v_draft_id := (v_response #>> '{data,id}')::uuid;

  if not exists (
    select 1
    from app_social_media.drafts as draft
    where draft.id = v_draft_id
      and draft.owner_user_id = v_capability_user
      and draft.version = 1
      and draft.document = v_document
  ) then
    raise exception 'Draft-Eigentuemer oder Dokument ist falsch.';
  end if;

  v_response := public.pd_api(
    'social_media_generator_drafts_list', '{}'::jsonb
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or jsonb_array_length(v_response #> '{data,drafts}') <> 1
     or v_response #>> '{data,drafts,0,id}' <> v_draft_id::text
     or v_response #> '{data,drafts,0}' ? 'document' then
    raise exception 'Draft-Liste ist falsch: %', v_response;
  end if;

  v_response := public.pd_api(
    'social_media_generator_draft_get',
    jsonb_build_object('draftId', v_draft_id)
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #> '{data,document}' <> v_document then
    raise exception 'Draft-Laden ist falsch: %', v_response;
  end if;

  v_saved_document := jsonb_set(
    v_document,
    '{metadata,updatedAt}',
    to_jsonb('2026-09-26T11:00:00.000Z'::text)
  );
  v_response := public.pd_api(
    'social_media_generator_draft_save',
    jsonb_build_object(
      'draftId', v_draft_id,
      'title', 'Spieltag Quadrat aktualisiert',
      'document', v_saved_document,
      'expectedVersion', 1
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or (v_response #>> '{data,version}')::bigint <> 2
     or v_response #> '{data,document}' <> v_saved_document then
    raise exception 'Draft-Speichern ist falsch: %', v_response;
  end if;

  v_response := public.pd_api(
    'social_media_generator_draft_save',
    jsonb_build_object(
      'draftId', v_draft_id,
      'title', 'Veraltete Speicherung',
      'document', v_document,
      'expectedVersion', 1
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> 'PT409'
     or v_response #>> '{error,message}' <>
       'SOCIAL_MEDIA_DRAFT_VERSION_CONFLICT' then
    raise exception 'Veraltete Speicherung wurde nicht abgewiesen: %',
      v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_team_user::text, true);
  v_response := public.pd_api(
    'social_media_generator_draft_get',
    jsonb_build_object('draftId', v_draft_id)
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> 'P0002' then
    raise exception 'Fremder Draft wurde nicht verborgen: %', v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_denied_user::text, true);
  v_response := public.pd_api(
    'social_media_generator_preferences_update',
    jsonb_build_object('expertMode', true)
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501' then
    raise exception 'Unberechtigte Mutation wurde nicht abgewiesen: %',
      v_response;
  end if;
end
$social_media_generator_phase1$;

rollback;
