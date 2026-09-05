-- Plärrdeifl Portal V4
-- Liveticker R5: editierbare Ausgabevarianten mit festen technischen Keys.

create table app_modules.liveticker_output_templates (
  template_key text primary key,
  title text not null,
  own_goal_template text not null,
  opponent_goal_template text not null,
  sort_order integer not null,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null,
  constraint liveticker_output_templates_key_check
    check (template_key ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint liveticker_output_templates_title_check
    check (char_length(btrim(title)) between 1 and 60),
  constraint liveticker_output_templates_own_text_check
    check (char_length(own_goal_template) between 1 and 4000),
  constraint liveticker_output_templates_opponent_text_check
    check (char_length(opponent_goal_template) between 1 and 4000),
  constraint liveticker_output_templates_sort_check check (sort_order > 0),
  constraint liveticker_output_templates_revision_check check (revision > 0),
  constraint liveticker_output_templates_sort_unique unique (sort_order)
);

alter table app_modules.liveticker_output_templates enable row level security;
revoke all on table app_modules.liveticker_output_templates from public, anon, authenticated;

create function app_private.liveticker_validate_output_template(
  p_template text,
  p_required_variables text[]
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_allowed_variables constant text[] := array[
    'minute', 'scorer', 'assists', 'mighty_score', 'opponent_score', 'opponent_name'
  ];
  v_variables text[] := '{}'::text[];
  v_unknown text[] := '{}'::text[];
  v_missing text[] := '{}'::text[];
  v_without_valid_tokens text;
begin
  if p_template is null or char_length(btrim(p_template)) = 0 or char_length(p_template) > 4000 then
    raise exception 'Ausgabetext ist erforderlich und darf maximal 4.000 Zeichen haben.'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct btrim((token.match)[1])), '{}'::text[])
  into v_variables
  from regexp_matches(p_template, '\{\{([^{}]+)\}\}', 'g') as token(match);

  select coalesce(array_agg(variable order by variable), '{}'::text[])
  into v_unknown
  from unnest(v_variables) as variable
  where not variable = any(v_allowed_variables);

  if cardinality(v_unknown) > 0 then
    raise exception 'Unbekannte Platzhalter: %.', array_to_string(v_unknown, ', ')
      using errcode = '22023';
  end if;

  v_without_valid_tokens := regexp_replace(
    p_template,
    '\{\{(minute|scorer|assists|mighty_score|opponent_score|opponent_name)\}\}',
    '',
    'g'
  );

  if v_without_valid_tokens ~ '\{\{|\}\}' then
    raise exception 'Ausgabetext enthält einen technisch ungültigen Platzhalter.'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(required_variable order by required_variable), '{}'::text[])
  into v_missing
  from unnest(p_required_variables) as required_variable
  where not required_variable = any(v_variables);

  if cardinality(v_missing) > 0 then
    raise exception 'Pflichtplatzhalter fehlen: %.', array_to_string(v_missing, ', ')
      using errcode = '22023';
  end if;
end;
$$;

create function app_private.liveticker_output_templates_validate_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.template_key is distinct from old.template_key then
    raise exception 'Technischer Varianten-Key darf nicht geändert werden.'
      using errcode = '22023';
  end if;

  perform app_private.liveticker_validate_output_template(
    new.own_goal_template,
    array['minute', 'mighty_score', 'opponent_score']
  );
  perform app_private.liveticker_validate_output_template(
    new.opponent_goal_template,
    array['minute', 'mighty_score', 'opponent_score', 'opponent_name']
  );
  return new;
end;
$$;

create trigger liveticker_output_templates_validate_r1
before insert or update
on app_modules.liveticker_output_templates
for each row execute function app_private.liveticker_output_templates_validate_row();

create function app_private.liveticker_output_templates_json()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'templates',
    coalesce(jsonb_agg(
      jsonb_build_object(
        'key', template.template_key,
        'title', template.title,
        'ownGoalTemplate', template.own_goal_template,
        'opponentGoalTemplate', template.opponent_goal_template,
        'revision', template.revision
      )
      order by template.sort_order
    ), '[]'::jsonb),
    'variables', jsonb_build_array(
      jsonb_build_object('key', 'minute', 'label', 'Spielminute', 'optional', false, 'contexts', jsonb_build_array('own', 'opponent')),
      jsonb_build_object('key', 'scorer', 'label', 'Torschütze (mit Trikotnummer)', 'optional', true, 'contexts', jsonb_build_array('own', 'opponent')),
      jsonb_build_object('key', 'assists', 'label', 'Assists (mit Trikotnummern)', 'optional', true, 'contexts', jsonb_build_array('own', 'opponent')),
      jsonb_build_object('key', 'mighty_score', 'label', 'Tore Mighty Dogs', 'optional', false, 'contexts', jsonb_build_array('own', 'opponent')),
      jsonb_build_object('key', 'opponent_score', 'label', 'Tore Gegner', 'optional', false, 'contexts', jsonb_build_array('own', 'opponent')),
      jsonb_build_object('key', 'opponent_name', 'label', 'Kurzname Gegner', 'optional', false, 'contexts', jsonb_build_array('opponent'))
    )
  )
  from app_modules.liveticker_output_templates as template;
$$;

create function app_private.api_liveticker_output_templates_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('liveticker.manage');
begin
  return app_private.liveticker_output_templates_json();
end;
$$;

