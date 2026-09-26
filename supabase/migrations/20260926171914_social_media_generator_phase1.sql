begin;

-- Plaerrdeifl Social-Media-Generator / Phase 1.1A
-- Minimal private persistence behind public.pd_api(text, jsonb).

create schema if not exists app_social_media;

revoke all on schema app_social_media
  from public, anon, authenticated, service_role;

alter default privileges in schema app_social_media
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema app_social_media
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema app_social_media
  revoke all on functions from public, anon, authenticated, service_role;

insert into app_portal.capabilities (
  code, name, category, description, is_active, sort_order
)
values (
  'social_media_generator.use',
  'Social-Media-Generator verwenden',
  'Social Media',
  'Zugriff auf den Plaerrdeifl Social-Media-Generator.',
  true,
  500
)
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

create table app_social_media.user_preferences (
  user_id uuid primary key
    references app_portal.users(id) on delete cascade,
  expert_mode boolean not null default false,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table app_social_media.drafts (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid not null
    references app_portal.users(id) on delete restrict,
  title text not null,
  document jsonb not null,
  document_schema_version integer not null,
  version bigint not null default 1,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint social_media_drafts_title_check
    check (pg_catalog.length(pg_catalog.btrim(title)) between 1 and 160),
  constraint social_media_drafts_document_check
    check (pg_catalog.jsonb_typeof(document) = 'object'),
  constraint social_media_drafts_document_schema_version_check
    check (document_schema_version > 0),
  constraint social_media_drafts_version_check
    check (version > 0)
);

create index social_media_drafts_owner_updated_idx
  on app_social_media.drafts(owner_user_id, updated_at desc, id);

alter table app_social_media.user_preferences enable row level security;
alter table app_social_media.drafts enable row level security;

revoke all on all tables in schema app_social_media
  from public, anon, authenticated, service_role;
revoke all on all sequences in schema app_social_media
  from public, anon, authenticated, service_role;

create function app_private.social_media_generator_user_has_access(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from app_portal.users as portal_user
    join app_portal.portal_roles as role
      on role.id = portal_user.role_id
     and role.is_active
    where portal_user.id = p_user_id
      and portal_user.status = 'ACTIVE'
      and (
        app_private.has_capability(
          portal_user.id,
          'social_media_generator.use'
        )
        or app_private.has_capability(portal_user.id, 'portal.admin')
        or exists (
          select 1
          from app_portal.team_memberships as membership
          join app_portal.teams as team
            on team.id = membership.team_id
           and team.is_active
          where membership.user_id = portal_user.id
            and membership.is_active
            and team.code = 'SOCIAL_MEDIA'
        )
      )
  );
$function$;

create function app_private.social_media_generator_require_access()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.require_active_user();
begin
  if not app_private.social_media_generator_user_has_access(v_user_id) then
    raise exception 'SOCIAL_MEDIA_GENERATOR_ACCESS_REQUIRED'
      using errcode = '42501';
  end if;
  return v_user_id;
end;
$function$;

create function app_private.social_media_generator_document_schema_version(
  p_document jsonb
)
returns integer
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
declare
  v_schema_version integer;
  v_element_count bigint;
  v_distinct_element_id_count bigint;
  v_max_element_depth integer;
  v_invalid_element boolean;
  v_invalid_children boolean;
  v_max_allowed_element_depth constant integer := 32;
begin
  if p_document is null
     or pg_catalog.jsonb_typeof(p_document) <> 'object' then
    raise exception 'SOCIAL_MEDIA_DOCUMENT_ROOT_INVALID'
      using errcode = '22023';
  end if;

  if pg_catalog.octet_length(p_document::text) > 5242880 then
    raise exception 'SOCIAL_MEDIA_DOCUMENT_TOO_LARGE'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_document -> 'schemaVersion')
       is distinct from 'number'
     or p_document -> 'schemaVersion' <> '1'::jsonb then
    raise exception 'SOCIAL_MEDIA_DOCUMENT_SCHEMA_VERSION_UNSUPPORTED'
      using errcode = '22023';
  end if;

  v_schema_version := 1;

  if pg_catalog.jsonb_typeof(p_document -> 'id') is distinct from 'string'
     or pg_catalog.length(
          pg_catalog.btrim(coalesce(p_document ->> 'id', ''))
        ) not between 1 and 160 then
    raise exception 'SOCIAL_MEDIA_DOCUMENT_ID_INVALID'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_document -> 'title')
       is distinct from 'string' then
    raise exception 'SOCIAL_MEDIA_DOCUMENT_TITLE_INVALID'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_document -> 'format')
       is distinct from 'object' then
    raise exception 'SOCIAL_MEDIA_DOCUMENT_FORMAT_INVALID'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_document #> '{format,width}')
       is distinct from 'number'
     or pg_catalog.jsonb_typeof(p_document #> '{format,height}')
       is distinct from 'number' then
    raise exception 'SOCIAL_MEDIA_DOCUMENT_FORMAT_DIMENSIONS_INVALID'
      using errcode = '22023';
  end if;

  if (p_document #>> '{format,width}')::numeric <= 0
     or (p_document #>> '{format,height}')::numeric <= 0 then
    raise exception 'SOCIAL_MEDIA_DOCUMENT_FORMAT_DIMENSIONS_INVALID'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_document -> 'elements')
       is distinct from 'array' then
    raise exception 'SOCIAL_MEDIA_DOCUMENT_ELEMENTS_INVALID'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_array_length(p_document -> 'elements') > 5000 then
    raise exception 'SOCIAL_MEDIA_DOCUMENT_ELEMENTS_LIMIT_EXCEEDED'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_document -> 'metadata')
       is distinct from 'object' then
    raise exception 'SOCIAL_MEDIA_DOCUMENT_METADATA_INVALID'
      using errcode = '22023';
  end if;

  with recursive element_tree(element, depth) as (
    select top_level.value, 1
    from pg_catalog.jsonb_array_elements(
      p_document -> 'elements'
    ) as top_level(value)

    union all

    select child.value, parent.depth + 1
    from element_tree as parent
    cross join lateral pg_catalog.jsonb_array_elements(
      case
        when pg_catalog.jsonb_typeof(parent.element -> 'children') = 'array'
          then parent.element -> 'children'
        else '[]'::jsonb
      end
    ) as child(value)
    where parent.depth <= v_max_allowed_element_depth
  )
  select
    pg_catalog.count(*),
    pg_catalog.count(distinct element ->> 'id'),
    coalesce(pg_catalog.max(depth), 0),
    coalesce(pg_catalog.bool_or(
      pg_catalog.jsonb_typeof(element) is distinct from 'object'
      or pg_catalog.jsonb_typeof(element -> 'id') is distinct from 'string'
      or pg_catalog.length(
           pg_catalog.btrim(coalesce(element ->> 'id', ''))
         ) not between 1 and 160
    ), false),
    coalesce(pg_catalog.bool_or(
      pg_catalog.jsonb_typeof(element) = 'object'
      and (
        (
          element ? 'children'
          and pg_catalog.jsonb_typeof(element -> 'children')
            is distinct from 'array'
        )
        or (
          element ->> 'type' = 'group'
          and pg_catalog.jsonb_typeof(element -> 'children')
            is distinct from 'array'
        )
      )
    ), false)
  into
    v_element_count,
    v_distinct_element_id_count,
    v_max_element_depth,
    v_invalid_element,
    v_invalid_children
  from element_tree;

  if v_max_element_depth > v_max_allowed_element_depth then
    raise exception 'SOCIAL_MEDIA_DOCUMENT_NESTING_TOO_DEEP'
      using errcode = '22023';
  end if;

  if v_invalid_children then
    raise exception 'SOCIAL_MEDIA_DOCUMENT_GROUP_CHILDREN_INVALID'
      using errcode = '22023';
  end if;

  if v_invalid_element then
    raise exception 'SOCIAL_MEDIA_DOCUMENT_ELEMENT_ID_INVALID'
      using errcode = '22023';
  end if;

  if v_element_count > 5000 then
    raise exception 'SOCIAL_MEDIA_DOCUMENT_ELEMENTS_LIMIT_EXCEEDED'
      using errcode = '22023';
  end if;

  if v_element_count <> v_distinct_element_id_count then
    raise exception 'SOCIAL_MEDIA_DOCUMENT_ELEMENT_ID_DUPLICATE'
      using errcode = '22023';
  end if;

  return v_schema_version;
end;
$function$;

create function app_private.social_media_generator_draft_json(
  p_draft_id uuid,
  p_include_document boolean default true
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_strip_nulls(
    pg_catalog.jsonb_build_object(
      'id', draft.id,
      'title', draft.title,
      'document', case when p_include_document then draft.document else null end,
      'documentSchemaVersion', draft.document_schema_version,
      'version', draft.version,
      'createdAt', draft.created_at,
      'updatedAt', draft.updated_at
    )
  )
  from app_social_media.drafts as draft
  where draft.id = p_draft_id;
$function$;

create function app_private.api_social_media_generator_bootstrap()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_display_name text;
  v_expert_mode boolean := false;
begin
  select
    pg_catalog.concat_ws(
      ' ',
      nullif(pg_catalog.btrim(portal_user.first_name), ''),
      nullif(pg_catalog.btrim(portal_user.last_name), '')
    ),
    coalesce(preference.expert_mode, false)
  into v_display_name, v_expert_mode
  from app_portal.users as portal_user
  left join app_social_media.user_preferences as preference
    on preference.user_id = portal_user.id
  where portal_user.id = v_user_id;

  return pg_catalog.jsonb_build_object(
    'accessAllowed', true,
    'user', pg_catalog.jsonb_build_object(
      'id', v_user_id,
      'displayName', v_display_name
    ),
    'preferences', pg_catalog.jsonb_build_object(
      'expertMode', v_expert_mode
    )
  );
end;
$function$;

create function app_private.api_social_media_generator_preferences_update(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_expert_mode boolean;
  v_before boolean := false;
begin
  if pg_catalog.jsonb_typeof(p_payload -> 'expertMode') <> 'boolean' then
    raise exception 'SOCIAL_MEDIA_EXPERT_MODE_INVALID'
      using errcode = '22023';
  end if;
  v_expert_mode := (p_payload ->> 'expertMode')::boolean;

  select preference.expert_mode
  into v_before
  from app_social_media.user_preferences as preference
  where preference.user_id = v_user_id;
  if not found then
    v_before := false;
  end if;

  insert into app_social_media.user_preferences (
    user_id, expert_mode, created_at, updated_at
  )
  values (
    v_user_id, v_expert_mode, pg_catalog.now(), pg_catalog.now()
  )
  on conflict (user_id) do update
  set expert_mode = excluded.expert_mode,
      updated_at = pg_catalog.now();

  perform app_private.log_audit(
    v_user_id,
    'SOCIAL_MEDIA_GENERATOR_PREFERENCES_UPDATED',
    'social_media_generator_preferences',
    v_user_id::text,
    pg_catalog.jsonb_build_object('expertMode', v_before),
    pg_catalog.jsonb_build_object('expertMode', v_expert_mode)
  );

  return pg_catalog.jsonb_build_object(
    'preferences', pg_catalog.jsonb_build_object('expertMode', v_expert_mode)
  );
end;
$function$;

create function app_private.api_social_media_generator_draft_create(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_title text := app_private.require_valid_name(
    p_payload ->> 'title', 'Entwurfstitel'
  );
  v_document jsonb := p_payload -> 'document';
  v_schema_version integer;
  v_draft_id uuid;
begin
  v_schema_version :=
    app_private.social_media_generator_document_schema_version(v_document);

  insert into app_social_media.drafts (
    owner_user_id, title, document, document_schema_version,
    version, created_at, updated_at
  )
  values (
    v_user_id, v_title, v_document, v_schema_version,
    1, pg_catalog.now(), pg_catalog.now()
  )
  returning id into v_draft_id;

  perform app_private.log_audit(
    v_user_id,
    'SOCIAL_MEDIA_GENERATOR_DRAFT_CREATED',
    'social_media_generator_draft',
    v_draft_id::text,
    null,
    pg_catalog.jsonb_build_object(
      'title', v_title,
      'documentSchemaVersion', v_schema_version,
      'version', 1
    )
  );

  return app_private.social_media_generator_draft_json(v_draft_id, true);
end;
$function$;

create function app_private.api_social_media_generator_draft_get(
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_draft_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'draftId', '')), ''
  )::uuid;
  v_result jsonb;
begin
  select app_private.social_media_generator_draft_json(draft.id, true)
  into v_result
  from app_social_media.drafts as draft
  where draft.id = v_draft_id
    and draft.owner_user_id = v_user_id;

  if not found then
    raise exception 'SOCIAL_MEDIA_DRAFT_NOT_FOUND'
      using errcode = 'P0002';
  end if;
  return v_result;
end;
$function$;

create function app_private.api_social_media_generator_drafts_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_drafts jsonb;
begin
  select coalesce(
    pg_catalog.jsonb_agg(
      app_private.social_media_generator_draft_json(draft.id, false)
      order by draft.updated_at desc, draft.id
    ),
    '[]'::jsonb
  )
  into v_drafts
  from app_social_media.drafts as draft
  where draft.owner_user_id = v_user_id;

  return pg_catalog.jsonb_build_object('drafts', v_drafts);
end;
$function$;

create function app_private.api_social_media_generator_draft_save(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_draft_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'draftId', '')), ''
  )::uuid;
  v_title text := app_private.require_valid_name(
    p_payload ->> 'title', 'Entwurfstitel'
  );
  v_document jsonb := p_payload -> 'document';
  v_schema_version integer;
  v_expected_version bigint;
  v_saved_id uuid;
  v_current_version bigint;
