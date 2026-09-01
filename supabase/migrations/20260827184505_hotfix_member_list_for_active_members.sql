create or replace function app_private.api_fanclub_member_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_own_member_id uuid;
begin
  select member.id
  into v_own_member_id
  from app_portal.user_member_links as link
  join app_fanclub.members as member
    on member.id = link.member_id
   and member.status = 'ACTIVE'
  where link.user_id = v_actor;

  if v_own_member_id is null then
    raise exception
      'Aktive Mitgliedsverknüpfung erforderlich.'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'scope',
    'MEMBERS_LIST',

    'members',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', member.id,
            'firstName', member.first_name,
            'lastName', member.last_name,
            'joinedOn', member.joined_on,
            'status', member.status
          )
          order by lower(member.last_name), lower(member.first_name), member.id
        )
        from app_fanclub.members as member
        where member.status = 'ACTIVE'
      ),
      '[]'::jsonb
    ),

    'offices',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'code', office.code,
            'label', office.label,
            'sortOrder', office.sort_order,
            'memberId', office.member_id,
            'memberCode', office_member.member_code,
            'memberName',
            case
              when office_member.id is null then ''
              else office_member.first_name || ' ' || office_member.last_name
            end,
            'memberPhone', coalesce(office_member.phone, ''),
            'revision', office.revision
          )
          order by office.sort_order
        ),
        '[]'::jsonb
      )
      from app_fanclub.office_slots as office
      left join app_fanclub.members as office_member
        on office_member.id = office.member_id
       and office_member.status = 'ACTIVE'
    ),

    'contributionSeasons', '[]'::jsonb,
    'contributionClasses', '[]'::jsonb,
    'financeAccounts', '[]'::jsonb,
    'memberContributions', '[]'::jsonb,
    'contributionPaymentReports', '[]'::jsonb,
    'financeEntries', '[]'::jsonb,
    'canViewMemberDetails', false,
    'canManageMembers', false,
    'canManageOffices', false,
    'canReadFinance', false,
    'canManageFinance', false,
    'canReportPayments', false
  );
end;
$$;

revoke all on function app_private.api_fanclub_member_snapshot()
from public, anon, authenticated, service_role;
