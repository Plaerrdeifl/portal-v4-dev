begin;

-- Plaerrdeifl Social-Media-Generator / Phase 2
-- Versioned templates behind public.pd_api(text, jsonb).

create table app_social_media.templates (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  category text not null default 'Allgemein',
  description text not null default '',
  sort_position integer not null default 0,
  is_active boolean not null default true,
  current_published_version_id uuid,
  created_by uuid not null
    references app_portal.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint social_media_templates_name_check
    check (pg_catalog.length(pg_catalog.btrim(name)) between 1 and 160),
  constraint social_media_templates_category_check
    check (pg_catalog.length(pg_catalog.btrim(category)) between 1 and 80),
  constraint social_media_templates_description_check
    check (pg_catalog.length(description) <= 2000)
);

create table app_social_media.template_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  template_id uuid not null
    references app_social_media.templates(id) on delete restrict,
  version_number bigint not null,
  revision bigint not null default 1,
  status text not null,
  document jsonb not null,
  document_schema_version integer not null,
  change_note text not null default '',
  created_by uuid not null
    references app_portal.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  published_by uuid
    references app_portal.users(id) on delete restrict,
  published_at timestamptz,
  constraint social_media_template_versions_number_check
    check (version_number > 0),
  constraint social_media_template_versions_revision_check
    check (revision > 0),
  constraint social_media_template_versions_status_check
    check (status in ('DRAFT', 'PUBLISHED')),
  constraint social_media_template_versions_document_check
    check (pg_catalog.jsonb_typeof(document) = 'object'),
  constraint social_media_template_versions_schema_check
    check (document_schema_version > 0),
  constraint social_media_template_versions_change_note_check
    check (pg_catalog.length(change_note) <= 1000),
  constraint social_media_template_versions_publish_check
    check (
      (status = 'DRAFT' and published_by is null and published_at is null)
      or
      (status = 'PUBLISHED' and published_by is not null and published_at is not null)
    ),
  constraint social_media_template_versions_unique
    unique (template_id, version_number)
);

alter table app_social_media.templates
  add constraint social_media_templates_current_published_fk
  foreign key (current_published_version_id)
  references app_social_media.template_versions(id)
  on delete restrict;

create unique index social_media_template_versions_one_draft_idx
  on app_social_media.template_versions(template_id)
  where status = 'DRAFT';

create index social_media_templates_browser_idx
  on app_social_media.templates(is_active, sort_position, category, name, id);

create index social_media_template_versions_template_idx
  on app_social_media.template_versions(
    template_id, version_number desc, id
  );

create table app_social_media.template_favorites (
  user_id uuid not null
    references app_portal.users(id) on delete cascade,
  template_id uuid not null
    references app_social_media.templates(id) on delete cascade,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (user_id, template_id)
);

alter table app_social_media.drafts
  add column template_version_id uuid
    references app_social_media.template_versions(id) on delete restrict;

create index social_media_drafts_template_version_idx
  on app_social_media.drafts(template_version_id)
  where template_version_id is not null;

alter table app_social_media.templates enable row level security;
alter table app_social_media.template_versions enable row level security;
alter table app_social_media.template_favorites enable row level security;

revoke all on all tables in schema app_social_media
  from public, anon, authenticated, service_role;
revoke all on all sequences in schema app_social_media
  from public, anon, authenticated, service_role;

