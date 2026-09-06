-- Plärrdeifl Portal V4
-- Liveticker R7: getrennte Strafentexte für Mighty Dogs und Gegner.

begin;

-- Der bisherige Strafentext wird zum Text für die Mighty Dogs. Der neue
-- Gegnertext wird anschließend identisch befüllt, sodass bestehende Ausgaben
-- nach der Migration unverändert bleiben.
alter table app_modules.liveticker_output_templates
  rename column penalty_template to own_penalty_template;

alter table app_modules.liveticker_output_templates
  rename constraint liveticker_output_templates_penalty_text_check
  to liveticker_output_templates_own_penalty_text_check;

alter table app_modules.liveticker_output_templates
  add column opponent_penalty_template text;

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
  v_allowed_variables text[];
  v_variables text[] := '{}'::text[];
  v_unknown text[] := '{}'::text[];
  v_missing text[] := '{}'::text[];
  v_without_valid_tokens text;
begin
  if 'penalties' = any(p_required_variables) then
    v_allowed_variables := array[
      'minute', 'opponent_name', 'player_name', 'jersey_number', 'player',
      'penalty_duration', 'penalty_reason', 'team_name', 'penalty_line',
      'penalties'
    ];
  elsif 'opponent_name' = any(p_required_variables) then
    v_allowed_variables := array[
      'minute', 'scorer', 'assists', 'mighty_score', 'opponent_score',
      'opponent_name'
    ];
  else
    v_allowed_variables := array[
      'minute', 'scorer', 'assists', 'mighty_score', 'opponent_score'
    ];
  end if;

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
    '\{\{(minute|scorer|assists|mighty_score|opponent_score|opponent_name|player_name|jersey_number|player|penalty_duration|penalty_reason|team_name|penalty_line|penalties)\}\}',
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
    new.own_penalty_template,
    array['minute', 'penalties']
  );
  perform app_private.liveticker_validate_output_template(
    new.opponent_goal_template,
    array['minute', 'mighty_score', 'opponent_score', 'opponent_name']
  );
  perform app_private.liveticker_validate_output_template(
    new.opponent_penalty_template,
    array['minute', 'penalties']
  );
  return new;
end;
$$;

-- Der vorhandene BEFORE-Trigger ruft bereits diese Validator-Funktion auf.
-- Deshalb müssen Validator und Row-Trigger nach dem Spalten-Rename, aber vor
-- dem Backfill auf die neuen Feldnamen zeigen.
update app_modules.liveticker_output_templates
set opponent_penalty_template = own_penalty_template;

