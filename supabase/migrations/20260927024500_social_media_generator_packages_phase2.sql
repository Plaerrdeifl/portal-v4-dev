begin;

-- Plaerrdeifl Social-Media-Generator / Phase 2 packages
-- Package templates reference concrete published template versions.
-- Media packages instantiate those slots as linked drafts plus shared data.

create table app_social_media.package_templates (
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
  constraint social_media_package_templates_name_check
    check (pg_catalog.length(pg_catalog.btrim(name)) between 1 and 160),
  constraint social_media_package_templates_category_check
    check (pg_catalog.length(pg_catalog.btrim(category)) between 1 and 80),
  constraint social_media_package_templates_description_check
    check (pg_catalog.length(description) <= 2000)
);

create table app_social_media.package_template_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  package_template_id uuid not null
    references app_social_media.package_templates(id) on delete restrict,
  version_number bigint not null,
  revision bigint not null default 1,
  status text not null,
  change_note text not null default '',
  created_by uuid not null
    references app_portal.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  published_by uuid
    references app_portal.users(id) on delete restrict,
  published_at timestamptz,
  constraint social_media_package_template_versions_number_check
    check (version_number > 0),
  constraint social_media_package_template_versions_revision_check
    check (revision > 0),
  constraint social_media_package_template_versions_status_check
    check (status in ('DRAFT', 'PUBLISHED')),
  constraint social_media_package_template_versions_change_note_check
    check (pg_catalog.length(change_note) <= 1000),
  constraint social_media_package_template_versions_publish_check
    check (
      (status = 'DRAFT' and published_by is null and published_at is null)
      or
      (status = 'PUBLISHED' and published_by is not null and published_at is not null)
    ),
  constraint social_media_package_template_versions_unique
    unique (package_template_id, version_number)
);

create table app_social_media.package_template_version_items (
  package_version_id uuid not null
    references app_social_media.package_template_versions(id) on delete cascade,
  slot_key text not null,
  label text not null,
  template_version_id uuid not null
    references app_social_media.template_versions(id) on delete restrict,
  sort_position integer not null default 0,
  primary key (package_version_id, slot_key),
  constraint social_media_package_item_slot_key_check
    check (
      pg_catalog.length(slot_key) between 1 and 80
      and slot_key ~ '^[A-Za-z0-9_.-]+$'
    ),
  constraint social_media_package_item_label_check
    check (pg_catalog.length(pg_catalog.btrim(label)) between 1 and 120)
);

alter table app_social_media.package_templates
  add constraint social_media_package_templates_current_published_fk
  foreign key (current_published_version_id)
  references app_social_media.package_template_versions(id)
  on delete restrict;

create unique index social_media_package_template_versions_one_draft_idx
  on app_social_media.package_template_versions(package_template_id)
  where status = 'DRAFT';

create index social_media_package_templates_browser_idx
  on app_social_media.package_templates(
    is_active, sort_position, category, name, id
  );

create index social_media_package_items_template_version_idx
  on app_social_media.package_template_version_items(template_version_id);

create table app_social_media.package_template_favorites (
  user_id uuid not null
    references app_portal.users(id) on delete cascade,
  package_template_id uuid not null
    references app_social_media.package_templates(id) on delete cascade,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (user_id, package_template_id)
);

create table app_social_media.media_packages (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid not null
    references app_portal.users(id) on delete cascade,
  title text not null,
  package_template_version_id uuid not null
    references app_social_media.package_template_versions(id) on delete restrict,
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint social_media_media_packages_title_check
    check (pg_catalog.length(pg_catalog.btrim(title)) between 1 and 160),
  constraint social_media_media_packages_data_check
    check (pg_catalog.jsonb_typeof(data) = 'object'),
  constraint social_media_media_packages_version_check
    check (version > 0)
);

create index social_media_media_packages_owner_idx
  on app_social_media.media_packages(
    owner_user_id, updated_at desc, id
  );

alter table app_social_media.drafts
  add column media_package_id uuid
    references app_social_media.media_packages(id) on delete restrict,
  add column package_slot_key text;

alter table app_social_media.drafts
  add constraint social_media_drafts_package_slot_pair_check
  check (
    (media_package_id is null and package_slot_key is null)
    or
    (
      media_package_id is not null
      and package_slot_key is not null
      and pg_catalog.length(package_slot_key) between 1 and 80
      and package_slot_key ~ '^[A-Za-z0-9_.-]+$'
    )
  );

create unique index social_media_drafts_media_package_slot_idx
  on app_social_media.drafts(media_package_id, package_slot_key)
  where media_package_id is not null;