create function app_private.social_media_generator_template_version_json(
  p_version_id uuid,
  p_include_document boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_strip_nulls(
    pg_catalog.jsonb_build_object(
      'id', version.id,
      'templateId', version.template_id,
      'versionNumber', version.version_number,
      'revision', version.revision,
      'status', version.status,
      'document',
        case when p_include_document then version.document else null end,
      'documentSchemaVersion', version.document_schema_version,
      'format', version.document -> 'format',
      'changeNote', nullif(version.change_note, ''),
      'createdAt', version.created_at,
      'updatedAt', version.updated_at,
      'publishedAt', version.published_at
    )
  )
  from app_social_media.template_versions as version
  where version.id = p_version_id;
$function$;

create function app_private.social_media_generator_template_json(
  p_template_id uuid,
  p_user_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_strip_nulls(
    pg_catalog.jsonb_build_object(
      'id', template.id,
      'name', template.name,
      'category', template.category,
      'description', template.description,
      'sortPosition', template.sort_position,
      'isActive', template.is_active,
      'isFavorite', favorite.user_id is not null,
      'publishedVersion',
        case
          when template.current_published_version_id is not null then
            app_private.social_media_generator_template_version_json(
              template.current_published_version_id,
              false
            )
          else null
        end,
      'draftVersion',
        case
          when draft.id is not null then
            app_private.social_media_generator_template_version_json(
              draft.id,
              false
            )
          else null
        end,
      'createdAt', template.created_at,
      'updatedAt', template.updated_at
    )
  )
  from app_social_media.templates as template
  left join app_social_media.template_versions as draft
    on draft.template_id = template.id
   and draft.status = 'DRAFT'
  left join app_social_media.template_favorites as favorite
    on favorite.template_id = template.id
   and favorite.user_id = p_user_id
  where template.id = p_template_id;
$function$;

create or replace function app_private.social_media_generator_draft_json(
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
      'document',
        case when p_include_document then draft.document else null end,
      'documentSchemaVersion', draft.document_schema_version,
      'version', draft.version,
      'templateVersionId', draft.template_version_id,
      'createdAt', draft.created_at,
      'updatedAt', draft.updated_at
    )
  )
  from app_social_media.drafts as draft
  where draft.id = p_draft_id;
$function$;

create function app_private.api_social_media_generator_templates_list(
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
  v_include_inactive boolean := coalesce(
    case
      when pg_catalog.jsonb_typeof(p_payload -> 'includeInactive') = 'boolean'
        then (p_payload ->> 'includeInactive')::boolean
      else false
    end,
    false
  );
  v_templates jsonb;
begin
  select coalesce(
    pg_catalog.jsonb_agg(
      app_private.social_media_generator_template_json(template.id, v_user_id)
      order by
        (favorite.user_id is not null) desc,
        template.sort_position,
        template.category,
        template.name,
        template.id
    ),
    '[]'::jsonb
  )
  into v_templates
  from app_social_media.templates as template
  left join app_social_media.template_favorites as favorite
    on favorite.template_id = template.id
   and favorite.user_id = v_user_id
  where v_include_inactive or template.is_active;

  return pg_catalog.jsonb_build_object('templates', v_templates);
end;
$function$;

create function app_private.api_social_media_generator_template_get(
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
  v_template_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'templateId', '')), ''
  )::uuid;
  v_version_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'versionId', '')), ''
  )::uuid;
  v_mode text := pg_catalog.upper(
    pg_catalog.btrim(coalesce(p_payload ->> 'mode', 'PUBLISHED'))
  );
  v_result jsonb;
begin
  if v_mode not in ('PUBLISHED', 'DRAFT') then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_MODE_INVALID'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from app_social_media.templates as template
    where template.id = v_template_id
  ) then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_version_id is null then
    if v_mode = 'PUBLISHED' then
      select template.current_published_version_id
      into v_version_id
      from app_social_media.templates as template
      where template.id = v_template_id;
    else
      select version.id
      into v_version_id
      from app_social_media.template_versions as version
      where version.template_id = v_template_id
        and version.status = 'DRAFT';
    end if;
  end if;

  if v_version_id is null then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_VERSION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select app_private.social_media_generator_template_version_json(
    version.id,
    true
  )
  into v_result
  from app_social_media.template_versions as version
  where version.id = v_version_id
    and version.template_id = v_template_id;

  if not found then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_VERSION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  return pg_catalog.jsonb_build_object(
    'template',
      app_private.social_media_generator_template_json(
        v_template_id,
        v_user_id
      ),
    'version', v_result
  );
end;
$function$;

