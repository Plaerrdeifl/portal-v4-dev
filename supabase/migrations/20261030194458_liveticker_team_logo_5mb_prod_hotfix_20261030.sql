-- PROD emergency hotfix, applied on 2026-10-30 as Supabase migration
-- version 20261030194458. This file keeps the DEV canonical migration history
-- authoritative. DEV's central logo upload is a different implementation:
-- do not replace it with the legacy PROD team-save function.
do $migration$
declare
  v_function text;
begin
  select pg_get_functiondef('app_private.api_liveticker_team_save(jsonb)'::regprocedure)
  into v_function;

  if position('Teamlogos werden über den zentralen Logo-Upload gespeichert.' in v_function) > 0 then
    -- DEV's central image upload has its own limits and migration path.
    raise notice 'Central DEV logo upload detected; PROD legacy hotfix not applicable';
  elsif position('char_length(v_logo_b64)>6990508' in v_function) > 0 then
    -- Already applied on PROD under this same migration version.
    raise notice 'PROD logo limit already raised';
  elsif position('char_length(v_logo_b64)>1400000' in v_function) > 0
    and position('octet_length(v_logo_data)>1048576' in v_function) > 0
    and position('Teamlogo darf maximal 1 MB groß sein.' in v_function) > 0 then
    v_function := replace(
      v_function,
      'char_length(v_logo_b64)>1400000',
      'char_length(v_logo_b64)>6990508'
    );
    v_function := replace(
      v_function,
      'octet_length(v_logo_data)>1048576',
      'octet_length(v_logo_data)>5242880'
    );
    v_function := replace(
      v_function,
      'Teamlogo darf maximal 1 MB groß sein.',
      'Teamlogo darf maximal 5 MB groß sein.'
    );
    execute v_function;

    execute 'alter table app_modules.liveticker_teams
      drop constraint if exists liveticker_teams_logo_upload_check';
    execute 'alter table app_modules.liveticker_teams
      add constraint liveticker_teams_logo_upload_check check (
        (logo_data is null and logo_mime is null and logo_sha256 is null)
        or (
          logo_data is not null
          and octet_length(logo_data) between 1 and 5242880
          and logo_mime in (''image/png'', ''image/jpeg'', ''image/webp'')
          and logo_sha256 ~ ''^[a-f0-9]{64}$''
        )
      )';
  else
    raise exception 'Unknown team-logo implementation: refusing automatic PROD hotfix';
  end if;
end;
$migration$;