alter table app_social_media.package_templates enable row level security;
alter table app_social_media.package_template_versions enable row level security;
alter table app_social_media.package_template_version_items enable row level security;
alter table app_social_media.package_template_favorites enable row level security;
alter table app_social_media.media_packages enable row level security;

revoke all on all tables in schema app_social_media
  from public, anon, authenticated, service_role;
revoke all on all sequences in schema app_social_media
  from public, anon, authenticated, service_role;

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
      'mediaPackageId', draft.media_package_id,
      'packageSlotKey', draft.package_slot_key,
      'createdAt', draft.created_at,
      'updatedAt', draft.updated_at
    )
  )
  from app_social_media.drafts as draft
  where draft.id = p_draft_id;
$function$;

create function app_private.social_media_generator_package_version_json(
  p_version_id uuid
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
      'packageTemplateId', version.package_template_id,
      'versionNumber', version.version_number,
      'revision', version.revision,
      'status', version.status,
      'changeNote', nullif(version.change_note, ''),
      'items', coalesce(
        (
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'slotKey', item.slot_key,
              'label', item.label,
              'sortPosition', item.sort_position,
              'templateVersionId', item.template_version_id,
              'templateVersion',
                app_private.social_media_generator_template_version_json(
                  item.template_version_id,
                  false
                )
            )
            order by item.sort_position, item.slot_key
          )
          from app_social_media.package_template_version_items as item
          where item.package_version_id = version.id
        ),
        '[]'::jsonb
      ),
      'createdAt', version.created_at,
      'updatedAt', version.updated_at,
      'publishedAt', version.published_at
    )
  )
  from app_social_media.package_template_versions as version
  where version.id = p_version_id;
$function$;

create function app_private.social_media_generator_package_template_json(
  p_package_template_id uuid,
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
      'id', package_template.id,
      'name', package_template.name,
      'category', package_template.category,
      'description', package_template.description,
      'sortPosition', package_template.sort_position,
      'isActive', package_template.is_active,
      'isFavorite', favorite.user_id is not null,
      'publishedVersion',
        case
          when package_template.current_published_version_id is not null then
            app_private.social_media_generator_package_version_json(
              package_template.current_published_version_id
            )
          else null
        end,
      'draftVersion',
        case
          when draft.id is not null then
            app_private.social_media_generator_package_version_json(draft.id)
          else null
        end,
      'createdAt', package_template.created_at,
      'updatedAt', package_template.updated_at
    )
  )
  from app_social_media.package_templates as package_template
  left join app_social_media.package_template_versions as draft
    on draft.package_template_id = package_template.id
   and draft.status = 'DRAFT'
  left join app_social_media.package_template_favorites as favorite
    on favorite.package_template_id = package_template.id
   and favorite.user_id = p_user_id
  where package_template.id = p_package_template_id;
$function$;

create function app_private.social_media_generator_replace_package_items(
  p_package_version_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item jsonb;
  v_slot_key text;
  v_label text;
  v_template_version_id uuid;
  v_sort_position integer;
  v_count integer;
begin
  if pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception 'SOCIAL_MEDIA_PACKAGE_ITEMS_INVALID'
      using errcode = '22023';
  end if;

  v_count := pg_catalog.jsonb_array_length(p_items);
  if v_count < 1 or v_count > 12 then
    raise exception 'SOCIAL_MEDIA_PACKAGE_ITEMS_COUNT_INVALID'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from app_social_media.package_template_versions as version
    where version.id = p_package_version_id
      and version.status = 'DRAFT'
  ) then
    raise exception 'SOCIAL_MEDIA_PACKAGE_DRAFT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  delete from app_social_media.package_template_version_items
  where package_version_id = p_package_version_id;

  for v_item in
    select value
    from pg_catalog.jsonb_array_elements(p_items)
  loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object' then
      raise exception 'SOCIAL_MEDIA_PACKAGE_ITEM_INVALID'
        using errcode = '22023';
    end if;

    v_slot_key := pg_catalog.btrim(coalesce(v_item ->> 'slotKey', ''));
    v_label := pg_catalog.btrim(coalesce(v_item ->> 'label', ''));
    v_template_version_id := nullif(
      pg_catalog.btrim(coalesce(v_item ->> 'templateVersionId', '')),
      ''
    )::uuid;
    v_sort_position := coalesce(
      nullif(v_item ->> 'sortPosition', '')::integer,
      0
    );

    if pg_catalog.length(v_slot_key) not between 1 and 80
       or v_slot_key !~ '^[A-Za-z0-9_.-]+$'
       or pg_catalog.length(v_label) not between 1 and 120 then
      raise exception 'SOCIAL_MEDIA_PACKAGE_ITEM_INVALID'
        using errcode = '22023';
    end if;

    if not exists (
      select 1
      from app_social_media.template_versions as template_version
      join app_social_media.templates as template
        on template.id = template_version.template_id
       and template.is_active
      where template_version.id = v_template_version_id
        and template_version.status = 'PUBLISHED'
    ) then
      raise exception 'SOCIAL_MEDIA_PACKAGE_ITEM_TEMPLATE_VERSION_INVALID'
        using errcode = '22023';
    end if;

    begin
      insert into app_social_media.package_template_version_items (
        package_version_id, slot_key, label,
        template_version_id, sort_position
      )
      values (
        p_package_version_id, v_slot_key, v_label,
        v_template_version_id, v_sort_position
      );
    exception when unique_violation then
      raise exception 'SOCIAL_MEDIA_PACKAGE_SLOT_DUPLICATE'
        using errcode = '22023';
    end;
  end loop;