create function app_private.api_social_media_generator_template_create(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_name text := app_private.require_valid_name(
    p_payload ->> 'name', 'Vorlagenname'
  );
  v_category text := pg_catalog.btrim(
    coalesce(nullif(p_payload ->> 'category', ''), 'Allgemein')
  );
  v_description text := coalesce(p_payload ->> 'description', '');
  v_document jsonb := p_payload -> 'document';
  v_schema_version integer;
  v_template_id uuid;
  v_version_id uuid;
begin
  if pg_catalog.length(v_category) not between 1 and 80 then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_CATEGORY_INVALID'
      using errcode = '22023';
  end if;
  if pg_catalog.length(v_description) > 2000 then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_DESCRIPTION_INVALID'
      using errcode = '22023';
  end if;

  v_schema_version :=
    app_private.social_media_generator_document_schema_version(v_document);

  insert into app_social_media.templates (
    name, category, description, created_by, created_at, updated_at
  )
  values (
    v_name, v_category, v_description, v_user_id,
    pg_catalog.now(), pg_catalog.now()
  )
  returning id into v_template_id;

  insert into app_social_media.template_versions (
    template_id, version_number, revision, status,
    document, document_schema_version,
    created_by, created_at, updated_at
  )
  values (
    v_template_id, 1, 1, 'DRAFT',
    v_document, v_schema_version,
    v_user_id, pg_catalog.now(), pg_catalog.now()
  )
  returning id into v_version_id;

  perform app_private.log_audit(
    v_user_id,
    'SOCIAL_MEDIA_GENERATOR_TEMPLATE_CREATED',
    'social_media_generator_template',
    v_template_id::text,
    null,
    pg_catalog.jsonb_build_object(
      'name', v_name,
      'category', v_category,
      'draftVersionId', v_version_id,
      'versionNumber', 1
    )
  );

  return app_private.api_social_media_generator_template_get(
    pg_catalog.jsonb_build_object(
      'templateId', v_template_id,
      'versionId', v_version_id,
      'mode', 'DRAFT'
    )
  );
end;
$function$;

create function app_private.api_social_media_generator_template_draft_begin(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_template_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'templateId', '')), ''
  )::uuid;
  v_existing_id uuid;
  v_published_id uuid;
  v_document jsonb;
  v_schema_version integer;
  v_next_number bigint;
  v_new_id uuid;
begin
  select version.id
  into v_existing_id
  from app_social_media.template_versions as version
  where version.template_id = v_template_id
    and version.status = 'DRAFT';

  if found then
    return app_private.api_social_media_generator_template_get(
      pg_catalog.jsonb_build_object(
        'templateId', v_template_id,
        'versionId', v_existing_id,
        'mode', 'DRAFT'
      )
    );
  end if;

  select template.current_published_version_id
  into v_published_id
  from app_social_media.templates as template
  where template.id = v_template_id
    and template.is_active;

  if not found then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_published_id is null then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_PUBLISHED_VERSION_REQUIRED'
      using errcode = '22023';
  end if;

  select version.document, version.document_schema_version
  into v_document, v_schema_version
  from app_social_media.template_versions as version
  where version.id = v_published_id
    and version.template_id = v_template_id
    and version.status = 'PUBLISHED';

  select coalesce(pg_catalog.max(version.version_number), 0) + 1
  into v_next_number
  from app_social_media.template_versions as version
  where version.template_id = v_template_id;

  insert into app_social_media.template_versions (
    template_id, version_number, revision, status,
    document, document_schema_version,
    created_by, created_at, updated_at
  )
  values (
    v_template_id, v_next_number, 1, 'DRAFT',
    v_document, v_schema_version,
    v_user_id, pg_catalog.now(), pg_catalog.now()
  )
  returning id into v_new_id;

  update app_social_media.templates
  set updated_at = pg_catalog.now()
  where id = v_template_id;

  perform app_private.log_audit(
    v_user_id,
    'SOCIAL_MEDIA_GENERATOR_TEMPLATE_DRAFT_BEGUN',
    'social_media_generator_template',
    v_template_id::text,
    pg_catalog.jsonb_build_object(
      'publishedVersionId', v_published_id
    ),
    pg_catalog.jsonb_build_object(
      'draftVersionId', v_new_id,
      'versionNumber', v_next_number
    )
  );

  return app_private.api_social_media_generator_template_get(
    pg_catalog.jsonb_build_object(
      'templateId', v_template_id,
      'versionId', v_new_id,
      'mode', 'DRAFT'
    )
  );
end;
$function$;

create function app_private.api_social_media_generator_template_draft_save(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_template_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'templateId', '')), ''
  )::uuid;
  v_version_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'versionId', '')), ''
  )::uuid;
  v_expected_revision bigint;
  v_name text := app_private.require_valid_name(
    p_payload ->> 'name', 'Vorlagenname'
  );
  v_category text := pg_catalog.btrim(
    coalesce(nullif(p_payload ->> 'category', ''), 'Allgemein')
  );
  v_description text := coalesce(p_payload ->> 'description', '');
  v_document jsonb := p_payload -> 'document';
  v_schema_version integer;
  v_current_revision bigint;
