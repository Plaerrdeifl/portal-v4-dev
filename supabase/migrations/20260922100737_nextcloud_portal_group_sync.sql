-- Portal-derived Nextcloud groups: Social Media + Vorstand.
-- Runtime credential is provisioned out-of-band. PROD renames the existing
-- nextcloud_social_sync role so the established password remains valid.

do $block$
begin
  if exists (
    select 1 from pg_roles where rolname = 'nextcloud_social_sync'
  ) and not exists (
    select 1 from pg_roles where rolname = 'nextcloud_portal_sync'
  ) then
    alter role nextcloud_social_sync rename to nextcloud_portal_sync;
  elsif not exists (
    select 1 from pg_roles where rolname = 'nextcloud_portal_sync'
  ) then
    create role nextcloud_portal_sync
      nologin
      nosuperuser
      nocreatedb
      nocreaterole
      noreplication
      nobypassrls
      connection limit 2;
  end if;
end;
$block$;

alter role nextcloud_portal_sync
  set default_transaction_read_only = on;

alter role nextcloud_portal_sync
  set statement_timeout = '5s';

create schema if not exists nextcloud_sync;

revoke all on schema nextcloud_sync from public;
grant usage on schema nextcloud_sync to nextcloud_portal_sync;

create or replace function nextcloud_sync.social_media_members()
returns table (
  user_id uuid,
  email text,
  display_name text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    portal_user.id,
    coalesce(auth_user.email, portal_user.email, '')::text,
    pg_catalog.btrim(
      pg_catalog.concat_ws(
        ' ',
        portal_user.first_name,
        portal_user.last_name
      )
    )::text
  from app_portal.users as portal_user
  join auth.users as auth_user
    on auth_user.id = portal_user.id
  join app_portal.team_memberships as membership
    on membership.user_id = portal_user.id
   and membership.is_active
  join app_portal.teams as team
    on team.id = membership.team_id
   and team.is_active
   and team.code = 'SOCIAL_MEDIA'
  where portal_user.status = 'ACTIVE'
  order by portal_user.id;
$function$;

create or replace function nextcloud_sync.board_members()
returns table (
  user_id uuid,
  email text,
  display_name text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select distinct on (board.user_id)
    board.user_id,
    coalesce(auth_user.email, portal_user.email, '')::text,
    pg_catalog.btrim(
      pg_catalog.concat_ws(
        ' ',
        portal_user.first_name,
        portal_user.last_name
      )
    )::text
  from app_private.m150_current_board() as board
  join app_portal.users as portal_user
    on portal_user.id = board.user_id
   and portal_user.status = 'ACTIVE'
  join auth.users as auth_user
    on auth_user.id = board.user_id
  order by board.user_id;
$function$;

create or replace function nextcloud_sync.portal_group_members()
returns table (
  group_name text,
  user_id uuid,
  email text,
  display_name text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    'socialmedia'::text,
    member.user_id,
    member.email,
    member.display_name
  from nextcloud_sync.social_media_members() as member

  union all

  select
    'vorstand'::text,
    member.user_id,
    member.email,
    member.display_name
  from nextcloud_sync.board_members() as member

  order by 1, 2;
$function$;

revoke all on function nextcloud_sync.social_media_members() from public;
revoke all on function nextcloud_sync.board_members() from public;
revoke all on function nextcloud_sync.portal_group_members() from public;

grant execute on function nextcloud_sync.social_media_members()
  to nextcloud_portal_sync;
grant execute on function nextcloud_sync.board_members()
  to nextcloud_portal_sync;
grant execute on function nextcloud_sync.portal_group_members()
  to nextcloud_portal_sync;
