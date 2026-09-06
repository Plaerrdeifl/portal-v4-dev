-- Plärrdeifl Portal V4
-- Liveticker R6: Strafenausgaben in die vorhandenen Ausgabeoptionen integrieren.

begin;

alter table app_modules.liveticker_output_templates
  add column penalty_template text;

-- Alle vorhandenen technischen Varianten erhalten zunächst exakt die bisherige
-- Strafenausgabe. Die Auswahl bleibt damit rückwärtskompatibel.
update app_modules.liveticker_output_templates
set penalty_template = $penalty${{minute}} Spielminute
Strafe(n)

{{penalties}}$penalty$;

alter table app_modules.liveticker_output_templates
  alter column penalty_template set not null,
  add constraint liveticker_output_templates_penalty_text_check
    check (char_length(penalty_template) between 1 and 4000);

create or replace function app_private.liveticker_validate_output_template(
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
    'minute', 'scorer', 'assists', 'mighty_score', 'opponent_score',
    'opponent_name', 'penalties'
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
    '\{\{(minute|scorer|assists|mighty_score|opponent_score|opponent_name|penalties)\}\}',
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

create or replace function app_private.liveticker_output_templates_validate_row()
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
  perform app_private.liveticker_validate_output_template(
    new.penalty_template,
    array['minute', 'penalties']
  );
  return new;
end;
$$;

create or replace function app_private.liveticker_output_templates_json()
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
        'penaltyTemplate', template.penalty_template,
        'opponentGoalTemplate', template.opponent_goal_template,
        'revision', template.revision
      )
      order by template.sort_order
    ), '[]'::jsonb),
    'variables', jsonb_build_array(
      jsonb_build_object('key', 'minute', 'label', 'Spielminute', 'optional', false, 'contexts', jsonb_build_array('own', 'penalty', 'opponent')),
      jsonb_build_object('key', 'scorer', 'label', 'Torschütze (mit Trikotnummer)', 'optional', true, 'contexts', jsonb_build_array('own', 'opponent')),
      jsonb_build_object('key', 'assists', 'label', 'Assists (mit Trikotnummern)', 'optional', true, 'contexts', jsonb_build_array('own', 'opponent')),
      jsonb_build_object('key', 'mighty_score', 'label', 'Tore Mighty Dogs', 'optional', false, 'contexts', jsonb_build_array('own', 'opponent')),
      jsonb_build_object('key', 'opponent_score', 'label', 'Tore Gegner', 'optional', false, 'contexts', jsonb_build_array('own', 'opponent')),
      jsonb_build_object('key', 'opponent_name', 'label', 'Kurzname Gegner', 'optional', false, 'contexts', jsonb_build_array('opponent')),
      jsonb_build_object('key', 'penalties', 'label', 'Formatierte Strafzeilen', 'optional', false, 'contexts', jsonb_build_array('penalty'))
    )
  )
  from app_modules.liveticker_output_templates as template;
$$;

create or replace function app_private.api_liveticker_output_template_save(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('liveticker.manage');
  v_key text := btrim(coalesce(p_payload ->> 'key', ''));
  v_context text := lower(btrim(coalesce(p_payload ->> 'context', 'legacy')));
  v_title text := btrim(coalesce(p_payload ->> 'title', ''));
  v_expected_revision integer := nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  v_existing app_modules.liveticker_output_templates%rowtype;
  v_own_template text;
  v_penalty_template text;
  v_opponent_template text;
  v_before jsonb;
  v_after jsonb;
begin
  if v_title = '' or char_length(v_title) > 60 then
    raise exception 'Variantentitel ist erforderlich und darf maximal 60 Zeichen haben.'
      using errcode = '22023';
  end if;

  select * into v_existing
  from app_modules.liveticker_output_templates
  where template_key = v_key
  for update;

  if not found then
    raise exception 'Unbekannter technischer Varianten-Key.' using errcode = 'P0002';
  end if;
  if v_expected_revision is null or v_expected_revision <> v_existing.revision then
    raise exception 'Die Ausgabeoption wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  v_own_template := v_existing.own_goal_template;
  v_penalty_template := v_existing.penalty_template;
  v_opponent_template := v_existing.opponent_goal_template;

  case v_context
    when 'own' then
      v_own_template := coalesce(p_payload ->> 'ownGoalTemplate', '');
    when 'penalty' then
      v_penalty_template := coalesce(p_payload ->> 'penaltyTemplate', '');
    when 'opponent' then
      v_opponent_template := coalesce(p_payload ->> 'opponentGoalTemplate', '');
    when 'legacy' then
      v_own_template := coalesce(p_payload ->> 'ownGoalTemplate', '');
      v_opponent_template := coalesce(p_payload ->> 'opponentGoalTemplate', '');
    else
      raise exception 'Unbekannter Ausgabe-Kontext.' using errcode = '22023';
  end case;

  perform app_private.liveticker_validate_output_template(
    v_own_template,
    array['minute', 'mighty_score', 'opponent_score']
  );
  perform app_private.liveticker_validate_output_template(
    v_opponent_template,
    array['minute', 'mighty_score', 'opponent_score', 'opponent_name']
  );
  perform app_private.liveticker_validate_output_template(
    v_penalty_template,
    array['minute', 'penalties']
  );

  v_before := to_jsonb(v_existing);

  update app_modules.liveticker_output_templates
  set title = v_title,
      own_goal_template = v_own_template,
      penalty_template = v_penalty_template,
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
    jsonb_build_object('context', v_context)
  );

  return app_private.liveticker_output_templates_json();
end;
$$;

revoke all on function app_private.liveticker_validate_output_template(text, text[]) from public, anon, authenticated;
revoke all on function app_private.liveticker_output_templates_validate_row() from public, anon, authenticated;
revoke all on function app_private.liveticker_output_templates_json() from public, anon, authenticated;
revoke all on function app_private.api_liveticker_output_template_save(jsonb) from public, anon, authenticated;

commit;