create function app_private.api_liveticker_output_template_save(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('liveticker.manage');
  v_key text := btrim(coalesce(p_payload ->> 'key', ''));
  v_title text := btrim(coalesce(p_payload ->> 'title', ''));
  v_own_template text := coalesce(p_payload ->> 'ownGoalTemplate', '');
  v_opponent_template text := coalesce(p_payload ->> 'opponentGoalTemplate', '');
  v_expected_revision integer := nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  v_existing app_modules.liveticker_output_templates%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if v_title = '' or char_length(v_title) > 60 then
    raise exception 'Variantentitel ist erforderlich und darf maximal 60 Zeichen haben.'
      using errcode = '22023';
  end if;

  perform app_private.liveticker_validate_output_template(
    v_own_template,
    array['minute', 'mighty_score', 'opponent_score']
  );
  perform app_private.liveticker_validate_output_template(
    v_opponent_template,
    array['minute', 'mighty_score', 'opponent_score', 'opponent_name']
  );

  select * into v_existing
  from app_modules.liveticker_output_templates
  where template_key = v_key
  for update;

  if not found then
    raise exception 'Unbekannter technischer Varianten-Key.' using errcode = 'P0002';
  end if;
  if v_expected_revision is null or v_expected_revision <> v_existing.revision then
    raise exception 'Die Ausgabevariante wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  v_before := to_jsonb(v_existing);

  update app_modules.liveticker_output_templates
  set title = v_title,
      own_goal_template = v_own_template,
      opponent_goal_template = v_opponent_template,
      revision = revision + 1,
      updated_at = now(),
      updated_by = v_actor
  where template_key = v_key;

  select to_jsonb(template) into v_after
  from app_modules.liveticker_output_templates as template
  where template.template_key = v_key;

  perform app_private.log_audit(
    v_actor,
    'LIVETICKER_OUTPUT_TEMPLATE_UPDATED',
    'liveticker_output_template',
    v_key,
    v_before,
    v_after,
    '{}'::jsonb
  );

  return app_private.liveticker_output_templates_json();
end;
$$;

create function public.pd_public_liveticker_templates()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app_private.liveticker_require_public_dev();
  return app_private.liveticker_output_templates_json();
end;
$$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_liveticker_output_templates_r1;

create or replace function app_private.pd_api_dispatch_current(p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
begin
  case v_action
    when 'liveticker_output_templates_list' then return app_private.api_liveticker_output_templates_list();
    when 'liveticker_output_template_save' then return app_private.api_liveticker_output_template_save(coalesce(p_payload, '{}'::jsonb));
    else return app_private.pd_api_dispatch_current_before_liveticker_output_templates_r1(p_action, p_payload);
  end case;
end;
$$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_lt_templates_r1;

create or replace function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $$
  select case lower(btrim(coalesce(p_action, '')))
    when 'liveticker_output_templates_list' then 'READ'
    when 'liveticker_output_template_save' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_lt_templates_r1(p_action)
  end;
$$;

insert into app_modules.liveticker_output_templates (
  template_key, title, own_goal_template, opponent_goal_template, sort_order
) values
  (
    'classic',
    'Klassisch',
    $classic_own${{minute}} Spielminute
*Tooooooor für unsere Schweinfurter Mighty Dogs*

Torschütze: {{scorer}}
Assists: {{assists}}

Neuer Spielstand
*{{mighty_score}}:{{opponent_score}}*$classic_own$,
    $classic_opponent${{minute}} Spielminute
Tor {{opponent_name}}
{{scorer}}
Assists: {{assists}}

Neuer Spielstand
*{{mighty_score}}:{{opponent_score}}*$classic_opponent$,
    10
  ),
  (
    'emotional',
    'Emotional',
    $emotional_own${{minute}} Spielminute
🔥 *TOOOOOOOR MIGHTY DOGS!* 🔥

{{scorer}}
Assists: {{assists}}

Neuer Spielstand
*{{mighty_score}}:{{opponent_score}}*$emotional_own$,
    $emotional_opponent${{minute}} Spielminute
Tor {{opponent_name}}
{{scorer}}
Assists: {{assists}}

Neuer Spielstand
*{{mighty_score}}:{{opponent_score}}*$emotional_opponent$,
    20
  ),
  (
    'short',
    'Kurz',
    $short_own${{minute}} Spielminute
*TOOOOOR SCHWEINFURT!*
{{scorer}}
Assists: {{assists}}

*{{mighty_score}}:{{opponent_score}}*$short_own$,
    $short_opponent${{minute}} Spielminute
Tor {{opponent_name}}
{{scorer}}
Assists: {{assists}}

*{{mighty_score}}:{{opponent_score}}*$short_opponent$,
    30
  );

revoke all on function app_private.liveticker_validate_output_template(text, text[]) from public, anon, authenticated;
revoke all on function app_private.liveticker_output_templates_validate_row() from public, anon, authenticated;
revoke all on function app_private.liveticker_output_templates_json() from public, anon, authenticated;
revoke all on function app_private.api_liveticker_output_templates_list() from public, anon, authenticated;
revoke all on function app_private.api_liveticker_output_template_save(jsonb) from public, anon, authenticated;
revoke all on function app_private.pd_api_dispatch_current(text, jsonb) from public, anon, authenticated;
revoke all on function app_private.pd_api_dispatch_current_before_liveticker_output_templates_r1(text, jsonb) from public, anon, authenticated;
revoke all on function public.pd_public_liveticker_templates() from public, anon, authenticated;
grant execute on function public.pd_public_liveticker_templates() to anon, authenticated;