end;
$function$;

create function app_private.api_social_media_generator_package_templates_list(
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
  v_packages jsonb;
begin
  select coalesce(
    pg_catalog.jsonb_agg(
      app_private.social_media_generator_package_template_json(
        package_template.id,
        v_user_id
      )
      order by
        (favorite.user_id is not null) desc,
        package_template.sort_position,
        package_template.category,
        package_template.name,
        package_template.id
    ),
    '[]'::jsonb
  )
  into v_packages
  from app_social_media.package_templates as package_template
  left join app_social_media.package_template_favorites as favorite
    on favorite.package_template_id = package_template.id
   and favorite.user_id = v_user_id
  where v_include_inactive or package_template.is_active;

  return pg_catalog.jsonb_build_object('packageTemplates', v_packages);
end;
$function$;

create function app_private.api_social_media_generator_package_template_get(
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
  v_package_template_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'packageTemplateId', '')),
    ''
  )::uuid;
  v_version_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'versionId', '')),
    ''
  )::uuid;
  v_mode text := pg_catalog.upper(
    pg_catalog.btrim(coalesce(p_payload ->> 'mode', 'PUBLISHED'))
  );
  v_version jsonb;
begin
  if v_mode not in ('PUBLISHED', 'DRAFT') then
    raise exception 'SOCIAL_MEDIA_PACKAGE_MODE_INVALID'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from app_social_media.package_templates
    where id = v_package_template_id
  ) then
    raise exception 'SOCIAL_MEDIA_PACKAGE_TEMPLATE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_version_id is null then
    if v_mode = 'PUBLISHED' then
      select current_published_version_id
      into v_version_id
      from app_social_media.package_templates
      where id = v_package_template_id;
    else
      select id
      into v_version_id
      from app_social_media.package_template_versions
      where package_template_id = v_package_template_id
        and status = 'DRAFT';
    end if;
  end if;

  if v_version_id is null then
    raise exception 'SOCIAL_MEDIA_PACKAGE_VERSION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select app_private.social_media_generator_package_version_json(version.id)
  into v_version
  from app_social_media.package_template_versions as version
  where version.id = v_version_id
    and version.package_template_id = v_package_template_id;

  if not found then
    raise exception 'SOCIAL_MEDIA_PACKAGE_VERSION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  return pg_catalog.jsonb_build_object(
    'packageTemplate',
      app_private.social_media_generator_package_template_json(
        v_package_template_id,
        v_user_id
      ),
    'version', v_version
  );
end;
$function$;

create function app_private.api_social_media_generator_package_template_create(
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
    p_payload ->> 'name', 'Paket-Vorlagenname'
  );
  v_category text := pg_catalog.btrim(
    coalesce(nullif(p_payload ->> 'category', ''), 'Allgemein')
  );
  v_description text := coalesce(p_payload ->> 'description', '');
  v_items jsonb := p_payload -> 'items';
  v_package_template_id uuid;
  v_version_id uuid;
