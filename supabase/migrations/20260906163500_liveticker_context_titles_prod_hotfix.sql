-- Plärrdeifl Portal V4 - PROD-only Liveticker hotfix
-- Separate visible option titles for all four output contexts without touching DEV or M340.
begin;

alter table app_modules.liveticker_output_templates
  add column own_goal_title text,
  add column own_penalty_title text,
  add column opponent_goal_title text,
  add column opponent_penalty_title text;

-- Preserve every currently edited PROD title as the initial title in all contexts.
update app_modules.liveticker_output_templates
set own_goal_title = title,
    own_penalty_title = title,
    opponent_goal_title = title,
    opponent_penalty_title = title;

alter table app_modules.liveticker_output_templates
  alter column own_goal_title set not null,
  alter column own_penalty_title set not null,
  alter column opponent_goal_title set not null,
  alter column opponent_penalty_title set not null,
  add constraint liveticker_output_templates_own_goal_title_check check (char_length(btrim(own_goal_title)) between 1 and 60),
  add constraint liveticker_output_templates_own_penalty_title_check check (char_length(btrim(own_penalty_title)) between 1 and 60),
  add constraint liveticker_output_templates_opponent_goal_title_check check (char_length(btrim(opponent_goal_title)) between 1 and 60),
  add constraint liveticker_output_templates_opponent_penalty_title_check check (char_length(btrim(opponent_penalty_title)) between 1 and 60);

create or replace function app_private.liveticker_output_templates_json()
returns jsonb language sql stable security definer set search_path=''
as $$ select jsonb_build_object('templates',coalesce(jsonb_agg(jsonb_build_object(
 'key',t.template_key,'title',t.title,
 'ownGoalTitle',t.own_goal_title,'ownPenaltyTitle',t.own_penalty_title,
 'opponentGoalTitle',t.opponent_goal_title,'opponentPenaltyTitle',t.opponent_penalty_title,
 'ownGoalTemplate',t.own_goal_template,'ownPenaltyTemplate',t.own_penalty_template,
 'opponentGoalTemplate',t.opponent_goal_template,'opponentPenaltyTemplate',t.opponent_penalty_template,'revision',t.revision) order by t.sort_order),'[]'::jsonb),
 'variables',jsonb_build_array(
 jsonb_build_object('key','minute','label','Spielminute','optional',false,'contexts',jsonb_build_array('own','ownPenalty','opponent','opponentPenalty')),
 jsonb_build_object('key','scorer','label','Torschütze (mit Trikotnummer)','optional',true,'contexts',jsonb_build_array('own','opponent')),
 jsonb_build_object('key','assists','label','Assists (mit Trikotnummern)','optional',true,'contexts',jsonb_build_array('own','opponent')),
 jsonb_build_object('key','mighty_score','label','Tore Mighty Dogs','optional',false,'contexts',jsonb_build_array('own','opponent')),
 jsonb_build_object('key','opponent_score','label','Tore Gegner','optional',false,'contexts',jsonb_build_array('own','opponent')),
 jsonb_build_object('key','opponent_name','label','Kurzname Gegner','optional',true,'contexts',jsonb_build_array('opponent','ownPenalty','opponentPenalty')),
 jsonb_build_object('key','player_name','label','Spielername · nur bei einer Strafzeile','optional',true,'contexts',jsonb_build_array('ownPenalty','opponentPenalty')),
 jsonb_build_object('key','jersey_number','label','Trikotnummer · nur bei einer Strafzeile','optional',true,'contexts',jsonb_build_array('ownPenalty','opponentPenalty')),
 jsonb_build_object('key','player','label','Spieler mit Trikotnummer · nur bei einer Strafzeile','optional',true,'contexts',jsonb_build_array('ownPenalty','opponentPenalty')),
 jsonb_build_object('key','penalty_duration','label','Strafdauer · nur bei einer Strafzeile','optional',true,'contexts',jsonb_build_array('ownPenalty','opponentPenalty')),
 jsonb_build_object('key','penalty_reason','label','Strafgrund · nur bei einer Strafzeile','optional',true,'contexts',jsonb_build_array('ownPenalty','opponentPenalty')),
 jsonb_build_object('key','team_name','label','Betroffenes Team','optional',true,'contexts',jsonb_build_array('ownPenalty','opponentPenalty')),
 jsonb_build_object('key','penalty_line','label','Vollständige Strafzeile · nur bei einer Strafzeile','optional',true,'contexts',jsonb_build_array('ownPenalty','opponentPenalty')),
 jsonb_build_object('key','penalties','label','Alle formatierten Strafzeilen','optional',false,'contexts',jsonb_build_array('ownPenalty','opponentPenalty'))))
 from app_modules.liveticker_output_templates t $$;

