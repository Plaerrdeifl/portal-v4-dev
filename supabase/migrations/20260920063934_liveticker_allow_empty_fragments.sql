-- Plärrdeifl Portal V4 - allow empty Liveticker text fragments
begin;

alter table app_modules.liveticker_output_variants
  drop constraint liveticker_output_variants_template_check;

alter table app_modules.liveticker_output_variants
  add constraint liveticker_output_variants_template_check
  check (char_length(template_text) between 0 and 4000);

create or replace function app_private.liveticker_output_variant_validate_row()
returns trigger language plpgsql set search_path=''
as $$
declare v_type app_modules.liveticker_output_types%rowtype;
begin
  if tg_op='UPDATE' and new.output_type_key is distinct from old.output_type_key then
    raise exception 'Der Ausgabetyp einer Variante darf nicht geändert werden.' using errcode='22023';
  end if;
  select * into v_type from app_modules.liveticker_output_types where type_key=new.output_type_key;
  if not found then raise exception 'Unbekannter Ausgabetyp.' using errcode='22023'; end if;

  if not (v_type.category='FRAGMENT' and char_length(btrim(new.template_text))=0) then
    perform app_private.liveticker_validate_output_variant(
      new.template_text,
      v_type.allowed_variables,
      v_type.required_variables
    );
  end if;

  return new;
end $$;

create or replace function app_private.api_liveticker_output_variant_save(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=app_private.liveticker_require_operator();
  v_id uuid:=nullif(btrim(coalesce(p_payload->>'id','')),'')::uuid;
  v_type_key text:=btrim(coalesce(p_payload->>'outputType',''));
  v_name text:=btrim(coalesce(p_payload->>'name',''));
  v_template text:=coalesce(p_payload->>'template','');
  v_sort integer:=nullif(btrim(coalesce(p_payload->>'sortOrder','')),'')::integer;
  v_active boolean:=coalesce((p_payload->>'active')::boolean,true);
  v_default boolean:=coalesce((p_payload->>'default')::boolean,false);
  v_expected integer:=nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer;
  v_existing app_modules.liveticker_output_variants%rowtype;
  v_type app_modules.liveticker_output_types%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if v_name='' or char_length(v_name)>80 then
    raise exception 'Variantenname ist erforderlich und darf maximal 80 Zeichen haben.' using errcode='22023';
  end if;

  select * into v_type from app_modules.liveticker_output_types where type_key=v_type_key;
  if not found then raise exception 'Unbekannter Ausgabetyp.' using errcode='22023'; end if;

  if not (v_type.category='FRAGMENT' and char_length(btrim(v_template))=0) then
    perform app_private.liveticker_validate_output_variant(
      v_template,
      v_type.allowed_variables,
      v_type.required_variables
    );
  end if;

  if v_sort is null then
    select coalesce(max(sort_order),0)+10
      into v_sort
      from app_modules.liveticker_output_variants
      where output_type_key=v_type_key;
  end if;

  if v_sort<1 then raise exception 'Sortierung muss mindestens 1 sein.' using errcode='22023'; end if;
  if v_default and not v_active then raise exception 'Die Standardvariante muss aktiv sein.' using errcode='22023'; end if;

  if v_default then
    update app_modules.liveticker_output_variants set
      is_default=false,revision=revision+1,updated_at=now(),updated_by=v_actor
    where output_type_key=v_type_key and is_default and (v_id is null or id<>v_id);
  end if;

  if v_id is null then
    insert into app_modules.liveticker_output_variants(
      output_type_key,display_name,template_text,sort_order,is_active,is_default,created_by,updated_by
    )
    values(v_type_key,v_name,v_template,v_sort,v_active,v_default,v_actor,v_actor)
    returning id into v_id;
    v_before:=null;
  else
    select * into v_existing
      from app_modules.liveticker_output_variants
      where id=v_id
      for update;

    if not found then raise exception 'Ausgabevariante wurde nicht gefunden.' using errcode='P0002'; end if;
    if v_existing.output_type_key<>v_type_key then
      raise exception 'Der Ausgabetyp einer Variante darf nicht geändert werden.' using errcode='22023';
    end if;
    if v_expected is null or v_expected<>v_existing.revision then
      raise exception 'Die Ausgabevariante wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001';
    end if;
    if v_existing.is_active and not v_active and (
      select count(*) from app_modules.liveticker_output_variants
      where output_type_key=v_type_key and is_active
    )<=1 then
      raise exception 'Mindestens eine aktive Variante muss erhalten bleiben.' using errcode='22023';
    end if;

    v_before:=to_jsonb(v_existing);
    update app_modules.liveticker_output_variants set
      display_name=v_name,
      template_text=v_template,
      sort_order=v_sort,
      is_active=v_active,
      is_default=v_default,
      revision=revision+1,
      updated_at=now(),
      updated_by=v_actor
    where id=v_id;
  end if;

  if not v_default and not exists(
    select 1 from app_modules.liveticker_output_variants
    where output_type_key=v_type_key and is_default
  ) then
    update app_modules.liveticker_output_variants set
      is_default=true,revision=revision+1,updated_at=now(),updated_by=v_actor
    where id=(
      select id from app_modules.liveticker_output_variants
      where output_type_key=v_type_key and is_active
      order by sort_order,id
      limit 1
    );
  end if;

  select to_jsonb(v) into v_after
    from app_modules.liveticker_output_variants v
    where v.id=v_id;

  perform app_private.log_audit(
    v_actor,
    case when v_before is null then 'LIVETICKER_OUTPUT_VARIANT_CREATED' else 'LIVETICKER_OUTPUT_VARIANT_UPDATED' end,
    'liveticker_output_variant',
    v_id::text,
    v_before,
    v_after,
    jsonb_build_object('outputType',v_type_key)
  );

  return app_private.liveticker_textsystem_json(true);
end $$;

commit;
