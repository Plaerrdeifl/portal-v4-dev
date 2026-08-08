create or replace function app_private.m150_normalize_email(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(btrim(coalesce(p_value, '')));
$$;

create or replace function app_private.m150_normalize_name(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'));
$$;

create or replace function app_private.m150_normalize_phone(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
$$;

create or replace function app_private.m150_current_board()
returns table (
  office_code text,
  user_id uuid,
  member_id uuid,
  first_name text,
  last_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    office.code,
    portal_user.id,
    member.id,
    portal_user.first_name,
    portal_user.last_name
  from app_fanclub.office_slots as office
  join app_fanclub.members as member
    on member.id = office.member_id
   and member.status = 'ACTIVE'
  join app_portal.user_member_links as user_member_link
    on user_member_link.member_id = member.id
  join app_portal.users as portal_user
    on portal_user.id = user_member_link.user_id
   and portal_user.status = 'ACTIVE'
  where office.code in (
    'VORSTAND_1',
    'VORSTAND_2',
    'VORSTAND_3',
    'KASSIER',
    'SCHRIFTFUEHRER'
  )
  order by office.sort_order, office.code;
$$;

create or replace function app_private.m150_require_current_board_member()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := app_private.require_active_user();

  if not exists (
    select 1
    from app_private.m150_current_board() as board
    where board.user_id = v_actor
  ) then
    raise exception 'M150_CURRENT_BOARD_REQUIRED'
      using errcode = '42501';
  end if;

  return v_actor;
end;
$$;

create or replace function app_private.m150_lock_board_roster()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from app_fanclub.office_slots as office
  where office.code in (
    'VORSTAND_1',
    'VORSTAND_2',
    'VORSTAND_3',
    'KASSIER',
    'SCHRIFTFUEHRER'
  )
  order by office.sort_order, office.code
  for share of office;

  perform 1
  from app_fanclub.office_slots as office
  join app_fanclub.members as member
    on member.id = office.member_id
  where office.code in (
    'VORSTAND_1',
    'VORSTAND_2',
    'VORSTAND_3',
    'KASSIER',
    'SCHRIFTFUEHRER'
  )
  order by office.sort_order, office.code
  for share of member;

  perform 1
  from app_fanclub.office_slots as office
  join app_fanclub.members as member
    on member.id = office.member_id
  join app_portal.user_member_links as user_member_link
    on user_member_link.member_id = member.id
  join app_portal.users as portal_user
    on portal_user.id = user_member_link.user_id
  where office.code in (
    'VORSTAND_1',
    'VORSTAND_2',
    'VORSTAND_3',
    'KASSIER',
    'SCHRIFTFUEHRER'
  )
  order by office.sort_order, office.code
  for share of user_member_link, portal_user;
end;
$$;

create or replace function app_private.m150_capture_board_roster()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.m150_lock_board_roster();

  insert into app_fanclub.membership_application_board_roster (
    application_id,
    office_code,
    voter_user_id,
    member_id,
    captured_at
  )
  select
    new.id,
    board.office_code,
    board.user_id,
    board.member_id,
    now()
  from app_private.m150_current_board() as board;

  return new;
end;
$$;

create trigger membership_applications_capture_board_roster
after insert on app_fanclub.membership_applications
for each row execute function app_private.m150_capture_board_roster();

create or replace function app_private.m150_assert_board_ready(p_application_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select count(*)
      from app_fanclub.membership_application_board_roster as roster
      where roster.application_id = p_application_id) <> 5
     or (select count(distinct roster.office_code)
         from app_fanclub.membership_application_board_roster as roster
         where roster.application_id = p_application_id) <> 5
     or (select count(distinct roster.voter_user_id)
         from app_fanclub.membership_application_board_roster as roster
         where roster.application_id = p_application_id) <> 5 then
    raise exception 'M150_BOARD_SNAPSHOT_INCOMPLETE'
      using errcode = 'P1501';
  end if;

  if (select count(*) from app_private.m150_current_board()) <> 5
     or (select count(distinct board.office_code)
         from app_private.m150_current_board() as board) <> 5
     or (select count(distinct board.user_id)
         from app_private.m150_current_board() as board) <> 5 then
    raise exception 'M150_BOARD_INCOMPLETE'
      using errcode = 'P1501';
  end if;

  if exists (
    (
      select roster.office_code, roster.voter_user_id, roster.member_id
      from app_fanclub.membership_application_board_roster as roster
      where roster.application_id = p_application_id
      except
      select board.office_code, board.user_id, board.member_id
      from app_private.m150_current_board() as board
    )
    union all
    (
      select board.office_code, board.user_id, board.member_id
      from app_private.m150_current_board() as board
      except
      select roster.office_code, roster.voter_user_id, roster.member_id
      from app_fanclub.membership_application_board_roster as roster
      where roster.application_id = p_application_id
    )
  ) then
    raise exception 'M150_BOARD_ROSTER_CHANGED'
      using errcode = 'P1502';
  end if;

  if exists (
    select 1
    from app_fanclub.membership_application_votes as vote
    left join app_private.m150_current_board() as board
      on board.user_id = vote.voter_user_id
    where vote.application_id = p_application_id
      and board.user_id is null
  ) then
    raise exception 'M150_BOARD_ROSTER_CHANGED'
      using errcode = 'P1502';
  end if;
end;
$$;

create or replace function app_private.m150_seven_day_available(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      application.status = 'PENDING'
      and (application.submitted_at at time zone 'Europe/Berlin')::date + 7
        <= (now() at time zone 'Europe/Berlin')::date
      and (select count(*)
           from app_fanclub.membership_application_board_roster as roster
           where roster.application_id = application.id) = 5
      and (select count(distinct roster.office_code)
           from app_fanclub.membership_application_board_roster as roster
           where roster.application_id = application.id) = 5
      and (select count(distinct roster.voter_user_id)
           from app_fanclub.membership_application_board_roster as roster
           where roster.application_id = application.id) = 5
      and (select count(*) from app_private.m150_current_board()) = 5
      and (select count(distinct board.office_code)
           from app_private.m150_current_board() as board) = 5
      and (select count(distinct board.user_id)
           from app_private.m150_current_board() as board) = 5
      and not exists (
        (
          select roster.office_code, roster.voter_user_id, roster.member_id
          from app_fanclub.membership_application_board_roster as roster
          where roster.application_id = application.id
          except
          select board.office_code, board.user_id, board.member_id
          from app_private.m150_current_board() as board
        )
        union all
        (
          select board.office_code, board.user_id, board.member_id
          from app_private.m150_current_board() as board
          except
          select roster.office_code, roster.voter_user_id, roster.member_id
          from app_fanclub.membership_application_board_roster as roster
          where roster.application_id = application.id
        )
      )
      and not exists (
        select 1
        from app_fanclub.membership_application_votes as vote
        left join app_private.m150_current_board() as board
          on board.user_id = vote.voter_user_id
        where vote.application_id = application.id
          and board.user_id is null
      )
      and (select count(*) from app_fanclub.membership_application_votes as vote
           where vote.application_id = application.id and vote.vote = 'YES') < 3
      and (select count(*) from app_fanclub.membership_application_votes as vote
           where vote.application_id = application.id and vote.vote = 'NO') < 3
    from app_fanclub.membership_applications as application
    where application.id = p_application_id
  ), false);
$$;

create or replace function app_private.api_membership_applications_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_result jsonb;
begin
  v_actor := app_private.m150_require_current_board_member();

  select coalesce(jsonb_agg(item.payload order by item.pending_rank, item.submitted_at desc), '[]'::jsonb)
  into v_result
  from (
    select
      case when application.status = 'PENDING' then 0 else 1 end as pending_rank,
      application.submitted_at,
      jsonb_build_object(
        'id', application.id,
        'name', btrim(application.first_name) || ' ' || btrim(application.last_name),
        'submittedAt', application.submitted_at,
        'status', application.status,
        'yesVotes', count(vote.*) filter (where vote.vote = 'YES'),
        'noVotes', count(vote.*) filter (where vote.vote = 'NO'),
        'missingVotes', greatest(5 - count(vote.*), 0),
        'ownVote', max(vote.vote) filter (where vote.voter_user_id = v_actor),
        'sevenDayDecisionAvailable', app_private.m150_seven_day_available(application.id),
        'revision', application.revision
      ) as payload
    from app_fanclub.membership_applications as application
    left join app_fanclub.membership_application_votes as vote
      on vote.application_id = application.id
    group by application.id
  ) as item;

  return v_result;
end;
$$;

create or replace function app_private.api_membership_application_detail(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_id uuid;
  v_application app_fanclub.membership_applications%rowtype;
  v_votes jsonb;
  v_yes integer;
  v_no integer;
  v_matches jsonb;
begin
  v_actor := app_private.m150_require_current_board_member();

  begin
    v_id := nullif(p_payload ->> 'id', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'M150_INVALID_APPLICATION_ID' using errcode = '22023';
  end;

  if v_id is null then
    raise exception 'M150_APPLICATION_ID_REQUIRED' using errcode = '22023';
  end if;

  select application.*
  into v_application
  from app_fanclub.membership_applications as application
  where application.id = v_id;

  if not found then
    raise exception 'M150_APPLICATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'voterUserId', vote.voter_user_id,
        'voterName', btrim(portal_user.first_name) || ' ' || btrim(portal_user.last_name),
        'vote', vote.vote,
        'reasonInternal', vote.reason_internal,
        'votedAt', vote.voted_at
      ) order by vote.voted_at, vote.voter_user_id
    ), '[]'::jsonb),
    count(*) filter (where vote.vote = 'YES')::integer,
    count(*) filter (where vote.vote = 'NO')::integer
  into v_votes, v_yes, v_no
  from app_fanclub.membership_application_votes as vote
  join app_portal.users as portal_user
    on portal_user.id = vote.voter_user_id
  where vote.application_id = v_id;

  select jsonb_build_object(
    'membersByEmail', coalesce((
      select jsonb_agg(jsonb_build_object(
        'memberId', member.id,
        'memberCode', member.member_code,
        'name', btrim(member.first_name) || ' ' || btrim(member.last_name)
      ) order by member.member_code)
      from app_fanclub.members as member
      where app_private.m150_normalize_email(member.email)
        = app_private.m150_normalize_email(v_application.email)
        and app_private.m150_normalize_email(v_application.email) <> ''
    ), '[]'::jsonb),
    'membersByIdentity', coalesce((
      select jsonb_agg(jsonb_build_object(
        'memberId', member.id,
        'memberCode', member.member_code,
        'name', btrim(member.first_name) || ' ' || btrim(member.last_name)
      ) order by member.member_code)
      from app_fanclub.members as member
      where app_private.m150_normalize_name(member.first_name)
        = app_private.m150_normalize_name(v_application.first_name)
        and app_private.m150_normalize_name(member.last_name)
        = app_private.m150_normalize_name(v_application.last_name)
        and member.birth_date = v_application.birth_date
    ), '[]'::jsonb),
    'membersByPhone', coalesce((
      select jsonb_agg(jsonb_build_object(
        'memberId', member.id,
        'memberCode', member.member_code,
        'name', btrim(member.first_name) || ' ' || btrim(member.last_name)
      ) order by member.member_code)
      from app_fanclub.members as member
      where app_private.m150_normalize_phone(member.phone)
        = app_private.m150_normalize_phone(v_application.phone)
        and app_private.m150_normalize_phone(v_application.phone) <> ''
    ), '[]'::jsonb),
    'portalUsersByEmail', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', portal_user.id,
        'userCode', portal_user.user_code,
        'name', btrim(portal_user.first_name) || ' ' || btrim(portal_user.last_name)
      ) order by portal_user.user_code)
      from app_portal.users as portal_user
      where app_private.m150_normalize_email(portal_user.email)
        = app_private.m150_normalize_email(v_application.email)
        and app_private.m150_normalize_email(v_application.email) <> ''
    ), '[]'::jsonb),
    'pendingApplications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'applicationId', other.id,
        'name', btrim(other.first_name) || ' ' || btrim(other.last_name),
        'signals', array_remove(array[
          case when app_private.m150_normalize_email(other.email)
            = app_private.m150_normalize_email(v_application.email) then 'EMAIL' end,
          case when app_private.m150_normalize_name(other.first_name)
            = app_private.m150_normalize_name(v_application.first_name)
            and app_private.m150_normalize_name(other.last_name)
            = app_private.m150_normalize_name(v_application.last_name)
            and other.birth_date = v_application.birth_date then 'IDENTITY' end,
          case when app_private.m150_normalize_phone(other.phone)
            = app_private.m150_normalize_phone(v_application.phone) then 'PHONE' end
        ], null)
      ) order by other.submitted_at desc)
      from app_fanclub.membership_applications as other
      where other.id <> v_application.id
        and other.status = 'PENDING'
        and (
          (app_private.m150_normalize_email(v_application.email) <> ''
            and app_private.m150_normalize_email(other.email)
              = app_private.m150_normalize_email(v_application.email))
          or
          (app_private.m150_normalize_name(other.first_name)
              = app_private.m150_normalize_name(v_application.first_name)
            and app_private.m150_normalize_name(other.last_name)
              = app_private.m150_normalize_name(v_application.last_name)
            and other.birth_date = v_application.birth_date)
          or
          (app_private.m150_normalize_phone(v_application.phone) <> ''
            and app_private.m150_normalize_phone(other.phone)
              = app_private.m150_normalize_phone(v_application.phone))
        )
    ), '[]'::jsonb)
  ) into v_matches;

  return jsonb_build_object(
    'id', v_application.id,
    'firstName', v_application.first_name,
    'lastName', v_application.last_name,
    'birthDate', v_application.birth_date,
    'email', v_application.email,
    'phone', v_application.phone,
    'street', v_application.street,
    'houseNumber', v_application.house_number,
    'postalCode', v_application.postal_code,
    'city', v_application.city,
    'applicantMessage', v_application.applicant_message,
    'status', v_application.status,
    'submittedAt', v_application.submitted_at,
    'decidedAt', v_application.decided_at,
    'decidedBy', v_application.decided_by,
    'decisionMethod', v_application.decision_method,
    'decisionReasonInternal', v_application.decision_reason_internal,
    'applicantNotice', v_application.applicant_notice,
    'declarationVersion', v_application.declaration_version,
    'statutesVersion', v_application.statutes_version,
    'statutesReference', v_application.statutes_reference,
    'declarationConfirmed', v_application.declaration_confirmed,
    'statutesConfirmed', v_application.statutes_confirmed,
    'votes', v_votes,
    'yesVotes', v_yes,
    'noVotes', v_no,
    'missingVotes', greatest(5 - v_yes - v_no, 0),
    'ownVote', (
      select vote.vote
      from app_fanclub.membership_application_votes as vote
      where vote.application_id = v_id
        and vote.voter_user_id = v_actor
    ),
    'sevenDayDecisionAvailable', app_private.m150_seven_day_available(v_id),
    'matches', v_matches,
    'revision', v_application.revision,
    'createdAt', v_application.created_at,
    'updatedAt', v_application.updated_at
  );