begin
  if pg_catalog.length(v_category) not between 1 and 80
     or pg_catalog.length(v_description) > 2000 then
    raise exception 'SOCIAL_MEDIA_PACKAGE_METADATA_INVALID'
      using errcode = '22023';
  end if;

  insert into app_social_media.package_templates (
    name, category, description, created_by
  )
  values (v_name, v_category, v_description, v_user_id)
  returning id into v_package_template_id;

  insert into app_social_media.package_template_versions (
    package_template_id, version_number, revision, status, created_by
  )
  values (v_package_template_id, 1, 1, 'DRAFT', v_user_id)
  returning id into v_version_id;

  perform app_private.social_media_generator_replace_package_items(
    v_version_id,
    v_items
  );

  perform app_private.log_audit(
    v_user_id,
    'SOCIAL_MEDIA_GENERATOR_PACKAGE_TEMPLATE_CREATED',
    'social_media_generator_package_template',
    v_package_template_id::text,
    null,
    pg_catalog.jsonb_build_object(
      'draftVersionId', v_version_id,
      'versionNumber', 1
    )
  );

  return app_private.api_social_media_generator_package_template_get(
    pg_catalog.jsonb_build_object(
      'packageTemplateId', v_package_template_id,
      'versionId', v_version_id,
      'mode', 'DRAFT'
    )
  );
end;
$function$;

create function app_private.api_social_media_generator_package_template_draft_begin(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_package_template_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'packageTemplateId', '')),
    ''
  )::uuid;
  v_existing_id uuid;
  v_published_id uuid;
  v_next_number bigint;
  v_new_id uuid;
begin
  select id into v_existing_id
  from app_social_media.package_template_versions
  where package_template_id = v_package_template_id
    and status = 'DRAFT';

  if found then
    return app_private.api_social_media_generator_package_template_get(
      pg_catalog.jsonb_build_object(
        'packageTemplateId', v_package_template_id,
        'versionId', v_existing_id,
        'mode', 'DRAFT'
      )
    );
  end if;

  select current_published_version_id
  into v_published_id
  from app_social_media.package_templates
  where id = v_package_template_id
    and is_active;

  if not found then
    raise exception 'SOCIAL_MEDIA_PACKAGE_TEMPLATE_NOT_FOUND'
      using errcode = 'P0002';
  end if;
  if v_published_id is null then
    raise exception 'SOCIAL_MEDIA_PACKAGE_PUBLISHED_VERSION_REQUIRED'
      using errcode = '22023';
  end if;

  select coalesce(pg_catalog.max(version_number), 0) + 1
  into v_next_number
  from app_social_media.package_template_versions
  where package_template_id = v_package_template_id;

  insert into app_social_media.package_template_versions (
    package_template_id, version_number, revision, status, created_by
  )
  values (
    v_package_template_id, v_next_number, 1, 'DRAFT', v_user_id
  )
  returning id into v_new_id;

  insert into app_social_media.package_template_version_items (
    package_version_id, slot_key, label, template_version_id, sort_position
  )
  select
    v_new_id, slot_key, label, template_version_id, sort_position
  from app_social_media.package_template_version_items
  where package_version_id = v_published_id;

  update app_social_media.package_templates
  set updated_at = pg_catalog.now()
  where id = v_package_template_id;

  return app_private.api_social_media_generator_package_template_get(
    pg_catalog.jsonb_build_object(
      'packageTemplateId', v_package_template_id,
      'versionId', v_new_id,
      'mode', 'DRAFT'
    )
  );
end;
$function$;

create function app_private.api_social_media_generator_package_template_draft_save(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_package_template_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'packageTemplateId', '')),
    ''
  )::uuid;
  v_version_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'versionId', '')),
    ''
  )::uuid;
  v_expected_revision bigint;
  v_name text := app_private.require_valid_name(
    p_payload ->> 'name', 'Paket-Vorlagenname'
  );
  v_category text := pg_catalog.btrim(
    coalesce(nullif(p_payload ->> 'category', ''), 'Allgemein')
  );
  v_description text := coalesce(p_payload ->> 'description', '');
  v_items jsonb := p_payload -> 'items';
  v_current_revision bigint;
