create or replace function public.pd_public_liveticker_graphics_games()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  perform app_private.liveticker_require_operator();
  return jsonb_build_object('games',coalesce((
    select jsonb_agg(
      x.item
      order by
        (x.completed_at is not null) asc,
        case when x.completed_at is null then x.event_date end asc,
        case when x.completed_at is null then x.event_time end asc nulls last,
        case when x.completed_at is not null then x.event_date end desc,
        case when x.completed_at is not null then x.event_time end desc nulls last,
        x.event_id
    )
    from (
      select e.id event_id,e.event_date,e.event_time,s.completed_at,
        jsonb_build_object(
          'eventId',e.id,'eventDate',e.event_date,'eventTime',e.event_time,'venue',e.venue,'homeAway',g.home_away,
          'completedAt',s.completed_at,
          'displayTitle',case g.home_away when 'HOME' then own.short_name||' – '||coalesce(opp.short_name,g.opponent_name) else coalesce(opp.short_name,g.opponent_name)||' – '||own.short_name end,
          'ownTeam',app_private.liveticker_team_json(own.id),
          'opponentTeam',coalesce(app_private.liveticker_team_json(opp.id),jsonb_build_object('id',null,'name',g.opponent_name,'shortName',g.opponent_name,'teamCode',null,'logoAssetPath',null,'logoUrl',null,'homeClub',false,'players','[]'::jsonb))
        ) item
      from app_modules.events e
      join app_modules.event_games g on g.event_id=e.id
      join app_modules.liveticker_teams own on own.is_home_club and own.is_active
      left join lateral(
        select t.id,t.short_name from app_modules.liveticker_teams t
        where t.is_active and not t.is_home_club and (
          lower(btrim(t.name))=lower(btrim(g.opponent_name))
          or lower(btrim(t.short_name))=lower(btrim(g.opponent_name))
          or lower(g.opponent_name) like '%'||lower(btrim(t.short_name))||'%'
        )
        order by case when lower(btrim(t.name))=lower(btrim(g.opponent_name)) then 0 else 1 end,t.name
        limit 1
      ) opp on true
      left join app_modules.liveticker_game_states s on s.event_id=e.id
      where e.event_type='GAME' and e.visibility='PUBLIC'
        and e.event_date between ((now() at time zone 'Europe/Berlin')::date-30) and ((now() at time zone 'Europe/Berlin')::date+220)
    ) x
  ),'[]'::jsonb));
end;
$$;

revoke all on function public.pd_public_liveticker_graphics_games() from public,anon,authenticated;
