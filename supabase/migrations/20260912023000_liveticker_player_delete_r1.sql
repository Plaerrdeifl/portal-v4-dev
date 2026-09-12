-- Plärrdeifl Portal V4 - Liveticker player deletion R1
-- Permanent roster deletion with revision safety. Historic ticker actions keep their JSON snapshots.

create or replace function app_private.api_liveticker_player_delete(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_id uuid := nullif(btrim(coalesce(p_payload->>'id','')),'')::uuid;
  v_expected integer := nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer;
  v_old app_modules.liveticker_players%rowtype;
begin
  if v_id is null or v_expected is null then
    raise exception 'Spieler und aktuelle Version sind erforderlich.' using errcode='22023';
  end if;

  select * into v_old
  from app_modules.liveticker_players
  where id=v_id
  for update;

  if not found then
    raise exception 'Spieler wurde nicht gefunden.' using errcode='P0002';
  end if;
  if v_expected<>v_old.revision then
    raise exception 'Der Spieler wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001';
  end if;

  delete from app_modules.liveticker_players where id=v_id;

  perform app_private.log_audit(
    v_actor,
    'LIVETICKER_PLAYER_DELETED',
    'liveticker_player',
    v_id::text,
    to_jsonb(v_old),
    null,
    jsonb_build_object('teamId',v_old.team_id)
  );

  return app_private.api_liveticker_teams_list();
end;
$$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_liveticker_player_delete_r1;
create or replace function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_action text:=lower(btrim(coalesce(p_action,'')));
begin
  case v_action
    when 'liveticker_player_delete' then
      return app_private.api_liveticker_player_delete(coalesce(p_payload,'{}'::jsonb));
    else
      return app_private.pd_api_dispatch_current_before_liveticker_player_delete_r1(p_action,p_payload);
  end case;
end;
$$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_liveticker_player_delete_r1;
create or replace function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path=''
as $$
  select case lower(btrim(coalesce(p_action,'')))
    when 'liveticker_player_delete' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_liveticker_player_delete_r1(p_action)
  end
$$;

revoke all on function app_private.api_liveticker_player_delete(jsonb) from public,anon,authenticated;
revoke all on function app_private.pd_api_dispatch_current_before_liveticker_player_delete_r1(text,jsonb) from public,anon,authenticated;
revoke all on function app_private.platform_action_classification_before_liveticker_player_delete_r1(text) from public,anon,authenticated;
