-- Phase 2 Abschluss: Beitragszuordnungen sicher entfernen,
-- unbenutzte Beitragsjahre löschen und Löschbarkeit serverseitig ausweisen.

alter function app_private.api_fanclub_snapshot()
rename to api_fanclub_snapshot_before_phase2_finalization;

create or replace function app_private.api_fanclub_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base jsonb := app_private.api_fanclub_snapshot_before_phase2_finalization();
  v_seasons jsonb := '[]'::jsonb;
begin
  select coalesce(jsonb_agg(
    item || jsonb_build_object(
      'canDelete', not exists (
        select 1
        from app_fanclub.member_contributions as contribution
        where contribution.season_id = season.id
      )
    )
    order by season.starts_on desc, lower(season.name), season.id
  ), '[]'::jsonb)
  into v_seasons
  from jsonb_array_elements(
    coalesce(v_base -> 'contributionSeasons', '[]'::jsonb)
  ) as item
  join app_fanclub.contribution_seasons as season
    on season.id = (item ->> 'id')::uuid;

  return jsonb_set(
    v_base,
    '{contributionSeasons}',
    v_seasons,
    true
  );
end;
$$;

create or replace function app_private.api_remove_member_contribution(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('finance.manage');
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_expected_revision integer :=
    nullif(p_payload ->> 'revision', '')::integer;
  v_existing app_fanclub.member_contributions%rowtype;
begin
  if v_id is null then
    raise exception 'Beitragszuordnung fehlt.'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from app_fanclub.member_contributions as contribution
  where contribution.id = v_id
  for update;

  if v_existing.id is null then
    raise exception 'Beitragszuordnung wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_expected_revision is null
     or v_expected_revision <> v_existing.revision then
    raise exception
      'Die Beitragszuordnung wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  if exists (
    select 1
    from app_fanclub.contribution_payment_reports as report
    where report.member_contribution_id = v_id
  ) then
    raise exception
      'Für diese Beitragszuordnung existieren bereits Zahlungsmeldungen. Sie kann nicht entfernt werden.'
      using errcode = '23503';
  end if;

  delete from app_fanclub.member_contributions
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    'MEMBER_CONTRIBUTION_REMOVED',
    'member_contribution',
    v_id::text,
    to_jsonb(v_existing),
    null
  );

  return app_private.api_fanclub_snapshot();
end;
$$;

create or replace function app_private.api_delete_contribution_season(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('finance.manage');
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_expected_revision integer :=
    nullif(p_payload ->> 'revision', '')::integer;
  v_existing app_fanclub.contribution_seasons%rowtype;
begin
  if v_id is null then
    raise exception 'Beitragsjahr fehlt.'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from app_fanclub.contribution_seasons as season
  where season.id = v_id
  for update;

  if v_existing.id is null then
    raise exception 'Beitragsjahr wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_expected_revision is null
     or v_expected_revision <> v_existing.revision then
    raise exception
      'Das Beitragsjahr wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  if exists (
    select 1
    from app_fanclub.member_contributions as contribution
    where contribution.season_id = v_id
  ) then
    raise exception
      'Das Beitragsjahr enthält noch Beitragszuordnungen. Entferne zuerst alle ungebuchten Zuordnungen.'
      using errcode = '23503';
  end if;

  delete from app_fanclub.contribution_seasons
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    'CONTRIBUTION_SEASON_DELETED',
    'contribution_season',
    v_id::text,
    to_jsonb(v_existing),
    null
  );

  return app_private.api_fanclub_snapshot();
end;
$$;

alter function public.pd_api(text, jsonb)
rename to pd_api_before_phase2_finalization;

create or replace function public.pd_api(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_data jsonb;
begin
  if auth.uid() is null then
    raise exception 'Anmeldung erforderlich.'
      using errcode = '42501';
  end if;

  if v_action = 'remove_member_contribution' then
    v_data := app_private.api_remove_member_contribution(
      coalesce(p_payload, '{}'::jsonb)
    );
    return jsonb_build_object('ok', true, 'data', v_data);
  end if;

  if v_action = 'delete_contribution_season' then
    v_data := app_private.api_delete_contribution_season(
      coalesce(p_payload, '{}'::jsonb)
    );
    return jsonb_build_object('ok', true, 'data', v_data);
  end if;

  return public.pd_api_before_phase2_finalization(p_action, p_payload);
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', sqlstate,
        'message', sqlerrm
      )
    );
end;
$$;

revoke all on function app_private.api_fanclub_snapshot_before_phase2_finalization()
from public, anon, authenticated;
revoke all on function app_private.api_fanclub_snapshot()
from public, anon, authenticated;
revoke all on function app_private.api_remove_member_contribution(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_delete_contribution_season(jsonb)
from public, anon, authenticated;
revoke all on function public.pd_api_before_phase2_finalization(text, jsonb)
from public, anon, authenticated;
revoke all on function public.pd_api(text, jsonb) from public;
revoke all on function public.pd_api(text, jsonb) from anon;
grant execute on function public.pd_api(text, jsonb) to authenticated;