begin
  if pg_catalog.jsonb_typeof(p_payload -> 'expectedRevision') <> 'number'
     or coalesce(p_payload ->> 'expectedRevision', '')
       !~ '^[1-9][0-9]{0,18}$' then
    raise exception 'SOCIAL_MEDIA_PACKAGE_EXPECTED_REVISION_INVALID'
      using errcode = '22023';
  end if;
  v_expected_revision := (p_payload ->> 'expectedRevision')::bigint;

  if pg_catalog.length(v_category) not between 1 and 80
     or pg_catalog.length(v_description) > 2000 then
    raise exception 'SOCIAL_MEDIA_PACKAGE_METADATA_INVALID'
      using errcode = '22023';
  end if;

  update app_social_media.package_template_versions as version
  set revision = version.revision + 1,
      updated_at = pg_catalog.now()
  where version.id = v_version_id
    and version.package_template_id = v_package_template_id
    and version.status = 'DRAFT'
    and version.revision = v_expected_revision;

  if not found then
    select revision into v_current_revision
    from app_social_media.package_template_versions
    where id = v_version_id
      and package_template_id = v_package_template_id
      and status = 'DRAFT';

    if not found then
      raise exception 'SOCIAL_MEDIA_PACKAGE_DRAFT_NOT_FOUND'
        using errcode = 'P0002';
    end if;

    raise exception 'SOCIAL_MEDIA_PACKAGE_DRAFT_VERSION_CONFLICT'
      using errcode = 'PT409',
            detail = pg_catalog.format(
              'expectedRevision=%s,currentRevision=%s',
              v_expected_revision,
              v_current_revision
            );
  end if;

  perform app_private.social_media_generator_replace_package_items(
    v_version_id,
    v_items
  );

  update app_social_media.package_templates
  set name = v_name,
      category = v_category,
      description = v_description,
      updated_at = pg_catalog.now()
  where id = v_package_template_id;

  return app_private.api_social_media_generator_package_template_get(
    pg_catalog.jsonb_build_object(
      'packageTemplateId', v_package_template_id,
      'versionId', v_version_id,
      'mode', 'DRAFT'
    )
  );
end;
$function$;

create function app_private.api_social_media_generator_package_template_publish(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_package_template_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'packageTemplateId', '')),
    ''
  )::uuid;
  v_version_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'versionId', '')),
    ''
  )::uuid;
  v_expected_revision bigint;
  v_change_note text := coalesce(p_payload ->> 'changeNote', '');
  v_revision bigint;
begin
  if pg_catalog.jsonb_typeof(p_payload -> 'expectedRevision') <> 'number'
     or coalesce(p_payload ->> 'expectedRevision', '')
       !~ '^[1-9][0-9]{0,18}$' then
    raise exception 'SOCIAL_MEDIA_PACKAGE_EXPECTED_REVISION_INVALID'
      using errcode = '22023';
  end if;
  v_expected_revision := (p_payload ->> 'expectedRevision')::bigint;

  if pg_catalog.length(v_change_note) > 1000 then
    raise exception 'SOCIAL_MEDIA_PACKAGE_CHANGE_NOTE_INVALID'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from app_social_media.package_template_version_items
    where package_version_id = v_version_id
  ) then
    raise exception 'SOCIAL_MEDIA_PACKAGE_ITEMS_REQUIRED'
      using errcode = '22023';
  end if;

  update app_social_media.package_template_versions as version
  set status = 'PUBLISHED',
      revision = version.revision + 1,
      change_note = v_change_note,
      published_by = v_user_id,
      published_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where version.id = v_version_id
    and version.package_template_id = v_package_template_id
    and version.status = 'DRAFT'
    and version.revision = v_expected_revision
  returning version.revision into v_revision;

  if not found then
    raise exception 'SOCIAL_MEDIA_PACKAGE_DRAFT_VERSION_CONFLICT'
      using errcode = 'PT409';
  end if;

  update app_social_media.package_templates
  set current_published_version_id = v_version_id,
      updated_at = pg_catalog.now()
  where id = v_package_template_id;

  perform app_private.log_audit(
    v_user_id,
    'SOCIAL_MEDIA_GENERATOR_PACKAGE_TEMPLATE_PUBLISHED',
    'social_media_generator_package_template',
    v_package_template_id::text,
    null,
    pg_catalog.jsonb_build_object(
      'versionId', v_version_id,
      'revision', v_revision
    )
  );

  return app_private.api_social_media_generator_package_template_get(
    pg_catalog.jsonb_build_object(
      'packageTemplateId', v_package_template_id,
      'versionId', v_version_id,
      'mode', 'PUBLISHED'
    )
  );
end;
$function$;

create function app_private.api_social_media_generator_package_template_favorite_set(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_package_template_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'packageTemplateId', '')),
    ''
  )::uuid;
  v_favorite boolean;
