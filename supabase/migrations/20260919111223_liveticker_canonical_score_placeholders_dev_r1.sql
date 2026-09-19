-- DEV: accept canonical home/away score placeholders while keeping legacy templates compatible.

create or replace function app_private.liveticker_validate_output_template(
  p_template text,
  p_required_variables text[]
)
returns void
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_allowed_variables text[];
  v_variables text[] := '{}';
  v_unknown text[] := '{}';
  v_missing text[] := '{}';
  v_without_valid_tokens text;
  v_score_required boolean := false;
  v_score_valid boolean := false;
begin
  if 'penalties' = any(p_required_variables) then
    v_allowed_variables := array[
      'minute','opponent_name','player_name','jersey_number','player',
      'penalty_duration','penalty_reason','team_name','penalty_line','penalties'
    ];
  elsif 'opponent_name' = any(p_required_variables) then
    v_allowed_variables := array[
      'minute','scorer','assists','mighty_score','opponent_score',
      'home_score','away_score','score','opponent_name'
    ];
  else
    v_allowed_variables := array[
      'minute','scorer','assists','mighty_score','opponent_score',
      'home_score','away_score','score'
    ];
  end if;

  if p_template is null
     or char_length(btrim(p_template)) = 0
     or char_length(p_template) > 4000 then
    raise exception 'Ausgabetext ist erforderlich und darf maximal 4.000 Zeichen haben.'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct btrim((token.match)[1])), '{}'::text[])
    into v_variables
  from regexp_matches(p_template, '\{\{([^{}]+)\}\}', 'g') as token(match);

  select coalesce(array_agg(variable order by variable), '{}'::text[])
    into v_unknown
  from unnest(v_variables) variable
  where not variable = any(v_allowed_variables);

  if cardinality(v_unknown) > 0 then
    raise exception 'Unbekannte Platzhalter: %.', array_to_string(v_unknown, ', ')
      using errcode = '22023';
  end if;

  v_without_valid_tokens := regexp_replace(
    p_template,
    '\{\{(minute|scorer|assists|mighty_score|opponent_score|home_score|away_score|score|opponent_name|player_name|jersey_number|player|penalty_duration|penalty_reason|team_name|penalty_line|penalties)\}\}',
    '',
    'g'
  );

  if v_without_valid_tokens ~ '\{\{|\}\}' then
    raise exception 'Ausgabetext enthält einen technisch ungültigen Platzhalter.'
      using errcode = '22023';
  end if;

  v_score_required :=
    'mighty_score' = any(p_required_variables)
    and 'opponent_score' = any(p_required_variables);

  select coalesce(array_agg(required_variable order by required_variable), '{}'::text[])
    into v_missing
  from unnest(p_required_variables) required_variable
  where not (
      v_score_required
      and required_variable = any(array['mighty_score','opponent_score'])
    )
    and not required_variable = any(v_variables);

  if cardinality(v_missing) > 0 then
    raise exception 'Pflichtplatzhalter fehlen: %.', array_to_string(v_missing, ', ')
      using errcode = '22023';
  end if;

  if v_score_required then
    v_score_valid :=
      'score' = any(v_variables)
      or (
        'home_score' = any(v_variables)
        and 'away_score' = any(v_variables)
      )
      or (
        'mighty_score' = any(v_variables)
        and 'opponent_score' = any(v_variables)
      );

    if not v_score_valid then
      raise exception 'Spielstand-Platzhalter fehlt: verwende {{score}}, {{home_score}} + {{away_score}} oder die bisherigen Team-Platzhalter.'
        using errcode = '22023';
    end if;
  end if;
end
$function$;