end;
$$;

create or replace function app_private.api_membership_application_vote(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_id uuid;
  v_vote text := upper(btrim(coalesce(p_payload ->> 'vote', '')));
  v_reason text := nullif(btrim(coalesce(p_payload ->> 'reasonInternal', '')), '');
  v_expected_revision integer;
  v_application app_fanclub.membership_applications%rowtype;
  v_yes integer;
  v_no integer;
  v_new_status text;
begin
  v_actor := app_private.m150_require_current_board_member();

  begin
    v_id := nullif(p_payload ->> 'id', '')::uuid;
    v_expected_revision := (p_payload ->> 'expectedRevision')::integer;
  exception when invalid_text_representation then
    raise exception 'M150_INVALID_VOTE_PAYLOAD' using errcode = '22023';
  end;

  if v_id is null or v_expected_revision is null or v_vote not in ('YES', 'NO') then
    raise exception 'M150_INVALID_VOTE_PAYLOAD' using errcode = '22023';
  end if;

  select application.*
  into v_application
  from app_fanclub.membership_applications as application
  where application.id = v_id
  for update;

  if not found then
    raise exception 'M150_APPLICATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_application.revision <> v_expected_revision then
    raise exception 'M150_REVISION_CONFLICT' using errcode = '40001';
  end if;

  if v_application.status <> 'PENDING' then
    raise exception 'M150_APPLICATION_ALREADY_DECIDED' using errcode = 'P1503';
  end if;

  perform app_private.m150_lock_board_roster();

  perform app_private.m150_assert_board_ready(v_id);

  if not exists (
    select 1 from app_private.m150_current_board() as board where board.user_id = v_actor
  ) then
    raise exception 'M150_BOARD_ROSTER_CHANGED' using errcode = 'P1502';
  end if;

  if exists (
    select 1
    from app_fanclub.membership_application_votes as existing_vote
    where existing_vote.application_id = v_id
      and existing_vote.voter_user_id = v_actor
  ) then
    raise exception 'M150_VOTE_ALREADY_EXISTS' using errcode = '23505';
  end if;

  select
    count(*) filter (where existing_vote.vote = 'YES')::integer,
    count(*) filter (where existing_vote.vote = 'NO')::integer
  into v_yes, v_no
  from app_fanclub.membership_application_votes as existing_vote
  where existing_vote.application_id = v_id;

  if v_vote = 'NO' and v_no = 2 and v_reason is null then
    raise exception 'M150_DECISIVE_NO_REASON_REQUIRED' using errcode = '22023';
  end if;

  insert into app_fanclub.membership_application_votes (
    application_id, voter_user_id, vote, reason_internal
  ) values (
    v_id, v_actor, v_vote, v_reason
  );

  v_yes := v_yes + case when v_vote = 'YES' then 1 else 0 end;
  v_no := v_no + case when v_vote = 'NO' then 1 else 0 end;
  v_new_status := case when v_yes >= 3 then 'APPROVED' when v_no >= 3 then 'REJECTED' else 'PENDING' end;

  update app_fanclub.membership_applications as application
  set status = v_new_status,
      decided_at = case when v_new_status <> 'PENDING' then now() else null end,
      decided_by = case when v_new_status <> 'PENDING' then v_actor else null end,
      decision_method = case when v_new_status <> 'PENDING' then 'VOTE_MAJORITY' else null end,
      decision_reason_internal = case when v_new_status = 'REJECTED' then v_reason else null end,
      revision = application.revision + 1,
      updated_at = now()
  where application.id = v_id;

  perform app_private.log_audit(
    v_actor,
    'MEMBERSHIP_APPLICATION_VOTE_CAST',
    'membership_application',
    v_id::text,
    null,
    jsonb_build_object('vote', v_vote),
    jsonb_build_object('yesVotes', v_yes, 'noVotes', v_no, 'missingVotes', 5 - v_yes - v_no)
  );

  if v_new_status <> 'PENDING' then
    perform app_private.log_audit(
      v_actor,
      case when v_new_status = 'APPROVED'
        then 'MEMBERSHIP_APPLICATION_AUTO_APPROVED'
        else 'MEMBERSHIP_APPLICATION_AUTO_REJECTED'
      end,
      'membership_application',
      v_id::text,
      jsonb_build_object('status', 'PENDING'),
      jsonb_build_object('status', v_new_status, 'decisionMethod', 'VOTE_MAJORITY'),
      jsonb_build_object(
        'yesVotes', v_yes,
        'noVotes', v_no,
        'missingVotes', 5 - v_yes - v_no,
        'decisionReasonInternal', case when v_new_status = 'REJECTED' then v_reason else null end
      )
    );
  end if;

  return app_private.api_membership_application_detail(jsonb_build_object('id', v_id));
end;
$$;

create or replace function app_private.api_membership_application_manual_decide(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_id uuid;
  v_decision text := upper(btrim(coalesce(p_payload ->> 'decision', '')));
  v_reason text := nullif(btrim(coalesce(p_payload ->> 'reasonInternal', '')), '');
  v_notice text := nullif(btrim(coalesce(p_payload ->> 'applicantNotice', '')), '');
  v_expected_revision integer;
  v_application app_fanclub.membership_applications%rowtype;
  v_yes integer;
  v_no integer;
begin
  v_actor := app_private.m150_require_current_board_member();

  begin
    v_id := nullif(p_payload ->> 'id', '')::uuid;
    v_expected_revision := (p_payload ->> 'expectedRevision')::integer;
  exception when invalid_text_representation then
    raise exception 'M150_INVALID_MANUAL_DECISION_PAYLOAD' using errcode = '22023';
  end;

  if v_id is null
    or v_expected_revision is null
    or v_decision not in ('APPROVED', 'REJECTED')
    or v_reason is null then
    raise exception 'M150_MANUAL_DECISION_REASON_REQUIRED' using errcode = '22023';
  end if;

  select application.*
  into v_application
  from app_fanclub.membership_applications as application
  where application.id = v_id
  for update;

  if not found then
    raise exception 'M150_APPLICATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_application.revision <> v_expected_revision then
    raise exception 'M150_REVISION_CONFLICT' using errcode = '40001';
  end if;

  if v_application.status <> 'PENDING' then
    raise exception 'M150_APPLICATION_ALREADY_DECIDED' using errcode = 'P1503';
  end if;

  perform app_private.m150_lock_board_roster();

  perform app_private.m150_assert_board_ready(v_id);

  if not exists (
    select 1 from app_private.m150_current_board() as board where board.user_id = v_actor
  ) then
    raise exception 'M150_BOARD_ROSTER_CHANGED' using errcode = 'P1502';
  end if;

  select
    count(*) filter (where vote.vote = 'YES')::integer,
    count(*) filter (where vote.vote = 'NO')::integer
  into v_yes, v_no
  from app_fanclub.membership_application_votes as vote
  where vote.application_id = v_id;

  if v_yes >= 3 or v_no >= 3 then
    raise exception 'M150_MAJORITY_MUST_NOT_BE_OVERWRITTEN' using errcode = 'P1504';
  end if;

  if (v_application.submitted_at at time zone 'Europe/Berlin')::date + 7
      > (now() at time zone 'Europe/Berlin')::date then
    raise exception 'M150_SEVEN_DAY_PERIOD_NOT_REACHED' using errcode = 'P1505';
  end if;

  update app_fanclub.membership_applications as application
  set status = v_decision,
      decided_at = now(),
      decided_by = v_actor,
      decision_method = 'SEVEN_DAY_MANUAL',
      decision_reason_internal = v_reason,
      applicant_notice = v_notice,
      revision = application.revision + 1,
      updated_at = now()
  where application.id = v_id;

  perform app_private.log_audit(
    v_actor,
    'MEMBERSHIP_APPLICATION_SEVEN_DAY_DECIDED',
    'membership_application',
    v_id::text,
    jsonb_build_object('status', 'PENDING'),
    jsonb_build_object('status', v_decision, 'decisionMethod', 'SEVEN_DAY_MANUAL'),
    jsonb_build_object(
      'decidingBoardUser', v_actor,
      'decidedAt', now(),
      'yesVotes', v_yes,
      'noVotes', v_no,
      'missingVotes', 5 - v_yes - v_no,
      'sevenDayDecision', true,
      'decisionReasonInternal', v_reason
    )
  );

  return app_private.api_membership_application_detail(jsonb_build_object('id', v_id));
end;
$$;

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_membership_applications_r1;

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

  case v_action
    when 'membership_applications_list' then
      v_data := app_private.api_membership_applications_list();
    when 'membership_application_detail' then
      v_data := app_private.api_membership_application_detail(coalesce(p_payload, '{}'::jsonb));
    when 'membership_application_vote' then
      v_data := app_private.api_membership_application_vote(coalesce(p_payload, '{}'::jsonb));
    when 'membership_application_manual_decide' then
      v_data := app_private.api_membership_application_manual_decide(coalesce(p_payload, '{}'::jsonb));
    else
      return public.pd_api_before_membership_applications_r1(p_action, p_payload);
  end case;

  return jsonb_build_object('ok', true, 'data', v_data);
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', sqlstate, 'message', sqlerrm)
    );
end;
$$;

revoke all on function app_private.m150_normalize_email(text)
from public, anon, authenticated;
revoke all on function app_private.m150_normalize_name(text)
from public, anon, authenticated;
revoke all on function app_private.m150_normalize_phone(text)
from public, anon, authenticated;
revoke all on function app_private.m150_current_board()
from public, anon, authenticated;
revoke all on function app_private.m150_require_current_board_member()
from public, anon, authenticated;
revoke all on function app_private.m150_lock_board_roster()
from public, anon, authenticated;
revoke all on function app_private.m150_capture_board_roster()
from public, anon, authenticated;
revoke all on function app_private.m150_assert_board_ready(uuid)
from public, anon, authenticated;
revoke all on function app_private.m150_seven_day_available(uuid)
from public, anon, authenticated;
revoke all on function app_private.api_membership_applications_list()
from public, anon, authenticated;
revoke all on function app_private.api_membership_application_detail(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_membership_application_vote(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_membership_application_manual_decide(jsonb)
from public, anon, authenticated;
revoke all on function public.pd_api_before_membership_applications_r1(text, jsonb)
from public, anon, authenticated;
revoke all on function public.pd_api(text, jsonb)
from public, anon, authenticated;

grant execute on function public.pd_api(text, jsonb)
to authenticated;
