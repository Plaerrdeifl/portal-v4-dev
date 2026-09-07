create or replace function app_private.liveticker_graphic_manifest_valid(p_manifest jsonb,p_kind text)
returns boolean
language plpgsql
immutable
set search_path=''
as $$
declare
  v_artifact jsonb;
  v_seen text[]:=array[]::text[];
  v_kind text;
  v_share text;
  v_download text;
begin
  if jsonb_typeof(p_manifest)<>'object'
     or p_manifest->>'schemaVersion'<>'1'
     or upper(coalesce(p_manifest->>'graphicKind',''))<>upper(coalesce(p_kind,''))
     or jsonb_typeof(p_manifest->'artifacts')<>'array'
     or jsonb_array_length(p_manifest->'artifacts')<>2 then
    return false;
  end if;

  for v_artifact in select value from jsonb_array_elements(p_manifest->'artifacts') loop
    v_kind:=upper(coalesce(v_artifact->>'kind',''));
    if v_kind not in ('POST','STORY') or v_kind=any(v_seen) then return false; end if;
    if coalesce(v_artifact->>'filename','') !~ '^[A-Za-z0-9._-]+[.]png$' then return false; end if;
    if coalesce(v_artifact->>'nextcloudPath','') not like '/Liveticker/%'
       or (v_artifact->>'nextcloudPath') like '%..%'
       or (v_artifact->>'nextcloudPath') like '%\\%'
       or (v_artifact->>'nextcloudPath') like '%?%'
       or (v_artifact->>'nextcloudPath') like '%#%' then return false; end if;
    if coalesce(v_artifact->>'sha256','') !~ '^[0-9a-f]{64}$' then return false; end if;
    if coalesce(v_artifact->>'bytes','') !~ '^[0-9]+$'
       or (v_artifact->>'bytes')::numeric not between 1 and 104857600 then return false; end if;

    v_share:=coalesce(v_artifact->>'shareUrl','');
    v_download:=coalesce(v_artifact->>'downloadUrl','');
    if v_share !~ '^https://cloud[.]plaerrdeifl[.]de/s/[A-Za-z0-9]{8,128}$' then return false; end if;
    if v_download <> (v_share || '/download') then return false; end if;

    v_seen:=array_append(v_seen,v_kind);
  end loop;
  return array['POST','STORY'] <@ v_seen;
exception when others then
  return false;
end;
$$;
