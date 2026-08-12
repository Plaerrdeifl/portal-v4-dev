-- BF-003: fehlende, eigenstaendige Baseline-Reparatur fuer birth_date.
-- Reproduziert ausschliesslich den bereits bestehenden DEV-Sollzustand.

alter table app_fanclub.members
  add column if not exists birth_date date;

do $bf_003_birth_date_type$
declare
  v_type text;
begin
  select pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
  into v_type
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = 'app_fanclub.members'::regclass
    and attribute.attname = 'birth_date'
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if v_type is distinct from 'date' then
    raise exception
      'BF-003 erwartet app_fanclub.members.birth_date vom Typ date, gefunden: %',
      coalesce(v_type, '<fehlend>')
      using errcode = '42804';
  end if;
end
$bf_003_birth_date_type$;

alter table app_fanclub.members
  alter column birth_date drop default,
  alter column birth_date drop not null;

do $bf_003_birth_date_constraint$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_definition
    where constraint_definition.conrelid = 'app_fanclub.members'::regclass
      and constraint_definition.conname = 'members_birth_date_reasonable_check'
      and constraint_definition.contype = 'c'
  ) then
    alter table app_fanclub.members
      add constraint members_birth_date_reasonable_check
      check (
        birth_date is null
        or birth_date >= date '1900-01-01'
      );
  end if;
end
$bf_003_birth_date_constraint$;

alter table app_fanclub.members
  validate constraint members_birth_date_reasonable_check;