alter table app_modules.liveticker_output_templates
  alter column opponent_penalty_template set not null,
  add constraint liveticker_output_templates_opponent_penalty_text_check
    check (char_length(opponent_penalty_template) between 1 and 4000);

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
        'ownPenaltyTemplate', template.own_penalty_template,
        'opponentGoalTemplate', template.opponent_goal_template,
        'opponentPenaltyTemplate', template.opponent_penalty_template,
        -- Kompatibilitätsalias für eine laufende ältere DEV-Runtime.
        'penaltyTemplate', template.own_penalty_template,
        'revision', template.revision
      )
      order by template.sort_order
    ), '[]'::jsonb),
    'variables', jsonb_build_array(
      jsonb_build_object('key', 'minute', 'label', 'Spielminute', 'optional', false, 'contexts', jsonb_build_array('own', 'ownPenalty', 'opponent', 'opponentPenalty')),
      jsonb_build_object('key', 'scorer', 'label', 'Torschütze (mit Trikotnummer)', 'optional', true, 'contexts', jsonb_build_array('own', 'opponent')),
      jsonb_build_object('key', 'assists', 'label', 'Assists (mit Trikotnummern)', 'optional', true, 'contexts', jsonb_build_array('own', 'opponent')),
      jsonb_build_object('key', 'mighty_score', 'label', 'Tore Mighty Dogs', 'optional', false, 'contexts', jsonb_build_array('own', 'opponent')),
      jsonb_build_object('key', 'opponent_score', 'label', 'Tore Gegner', 'optional', false, 'contexts', jsonb_build_array('own', 'opponent')),
      jsonb_build_object('key', 'opponent_name', 'label', 'Kurzname Gegner', 'optional', true, 'contexts', jsonb_build_array('opponent', 'ownPenalty', 'opponentPenalty')),
      jsonb_build_object('key', 'player_name', 'label', 'Spielername · nur bei einer Strafzeile', 'optional', true, 'contexts', jsonb_build_array('ownPenalty', 'opponentPenalty')),
      jsonb_build_object('key', 'jersey_number', 'label', 'Trikotnummer · nur bei einer Strafzeile', 'optional', true, 'contexts', jsonb_build_array('ownPenalty', 'opponentPenalty')),
      jsonb_build_object('key', 'player', 'label', 'Spieler mit Trikotnummer · nur bei einer Strafzeile', 'optional', true, 'contexts', jsonb_build_array('ownPenalty', 'opponentPenalty')),
      jsonb_build_object('key', 'penalty_duration', 'label', 'Strafdauer · nur bei einer Strafzeile', 'optional', true, 'contexts', jsonb_build_array('ownPenalty', 'opponentPenalty')),
      jsonb_build_object('key', 'penalty_reason', 'label', 'Strafgrund · nur bei einer Strafzeile', 'optional', true, 'contexts', jsonb_build_array('ownPenalty', 'opponentPenalty')),
      jsonb_build_object('key', 'team_name', 'label', 'Betroffenes Team', 'optional', true, 'contexts', jsonb_build_array('ownPenalty', 'opponentPenalty')),
      jsonb_build_object('key', 'penalty_line', 'label', 'Vollständige Strafzeile · nur bei einer Strafzeile', 'optional', true, 'contexts', jsonb_build_array('ownPenalty', 'opponentPenalty')),
      jsonb_build_object('key', 'penalties', 'label', 'Alle formatierten Strafzeilen', 'optional', false, 'contexts', jsonb_build_array('ownPenalty', 'opponentPenalty'))
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
  v_own_goal_template text;
  v_own_penalty_template text;
  v_opponent_goal_template text;
  v_opponent_penalty_template text;
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

  v_own_goal_template := v_existing.own_goal_template;
  v_own_penalty_template := v_existing.own_penalty_template;
  v_opponent_goal_template := v_existing.opponent_goal_template;
  v_opponent_penalty_template := v_existing.opponent_penalty_template;

  case v_context
    when 'own' then
      v_own_goal_template := coalesce(p_payload ->> 'ownGoalTemplate', '');
    when 'own_penalty' then
      v_own_penalty_template := coalesce(p_payload ->> 'ownPenaltyTemplate', '');
    when 'opponent' then
      v_opponent_goal_template := coalesce(p_payload ->> 'opponentGoalTemplate', '');
    when 'opponent_penalty' then
      v_opponent_penalty_template := coalesce(p_payload ->> 'opponentPenaltyTemplate', '');
    when 'penalty' then
      -- Übergangspfad für den bisherigen Editor: ein gespeicherter Text gilt
      -- weiterhin für beide Seiten und verliert dadurch keine Information.
      v_own_penalty_template := coalesce(p_payload ->> 'penaltyTemplate', '');
      v_opponent_penalty_template := v_own_penalty_template;
    when 'legacy' then
      v_own_goal_template := coalesce(p_payload ->> 'ownGoalTemplate', '');
      v_opponent_goal_template := coalesce(p_payload ->> 'opponentGoalTemplate', '');
    else
      raise exception 'Unbekannter Ausgabe-Kontext.' using errcode = '22023';
  end case;

  perform app_private.liveticker_validate_output_template(
    v_own_goal_template,
    array['minute', 'mighty_score', 'opponent_score']
  );
  perform app_private.liveticker_validate_output_template(
    v_own_penalty_template,
    array['minute', 'penalties']
  );
  perform app_private.liveticker_validate_output_template(
    v_opponent_goal_template,
    array['minute', 'mighty_score', 'opponent_score', 'opponent_name']
  );
  perform app_private.liveticker_validate_output_template(
    v_opponent_penalty_template,
    array['minute', 'penalties']
  );

  v_before := to_jsonb(v_existing);

  update app_modules.liveticker_output_templates
  set title = v_title,
      own_goal_template = v_own_goal_template,
      own_penalty_template = v_own_penalty_template,
      opponent_goal_template = v_opponent_goal_template,
      opponent_penalty_template = v_opponent_penalty_template,
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