begin
  if pg_catalog.jsonb_typeof(p_payload -> 'favorite') <> 'boolean' then
    raise exception 'SOCIAL_MEDIA_PACKAGE_FAVORITE_INVALID'
      using errcode = '22023';
  end if;
  v_favorite := (p_payload ->> 'favorite')::boolean;

  if not exists (
    select 1
    from app_social_media.package_templates
    where id = v_package_template_id
  ) then
    raise exception 'SOCIAL_MEDIA_PACKAGE_TEMPLATE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_favorite then
    insert into app_social_media.package_template_favorites (
      user_id, package_template_id
    )
    values (v_user_id, v_package_template_id)
    on conflict (user_id, package_template_id) do nothing;
  else
    delete from app_social_media.package_template_favorites
    where user_id = v_user_id
      and package_template_id = v_package_template_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'packageTemplateId', v_package_template_id,
    'favorite', v_favorite
  );
end;
$function$;

create function app_private.social_media_generator_media_package_json(
  p_media_package_id uuid,
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
      'id', media_package.id,
      'title', media_package.title,
      'packageTemplateVersionId', media_package.package_template_version_id,
      'data', media_package.data,
      'version', media_package.version,
      'drafts', coalesce(
        (
          select pg_catalog.jsonb_agg(
            app_private.social_media_generator_draft_json(draft.id, false)
            order by item.sort_position, draft.package_slot_key, draft.id
          )
          from app_social_media.drafts as draft
          left join app_social_media.package_template_version_items as item
            on item.package_version_id = media_package.package_template_version_id
           and item.slot_key = draft.package_slot_key
          where draft.media_package_id = media_package.id
            and draft.owner_user_id = p_user_id
        ),
        '[]'::jsonb
      ),
      'createdAt', media_package.created_at,
      'updatedAt', media_package.updated_at
    )
  )
  from app_social_media.media_packages as media_package
  where media_package.id = p_media_package_id
    and media_package.owner_user_id = p_user_id;
$function$;

create function app_private.api_social_media_generator_media_package_create(
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
    p_payload ->> 'title', 'Medienpaket-Titel'
  );
  v_package_template_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'packageTemplateId', '')),
    ''
  )::uuid;
  v_package_version_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'versionId', '')),
    ''
  )::uuid;
  v_data jsonb := coalesce(p_payload -> 'data', '{}'::jsonb);
  v_media_package_id uuid;
  v_item record;
  v_document jsonb;
  v_draft_title text;
  v_now text := pg_catalog.now()::text;
  v_count integer := 0;
begin
  if pg_catalog.jsonb_typeof(v_data) <> 'object' then
    raise exception 'SOCIAL_MEDIA_MEDIA_PACKAGE_DATA_INVALID'
      using errcode = '22023';
  end if;

  if v_package_version_id is null then
    select current_published_version_id
    into v_package_version_id
    from app_social_media.package_templates
    where id = v_package_template_id
      and is_active;
  end if;

  if v_package_version_id is null then
    raise exception 'SOCIAL_MEDIA_PACKAGE_PUBLISHED_VERSION_REQUIRED'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from app_social_media.package_template_versions as version
    join app_social_media.package_templates as package_template
      on package_template.id = version.package_template_id
     and package_template.is_active
    where version.id = v_package_version_id
      and version.package_template_id = v_package_template_id
      and version.status = 'PUBLISHED'
  ) then
    raise exception 'SOCIAL_MEDIA_PACKAGE_VERSION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  insert into app_social_media.media_packages (
    owner_user_id, title, package_template_version_id, data, version
  )
  values (
    v_user_id, v_title, v_package_version_id, v_data, 1
  )
  returning id into v_media_package_id;

  for v_item in
    select
      item.slot_key,
      item.label,
      item.template_version_id,
      template_version.document,
      template_version.document_schema_version,
      item.sort_position
    from app_social_media.package_template_version_items as item
    join app_social_media.template_versions as template_version
      on template_version.id = item.template_version_id
     and template_version.status = 'PUBLISHED'
    where item.package_version_id = v_package_version_id
    order by item.sort_position, item.slot_key
  loop
    v_count := v_count + 1;
    v_draft_title := v_title || ' – ' || v_item.label;
    v_document := v_item.document;
    v_document := pg_catalog.jsonb_set(
      v_document,
      '{id}',
      pg_catalog.to_jsonb(extensions.gen_random_uuid()::text),
      true
    );
    v_document := pg_catalog.jsonb_set(
      v_document,
      '{title}',
      pg_catalog.to_jsonb(v_draft_title),
      true
    );
    v_document := pg_catalog.jsonb_set(
      v_document,
      '{metadata,templateVersionId}',
      pg_catalog.to_jsonb(v_item.template_version_id::text),
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

    perform app_private.social_media_generator_document_schema_version(
      v_document
    );

    insert into app_social_media.drafts (
      owner_user_id, title, document, document_schema_version,
      version, template_version_id,
      media_package_id, package_slot_key
    )
    values (
      v_user_id, v_draft_title, v_document,
      v_item.document_schema_version,
      1, v_item.template_version_id,
      v_media_package_id, v_item.slot_key
    );
  end loop;

  if v_count = 0 then
    raise exception 'SOCIAL_MEDIA_PACKAGE_ITEMS_REQUIRED'
      using errcode = '22023';
  end if;

  perform app_private.log_audit(
    v_user_id,
    'SOCIAL_MEDIA_GENERATOR_MEDIA_PACKAGE_CREATED',
    'social_media_generator_media_package',
    v_media_package_id::text,
    null,
    pg_catalog.jsonb_build_object(
      'packageTemplateId', v_package_template_id,
      'packageTemplateVersionId', v_package_version_id,
      'draftCount', v_count
    )
  );

  return app_private.social_media_generator_media_package_json(
    v_media_package_id,
    v_user_id
  );
end;
$function$;

create function app_private.api_social_media_generator_media_packages_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_packages jsonb;
begin
  select coalesce(
    pg_catalog.jsonb_agg(
      app_private.social_media_generator_media_package_json(
        media_package.id,
        v_user_id
      )
      order by media_package.updated_at desc, media_package.id
    ),
    '[]'::jsonb
  )
  into v_packages
  from app_social_media.media_packages as media_package
  where media_package.owner_user_id = v_user_id;

  return pg_catalog.jsonb_build_object('mediaPackages', v_packages);
end;
$function$;

create function app_private.api_social_media_generator_media_package_get(
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
  v_media_package_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'mediaPackageId', '')),
    ''
  )::uuid;
  v_result jsonb;