begin
  if pg_catalog.jsonb_typeof(p_payload -> 'expectedVersion') <> 'number'
     or coalesce(p_payload ->> 'expectedVersion', '') !~ '^[1-9][0-9]{0,18}$' then
    raise exception 'SOCIAL_MEDIA_DRAFT_EXPECTED_VERSION_INVALID'
      using errcode = '22023';
  end if;

  v_expected_version := (p_payload ->> 'expectedVersion')::bigint;
  v_schema_version :=
    app_private.social_media_generator_document_schema_version(v_document);

  update app_social_media.drafts as draft
  set title = v_title,
      document = v_document,
      document_schema_version = v_schema_version,
      version = draft.version + 1,
      updated_at = pg_catalog.now()
  where draft.id = v_draft_id
    and draft.owner_user_id = v_user_id
    and draft.version = v_expected_version
  returning draft.id into v_saved_id;

  if not found then
    select draft.version
    into v_current_version
    from app_social_media.drafts as draft
    where draft.id = v_draft_id
      and draft.owner_user_id = v_user_id;

    if not found then
      raise exception 'SOCIAL_MEDIA_DRAFT_NOT_FOUND'
        using errcode = 'P0002';
    end if;

    raise exception 'SOCIAL_MEDIA_DRAFT_VERSION_CONFLICT'
      using errcode = 'PT409',
            detail = pg_catalog.format(
              'expectedVersion=%s,currentVersion=%s',
              v_expected_version,
              v_current_version
            );
  end if;

  perform app_private.log_audit(
    v_user_id,
    'SOCIAL_MEDIA_GENERATOR_DRAFT_SAVED',
    'social_media_generator_draft',
    v_saved_id::text,
    pg_catalog.jsonb_build_object('version', v_expected_version),
    pg_catalog.jsonb_build_object(
      'title', v_title,
      'documentSchemaVersion', v_schema_version,
      'version', v_expected_version + 1
    )
  );

  return app_private.social_media_generator_draft_json(v_saved_id, true);
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_social_media_generator_phase1;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_social_media_generator_phase1()
    || array[
      'social_media_generator_bootstrap',
      'social_media_generator_preferences_update',
      'social_media_generator_draft_create',
      'social_media_generator_draft_get',
      'social_media_generator_drafts_list',
      'social_media_generator_draft_save'
    ]::text[];
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_social_media_generator_phase1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'social_media_generator_bootstrap' then 'READ'
    when 'social_media_generator_draft_get' then 'READ'
    when 'social_media_generator_drafts_list' then 'READ'
    when 'social_media_generator_preferences_update' then 'USER_MUTATION'
    when 'social_media_generator_draft_create' then 'USER_MUTATION'
    when 'social_media_generator_draft_save' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_social_media_generator_phase1(
      p_action
    )
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_social_media_generator_phase1;

