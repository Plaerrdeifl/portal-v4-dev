-- Plärrdeifl Portal V4 - Liveticker output templates PROD R1
-- Authenticated-only runtime. All reads/writes require liveticker.manage.
begin;

create table app_modules.liveticker_output_templates (
  template_key text primary key,
  title text not null,
  own_goal_template text not null,
  own_penalty_template text not null,
  opponent_goal_template text not null,
  opponent_penalty_template text not null,
  sort_order integer not null,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null,
  constraint liveticker_output_templates_key_check check (template_key ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint liveticker_output_templates_title_check check (char_length(btrim(title)) between 1 and 60),
  constraint liveticker_output_templates_own_text_check check (char_length(own_goal_template) between 1 and 4000),
  constraint liveticker_output_templates_own_penalty_text_check check (char_length(own_penalty_template) between 1 and 4000),
  constraint liveticker_output_templates_opponent_text_check check (char_length(opponent_goal_template) between 1 and 4000),
  constraint liveticker_output_templates_opponent_penalty_text_check check (char_length(opponent_penalty_template) between 1 and 4000),
  constraint liveticker_output_templates_sort_check check (sort_order > 0),
  constraint liveticker_output_templates_revision_check check (revision > 0),
  constraint liveticker_output_templates_sort_unique unique (sort_order)
);
alter table app_modules.liveticker_output_templates enable row level security;
revoke all on table app_modules.liveticker_output_templates from public, anon, authenticated;

create function app_private.liveticker_validate_output_template(p_template text,p_required_variables text[])
returns void language plpgsql immutable set search_path=''
as $$
declare v_allowed_variables text[]; v_variables text[]:='{}'; v_unknown text[]:='{}'; v_missing text[]:='{}'; v_without_valid_tokens text;
begin
 if 'penalties'=any(p_required_variables) then v_allowed_variables:=array['minute','opponent_name','player_name','jersey_number','player','penalty_duration','penalty_reason','team_name','penalty_line','penalties'];
 elsif 'opponent_name'=any(p_required_variables) then v_allowed_variables:=array['minute','scorer','assists','mighty_score','opponent_score','opponent_name'];
 else v_allowed_variables:=array['minute','scorer','assists','mighty_score','opponent_score']; end if;
 if p_template is null or char_length(btrim(p_template))=0 or char_length(p_template)>4000 then raise exception 'Ausgabetext ist erforderlich und darf maximal 4.000 Zeichen haben.' using errcode='22023'; end if;
 select coalesce(array_agg(distinct btrim((token.match)[1])),'{}'::text[]) into v_variables from regexp_matches(p_template,'\{\{([^{}]+)\}\}','g') as token(match);
 select coalesce(array_agg(variable order by variable),'{}'::text[]) into v_unknown from unnest(v_variables) variable where not variable=any(v_allowed_variables);
 if cardinality(v_unknown)>0 then raise exception 'Unbekannte Platzhalter: %.',array_to_string(v_unknown,', ') using errcode='22023'; end if;
 v_without_valid_tokens:=regexp_replace(p_template,'\{\{(minute|scorer|assists|mighty_score|opponent_score|opponent_name|player_name|jersey_number|player|penalty_duration|penalty_reason|team_name|penalty_line|penalties)\}\}','','g');
 if v_without_valid_tokens ~ '\{\{|\}\}' then raise exception 'Ausgabetext enthält einen technisch ungültigen Platzhalter.' using errcode='22023'; end if;
 select coalesce(array_agg(required_variable order by required_variable),'{}'::text[]) into v_missing from unnest(p_required_variables) required_variable where not required_variable=any(v_variables);
 if cardinality(v_missing)>0 then raise exception 'Pflichtplatzhalter fehlen: %.',array_to_string(v_missing,', ') using errcode='22023'; end if;
end $$;

create function app_private.liveticker_output_templates_validate_row()
returns trigger language plpgsql set search_path=''
as $$ begin
 if tg_op='UPDATE' and new.template_key is distinct from old.template_key then raise exception 'Technischer Varianten-Key darf nicht geändert werden.' using errcode='22023'; end if;
 perform app_private.liveticker_validate_output_template(new.own_goal_template,array['minute','mighty_score','opponent_score']);
 perform app_private.liveticker_validate_output_template(new.own_penalty_template,array['minute','penalties']);
 perform app_private.liveticker_validate_output_template(new.opponent_goal_template,array['minute','mighty_score','opponent_score','opponent_name']);
 perform app_private.liveticker_validate_output_template(new.opponent_penalty_template,array['minute','penalties']);
 return new; end $$;
create trigger liveticker_output_templates_validate_r1 before insert or update on app_modules.liveticker_output_templates for each row execute function app_private.liveticker_output_templates_validate_row();

create function app_private.liveticker_output_templates_json()
returns jsonb language sql stable security definer set search_path=''
as $$ select jsonb_build_object('templates',coalesce(jsonb_agg(jsonb_build_object(
 'key',t.template_key,'title',t.title,'ownGoalTemplate',t.own_goal_template,'ownPenaltyTemplate',t.own_penalty_template,
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

create function app_private.api_liveticker_output_templates_list() returns jsonb language plpgsql stable security definer set search_path=''
as $$ begin perform app_private.liveticker_require_operator(); return app_private.liveticker_output_templates_json(); end $$;

create function app_private.api_liveticker_output_template_save(p_payload jsonb) returns jsonb language plpgsql security definer set search_path=''
as $$ declare
 v_actor uuid:=app_private.liveticker_require_operator(); v_key text:=btrim(coalesce(p_payload->>'key','')); v_context text:=lower(btrim(coalesce(p_payload->>'context','legacy'))); v_title text:=btrim(coalesce(p_payload->>'title','')); v_expected_revision integer:=nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer; v_existing app_modules.liveticker_output_templates%rowtype; v_own_goal text; v_own_penalty text; v_opponent_goal text; v_opponent_penalty text; v_before jsonb; v_after jsonb;
begin
 if v_title='' or char_length(v_title)>60 then raise exception 'Variantentitel ist erforderlich und darf maximal 60 Zeichen haben.' using errcode='22023'; end if;
 select * into v_existing from app_modules.liveticker_output_templates where template_key=v_key for update;
 if not found then raise exception 'Unbekannter technischer Varianten-Key.' using errcode='P0002'; end if;
 if v_expected_revision is null or v_expected_revision<>v_existing.revision then raise exception 'Die Ausgabeoption wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001'; end if;
 v_own_goal:=v_existing.own_goal_template; v_own_penalty:=v_existing.own_penalty_template; v_opponent_goal:=v_existing.opponent_goal_template; v_opponent_penalty:=v_existing.opponent_penalty_template;
 case v_context when 'own' then v_own_goal:=coalesce(p_payload->>'ownGoalTemplate',''); when 'own_penalty' then v_own_penalty:=coalesce(p_payload->>'ownPenaltyTemplate',''); when 'opponent' then v_opponent_goal:=coalesce(p_payload->>'opponentGoalTemplate',''); when 'opponent_penalty' then v_opponent_penalty:=coalesce(p_payload->>'opponentPenaltyTemplate',''); else raise exception 'Unbekannter Ausgabe-Kontext.' using errcode='22023'; end case;
 perform app_private.liveticker_validate_output_template(v_own_goal,array['minute','mighty_score','opponent_score']); perform app_private.liveticker_validate_output_template(v_own_penalty,array['minute','penalties']); perform app_private.liveticker_validate_output_template(v_opponent_goal,array['minute','mighty_score','opponent_score','opponent_name']); perform app_private.liveticker_validate_output_template(v_opponent_penalty,array['minute','penalties']);
 v_before:=to_jsonb(v_existing); update app_modules.liveticker_output_templates set title=v_title,own_goal_template=v_own_goal,own_penalty_template=v_own_penalty,opponent_goal_template=v_opponent_goal,opponent_penalty_template=v_opponent_penalty,revision=revision+1,updated_at=now(),updated_by=v_actor where template_key=v_key;
 select to_jsonb(t) into v_after from app_modules.liveticker_output_templates t where t.template_key=v_key; perform app_private.log_audit(v_actor,'LIVETICKER_OUTPUT_TEMPLATE_UPDATED','liveticker_output_template',v_key,v_before,v_after,jsonb_build_object('context',v_context)); return app_private.liveticker_output_templates_json(); end $$;

create function public.pd_public_liveticker_templates() returns jsonb language plpgsql stable security definer set search_path=''
as $$ begin perform app_private.liveticker_require_operator(); return app_private.liveticker_output_templates_json(); end $$;

alter function app_private.pd_api_dispatch_current(text,jsonb) rename to pd_api_dispatch_current_before_liveticker_templates_prod_r1;
create or replace function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_action text:=lower(btrim(coalesce(p_action,''))); begin case v_action when 'liveticker_output_templates_list' then return app_private.api_liveticker_output_templates_list(); when 'liveticker_output_template_save' then return app_private.api_liveticker_output_template_save(coalesce(p_payload,'{}'::jsonb)); else return app_private.pd_api_dispatch_current_before_liveticker_templates_prod_r1(p_action,p_payload); end case; end $$;

alter function app_private.platform_action_classification(text) rename to platform_action_classification_before_liveticker_templates_prod_r1;
create or replace function app_private.platform_action_classification(p_action text) returns text language sql stable set search_path=''
as $$ select case lower(btrim(coalesce(p_action,''))) when 'liveticker_output_templates_list' then 'READ' when 'liveticker_output_template_save' then 'USER_MUTATION' else app_private.platform_action_classification_before_liveticker_templates_prod_r1(p_action) end $$;

insert into app_modules.liveticker_output_templates(template_key,title,own_goal_template,own_penalty_template,opponent_goal_template,opponent_penalty_template,sort_order) values
('classic','Klassisch',$a${{minute}} Spielminute
*Tooooooor für unsere Schweinfurter Mighty Dogs*

Torschütze: {{scorer}}
Assists: {{assists}}

Neuer Spielstand
*{{mighty_score}}:{{opponent_score}}*$a$,$p${{minute}} Spielminute
Strafe(n)

{{penalties}}$p$,$b${{minute}} Spielminute
Tor {{opponent_name}}
{{scorer}}
Assists: {{assists}}

Neuer Spielstand
*{{mighty_score}}:{{opponent_score}}*$b$,$p${{minute}} Spielminute
Strafe(n)

{{penalties}}$p$,10),
('emotional','Emotional',$a${{minute}} Spielminute
🔥 *TOOOOOOOR MIGHTY DOGS!* 🔥

{{scorer}}
Assists: {{assists}}

Neuer Spielstand
*{{mighty_score}}:{{opponent_score}}*$a$,$p${{minute}} Spielminute
Strafe(n)

{{penalties}}$p$,$b${{minute}} Spielminute
Tor {{opponent_name}}
{{scorer}}
Assists: {{assists}}

Neuer Spielstand
*{{mighty_score}}:{{opponent_score}}*$b$,$p${{minute}} Spielminute
Strafe(n)

{{penalties}}$p$,20),
('short','Kurz',$a${{minute}} Spielminute
*TOOOOOR SCHWEINFURT!*
{{scorer}}
Assists: {{assists}}

*{{mighty_score}}:{{opponent_score}}*$a$,$p${{minute}} Spielminute
Strafe(n)

{{penalties}}$p$,$b${{minute}} Spielminute
Tor {{opponent_name}}
{{scorer}}
Assists: {{assists}}

*{{mighty_score}}:{{opponent_score}}*$b$,$p${{minute}} Spielminute
Strafe(n)

{{penalties}}$p$,30);

revoke all on function app_private.liveticker_validate_output_template(text,text[]) from public,anon,authenticated;
revoke all on function app_private.liveticker_output_templates_validate_row() from public,anon,authenticated;
revoke all on function app_private.liveticker_output_templates_json() from public,anon,authenticated;
revoke all on function app_private.api_liveticker_output_templates_list() from public,anon,authenticated;
revoke all on function app_private.api_liveticker_output_template_save(jsonb) from public,anon,authenticated;
revoke all on function app_private.pd_api_dispatch_current(text,jsonb) from public,anon,authenticated;
revoke all on function app_private.pd_api_dispatch_current_before_liveticker_templates_prod_r1(text,jsonb) from public,anon,authenticated;
revoke all on function public.pd_public_liveticker_templates() from public,anon,authenticated;
grant execute on function public.pd_public_liveticker_templates() to authenticated;
commit;
