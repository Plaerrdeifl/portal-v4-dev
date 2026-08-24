create or replace function app_private.notification_project_user(
  p_event app_private.notification_events,
  p_user_id uuid,
  p_title text,
  p_body text,
  p_route text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid;
begin
  if p_user_id is null then return; end if;

  if not exists (
    select 1
    from app_portal.users u
    where u.id = p_user_id
      and u.status = 'ACTIVE'
  ) then
    return;
  end if;

  if p_event.actor_user_id is not null
     and exists (
       select 1
       from app_portal.users u
       where u.id = p_event.actor_user_id
     ) then
    v_actor_user_id := p_event.actor_user_id;
  else
    v_actor_user_id := null;
  end if;

  insert into app_portal.notifications(
    user_id,
    event_key,
    event_type,
    title,
    body,
    route,
    entity_type,
    entity_id,
    actor_user_id,
    push_state,
    push_attempted_at,
    push_error
  )
  values (
    p_user_id,
    'm020:' || p_event.id::text || ':' || p_user_id::text,
    p_event.notification_type,
    left(coalesce(p_title, 'Plärrdeifl'), 180),
    left(coalesce(p_body, ''), 1000),
    coalesce(nullif(p_route, ''), '#/dashboard'),
    p_event.entity_type,
    nullif(p_event.entity_id, ''),
    v_actor_user_id,
    'SKIPPED',
    now(),
    'M020 zentrale Zustellung'
  )
  on conflict (user_id, event_key) do nothing;
end;
$function$;

comment on function app_private.notification_project_user(
  app_private.notification_events,
  uuid,
  text,
  text,
  text
) is
'Projects M020 events into portal notifications. Non-portal actors remain on the event but are projected with actor_user_id NULL to satisfy the portal-user FK.';