begin
  if pg_catalog.jsonb_typeof(p_payload -> 'expectedRevision') <> 'number'
     or coalesce(p_payload ->> 'expectedRevision', '')
       !~ '^[1-9][0-9]{0,18}$' then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_EXPECTED_REVISION_INVALID'
      using errcode = '22023';
  end if;
  v_expected_revision := (p_payload ->> 'expectedRevision')::bigint;

  if pg_catalog.length(v_category) not between 1 and 80 then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_CATEGORY_INVALID'
      using errcode = '22023';
  end if;
  if pg_catalog.length(v_description) > 2000 then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_DESCRIPTION_INVALID'
      using errcode = '22023';
  end if;

  v_schema_version :=
    app_private.social_media_generator_document_schema_version(v_document);

  update app_social_media.template_versions as version
  set document = v_document,
      document_schema_version = v_schema_version,
      revision = version.revision + 1,
      updated_at = pg_catalog.now()
  where version.id = v_version_id
    and version.template_id = v_template_id
    and version.status = 'DRAFT'
    and version.revision = v_expected_revision;

  if not found then
    select version.revision
    into v_current_revision
    from app_social_media.template_versions as version
    where version.id = v_version_id
      and version.template_id = v_template_id
      and version.status = 'DRAFT';

    if not found then
      raise exception 'SOCIAL_MEDIA_TEMPLATE_DRAFT_NOT_FOUND'
        using errcode = 'P0002';
    end if;

    raise exception 'SOCIAL_MEDIA_TEMPLATE_DRAFT_VERSION_CONFLICT'
      using errcode = 'PT409',
            detail = pg_catalog.format(
              'expectedRevision=%s,currentRevision=%s',
              v_expected_revision,
              v_current_revision
            );
  end if;

  update app_social_media.templates
  set name = v_name,
      category = v_category,
      description = v_description,
      updated_at = pg_catalog.now()
  where id = v_template_id;

  perform app_private.log_audit(
    v_user_id,
    'SOCIAL_MEDIA_GENERATOR_TEMPLATE_DRAFT_SAVED',
    'social_media_generator_template',
    v_template_id::text,
    pg_catalog.jsonb_build_object(
      'versionId', v_version_id,
      'revision', v_expected_revision
    ),
    pg_catalog.jsonb_build_object(
      'versionId', v_version_id,
      'revision', v_expected_revision + 1
    )
  );

  return app_private.api_social_media_generator_template_get(
    pg_catalog.jsonb_build_object(
      'templateId', v_template_id,
      'versionId', v_version_id,
      'mode', 'DRAFT'
    )
  );
end;
$function$;

create function app_private.api_social_media_generator_template_publish(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_template_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'templateId', '')), ''
  )::uuid;
  v_version_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'versionId', '')), ''
  )::uuid;
  v_expected_revision bigint;
  v_change_note text := coalesce(p_payload ->> 'changeNote', '');
  v_current_revision bigint;
begin
  if pg_catalog.jsonb_typeof(p_payload -> 'expectedRevision') <> 'number'
     or coalesce(p_payload ->> 'expectedRevision', '')
       !~ '^[1-9][0-9]{0,18}$' then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_EXPECTED_REVISION_INVALID'
      using errcode = '22023';
  end if;
  v_expected_revision := (p_payload ->> 'expectedRevision')::bigint;

  if pg_catalog.length(v_change_note) > 1000 then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_CHANGE_NOTE_INVALID'
      using errcode = '22023';
  end if;

  update app_social_media.template_versions as version
  set status = 'PUBLISHED',
      change_note = v_change_note,
      revision = version.revision + 1,
      published_by = v_user_id,
      published_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where version.id = v_version_id
    and version.template_id = v_template_id
    and version.status = 'DRAFT'
    and version.revision = v_expected_revision
  returning version.revision into v_current_revision;

  if not found then
    select version.revision
    into v_current_revision
    from app_social_media.template_versions as version
    where version.id = v_version_id
      and version.template_id = v_template_id;

    if not found then
      raise exception 'SOCIAL_MEDIA_TEMPLATE_VERSION_NOT_FOUND'
        using errcode = 'P0002';
    end if;

    raise exception 'SOCIAL_MEDIA_TEMPLATE_DRAFT_VERSION_CONFLICT'
      using errcode = 'PT409';
  end if;

  update app_social_media.templates
  set current_published_version_id = v_version_id,
      updated_at = pg_catalog.now()
  where id = v_template_id;

  perform app_private.log_audit(
    v_user_id,
    'SOCIAL_MEDIA_GENERATOR_TEMPLATE_PUBLISHED',
    'social_media_generator_template',
    v_template_id::text,
    null,
    pg_catalog.jsonb_build_object(
      'versionId', v_version_id,
      'revision', v_current_revision,
      'changeNote', nullif(v_change_note, '')
    )
  );

  return app_private.api_social_media_generator_template_get(
    pg_catalog.jsonb_build_object(
      'templateId', v_template_id,
      'versionId', v_version_id,
      'mode', 'PUBLISHED'
    )
  );
