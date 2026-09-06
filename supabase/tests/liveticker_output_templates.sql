\set ON_ERROR_STOP on

begin;

update app_portal.settings
set value = value || jsonb_build_object('environment', 'DEV')
where key = 'platform.mode';

set local role anon;

do $liveticker_public_runtime$
begin
  if jsonb_array_length(public.pd_public_liveticker_templates() -> 'templates') <> 3 then
    raise exception 'Öffentliche DEV-Runtime liefert nicht die drei gespeicherten Ausgabevarianten.';
  end if;
end
$liveticker_public_runtime$;

reset role;

do $liveticker_output_templates$
declare
  v_manager uuid := '00000000-0000-4906-8000-000000000001';
  v_without_right uuid := '00000000-0000-4906-8000-000000000002';
  v_role uuid := '00000000-0000-4906-8000-000000000101';
  v_before jsonb;
  v_saved jsonb;
  v_revision integer;
  v_opponent_before text;
  v_own_penalty_before text;
  v_opponent_penalty_before text;
begin
  if not (
    select relrowsecurity
    from pg_class
    where oid = 'app_modules.liveticker_output_templates'::regclass
  ) then
    raise exception 'RLS fehlt auf liveticker_output_templates.';
  end if;

  if has_table_privilege('anon', 'app_modules.liveticker_output_templates', 'SELECT')
     or has_table_privilege('authenticated', 'app_modules.liveticker_output_templates', 'SELECT')
     or has_table_privilege('authenticated', 'app_modules.liveticker_output_templates', 'UPDATE') then
    raise exception 'Browserrollen besitzen direkten Tabellenzugriff auf Ausgabevarianten.';
  end if;

  if not has_function_privilege('anon', 'public.pd_public_liveticker_templates()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.pd_public_liveticker_templates()', 'EXECUTE') then
    raise exception 'Öffentliche Runtime-Lesegrenze fehlt.';
  end if;

  insert into auth.users (id, email)
  values
    (v_manager, 'liveticker-template-manager@example.invalid'),
    (v_without_right, 'liveticker-template-no-right@example.invalid');

  insert into app_portal.portal_roles (id, code, name, is_active, sort_order)
  values (v_role, 'LIVETICKER_TEMPLATE_TEST', 'Liveticker Template Test', true, 990);

  insert into app_portal.role_capabilities (role_id, capability_code)
  values (v_role, 'liveticker.manage');

  insert into app_portal.users (
    id, user_code, email, first_name, last_name, status, role_id
  ) values
    (v_manager, 'U-LT-TEMPLATE-1', 'liveticker-template-manager@example.invalid', 'Template', 'Manager', 'ACTIVE', v_role),
    (v_without_right, 'U-LT-TEMPLATE-2', 'liveticker-template-no-right@example.invalid', 'Ohne', 'Recht', 'ACTIVE', '00000000-0000-4000-8000-000000000003');

  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_manager, 'role', 'authenticated')::text,
    true
  );

  v_before := app_private.api_liveticker_output_templates_list();
  if exists (
    select 1
    from jsonb_array_elements(v_before -> 'variables') as variable_entry(item)
    where (
      (variable_entry.item -> 'contexts') ? 'ownPenalty'
      or (variable_entry.item -> 'contexts') ? 'opponentPenalty'
    )
      and variable_entry.item ->> 'key' not in ('minute', 'penalties')
      and not (variable_entry.item ->> 'optional')::boolean
  ) then
    raise exception 'Optionale Strafvariablen werden fälschlich als Pflichtvariablen ausgeliefert.';
  end if;

  select
    (template_entry.item ->> 'revision')::integer,
    template_entry.item ->> 'opponentGoalTemplate',
    template_entry.item ->> 'ownPenaltyTemplate',
    template_entry.item ->> 'opponentPenaltyTemplate'
  into v_revision, v_opponent_before, v_own_penalty_before, v_opponent_penalty_before
  from jsonb_array_elements(v_before -> 'templates') as template_entry(item)
  where template_entry.item ->> 'key' = 'classic';

  v_saved := app_private.api_liveticker_output_template_save(jsonb_build_object(
    'key', 'classic',
    'context', 'own',
    'title', 'Persistierter Titel',
    'ownGoalTemplate', E' CUSTOM {{minute}}\n{{scorer}}\n{{mighty_score}}:{{opponent_score}}\n',
    'expectedRevision', v_revision
  ));

  if not exists (
    select 1
    from jsonb_array_elements(v_saved -> 'templates') as template_entry(item)
    where template_entry.item ->> 'key' = 'classic'
      and template_entry.item ->> 'title' = 'Persistierter Titel'
      and template_entry.item ->> 'ownGoalTemplate' = E' CUSTOM {{minute}}\n{{scorer}}\n{{mighty_score}}:{{opponent_score}}\n'
      and template_entry.item ->> 'opponentGoalTemplate' = v_opponent_before
      and template_entry.item ->> 'ownPenaltyTemplate' = v_own_penalty_before
      and template_entry.item ->> 'opponentPenaltyTemplate' = v_opponent_penalty_before
      and (template_entry.item ->> 'revision')::integer = v_revision + 1
  ) then
    raise exception 'Titel/Text wurden nicht revisionssicher persistiert: %', v_saved;
  end if;

  v_saved := app_private.api_liveticker_output_template_save(jsonb_build_object(
    'key', 'classic',
    'context', 'own_penalty',
    'title', 'Persistierter Titel',
    'ownPenaltyTemplate', E'WIR {{minute}} {{player}}\n{{penalties}}\n ',
    'expectedRevision', v_revision + 1
  ));

  if not exists (
    select 1
    from jsonb_array_elements(v_saved -> 'templates') as template_entry(item)
    where template_entry.item ->> 'key' = 'classic'
      and template_entry.item ->> 'ownPenaltyTemplate' = E'WIR {{minute}} {{player}}\n{{penalties}}\n '
      and template_entry.item ->> 'opponentPenaltyTemplate' = v_opponent_penalty_before
      and (template_entry.item ->> 'revision')::integer = v_revision + 2
  ) then
    raise exception 'Eigener Strafentext wurde nicht getrennt persistiert: %', v_saved;
  end if;

  v_saved := app_private.api_liveticker_output_template_save(jsonb_build_object(
    'key', 'classic',
    'context', 'opponent_penalty',
    'title', 'Persistierter Titel',
    'opponentPenaltyTemplate', E'DIE ANDEREN {{minute}} {{opponent_name}}\n{{penalties}}\n ',
    'expectedRevision', v_revision + 2
  ));

  if not exists (
    select 1
    from jsonb_array_elements(v_saved -> 'templates') as template_entry(item)
    where template_entry.item ->> 'key' = 'classic'
      and template_entry.item ->> 'ownPenaltyTemplate' = E'WIR {{minute}} {{player}}\n{{penalties}}\n '
      and template_entry.item ->> 'opponentPenaltyTemplate' = E'DIE ANDEREN {{minute}} {{opponent_name}}\n{{penalties}}\n '
      and (template_entry.item ->> 'revision')::integer = v_revision + 3
  ) then
    raise exception 'Gegnerischer Strafentext wurde nicht getrennt persistiert: %', v_saved;
  end if;

  v_saved := app_private.api_liveticker_output_template_save(jsonb_build_object(
    'key', 'classic',
    'context', 'opponent',
    'title', 'Persistierter Titel',
    'opponentGoalTemplate', E'CUSTOM {{minute}} Tor {{opponent_name}}\n{{mighty_score}}:{{opponent_score}}\n ',
    'expectedRevision', v_revision + 3
  ));

  if not exists (
    select 1
    from jsonb_array_elements(v_saved -> 'templates') as template_entry(item)
    where template_entry.item ->> 'key' = 'classic'
      and template_entry.item ->> 'ownGoalTemplate' = E' CUSTOM {{minute}}\n{{scorer}}\n{{mighty_score}}:{{opponent_score}}\n'
      and template_entry.item ->> 'ownPenaltyTemplate' = E'WIR {{minute}} {{player}}\n{{penalties}}\n '
      and template_entry.item ->> 'opponentPenaltyTemplate' = E'DIE ANDEREN {{minute}} {{opponent_name}}\n{{penalties}}\n '
      and template_entry.item ->> 'opponentGoalTemplate' = E'CUSTOM {{minute}} Tor {{opponent_name}}\n{{mighty_score}}:{{opponent_score}}\n '
      and (template_entry.item ->> 'revision')::integer = v_revision + 4
  ) then
    raise exception 'Gegnertor-Text oder andere Kontexte wurden nicht revisionssicher persistiert: %', v_saved;
  end if;

  begin
    perform app_private.api_liveticker_output_template_save(jsonb_build_object(
      'key', 'classic',
      'context', 'own_penalty',
      'title', 'Unbekannt',
      'ownPenaltyTemplate', '{{minute}} {{penalties}} {{unknown}}',
      'expectedRevision', v_revision + 4
    ));
    raise exception 'Unbekannter Platzhalter wurde gespeichert.';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    perform app_private.api_liveticker_output_template_save(jsonb_build_object(
      'key', 'classic',
      'context', 'opponent_penalty',
      'title', 'Fehlend',
      'opponentPenaltyTemplate', '{{minute}} ohne Strafzeilen',
      'expectedRevision', v_revision + 4
    ));
    raise exception 'Fehlender Pflichtplatzhalter wurde gespeichert.';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    update app_modules.liveticker_output_templates
    set template_key = 'classic_changed'
    where template_key = 'classic';
    raise exception 'Technischer Varianten-Key wurde geändert.';
  exception
    when sqlstate '22023' then null;
  end;

  perform set_config('request.jwt.claim.sub', v_without_right::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_without_right, 'role', 'authenticated')::text,
    true
  );

  begin
    perform app_private.api_liveticker_output_templates_list();
    raise exception 'Benutzer ohne liveticker.manage durfte Vorlagen lesen.';
  exception
    when sqlstate '42501' then null;
  end;
end
$liveticker_output_templates$;

rollback;
