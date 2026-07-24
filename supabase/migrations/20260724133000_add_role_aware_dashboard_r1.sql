-- Plärrdeifl Portal V4
-- Rollenabhängiges Dashboard R1
-- Geburtsdatum, geschützte Geburtstagsausgabe und Dashboard-Snapshot.
-- Ausschließlich für Supabase DEV vorgesehen.

alter table app_fanclub.members
  add column birth_date date;

alter table app_fanclub.members
  add constraint members_birth_date_reasonable_check
  check (
    birth_date is null
    or birth_date >= date '1900-01-01'
  );

create index members_active_birth_date_idx
  on app_fanclub.members(status, birth_date)
  where birth_date is not null;

create or replace function app_private.next_member_birthday(
  p_birth_date date,
  p_reference date default current_date
)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_year integer;
  v_month integer;
  v_day integer;
  v_last_day integer;
  v_candidate date;
begin
  if p_birth_date is null then
    return null;
  end if;

  v_year := extract(year from p_reference)::integer;
  v_month := extract(month from p_birth_date)::integer;
  v_day := extract(day from p_birth_date)::integer;

  v_last_day := extract(
    day from (
      date_trunc(
        'month',
        make_date(v_year, v_month, 1)
      )
      + interval '1 month - 1 day'
    )
  )::integer;

  v_candidate := make_date(
    v_year,
    v_month,
    least(v_day, v_last_day)
  );

  if v_candidate < p_reference then
    v_year := v_year + 1;

    v_last_day := extract(
      day from (
        date_trunc(
          'month',
          make_date(v_year, v_month, 1)
        )
        + interval '1 month - 1 day'
      )
    )::integer;

    v_candidate := make_date(
      v_year,
      v_month,
      least(v_day, v_last_day)
    );
  end if;

  return v_candidate;
end;
$$;

create or replace function app_private.api_member_detail(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_member_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_result jsonb;
begin
  if not app_private.can_manage_member_details(v_actor) then
    raise exception
      'Mitgliederdetails dürfen nur Administration oder aktuelle Amtsinhaber einsehen.'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', member.id,
    'memberCode', member.member_code,
    'firstName', member.first_name,
    'lastName', member.last_name,
    'birthDate', member.birth_date,
    'email', member.email,
    'phone', member.phone,
    'street', member.street,
    'houseNumber', member.house_number,
    'postalCode', member.postal_code,
    'city', member.city,
    'joinedOn', member.joined_on,
    'leftOn', member.left_on,
    'status', member.status,
    'notes', member.notes,
    'revision', member.revision
  )
  into v_result
  from app_fanclub.members as member
  where member.id = v_member_id;

  if v_result is null then
    raise exception 'Mitglied wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

