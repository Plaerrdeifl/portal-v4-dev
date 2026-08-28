-- DEV acceptance overlay: M326 manual composer person-default boarding stop projection.
-- Must be reconciled into the ordered migration chain before the joint PROD release.

create or replace function app_private.api_fanbus_registration_people_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability(
    'fanbus.registrations.manage'
  );
begin
  return jsonb_build_object(
    'people',
    coalesce((
      with selectable_people as (
        select
          'MEMBER'::text as person_type,
          member.id as member_id,
          portal_user.id as portal_user_id,
          member.first_name,
          member.last_name,
          case
            when nullif(lower(btrim(member.email)), '')
              ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
              then nullif(lower(btrim(member.email)), '')
            when nullif(lower(btrim(portal_user.email)), '')
              ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
              then nullif(lower(btrim(portal_user.email)), '')
            else null
          end as email,
          preference.default_boarding_stop_id,
          preference_stop.label as default_boarding_stop_label
        from app_fanclub.members as member
        left join app_portal.user_member_links as link
          on link.member_id = member.id
        left join app_portal.users as portal_user
          on portal_user.id = link.user_id
         and portal_user.status = 'ACTIVE'
        left join app_modules.fanbus_user_preferences as preference
          on preference.user_id = portal_user.id
        left join app_modules.fanbus_boarding_stops as preference_stop
          on preference_stop.id = preference.default_boarding_stop_id
        where member.status = 'ACTIVE'

        union all

        select
          'PORTAL_USER'::text as person_type,
          null::uuid as member_id,
          portal_user.id as portal_user_id,
          portal_user.first_name,
          portal_user.last_name,
          nullif(btrim(portal_user.email), '') as email,
          preference.default_boarding_stop_id,
          preference_stop.label as default_boarding_stop_label
        from app_portal.users as portal_user
        left join app_modules.fanbus_user_preferences as preference
          on preference.user_id = portal_user.id
        left join app_modules.fanbus_boarding_stops as preference_stop
          on preference_stop.id = preference.default_boarding_stop_id
        where portal_user.status = 'ACTIVE'
          and not exists (
            select 1
            from app_portal.user_member_links as link
            join app_fanclub.members as member
              on member.id = link.member_id
             and member.status = 'ACTIVE'
            where link.user_id = portal_user.id
          )
      )
      select jsonb_agg(
        jsonb_build_object(
          'personType', person.person_type,
          'memberId', person.member_id,
          'portalUserId', person.portal_user_id,
          'firstName', person.first_name,
          'lastName', person.last_name,
          'email', person.email,
          'defaultBoardingStopId', person.default_boarding_stop_id,
          'defaultBoardingStopLabel', person.default_boarding_stop_label
        )
        order by
          lower(person.last_name),
          lower(person.first_name),
          person.member_id nulls last,
          person.portal_user_id
      )
      from selectable_people as person
    ), '[]'::jsonb)
  );
end;
$function$;