create function app_private.pd_api_dispatch_current(
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_action text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_action, ''))
  );
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  case v_action
    when 'social_media_generator_bootstrap' then
      return app_private.api_social_media_generator_bootstrap();
    when 'social_media_generator_preferences_update' then
      return app_private.api_social_media_generator_preferences_update(v_payload);
    when 'social_media_generator_draft_create' then
      return app_private.api_social_media_generator_draft_create(v_payload);
    when 'social_media_generator_draft_get' then
      return app_private.api_social_media_generator_draft_get(v_payload);
    when 'social_media_generator_drafts_list' then
      return app_private.api_social_media_generator_drafts_list();
    when 'social_media_generator_draft_save' then
      return app_private.api_social_media_generator_draft_save(v_payload);
    else
      return app_private.pd_api_dispatch_current_before_social_media_generator_phase1(
        p_action, p_payload
      );
  end case;
end;
$function$;

revoke all on function
  app_private.social_media_generator_user_has_access(uuid),
  app_private.social_media_generator_require_access(),
  app_private.social_media_generator_document_schema_version(jsonb),
  app_private.social_media_generator_draft_json(uuid, boolean),
  app_private.api_social_media_generator_bootstrap(),
  app_private.api_social_media_generator_preferences_update(jsonb),
  app_private.api_social_media_generator_draft_create(jsonb),
  app_private.api_social_media_generator_draft_get(jsonb),
  app_private.api_social_media_generator_drafts_list(),
  app_private.api_social_media_generator_draft_save(jsonb),
  app_private.pd_api_current_actions_before_social_media_generator_phase1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_social_media_generator_phase1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_social_media_generator_phase1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.social_media_generator_user_has_access(uuid),
  app_private.social_media_generator_require_access(),
  app_private.social_media_generator_document_schema_version(jsonb),
  app_private.social_media_generator_draft_json(uuid, boolean),
  app_private.api_social_media_generator_bootstrap(),
  app_private.api_social_media_generator_preferences_update(jsonb),
  app_private.api_social_media_generator_draft_create(jsonb),
  app_private.api_social_media_generator_draft_get(jsonb),
  app_private.api_social_media_generator_drafts_list(),
  app_private.api_social_media_generator_draft_save(jsonb),
  app_private.pd_api_current_actions_before_social_media_generator_phase1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_social_media_generator_phase1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_social_media_generator_phase1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

commit;