create or replace function app_private.api_save_member(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_expected_revision integer :=
    nullif(p_payload ->> 'revision', '')::integer;
  v_first_name text :=
    app_private.require_valid_name(
      p_payload ->> 'firstName',
      'Vorname'
    );
  v_last_name text :=
    app_private.require_valid_name(
      p_payload ->> 'lastName',
      'Nachname'
    );
  v_birth_date date :=
    nullif(p_payload ->> 'birthDate', '')::date;
  v_status text :=
    upper(coalesce(p_payload ->> 'status', 'ACTIVE'));
  v_existing app_fanclub.members%rowtype;
begin
  if v_status not in ('ACTIVE', 'INACTIVE') then
    raise exception 'Unzulässiger Mitgliedsstatus.'
      using errcode = '22023';
  end if;

  if v_birth_date is not null
     and (
       v_birth_date < date '1900-01-01'
       or v_birth_date > current_date
     ) then
    raise exception 'Das Geburtsdatum ist ungültig.'
      using errcode = '22023';
  end if;

  if v_id is null then
    v_actor := app_private.require_capability('members.manage');

    insert into app_fanclub.members (
      first_name,
      last_name,
      birth_date,
      email,
      phone,
      street,
      house_number,
      postal_code,
      city,
      joined_on,
      left_on,
      status,
      notes
    )
    values (
      v_first_name,
      v_last_name,
      v_birth_date,
      left(btrim(coalesce(p_payload ->> 'email', '')), 320),
      left(btrim(coalesce(p_payload ->> 'phone', '')), 80),
      left(btrim(coalesce(p_payload ->> 'street', '')), 160),
      left(btrim(coalesce(p_payload ->> 'houseNumber', '')), 40),
      left(btrim(coalesce(p_payload ->> 'postalCode', '')), 20),
      left(btrim(coalesce(p_payload ->> 'city', '')), 160),
      nullif(p_payload ->> 'joinedOn', '')::date,
      nullif(p_payload ->> 'leftOn', '')::date,
      v_status,
      left(coalesce(p_payload ->> 'notes', ''), 4000)
    )
    returning id into v_id;

    perform app_private.log_audit(
      v_actor,
      'MEMBER_CREATED',
      'member',
      v_id::text,
      null,
      jsonb_build_object(
        'firstName', v_first_name,
        'lastName', v_last_name,
        'changedFields',
          jsonb_build_array(
            'firstName',
            'lastName',
            'birthDate',
            'status'
          )
      )
    );
  else
    v_actor := app_private.require_active_user();

    if not app_private.can_manage_member_details(v_actor) then
      raise exception
        'Mitgliedsdaten dürfen nur Administration oder aktuelle Amtsinhaber bearbeiten.'
        using errcode = '42501';
    end if;

    select *
    into v_existing
    from app_fanclub.members as member
    where member.id = v_id
    for update;

    if v_existing.id is null then
      raise exception 'Mitglied wurde nicht gefunden.'
        using errcode = 'P0002';
    end if;

    if v_expected_revision is null
       or v_expected_revision <> v_existing.revision then
      raise exception
        'Das Mitglied wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
        using errcode = '40001';
    end if;

    update app_fanclub.members
    set first_name = v_first_name,
        last_name = v_last_name,
        birth_date = v_birth_date,
        email = left(
          btrim(coalesce(p_payload ->> 'email', '')),
          320
        ),
        phone = left(
          btrim(coalesce(p_payload ->> 'phone', '')),
          80
        ),
        street = left(
          btrim(coalesce(p_payload ->> 'street', '')),
          160
        ),
        house_number = left(
          btrim(coalesce(p_payload ->> 'houseNumber', '')),
          40
        ),
        postal_code = left(
          btrim(coalesce(p_payload ->> 'postalCode', '')),
          20
        ),
        city = left(
          btrim(coalesce(p_payload ->> 'city', '')),
          160
        ),
        joined_on = nullif(p_payload ->> 'joinedOn', '')::date,
        left_on = nullif(p_payload ->> 'leftOn', '')::date,
        status = v_status,
        notes = left(
          coalesce(p_payload ->> 'notes', ''),
          4000
        ),
        revision = revision + 1
    where id = v_id;

    perform app_private.log_audit(
      v_actor,
      'MEMBER_UPDATED',
      'member',
      v_id::text,
      jsonb_build_object(
        'revision', v_existing.revision,
        'status', v_existing.status
      ),
      jsonb_build_object(
        'revision', v_existing.revision + 1,
        'status', v_status,
        'changedFields',
          jsonb_build_array(
            'firstName',
            'lastName',
            'birthDate',
            'email',
            'phone',
            'address',
            'joinedOn',
            'leftOn',
            'status',
            'notes'
          )
      )
    );
  end if;

  return app_private.api_fanclub_snapshot();
end;
$$;

create or replace function app_private.api_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_member_id uuid;
  v_is_member boolean := false;
  v_is_office boolean :=
    app_private.is_office_holder(v_actor);
  v_is_admin boolean :=
    app_private.has_capability(v_actor, 'portal.admin');
  v_has_override boolean := false;
  v_task_profile jsonb :=
    app_private.task_access_profile(v_actor);
  v_task_access jsonb := '{}'::jsonb;
  v_has_team_membership boolean := false;
  v_can_view_team boolean := false;
  v_can_view_board boolean := false;
  v_show_own_tasks boolean := false;
  v_current_season_id uuid;
  v_current_season_name text;
  v_current_season_starts_on date;
  v_current_season_ends_on date;
  v_member_count integer;
  v_contribution jsonb := null;
  v_birthdays jsonb := '[]'::jsonb;
  v_own_tasks jsonb := '[]'::jsonb;
  v_own_task_count integer := 0;
  v_team_tasks jsonb := '[]'::jsonb;
  v_team_task_count integer := 0;
  v_board_tasks jsonb := '[]'::jsonb;
  v_board_task_count integer := 0;
  v_board_task_status jsonb :=
    jsonb_build_object(
      'OPEN', 0,
      'IN_PROGRESS', 0,
      'WAITING', 0
    );
  v_finance_accounts jsonb := '[]'::jsonb;
  v_finance_total numeric(14,2) := 0;
  v_open_contribution_count integer := 0;
  v_open_contribution_amount numeric(14,2) := 0;
  v_can_open_finance boolean :=
    app_private.has_capability(v_actor, 'finance.read');
begin
  v_task_access :=
    coalesce(v_task_profile -> 'effective', '{}'::jsonb);

  v_has_team_membership :=
    coalesce(
      (v_task_access ->> 'hasTeamMembership')::boolean,
      false
    );

  v_can_view_team :=
    coalesce(
      (v_task_access ->> 'canViewTeamSection')::boolean,
      false
    );

  v_can_view_board :=
    coalesce(
      (v_task_access ->> 'canViewBoardSection')::boolean,
      false
    );

  select exists (
    select 1
    from app_portal.user_task_access_overrides as access_override
    where access_override.user_id = v_actor
  )
  into v_has_override;

  select member.id
  into v_member_id
  from app_portal.user_member_links as link
  join app_fanclub.members as member
    on member.id = link.member_id
   and member.status = 'ACTIVE'
  where link.user_id = v_actor;

  v_is_member := v_member_id is not null;

  v_show_own_tasks :=
    v_is_member
    or v_has_team_membership
    or v_is_office
    or v_is_admin
    or v_has_override;

  select
    season.id,
    season.name,
    season.starts_on,
    season.ends_on
  into
    v_current_season_id,
    v_current_season_name,
    v_current_season_starts_on,
    v_current_season_ends_on
  from app_fanclub.contribution_seasons as season
  where season.is_active
  order by
    case
      when current_date between season.starts_on and season.ends_on
        then 0
      else 1
    end,
    season.starts_on desc,
    season.id
  limit 1;

  if v_is_member then
    select count(*)::integer
    into v_member_count
    from app_fanclub.members as member
    where member.status = 'ACTIVE';

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'memberId', upcoming.id,
          'name',
            upcoming.first_name || ' ' || upcoming.last_name,
          'birthdayOn', upcoming.next_birthday,
          'daysUntil',
            upcoming.next_birthday - current_date
        )
        order by
          upcoming.next_birthday,
          lower(upcoming.last_name),
          lower(upcoming.first_name),
          upcoming.id
      ),
      '[]'::jsonb
    )
    into v_birthdays
    from (
      select
        member.id,
        member.first_name,
        member.last_name,
        app_private.next_member_birthday(
          member.birth_date,
          current_date
        ) as next_birthday
      from app_fanclub.members as member
      where member.status = 'ACTIVE'
        and member.birth_date is not null
      order by
        app_private.next_member_birthday(
          member.birth_date,
          current_date
        ),
        lower(member.last_name),
        lower(member.first_name),
        member.id
      limit 5
    ) as upcoming;

    if v_current_season_id is null then
      v_contribution := jsonb_build_object(
        'seasonId', null,
        'seasonName', '',
        'startsOn', null,
        'endsOn', null,
        'status', 'NO_SEASON',
        'className', '',
        'amountDue', 0,
        'paidAmount', 0,
        'pendingAmount', 0,
        'openAmount', 0
      );
    else
      select jsonb_build_object(
        'seasonId', v_current_season_id,
        'seasonName', v_current_season_name,
        'startsOn', v_current_season_starts_on,
        'endsOn', v_current_season_ends_on,
        'status',
          case
            when contribution.amount_due = 0
              then 'EXEMPT'
            when greatest(
              contribution.amount_due - payment.paid_amount,
              0
            ) = 0
              then 'PAID'
            when payment.paid_amount + payment.pending_amount
                 >= contribution.amount_due
              then 'PENDING'
            when payment.paid_amount > 0
              or payment.pending_amount > 0
              then 'PARTIAL'
            else 'OPEN'
          end,
        'className', contribution_class.name,
        'amountDue', contribution.amount_due,
        'paidAmount', payment.paid_amount,
        'pendingAmount', payment.pending_amount,
        'openAmount',
          greatest(
            contribution.amount_due - payment.paid_amount,
            0
          )
      )
      into v_contribution
      from app_fanclub.member_contributions as contribution
      join app_fanclub.contribution_classes as contribution_class
        on contribution_class.id =
          contribution.contribution_class_id
      left join lateral (
        select
          coalesce(sum(report.amount) filter (
            where report.status = 'CONFIRMED'
          ), 0) as paid_amount,
          coalesce(sum(report.amount) filter (
            where report.status = 'PENDING'
          ), 0) as pending_amount
        from app_fanclub.contribution_payment_reports as report
        where report.member_contribution_id = contribution.id
      ) as payment on true
      where contribution.season_id = v_current_season_id
        and contribution.member_id = v_member_id;

      if v_contribution is null then
        v_contribution := jsonb_build_object(
          'seasonId', v_current_season_id,
          'seasonName', v_current_season_name,
          'startsOn', v_current_season_starts_on,
          'endsOn', v_current_season_ends_on,
          'status', 'NOT_ASSIGNED',
          'className', '',
          'amountDue', 0,
          'paidAmount', 0,
          'pendingAmount', 0,
          'openAmount', 0
        );
      end if;
    end if;
  end if;

  if v_show_own_tasks then
    select count(*)::integer
    into v_own_task_count
    from app_modules.tasks as task
    where task.assigned_user_id = v_actor
      and task.status in ('OPEN', 'IN_PROGRESS', 'WAITING');

    select coalesce(
      jsonb_agg(
        task_row.item
        order by
          task_row.priority_order,
          task_row.status_order,
          task_row.updated_at desc,
          task_row.id
      ),
      '[]'::jsonb
    )
    into v_own_tasks
    from (
      select
        task.id,
        task.updated_at,
        case task.priority
          when 'URGENT' then 1
          when 'HIGH' then 2
          when 'NORMAL' then 3
          else 4
        end as priority_order,
        case task.status
          when 'IN_PROGRESS' then 1
          when 'WAITING' then 2
          else 3
        end as status_order,
        jsonb_build_object(
          'id', task.id,
          'title', task.title,
          'context', task.context_type,
          'teamId', task.team_id,
          'teamName', coalesce(team.name, ''),
          'priority', task.priority,
          'status', task.status,
          'updatedAt', task.updated_at
        ) as item
      from app_modules.tasks as task
      left join app_portal.teams as team
        on team.id = task.team_id
      where task.assigned_user_id = v_actor
        and task.status in ('OPEN', 'IN_PROGRESS', 'WAITING')
      order by
        priority_order,
        status_order,
        task.updated_at desc,
        task.id
      limit 5
    ) as task_row;
  end if;

  if v_can_view_team then
    select count(*)::integer
    into v_team_task_count
    from app_modules.tasks as task
    where task.context_type = 'TEAM'
      and task.status in ('OPEN', 'IN_PROGRESS', 'WAITING')
      and app_private.task_is_visible(v_actor, task.id);

    select coalesce(
      jsonb_agg(
        task_row.item
        order by
          task_row.priority_order,
          task_row.status_order,
          task_row.updated_at desc,
          task_row.id
      ),
      '[]'::jsonb
    )
    into v_team_tasks
    from (
      select
        task.id,
        task.updated_at,
        case task.priority
          when 'URGENT' then 1
          when 'HIGH' then 2
          when 'NORMAL' then 3
          else 4
        end as priority_order,
        case task.status
          when 'IN_PROGRESS' then 1
          when 'WAITING' then 2
          else 3
        end as status_order,
        jsonb_build_object(
          'id', task.id,
          'title', task.title,
          'context', task.context_type,
          'teamId', task.team_id,
          'teamName', coalesce(team.name, ''),
          'priority', task.priority,
          'status', task.status,
          'updatedAt', task.updated_at
        ) as item
      from app_modules.tasks as task
      join app_portal.teams as team
        on team.id = task.team_id
      where task.context_type = 'TEAM'
        and task.status in ('OPEN', 'IN_PROGRESS', 'WAITING')
        and app_private.task_is_visible(v_actor, task.id)
      order by
        priority_order,
        status_order,
        task.updated_at desc,
        task.id
      limit 5
    ) as task_row;
  end if;

  if v_can_view_board then
    select
      count(*)::integer,
      jsonb_build_object(
        'OPEN',
          count(*) filter (where task.status = 'OPEN'),
        'IN_PROGRESS',
          count(*) filter (where task.status = 'IN_PROGRESS'),
        'WAITING',
          count(*) filter (where task.status = 'WAITING')
      )
    into
      v_board_task_count,
      v_board_task_status
    from app_modules.tasks as task
    where task.context_type = 'BOARD'
      and task.status in ('OPEN', 'IN_PROGRESS', 'WAITING')
      and app_private.task_is_visible(v_actor, task.id);

    select coalesce(
      jsonb_agg(
        task_row.item
        order by
          task_row.priority_order,
          task_row.status_order,
          task_row.updated_at desc,
          task_row.id
      ),
      '[]'::jsonb
    )
    into v_board_tasks
    from (
      select
        task.id,
        task.updated_at,
        case task.priority
          when 'URGENT' then 1
          when 'HIGH' then 2
          when 'NORMAL' then 3
          else 4
        end as priority_order,
        case task.status
          when 'IN_PROGRESS' then 1
          when 'WAITING' then 2
          else 3
        end as status_order,
        jsonb_build_object(
          'id', task.id,
          'title', task.title,
          'context', task.context_type,
          'teamId', null,
          'teamName', '',
          'priority', task.priority,
          'status', task.status,
          'updatedAt', task.updated_at
        ) as item
      from app_modules.tasks as task
      where task.context_type = 'BOARD'
        and task.status in ('OPEN', 'IN_PROGRESS', 'WAITING')
        and app_private.task_is_visible(v_actor, task.id)
      order by
        priority_order,
        status_order,
        task.updated_at desc,
        task.id
      limit 5
    ) as task_row;
  end if;

  if v_is_office or v_is_admin then
    with account_balances as (
      select
        account.id,
        account.name,
        account.account_type,
        account.sort_position,
        coalesce(sum(
          case entry.entry_type
            when 'INCOME' then entry.amount
            when 'EXPENSE' then -entry.amount
            else 0
          end
        ), 0)::numeric(14,2) as balance
      from app_fanclub.finance_accounts as account
      left join app_fanclub.finance_entries as entry
        on entry.account_id = account.id
      where account.is_active
      group by
        account.id,
        account.name,
        account.account_type,
        account.sort_position
    )
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', account_balance.id,
            'name', account_balance.name,
            'accountType', account_balance.account_type,
            'balance', account_balance.balance
          )
          order by
            account_balance.sort_position,
            lower(account_balance.name),
            account_balance.id
        ),
        '[]'::jsonb
      ),
      coalesce(
        sum(account_balance.balance),
        0
      )::numeric(14,2)
    into
      v_finance_accounts,
      v_finance_total
    from account_balances as account_balance;

    if v_current_season_id is not null then
      select
        count(*)::integer,
        coalesce(sum(open_row.open_amount), 0)::numeric(14,2)
      into
        v_open_contribution_count,
        v_open_contribution_amount
      from (
        select
          greatest(
            contribution.amount_due
            - coalesce(sum(report.amount) filter (
              where report.status = 'CONFIRMED'
            ), 0),
            0
          )::numeric(14,2) as open_amount
        from app_fanclub.member_contributions as contribution
        join app_fanclub.members as member
          on member.id = contribution.member_id
         and member.status = 'ACTIVE'
        left join app_fanclub.contribution_payment_reports as report
          on report.member_contribution_id = contribution.id
        where contribution.season_id = v_current_season_id
        group by
          contribution.id,
          contribution.amount_due
      ) as open_row
      where open_row.open_amount > 0;
    end if;
  end if;

  return jsonb_build_object(
    'access',
    jsonb_build_object(
      'isMember', v_is_member,
      'isOfficeHolder', v_is_office,
      'isAdmin', v_is_admin,
      'hasTeamMembership', v_has_team_membership,
      'showOwnTasks', v_show_own_tasks,
      'showTeamTasks', v_can_view_team,
      'showBoardTasks', v_can_view_board,
      'showFinance', v_is_office or v_is_admin,
      'canOpenFinance', v_can_open_finance
    ),
    'member', case
      when not v_is_member then null
      else jsonb_build_object(
        'id', v_member_id,
        'memberCount', v_member_count,
        'contribution', v_contribution,
        'birthdays', v_birthdays
      )
    end,
    'ownTasks',
      jsonb_build_object(
        'count', v_own_task_count,
        'items', v_own_tasks
      ),
    'teamTasks',
      jsonb_build_object(
        'count', v_team_task_count,
        'items', v_team_tasks
      ),
    'boardTasks',
      jsonb_build_object(
        'count', v_board_task_count,
        'statusCounts', v_board_task_status,
        'items', v_board_tasks
      ),
    'finance', case
      when not (v_is_office or v_is_admin) then null
      else jsonb_build_object(
        'accounts', v_finance_accounts,
        'totalBalance', v_finance_total,
        'seasonId', v_current_season_id,
        'seasonName', coalesce(v_current_season_name, ''),
        'openContributionCount', v_open_contribution_count,
        'openContributionAmount', v_open_contribution_amount
      )
    end,
    'serverTime', now()
  );
end;
$$;

revoke all on function
  app_private.next_member_birthday(date, date)
from public, anon, authenticated;

revoke all on function
  app_private.api_member_detail(jsonb)
from public, anon, authenticated;

revoke all on function
  app_private.api_save_member(jsonb)
from public, anon, authenticated;

revoke all on function
  app_private.api_dashboard()
from public, anon, authenticated;