end;
$function$;

create function app_private.api_social_media_generator_template_favorite_set(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_template_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'templateId', '')), ''
  )::uuid;
  v_favorite boolean;
begin
  if pg_catalog.jsonb_typeof(p_payload -> 'favorite') <> 'boolean' then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_FAVORITE_INVALID'
      using errcode = '22023';
  end if;
  v_favorite := (p_payload ->> 'favorite')::boolean;

  if not exists (
    select 1
    from app_social_media.templates as template
    where template.id = v_template_id
  ) then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_favorite then
    insert into app_social_media.template_favorites (
      user_id, template_id, created_at
    )
    values (v_user_id, v_template_id, pg_catalog.now())
    on conflict (user_id, template_id) do nothing;
  else
    delete from app_social_media.template_favorites
    where user_id = v_user_id
      and template_id = v_template_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'templateId', v_template_id,
    'favorite', v_favorite
  );
end;
$function$;

create function app_private.api_social_media_generator_draft_create_from_template(
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
  v_template_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'templateId', '')), ''
  )::uuid;
  v_version_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'versionId', '')), ''
  )::uuid;
  v_document jsonb;
  v_schema_version integer;
  v_draft_id uuid;
  v_now text := pg_catalog.now()::text;
begin
  if v_version_id is null then
    select template.current_published_version_id
    into v_version_id
    from app_social_media.templates as template
    where template.id = v_template_id
      and template.is_active;
  end if;

  if v_version_id is null then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_PUBLISHED_VERSION_REQUIRED'
      using errcode = '22023';
  end if;

  select version.document, version.document_schema_version
  into v_document, v_schema_version
  from app_social_media.template_versions as version
  join app_social_media.templates as template
    on template.id = version.template_id
   and template.is_active
  where version.id = v_version_id
    and version.template_id = v_template_id
    and version.status = 'PUBLISHED';

  if not found then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_VERSION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  v_document := pg_catalog.jsonb_set(
    v_document,
    '{id}',
    pg_catalog.to_jsonb(extensions.gen_random_uuid()::text),
    true
  );
  v_document := pg_catalog.jsonb_set(
    v_document,
    '{title}',
    pg_catalog.to_jsonb(v_title),
    true
  );
  v_document := pg_catalog.jsonb_set(
    v_document,
    '{metadata,templateVersionId}',
    pg_catalog.to_jsonb(v_version_id::text),
    true
  );
  v_document := pg_catalog.jsonb_set(
    v_document,
    '{metadata,createdAt}',
    pg_catalog.to_jsonb(v_now),
    true
  );
  v_document := pg_catalog.jsonb_set(
    v_document,
    '{metadata,updatedAt}',
    pg_catalog.to_jsonb(v_now),
    true
  );

  perform app_private.social_media_generator_document_schema_version(v_document);

  insert into app_social_media.drafts (
    owner_user_id, title, document, document_schema_version,
    version, template_version_id, created_at, updated_at
  )
  values (
    v_user_id, v_title, v_document, v_schema_version,
    1, v_version_id, pg_catalog.now(), pg_catalog.now()
  )
  returning id into v_draft_id;

  perform app_private.log_audit(
    v_user_id,
    'SOCIAL_MEDIA_GENERATOR_DRAFT_CREATED_FROM_TEMPLATE',
    'social_media_generator_draft',
    v_draft_id::text,
    null,
    pg_catalog.jsonb_build_object(
      'templateId', v_template_id,
      'templateVersionId', v_version_id,
      'version', 1
    )
  );

  return app_private.social_media_generator_draft_json(v_draft_id, true);
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_social_media_generator_templates_phase2;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_social_media_generator_templates_phase2()
    || array[
      'social_media_generator_templates_list',
      'social_media_generator_template_get',
      'social_media_generator_template_create',
      'social_media_generator_template_draft_begin',
      'social_media_generator_template_draft_save',
      'social_media_generator_template_publish',
      'social_media_generator_template_favorite_set',
      'social_media_generator_draft_create_from_template'
    ]::text[];
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_social_media_generator_templates_phase2;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'social_media_generator_templates_list' then 'READ'
    when 'social_media_generator_template_get' then 'READ'
    when 'social_media_generator_template_create' then 'USER_MUTATION'
    when 'social_media_generator_template_draft_begin' then 'USER_MUTATION'
    when 'social_media_generator_template_draft_save' then 'USER_MUTATION'
    when 'social_media_generator_template_publish' then 'USER_MUTATION'
    when 'social_media_generator_template_favorite_set' then 'USER_MUTATION'
    when 'social_media_generator_draft_create_from_template' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_social_media_generator_templates_phase2(
      p_action
    )
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_social_media_generator_templates_phase2;

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
    when 'social_media_generator_templates_list' then
      return app_private.api_social_media_generator_templates_list(v_payload);
    when 'social_media_generator_template_get' then
      return app_private.api_social_media_generator_template_get(v_payload);
    when 'social_media_generator_template_create' then
      return app_private.api_social_media_generator_template_create(v_payload);
    when 'social_media_generator_template_draft_begin' then
      return app_private.api_social_media_generator_template_draft_begin(v_payload);
    when 'social_media_generator_template_draft_save' then
      return app_private.api_social_media_generator_template_draft_save(v_payload);
    when 'social_media_generator_template_publish' then
      return app_private.api_social_media_generator_template_publish(v_payload);
    when 'social_media_generator_template_favorite_set' then
      return app_private.api_social_media_generator_template_favorite_set(v_payload);
    when 'social_media_generator_draft_create_from_template' then
      return app_private.api_social_media_generator_draft_create_from_template(v_payload);
    else
      return app_private.pd_api_dispatch_current_before_social_media_generator_templates_phase2(
        p_action, p_payload
      );
  end case;