begin
  select app_private.social_media_generator_media_package_json(
    media_package.id,
    v_user_id
  )
  into v_result
  from app_social_media.media_packages as media_package
  where media_package.id = v_media_package_id
    and media_package.owner_user_id = v_user_id;

  if not found then
    raise exception 'SOCIAL_MEDIA_MEDIA_PACKAGE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  return v_result;
end;
$function$;

create function app_private.api_social_media_generator_media_package_data_save(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_media_package_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'mediaPackageId', '')),
    ''
  )::uuid;
  v_data jsonb := p_payload -> 'data';
  v_expected_version bigint;
  v_current_version bigint;
begin
  if pg_catalog.jsonb_typeof(v_data) <> 'object'
     or pg_catalog.jsonb_typeof(p_payload -> 'expectedVersion') <> 'number'
     or coalesce(p_payload ->> 'expectedVersion', '')
       !~ '^[1-9][0-9]{0,18}$' then
    raise exception 'SOCIAL_MEDIA_MEDIA_PACKAGE_SAVE_INVALID'
      using errcode = '22023';
  end if;
  v_expected_version := (p_payload ->> 'expectedVersion')::bigint;

  update app_social_media.media_packages as media_package
  set data = v_data,
      version = media_package.version + 1,
      updated_at = pg_catalog.now()
  where media_package.id = v_media_package_id
    and media_package.owner_user_id = v_user_id
    and media_package.version = v_expected_version;

  if not found then
    select version into v_current_version
    from app_social_media.media_packages
    where id = v_media_package_id
      and owner_user_id = v_user_id;

    if not found then
      raise exception 'SOCIAL_MEDIA_MEDIA_PACKAGE_NOT_FOUND'
        using errcode = 'P0002';
    end if;

    raise exception 'SOCIAL_MEDIA_MEDIA_PACKAGE_VERSION_CONFLICT'
      using errcode = 'PT409',
            detail = pg_catalog.format(
              'expectedVersion=%s,currentVersion=%s',
              v_expected_version,
              v_current_version
            );
  end if;

  return app_private.social_media_generator_media_package_json(
    v_media_package_id,
    v_user_id
  );
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_sm_packages_p2;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_sm_packages_p2()
    || array[
      'social_media_generator_package_templates_list',
      'social_media_generator_package_template_get',
      'social_media_generator_package_template_create',
      'social_media_generator_package_template_draft_begin',
      'social_media_generator_package_template_draft_save',
      'social_media_generator_package_template_publish',
      'social_media_generator_package_template_favorite_set',
      'social_media_generator_media_package_create',
      'social_media_generator_media_packages_list',
      'social_media_generator_media_package_get',
      'social_media_generator_media_package_data_save'
    ]::text[];
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_sm_packages_p2;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'social_media_generator_package_templates_list' then 'READ'
    when 'social_media_generator_package_template_get' then 'READ'
    when 'social_media_generator_package_template_create' then 'USER_MUTATION'
    when 'social_media_generator_package_template_draft_begin' then 'USER_MUTATION'
    when 'social_media_generator_package_template_draft_save' then 'USER_MUTATION'
    when 'social_media_generator_package_template_publish' then 'USER_MUTATION'
    when 'social_media_generator_package_template_favorite_set' then 'USER_MUTATION'
    when 'social_media_generator_media_package_create' then 'USER_MUTATION'
    when 'social_media_generator_media_packages_list' then 'READ'
    when 'social_media_generator_media_package_get' then 'READ'
    when 'social_media_generator_media_package_data_save' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_sm_packages_p2(
      p_action
    )
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_sm_packages_p2;

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
    when 'social_media_generator_package_templates_list' then
      return app_private.api_social_media_generator_package_templates_list(v_payload);
    when 'social_media_generator_package_template_get' then
      return app_private.api_social_media_generator_package_template_get(v_payload);
    when 'social_media_generator_package_template_create' then
      return app_private.api_social_media_generator_package_template_create(v_payload);
    when 'social_media_generator_package_template_draft_begin' then
      return app_private.api_social_media_generator_package_template_draft_begin(v_payload);
    when 'social_media_generator_package_template_draft_save' then
      return app_private.api_social_media_generator_package_template_draft_save(v_payload);
    when 'social_media_generator_package_template_publish' then
      return app_private.api_social_media_generator_package_template_publish(v_payload);
    when 'social_media_generator_package_template_favorite_set' then
      return app_private.api_social_media_generator_package_template_favorite_set(v_payload);
    when 'social_media_generator_media_package_create' then
      return app_private.api_social_media_generator_media_package_create(v_payload);
    when 'social_media_generator_media_packages_list' then
      return app_private.api_social_media_generator_media_packages_list();
    when 'social_media_generator_media_package_get' then
      return app_private.api_social_media_generator_media_package_get(v_payload);
    when 'social_media_generator_media_package_data_save' then
      return app_private.api_social_media_generator_media_package_data_save(v_payload);
    else
      return app_private.pd_api_dispatch_current_before_sm_packages_p2(
        p_action, p_payload
      );
  end case;
