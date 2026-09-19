-- Plärrdeifl Portal V4 - Liveticker Textsystem V2
-- Additive rollout: the classic/emotional/short table remains intact for
-- historical actions and can be removed only in a later explicit migration.
begin;

create table app_modules.liveticker_output_types (
  type_key text primary key,
  label text not null,
  description text not null default '',
  category text not null,
  sort_order integer not null,
  allowed_variables text[] not null default '{}',
  required_variables text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null,
  constraint liveticker_output_types_key_check check (type_key ~ '^[a-z][a-z0-9_]{1,49}$'),
  constraint liveticker_output_types_label_check check (char_length(btrim(label)) between 1 and 80),
  constraint liveticker_output_types_category_check check (category in ('ACTION','SUMMARY','FRAGMENT')),
  constraint liveticker_output_types_sort_check check (sort_order > 0),
  constraint liveticker_output_types_required_allowed_check check (required_variables <@ allowed_variables)
);

create table app_modules.liveticker_output_variants (
  id uuid primary key default gen_random_uuid(),
  output_type_key text not null references app_modules.liveticker_output_types(type_key) on delete restrict,
  semantic_key text,
  display_name text not null,
  template_text text not null,
  sort_order integer not null,
  is_active boolean not null default true,
  is_default boolean not null default false,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null,
  constraint liveticker_output_variants_semantic_key_check check (semantic_key is null or semantic_key ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint liveticker_output_variants_name_check check (char_length(btrim(display_name)) between 1 and 80),
  constraint liveticker_output_variants_template_check check (char_length(template_text) between 1 and 4000),
  constraint liveticker_output_variants_sort_check check (sort_order > 0),
  constraint liveticker_output_variants_revision_check check (revision > 0),
  constraint liveticker_output_variants_default_active_check check (not is_default or is_active),
  constraint liveticker_output_variants_semantic_unique unique (output_type_key, semantic_key)
);

create index liveticker_output_types_order_idx
  on app_modules.liveticker_output_types(category, sort_order, type_key);
create index liveticker_output_variants_runtime_idx
  on app_modules.liveticker_output_variants(output_type_key, is_active, sort_order, id);
create unique index liveticker_output_variants_one_default_idx
  on app_modules.liveticker_output_variants(output_type_key)
  where is_default;

alter table app_modules.liveticker_output_types enable row level security;
alter table app_modules.liveticker_output_variants enable row level security;
revoke all on table app_modules.liveticker_output_types, app_modules.liveticker_output_variants
  from public, anon, authenticated;

insert into app_modules.liveticker_output_types(
  type_key,label,description,category,sort_order,allowed_variables,required_variables
) values
('goal_mighty','Tor Mighty Dogs','Texte für Tore der Mighty Dogs.','ACTION',10,array['minute','scorer','assists','score','home_score','away_score','mighty_score','opponent_score','opponent_name'],array['minute']),
('goal_opponent','Tor Gegner','Unabhängige Texte für Tore des Gegners.','ACTION',20,array['minute','scorer','assists','score','home_score','away_score','mighty_score','opponent_score','opponent_name'],array['minute','opponent_name']),
('penalty','Strafe','Gemeinsame Ausgabe für Strafen einer oder beider Mannschaften.','ACTION',30,array['minute','opponent_name','player_name','jersey_number','player','penalty_duration','penalty_reason','team_name','penalty_line','penalties'],array['minute','penalties']),
('penalty_shot','Straf-Penalty','Ausgabe eines Straf-Penaltys.','ACTION',40,array['minute','team_name','opponent_name','shooter','goalie','result'],array['minute','team_name','shooter','goalie','result']),
('shootout_attempt','Penaltyschießen','Ausgabe eines einzelnen Penaltyschießen-Versuchs.','ACTION',50,array['team_name','opponent_name','shooter','result'],array['team_name','shooter','result']),
('period_summary','Drittelende','Kumulative Drittelzusammenfassung.','SUMMARY',60,array['period_label','score_line','own_goals','opponent_goals','opponent_name'],array['period_label','score_line','own_goals','opponent_goals','opponent_name']),
('final_summary','Endstand','Endstand mit Toren, Strafen und optionalem Penaltyschießen.','SUMMARY',70,array['score_line','own_goals','opponent_goals','own_penalties','opponent_penalties','shootout_summary','opponent_name'],array['score_line','own_goals','opponent_goals','own_penalties','opponent_penalties','opponent_name']),
('goal_summary_line','Textbaustein · Torzeile','Wiederverwendete Zeile in Drittel- und Endzusammenfassungen.','FRAGMENT',80,array['minute','scorer'],array['minute','scorer']),
('penalty_summary_line','Textbaustein · Strafzeile','Wiederverwendete Strafzeile im Endstand.','FRAGMENT',90,array['minute','player','penalty_duration','penalty_reason'],array['minute','player','penalty_duration','penalty_reason']),
('penalty_shot_summary_line','Textbaustein · Straf-Penalty','Wiederverwendete Straf-Penalty-Zeile.','FRAGMENT',100,array['minute','shooter','goalie','result'],array['minute','shooter','goalie','result']),
('shootout_summary_line','Textbaustein · Penaltyversuch','Zeile eines Penaltyschießen-Versuchs.','FRAGMENT',110,array['team_name','shooter','result'],array['team_name','shooter','result']),
('shootout_summary','Textbaustein · Penaltyschießen','Gesamter Penaltyschießen-Block im Endstand.','FRAGMENT',120,array['mighty_score','opponent_score','opponent_name','shootout_attempts'],array['mighty_score','opponent_score','opponent_name','shootout_attempts']),
('no_goals','Textbaustein · Keine Tore','Fallback für eine leere Torliste.','FRAGMENT',130,'{}','{}'),
('no_penalties','Textbaustein · Keine Strafen','Fallback für eine leere Strafliste.','FRAGMENT',140,'{}','{}');

create function app_private.liveticker_validate_output_variant(
  p_template text,
  p_allowed_variables text[],
  p_required_variables text[]
) returns void
language plpgsql immutable set search_path=''
as $$
declare
  v_variables text[] := '{}';
  v_unknown text[] := '{}';
  v_missing text[] := '{}';
  v_without_valid_tokens text;
begin
  if p_template is null or char_length(btrim(p_template))=0 or char_length(p_template)>4000 then
    raise exception 'Ausgabetext ist erforderlich und darf maximal 4.000 Zeichen haben.' using errcode='22023';
  end if;
  select coalesce(array_agg(distinct btrim((token.match)[1])),'{}'::text[])
    into v_variables
    from regexp_matches(p_template,'\{\{([^{}]+)\}\}','g') as token(match);
  select coalesce(array_agg(variable order by variable),'{}'::text[])
    into v_unknown from unnest(v_variables) variable
    where not variable=any(p_allowed_variables);
  if cardinality(v_unknown)>0 then
    raise exception 'Unbekannte Platzhalter: %.',array_to_string(v_unknown,', ') using errcode='22023';
  end if;
  v_without_valid_tokens:=regexp_replace(p_template,'\{\{[a-z_]+\}\}','','g');
  if v_without_valid_tokens ~ '\{\{|\}\}' then
    raise exception 'Ausgabetext enthält einen technisch ungültigen Platzhalter.' using errcode='22023';
  end if;
  select coalesce(array_agg(required_variable order by required_variable),'{}'::text[])
    into v_missing from unnest(p_required_variables) required_variable
    where not required_variable=any(v_variables);
  if cardinality(v_missing)>0 then
    raise exception 'Pflichtplatzhalter fehlen: %.',array_to_string(v_missing,', ') using errcode='22023';
  end if;
end $$;

create function app_private.liveticker_output_variant_validate_row()
returns trigger language plpgsql set search_path=''
as $$
declare v_type app_modules.liveticker_output_types%rowtype;
begin
  if tg_op='UPDATE' and new.output_type_key is distinct from old.output_type_key then
    raise exception 'Der Ausgabetyp einer Variante darf nicht geändert werden.' using errcode='22023';
  end if;
  select * into v_type from app_modules.liveticker_output_types where type_key=new.output_type_key;
  if not found then raise exception 'Unbekannter Ausgabetyp.' using errcode='22023'; end if;
  -- V2 variants are validated only against their own output-type contract.
  -- Legacy classic/emotional/short templates keep their stricter historical
  -- score validation in the legacy table trigger.
  perform app_private.liveticker_validate_output_variant(new.template_text,v_type.allowed_variables,v_type.required_variables);
  return new;
end $$;

create trigger liveticker_output_variant_validate_v2
before insert or update on app_modules.liveticker_output_variants
for each row execute function app_private.liveticker_output_variant_validate_row();

-- Goal and penalty variants are copied from the final legacy DEV values. The
-- two goal groups deliberately receive independent rows and stable IDs.
insert into app_modules.liveticker_output_variants(
  id,output_type_key,semantic_key,display_name,template_text,sort_order,is_active,is_default
)
select seed.id,seed.output_type_key,seed.semantic_key,seed.display_name,seed.template_text,seed.sort_order,true,seed.is_default
from (
  select '10000000-0000-4000-8000-000000000001'::uuid,'goal_mighty','normal',coalesce(t.own_goal_title,'Normal'),t.own_goal_template,10,true from app_modules.liveticker_output_templates t where t.template_key='classic'
  union all select '10000000-0000-4000-8000-000000000002'::uuid,'goal_mighty','emotional',coalesce(t.own_goal_title,'Emotional'),t.own_goal_template,20,false from app_modules.liveticker_output_templates t where t.template_key='emotional'
  union all select '10000000-0000-4000-8000-000000000003'::uuid,'goal_mighty','hattrick',coalesce(t.own_goal_title,'Hattrick'),t.own_goal_template,30,false from app_modules.liveticker_output_templates t where t.template_key='short'
  union all select '20000000-0000-4000-8000-000000000001'::uuid,'goal_opponent','normal',coalesce(t.opponent_goal_title,'Normal'),t.opponent_goal_template,10,true from app_modules.liveticker_output_templates t where t.template_key='classic'
  union all select '20000000-0000-4000-8000-000000000002'::uuid,'goal_opponent','with_scorer',coalesce(t.opponent_goal_title,'Mit Torschütze'),t.opponent_goal_template,20,false from app_modules.liveticker_output_templates t where t.template_key='emotional'
  union all select '20000000-0000-4000-8000-000000000003'::uuid,'goal_opponent','hattrick',coalesce(t.opponent_goal_title,'Hattrick'),t.opponent_goal_template,30,false from app_modules.liveticker_output_templates t where t.template_key='short'
  union all select '30000000-0000-4000-8000-000000000001'::uuid,'penalty','normal','Normal',t.own_penalty_template,10,true from app_modules.liveticker_output_templates t where t.template_key='classic'
  union all select '30000000-0000-4000-8000-000000000002'::uuid,'penalty','major','Spieldauer',t.own_penalty_template,20,false from app_modules.liveticker_output_templates t where t.template_key='short'
  union all select '30000000-0000-4000-8000-000000000003'::uuid,'penalty','both','Beide Teams',t.own_penalty_template,30,false from app_modules.liveticker_output_templates t where t.template_key='emotional'
) as seed(id,output_type_key,semantic_key,display_name,template_text,sort_order,is_default);

insert into app_modules.liveticker_output_variants(
  id,output_type_key,semantic_key,display_name,template_text,sort_order,is_active,is_default
) values
('40000000-0000-4000-8000-000000000001','penalty_shot','normal','Normal',$t$🏒 *Straf-Penalty*
{{minute}} Spielminute
{{team_name}} · Schütze: {{shooter}}
{{opponent_name}} · Goalie: {{goalie}}
{{result}}$t$,10,true,true),
('50000000-0000-4000-8000-000000000001','shootout_attempt','normal','Normal',$t$*Penaltyschießen*
{{team_name}} · {{shooter}}
{{result}}$t$,10,true,true),
('60000000-0000-4000-8000-000000000001','period_summary','normal','Normal',$t$*Ende {{period_label}} – {{score_line}}*

🥅 *Mighty Dogs*
{{own_goals}}

🥅 *{{opponent_name}}*
{{opponent_goals}}$t$,10,true,true),
('70000000-0000-4000-8000-000000000001','final_summary','normal','Normal',$t$*ENDSTAND*
{{score_line}}

🥅 *Tore Mighty Dogs*
{{own_goals}}

🥅 *Tore {{opponent_name}}*
{{opponent_goals}}

🚨 *Strafen Mighty Dogs*
{{own_penalties}}

🚨 *Strafen {{opponent_name}}*
{{opponent_penalties}}
{{shootout_summary}}$t$,10,true,true),
('80000000-0000-4000-8000-000000000001','goal_summary_line','normal','Normal',$t${{minute}} Spielminute – {{scorer}}$t$,10,true,true),
('81000000-0000-4000-8000-000000000001','penalty_summary_line','normal','Normal',$t${{minute}} Spielminute – {{player}} – {{penalty_duration}} {{penalty_reason}}$t$,10,true,true),
('82000000-0000-4000-8000-000000000001','penalty_shot_summary_line','normal','Normal',$t${{minute}} Spielminute – Straf-Penalty · {{shooter}} gegen {{goalie}} · {{result}}$t$,10,true,true),
('83000000-0000-4000-8000-000000000001','shootout_summary_line','normal','Normal',$t${{team_name}} · {{shooter}} · {{result}}$t$,10,true,true),
('84000000-0000-4000-8000-000000000001','shootout_summary','normal','Normal',$t$
🏒 *Penaltyschießen*
Treffer: Mighty Dogs {{mighty_score}}:{{opponent_score}} {{opponent_name}}
{{shootout_attempts}}$t$,10,true,true),
('85000000-0000-4000-8000-000000000001','no_goals','normal','Normal','Keine Tore',10,true,true),
('86000000-0000-4000-8000-000000000001','no_penalties','normal','Normal','Keine Strafen',10,true,true);

create function app_private.liveticker_textsystem_json(p_include_inactive boolean default false)
returns jsonb language sql stable security definer set search_path=''
as $$
select jsonb_build_object(
  -- Legacy data is intentionally included throughout the transition.
  'templates',coalesce((select jsonb_agg(jsonb_build_object(
    'key',t.template_key,'title',t.title,
    'ownGoalTitle',t.own_goal_title,'ownPenaltyTitle',t.own_penalty_title,
    'opponentGoalTitle',t.opponent_goal_title,'opponentPenaltyTitle',t.opponent_penalty_title,
    'ownGoalTemplate',t.own_goal_template,'ownPenaltyTemplate',t.own_penalty_template,
    'opponentGoalTemplate',t.opponent_goal_template,'opponentPenaltyTemplate',t.opponent_penalty_template,
    'revision',t.revision) order by t.sort_order)
    from app_modules.liveticker_output_templates t),'[]'::jsonb),
  'outputTypes',coalesce((select jsonb_agg(jsonb_build_object(
    'key',o.type_key,'label',o.label,'description',o.description,'category',o.category,
    'sortOrder',o.sort_order,'allowedVariables',o.allowed_variables,'requiredVariables',o.required_variables)
    order by o.sort_order,o.type_key) from app_modules.liveticker_output_types o),'[]'::jsonb),
  'variants',coalesce((select jsonb_agg(jsonb_build_object(
    'id',v.id,'outputType',v.output_type_key,'semanticKey',v.semantic_key,
    'name',v.display_name,'template',v.template_text,'sortOrder',v.sort_order,
    'active',v.is_active,'default',v.is_default,'revision',v.revision,
    'createdAt',v.created_at,'updatedAt',v.updated_at)
    order by o.sort_order,v.sort_order,v.display_name,v.id)
    from app_modules.liveticker_output_variants v
    join app_modules.liveticker_output_types o on o.type_key=v.output_type_key
    where p_include_inactive or v.is_active),'[]'::jsonb)
) $$;

create or replace function app_private.api_liveticker_output_templates_list()
returns jsonb language plpgsql stable security definer set search_path=''
as $$ begin
  perform app_private.liveticker_require_operator();
  return app_private.liveticker_textsystem_json(true);
end $$;

create or replace function public.pd_public_liveticker_templates()
returns jsonb language plpgsql stable security definer set search_path=''
as $$ begin
  perform app_private.liveticker_require_operator();
  -- Inactive variants remain available for rendering already saved actions;
  -- the client only offers active variants for new actions.
  return app_private.liveticker_textsystem_json(true);
end $$;

create function app_private.api_liveticker_output_variant_save(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=app_private.liveticker_require_operator();
  v_id uuid:=nullif(btrim(coalesce(p_payload->>'id','')),'')::uuid;
  v_type_key text:=btrim(coalesce(p_payload->>'outputType',''));
  v_name text:=btrim(coalesce(p_payload->>'name',''));
  v_template text:=coalesce(p_payload->>'template','');
  v_sort integer:=nullif(btrim(coalesce(p_payload->>'sortOrder','')),'')::integer;
  v_active boolean:=coalesce((p_payload->>'active')::boolean,true);
  v_default boolean:=coalesce((p_payload->>'default')::boolean,false);
  v_expected integer:=nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer;
  v_existing app_modules.liveticker_output_variants%rowtype;
  v_type app_modules.liveticker_output_types%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if v_name='' or char_length(v_name)>80 then raise exception 'Variantenname ist erforderlich und darf maximal 80 Zeichen haben.' using errcode='22023'; end if;
  select * into v_type from app_modules.liveticker_output_types where type_key=v_type_key;
  if not found then raise exception 'Unbekannter Ausgabetyp.' using errcode='22023'; end if;
  perform app_private.liveticker_validate_output_variant(v_template,v_type.allowed_variables,v_type.required_variables);
  if v_sort is null then select coalesce(max(sort_order),0)+10 into v_sort from app_modules.liveticker_output_variants where output_type_key=v_type_key; end if;
  if v_sort<1 then raise exception 'Sortierung muss mindestens 1 sein.' using errcode='22023'; end if;
  if v_default and not v_active then raise exception 'Die Standardvariante muss aktiv sein.' using errcode='22023'; end if;

  -- Clear the previous default before inserting/updating the new one so the
  -- partial unique index is never violated inside this transaction.
  if v_default then
    update app_modules.liveticker_output_variants set
      is_default=false,revision=revision+1,updated_at=now(),updated_by=v_actor
    where output_type_key=v_type_key and is_default and (v_id is null or id<>v_id);
  end if;

  if v_id is null then
    insert into app_modules.liveticker_output_variants(output_type_key,display_name,template_text,sort_order,is_active,is_default,created_by,updated_by)
    values(v_type_key,v_name,v_template,v_sort,v_active,v_default,v_actor,v_actor)
    returning id into v_id;
    v_before:=null;
  else
    select * into v_existing from app_modules.liveticker_output_variants where id=v_id for update;
    if not found then raise exception 'Ausgabevariante wurde nicht gefunden.' using errcode='P0002'; end if;
    if v_existing.output_type_key<>v_type_key then raise exception 'Der Ausgabetyp einer Variante darf nicht geändert werden.' using errcode='22023'; end if;
    if v_expected is null or v_expected<>v_existing.revision then raise exception 'Die Ausgabevariante wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001'; end if;
    if v_existing.is_active and not v_active and (select count(*) from app_modules.liveticker_output_variants where output_type_key=v_type_key and is_active)<=1 then
      raise exception 'Mindestens eine aktive Variante muss erhalten bleiben.' using errcode='22023';
    end if;
    v_before:=to_jsonb(v_existing);
    update app_modules.liveticker_output_variants set
      display_name=v_name,template_text=v_template,sort_order=v_sort,is_active=v_active,
      is_default=v_default,revision=revision+1,updated_at=now(),updated_by=v_actor
    where id=v_id;
  end if;

  if not v_default and not exists(select 1 from app_modules.liveticker_output_variants where output_type_key=v_type_key and is_default) then
    update app_modules.liveticker_output_variants set
      is_default=true,revision=revision+1,updated_at=now(),updated_by=v_actor
    where id=(select id from app_modules.liveticker_output_variants where output_type_key=v_type_key and is_active order by sort_order,id limit 1);
  end if;

  select to_jsonb(v) into v_after from app_modules.liveticker_output_variants v where v.id=v_id;
  perform app_private.log_audit(v_actor,
    case when v_before is null then 'LIVETICKER_OUTPUT_VARIANT_CREATED' else 'LIVETICKER_OUTPUT_VARIANT_UPDATED' end,
    'liveticker_output_variant',v_id::text,v_before,v_after,jsonb_build_object('outputType',v_type_key));
  return app_private.liveticker_textsystem_json(true);
end $$;

create function app_private.api_liveticker_output_variant_delete(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=app_private.liveticker_require_operator();
  v_id uuid:=nullif(btrim(coalesce(p_payload->>'id','')),'')::uuid;
  v_expected integer:=nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer;
  v_existing app_modules.liveticker_output_variants%rowtype;
begin
  select * into v_existing from app_modules.liveticker_output_variants where id=v_id for update;
  if not found then raise exception 'Ausgabevariante wurde nicht gefunden.' using errcode='P0002'; end if;
  if v_expected is null or v_expected<>v_existing.revision then raise exception 'Die Ausgabevariante wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001'; end if;
  if v_existing.is_default then raise exception 'Die Standardvariante kann nicht gelöscht werden. Bitte zuerst eine andere Variante als Standard festlegen.' using errcode='22023'; end if;
  if (select count(*) from app_modules.liveticker_output_variants where output_type_key=v_existing.output_type_key)<=1 then raise exception 'Die letzte Variante eines Ausgabetyps kann nicht gelöscht werden.' using errcode='22023'; end if;
  if exists(select 1 from app_modules.liveticker_actions where payload->>'outputVariantId'=v_id::text) then raise exception 'Die Variante wird von gespeicherten Liveticker-Aktionen verwendet und kann nur deaktiviert werden.' using errcode='55000'; end if;
  delete from app_modules.liveticker_output_variants where id=v_id;
  perform app_private.log_audit(v_actor,'LIVETICKER_OUTPUT_VARIANT_DELETED','liveticker_output_variant',v_id::text,to_jsonb(v_existing),null,jsonb_build_object('outputType',v_existing.output_type_key));
  return app_private.liveticker_textsystem_json(true);
end $$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_liveticker_textsystem_v2;
create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_action text:=lower(btrim(coalesce(p_action,'')));
begin
  case v_action
    when 'liveticker_output_variant_save' then return app_private.api_liveticker_output_variant_save(coalesce(p_payload,'{}'::jsonb));
    when 'liveticker_output_variant_delete' then return app_private.api_liveticker_output_variant_delete(coalesce(p_payload,'{}'::jsonb));
    else return app_private.pd_api_dispatch_current_before_liveticker_textsystem_v2(p_action,p_payload);
  end case;
end $$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_liveticker_textsystem_v2;
create function app_private.platform_action_classification(p_action text)
returns text language sql stable set search_path=''
as $$ select case lower(btrim(coalesce(p_action,'')))
  when 'liveticker_output_variant_save' then 'USER_MUTATION'
  when 'liveticker_output_variant_delete' then 'USER_MUTATION'
  else app_private.platform_action_classification_before_liveticker_textsystem_v2(p_action)
end $$;

revoke all on function app_private.liveticker_validate_output_variant(text,text[],text[]) from public,anon,authenticated;
revoke all on function app_private.liveticker_output_variant_validate_row() from public,anon,authenticated;
revoke all on function app_private.liveticker_textsystem_json(boolean) from public,anon,authenticated;
revoke all on function app_private.api_liveticker_output_templates_list() from public,anon,authenticated;
revoke all on function app_private.api_liveticker_output_variant_save(jsonb) from public,anon,authenticated;
revoke all on function app_private.api_liveticker_output_variant_delete(jsonb) from public,anon,authenticated;
revoke all on function app_private.pd_api_dispatch_current(text,jsonb) from public,anon,authenticated;
revoke all on function app_private.pd_api_dispatch_current_before_liveticker_textsystem_v2(text,jsonb) from public,anon,authenticated;
revoke all on function public.pd_public_liveticker_templates() from public,anon,authenticated;
grant execute on function public.pd_public_liveticker_templates() to authenticated;

commit;
