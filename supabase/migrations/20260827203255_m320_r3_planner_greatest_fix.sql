-- M320-R3 follow-up: GREATEST is SQL syntax and must not be pg_catalog-qualified.
-- Keep this as an additive migration because 20260827203217 is already registered in DEV.

do $migration$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef('app_private.m320_r3_assignment_plan(uuid)'::regprocedure)
  into v_definition;

  v_definition := pg_catalog.replace(
    v_definition,
    'pg_catalog.greatest',
    'greatest'
  );

  execute v_definition;
end;
$migration$;
