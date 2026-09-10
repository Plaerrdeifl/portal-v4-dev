do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('app_private.api_liveticker_graphic_template_save(jsonb)'::regprocedure)
    into v_definition;
  if position('524288' in v_definition) = 0 then
    raise exception 'LIVETICKER_TEMPLATE_SAVE_LIMIT_SIGNATURE_MISSING';
  end if;
  v_definition := replace(v_definition, '524288', '1048576');
  v_definition := replace(v_definition, '512 KB', '1 MiB');
  execute v_definition;
end;
$$;

revoke all on function app_private.api_liveticker_graphic_template_save(jsonb) from public,anon,authenticated;
