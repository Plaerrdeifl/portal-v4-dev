alter table app_fanclub.membership_applications
  add column converted_at timestamptz,
  add column converted_by uuid
    references app_portal.users(id) on delete restrict,
  add column converted_member_id uuid
    references app_fanclub.members(id) on delete restrict,
  add column conversion_mode text,
  add constraint membership_applications_conversion_mode_check
    check (
      conversion_mode is null
      or conversion_mode in (
        'NEW_MEMBER',
        'REACTIVATE_EXISTING',
        'RESOLVE_EXISTING_ACTIVE'
      )
    ),
  add constraint membership_applications_conversion_state_check
    check (
      (converted_at is null
        and converted_by is null
        and converted_member_id is null
        and conversion_mode is null)
      or
      (status = 'APPROVED'
        and converted_at is not null
        and converted_by is not null
        and converted_member_id is not null
        and conversion_mode is not null)
    );

create index membership_applications_converted_by_idx
on app_fanclub.membership_applications (converted_by)
where converted_by is not null;

create index membership_applications_converted_member_idx
on app_fanclub.membership_applications (converted_member_id)
where converted_member_id is not null;

create or replace function app_private.m150_guard_application_conversion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.converted_at is not null
     and row(
       new.converted_at,
       new.converted_by,
       new.converted_member_id,
       new.conversion_mode
     ) is distinct from row(
       old.converted_at,
       old.converted_by,
       old.converted_member_id,
       old.conversion_mode
     ) then
    raise exception 'M150_CONVERSION_IMMUTABLE'
      using errcode = '22000';
  end if;

  return new;
end;
$$;

create trigger membership_applications_conversion_immutable
before update on app_fanclub.membership_applications
for each row execute function app_private.m150_guard_application_conversion();

revoke all on function app_private.m150_guard_application_conversion()
from public, anon, authenticated;