end;
$function$;

revoke all on function
  app_private.social_media_generator_template_version_json(uuid, boolean),
  app_private.social_media_generator_template_json(uuid, uuid),
  app_private.api_social_media_generator_templates_list(jsonb),
  app_private.api_social_media_generator_template_get(jsonb),
  app_private.api_social_media_generator_template_create(jsonb),
  app_private.api_social_media_generator_template_draft_begin(jsonb),
  app_private.api_social_media_generator_template_draft_save(jsonb),
  app_private.api_social_media_generator_template_publish(jsonb),
  app_private.api_social_media_generator_template_favorite_set(jsonb),
  app_private.api_social_media_generator_draft_create_from_template(jsonb),
  app_private.pd_api_current_actions_before_social_media_generator_templates_phase2(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_social_media_generator_templates_phase2(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_social_media_generator_templates_phase2(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.social_media_generator_template_version_json(uuid, boolean),
  app_private.social_media_generator_template_json(uuid, uuid),
  app_private.api_social_media_generator_templates_list(jsonb),
  app_private.api_social_media_generator_template_get(jsonb),
  app_private.api_social_media_generator_template_create(jsonb),
  app_private.api_social_media_generator_template_draft_begin(jsonb),
  app_private.api_social_media_generator_template_draft_save(jsonb),
  app_private.api_social_media_generator_template_publish(jsonb),
  app_private.api_social_media_generator_template_favorite_set(jsonb),
  app_private.api_social_media_generator_draft_create_from_template(jsonb),
  app_private.pd_api_current_actions_before_social_media_generator_templates_phase2(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_social_media_generator_templates_phase2(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_social_media_generator_templates_phase2(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

commit;
