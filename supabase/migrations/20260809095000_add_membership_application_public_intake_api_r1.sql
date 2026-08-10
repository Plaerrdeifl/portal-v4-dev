create function app_private.m150_submit_membership_application(
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed_keys constant text[] := array[
    'firstName',
    'lastName',
    'birthDate',
    'email',
    'phone',
    'street',
    'houseNumber',
    'postalCode',
    'city',
    'applicantMessage',
    'declarationConfirmed',
    'declarationVersion',
    'statutesConfirmed',
    'statutesVersion',
    'statutesReference'
  ];
  v_required_keys constant text[] := array[
    'firstName',
    'lastName',
    'birthDate',
    'email',
    'phone',
    'street',
    'houseNumber',
    'postalCode',
    'city',
    'declarationConfirmed',
    'declarationVersion',
    'statutesConfirmed',
    'statutesVersion',
    'statutesReference'
  ];
  v_string_keys constant text[] := array[
    'firstName',
    'lastName',
    'birthDate',
    'email',
    'phone',
    'street',
    'houseNumber',
    'postalCode',
    'city',
    'declarationVersion',
    'statutesVersion',
    'statutesReference'
  ];
  v_key text;
  v_idempotency_key text := btrim(coalesce(p_idempotency_key, ''));
  v_payload_sha256 text;
  v_first_name text;
  v_last_name text;
  v_birth_date date;
  v_email text;
  v_phone text;
  v_street text;
  v_house_number text;
  v_postal_code text;
  v_city text;
  v_applicant_message text;
  v_declaration_version text;
  v_statutes_version text;
  v_statutes_reference text;
  v_today date := (clock_timestamp() at time zone 'Europe/Berlin')::date;
  v_claimed integer;
  v_idempotency app_private.membership_application_intake_idempotency%rowtype;
  v_application_id uuid;
  v_existing_application_id uuid;
  v_board_count integer;
  v_board_offices integer;
  v_board_users integer;
  v_roster_count integer;
  v_roster_offices integer;
  v_roster_users integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'M150_PUBLIC_INTAKE_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_payload) as payload_key(key)
    where not (payload_key.key = any(v_allowed_keys))
  ) or not (p_payload ?& v_required_keys) then
    raise exception 'M150_PUBLIC_INTAKE_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  foreach v_key in array v_string_keys
  loop
    if jsonb_typeof(p_payload -> v_key) <> 'string' then
      raise exception 'M150_PUBLIC_INTAKE_INVALID_PAYLOAD'
        using errcode = '22023';
    end if;
  end loop;

  if p_payload ? 'applicantMessage'
     and p_payload -> 'applicantMessage' <> 'null'::jsonb
     and jsonb_typeof(p_payload -> 'applicantMessage') <> 'string' then
    raise exception 'M150_PUBLIC_INTAKE_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  if p_payload -> 'declarationConfirmed' <> 'true'::jsonb
     or p_payload -> 'statutesConfirmed' <> 'true'::jsonb then
    raise exception 'M150_PUBLIC_INTAKE_DECLARATION_REQUIRED'
      using errcode = '22023';
  end if;

  v_first_name := p_payload ->> 'firstName';
  v_last_name := p_payload ->> 'lastName';
  v_email := btrim(p_payload ->> 'email');
  v_phone := p_payload ->> 'phone';
  v_street := p_payload ->> 'street';
  v_house_number := p_payload ->> 'houseNumber';
  v_postal_code := p_payload ->> 'postalCode';
  v_city := p_payload ->> 'city';
  v_applicant_message := p_payload ->> 'applicantMessage';
  v_declaration_version := p_payload ->> 'declarationVersion';
  v_statutes_version := p_payload ->> 'statutesVersion';
  v_statutes_reference := p_payload ->> 'statutesReference';

  if length(btrim(v_first_name)) not between 1 and 160
     or length(btrim(v_last_name)) not between 1 and 160
     or length(btrim(v_email)) not between 3 and 320
     or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(btrim(v_phone)) not between 3 and 80
     or length(btrim(v_street)) not between 1 and 160
     or length(btrim(v_house_number)) not between 1 and 40
     or length(btrim(v_postal_code)) not between 1 and 20
     or length(btrim(v_city)) not between 1 and 160
     or (
       v_applicant_message is not null
       and length(btrim(v_applicant_message)) not between 1 and 4000
     )
     or length(btrim(v_declaration_version)) not between 1 and 80
     or length(btrim(v_statutes_version)) not between 1 and 80
     or length(btrim(v_statutes_reference)) not between 1 and 500 then
    raise exception 'M150_PUBLIC_INTAKE_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  if (p_payload ->> 'birthDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'M150_PUBLIC_INTAKE_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  begin
    v_birth_date := (p_payload ->> 'birthDate')::date;
  exception
    when invalid_datetime_format or datetime_field_overflow then
      raise exception 'M150_PUBLIC_INTAKE_INVALID_PAYLOAD'
        using errcode = '22023';
  end;

  if v_birth_date < date '1900-01-01' or v_birth_date > v_today then
    raise exception 'M150_PUBLIC_INTAKE_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  if v_birth_date + interval '18 years' > v_today then
    raise exception 'M150_PUBLIC_INTAKE_ADULT_REQUIRED'
      using errcode = '22023';
  end if;

  if length(v_idempotency_key) not between 1 and 200 then
    raise exception 'M150_PUBLIC_INTAKE_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  v_payload_sha256 := encode(
    extensions.digest(p_payload::text, 'sha256'),
    'hex'
  );

  insert into app_private.membership_application_intake_idempotency (
    idempotency_key,
    payload_sha256,
    outcome
  ) values (
    v_idempotency_key,
    v_payload_sha256,
    'PROCESSING'
  )
  on conflict (idempotency_key) do nothing;

  get diagnostics v_claimed = row_count;

  if v_claimed = 0 then
    select intake.*
    into v_idempotency
    from app_private.membership_application_intake_idempotency as intake
    where intake.idempotency_key = v_idempotency_key
    for update;

    if v_idempotency.payload_sha256 <> v_payload_sha256 then
      raise exception 'M150_IDEMPOTENCY_KEY_REUSED'
        using errcode = '22023';
    end if;

    if v_idempotency.outcome not in ('CREATED', 'DUPLICATE_PENDING')
       or v_idempotency.application_id is null then
      raise exception 'M150_PUBLIC_INTAKE_INVALID_PAYLOAD'
        using errcode = '55000';
    end if;

    return jsonb_build_object(
      'accepted', true,
      'created', false,
      'applicationId', v_idempotency.application_id
    );
  end if;

  select application.id
  into v_existing_application_id
  from app_fanclub.membership_applications as application
  where application.status = 'PENDING'
    and (
      app_private.m150_normalize_email(application.email)
        = app_private.m150_normalize_email(v_email)
      or (
        app_private.m150_normalize_name(application.first_name)
          = app_private.m150_normalize_name(v_first_name)
        and app_private.m150_normalize_name(application.last_name)
          = app_private.m150_normalize_name(v_last_name)
        and application.birth_date = v_birth_date
      )
    )
  order by application.submitted_at, application.id
  limit 1;

  if v_existing_application_id is not null then
    update app_private.membership_application_intake_idempotency
    set application_id = v_existing_application_id,
        outcome = 'DUPLICATE_PENDING'
    where idempotency_key = v_idempotency_key;

    return jsonb_build_object(
      'accepted', true,
      'created', false,
      'applicationId', v_existing_application_id
    );
  end if;

  perform app_private.m150_lock_board_roster();

  select
    count(*)::integer,
    count(distinct board.office_code)::integer,
    count(distinct board.user_id)::integer
  into
    v_board_count,
    v_board_offices,
    v_board_users
  from app_private.m150_current_board() as board;

  if v_board_count <> 5
     or v_board_offices <> 5
     or v_board_users <> 5 then
    raise exception 'M150_PUBLIC_INTAKE_BOARD_UNAVAILABLE'
      using errcode = 'P1501';
  end if;

  begin
    insert into app_fanclub.membership_applications (
      first_name,
      last_name,
      birth_date,
      email,
      phone,
      street,
      house_number,
      postal_code,
      city,
      applicant_message,
      status,
      declaration_version,
      statutes_version,
      statutes_reference,
      declaration_confirmed,
      statutes_confirmed
    ) values (
      v_first_name,
      v_last_name,
      v_birth_date,
      v_email,
      v_phone,
      v_street,
      v_house_number,
      v_postal_code,
      v_city,
      v_applicant_message,
      'PENDING',
      v_declaration_version,
      v_statutes_version,
      v_statutes_reference,
      true,
      true
    )
    returning id into v_application_id;
  exception
    when unique_violation then
      select application.id
      into v_existing_application_id
      from app_fanclub.membership_applications as application
      where application.status = 'PENDING'
        and (
          app_private.m150_normalize_email(application.email)
            = app_private.m150_normalize_email(v_email)
          or (
            app_private.m150_normalize_name(application.first_name)
              = app_private.m150_normalize_name(v_first_name)
            and app_private.m150_normalize_name(application.last_name)
              = app_private.m150_normalize_name(v_last_name)
            and application.birth_date = v_birth_date
          )
        )
      order by application.submitted_at, application.id
      limit 1;

      if v_existing_application_id is null then
        raise;
      end if;

      update app_private.membership_application_intake_idempotency
      set application_id = v_existing_application_id,
          outcome = 'DUPLICATE_PENDING'
      where idempotency_key = v_idempotency_key;

      return jsonb_build_object(
        'accepted', true,
        'created', false,
        'applicationId', v_existing_application_id
      );
  end;

  select
    count(*)::integer,
    count(distinct roster.office_code)::integer,
    count(distinct roster.voter_user_id)::integer
  into
    v_roster_count,
    v_roster_offices,
    v_roster_users
  from app_fanclub.membership_application_board_roster as roster
  where roster.application_id = v_application_id;

  if v_roster_count <> 5
     or v_roster_offices <> 5
     or v_roster_users <> 5 then
    raise exception 'M150_PUBLIC_INTAKE_BOARD_UNAVAILABLE'
      using errcode = 'P1501';
  end if;

  update app_private.membership_application_intake_idempotency
  set application_id = v_application_id,
      outcome = 'CREATED'
  where idempotency_key = v_idempotency_key;

  perform app_private.log_audit(
    null,
    'MEMBERSHIP_APPLICATION_SUBMITTED_PUBLIC',
    'membership_application',
    v_application_id::text,
    null,
    null,
    jsonb_build_object(
      'source', 'WORDPRESS_PUBLIC_INTAKE',
      'status', 'PENDING'
    )
  );

  return jsonb_build_object(
    'accepted', true,
    'created', true,
    'applicationId', v_application_id
  );
end;
$$;

create function public.m150_submit_membership_application(
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app_private.m150_submit_membership_application(
    p_payload,
    p_idempotency_key
  );
$$;

revoke all on function app_private.m150_submit_membership_application(jsonb, text)
from public, anon, authenticated, service_role;

revoke all on function public.m150_submit_membership_application(jsonb, text)
from public, anon, authenticated, service_role;

grant execute on function public.m150_submit_membership_application(jsonb, text)
to service_role;