create or replace function app_private.api_liveticker_output_template_save(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare
 v_actor uuid:=app_private.liveticker_require_operator();
 v_key text:=btrim(coalesce(p_payload->>'key',''));
 v_context text:=lower(btrim(coalesce(p_payload->>'context','legacy')));
 v_context_title text:=btrim(coalesce(p_payload->>'title',''));
 v_expected_revision integer:=nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer;
 v_existing app_modules.liveticker_output_templates%rowtype;
 v_own_goal text; v_own_penalty text; v_opponent_goal text; v_opponent_penalty text;
 v_own_goal_title text; v_own_penalty_title text; v_opponent_goal_title text; v_opponent_penalty_title text;
 v_before jsonb; v_after jsonb;
begin
 if v_context_title='' or char_length(v_context_title)>60 then raise exception 'Variantentitel ist erforderlich und darf maximal 60 Zeichen haben.' using errcode='22023'; end if;
 select * into v_existing from app_modules.liveticker_output_templates where template_key=v_key for update;
 if not found then raise exception 'Unbekannter technischer Varianten-Key.' using errcode='P0002'; end if;
 if v_expected_revision is null or v_expected_revision<>v_existing.revision then raise exception 'Die Ausgabeoption wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001'; end if;
 v_own_goal:=v_existing.own_goal_template; v_own_penalty:=v_existing.own_penalty_template; v_opponent_goal:=v_existing.opponent_goal_template; v_opponent_penalty:=v_existing.opponent_penalty_template;
 v_own_goal_title:=v_existing.own_goal_title; v_own_penalty_title:=v_existing.own_penalty_title; v_opponent_goal_title:=v_existing.opponent_goal_title; v_opponent_penalty_title:=v_existing.opponent_penalty_title;
 case v_context
   when 'own' then v_own_goal:=coalesce(p_payload->>'ownGoalTemplate',''); v_own_goal_title:=v_context_title;
   when 'own_penalty' then v_own_penalty:=coalesce(p_payload->>'ownPenaltyTemplate',''); v_own_penalty_title:=v_context_title;
   when 'opponent' then v_opponent_goal:=coalesce(p_payload->>'opponentGoalTemplate',''); v_opponent_goal_title:=v_context_title;
   when 'opponent_penalty' then v_opponent_penalty:=coalesce(p_payload->>'opponentPenaltyTemplate',''); v_opponent_penalty_title:=v_context_title;
   else raise exception 'Unbekannter Ausgabe-Kontext.' using errcode='22023';
 end case;
 perform app_private.liveticker_validate_output_template(v_own_goal,array['minute','mighty_score','opponent_score']);
 perform app_private.liveticker_validate_output_template(v_own_penalty,array['minute','penalties']);
 perform app_private.liveticker_validate_output_template(v_opponent_goal,array['minute','mighty_score','opponent_score','opponent_name']);
 perform app_private.liveticker_validate_output_template(v_opponent_penalty,array['minute','penalties']);
 v_before:=to_jsonb(v_existing);
 update app_modules.liveticker_output_templates
 set own_goal_title=v_own_goal_title,
     own_penalty_title=v_own_penalty_title,
     opponent_goal_title=v_opponent_goal_title,
     opponent_penalty_title=v_opponent_penalty_title,
     own_goal_template=v_own_goal,
     own_penalty_template=v_own_penalty,
     opponent_goal_template=v_opponent_goal,
     opponent_penalty_template=v_opponent_penalty,
     revision=revision+1, updated_at=now(), updated_by=v_actor
 where template_key=v_key;
 select to_jsonb(t) into v_after from app_modules.liveticker_output_templates t where t.template_key=v_key;
 perform app_private.log_audit(v_actor,'LIVETICKER_OUTPUT_TEMPLATE_UPDATED','liveticker_output_template',v_key,v_before,v_after,jsonb_build_object('context',v_context));
 return app_private.liveticker_output_templates_json();
end $$;

revoke all on function app_private.liveticker_output_templates_json() from public,anon,authenticated;
revoke all on function app_private.api_liveticker_output_template_save(jsonb) from public,anon,authenticated;

commit;