end;
$function$;

revoke all on function
  app_private.social_media_generator_package_version_json(uuid),
  app_private.social_media_generator_package_template_json(uuid, uuid),
  app_private.social_media_generator_replace_package_items(uuid, jsonb),
  app_private.api_social_media_generator_package_templates_list(jsonb),
  app_private.api_social_media_generator_package_template_get(jsonb),
  app_private.api_social_media_generator_package_template_create(jsonb),
  app_private.api_social_media_generator_package_template_draft_begin(jsonb),
  app_private.api_social_media_generator_package_template_draft_save(jsonb),
  app_private.api_social_media_generator_package_template_publish(jsonb),
  app_private.api_social_media_generator_package_template_favorite_set(jsonb),
  app_private.social_media_generator_media_package_json(uuid, uuid),
  app_private.api_social_media_generator_media_package_create(jsonb),
  app_private.api_social_media_generator_media_packages_list(),
  app_private.api_social_media_generator_media_package_get(jsonb),
  app_private.api_social_media_generator_media_package_data_save(jsonb),
  app_private.pd_api_current_actions_before_sm_packages_p2(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_packages_p2(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_packages_p2(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.social_media_generator_package_version_json(uuid),
  app_private.social_media_generator_package_template_json(uuid, uuid),
  app_private.social_media_generator_replace_package_items(uuid, jsonb),
  app_private.api_social_media_generator_package_templates_list(jsonb),
  app_private.api_social_media_generator_package_template_get(jsonb),
  app_private.api_social_media_generator_package_template_create(jsonb),
  app_private.api_social_media_generator_package_template_draft_begin(jsonb),
  app_private.api_social_media_generator_package_template_draft_save(jsonb),
  app_private.api_social_media_generator_package_template_publish(jsonb),
  app_private.api_social_media_generator_package_template_favorite_set(jsonb),
  app_private.social_media_generator_media_package_json(uuid, uuid),
  app_private.api_social_media_generator_media_package_create(jsonb),
  app_private.api_social_media_generator_media_packages_list(),
  app_private.api_social_media_generator_media_package_get(jsonb),
  app_private.api_social_media_generator_media_package_data_save(jsonb),
  app_private.pd_api_current_actions_before_sm_packages_p2(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_packages_p2(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_packages_p2(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

commit;
