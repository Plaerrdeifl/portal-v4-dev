-- M340 DEV: direct read-only flyer downloads via Nextcloud public shares.
create or replace function app_private.m340_fanbus_publishing_manifest_is_valid(p_manifest jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select
    p_manifest is not null
    and pg_catalog.jsonb_typeof(p_manifest) = 'object'
    and (select pg_catalog.array_agg(entry.key order by entry.key) from pg_catalog.jsonb_object_keys(p_manifest) as entry(key)) = array['artifacts','schemaVersion']::text[]
    and p_manifest -> 'schemaVersion' = '1'::jsonb
    and pg_catalog.jsonb_typeof(p_manifest -> 'artifacts') = 'array'
    and pg_catalog.jsonb_array_length(p_manifest -> 'artifacts') = 4
    and (
      select pg_catalog.count(*) = 4
        and pg_catalog.count(distinct artifact.value ->> 'kind') = 4
        and pg_catalog.bool_and(
          pg_catalog.jsonb_typeof(artifact.value) = 'object'
          and (select pg_catalog.array_agg(field.key order by field.key) from pg_catalog.jsonb_object_keys(artifact.value) as field(key))
              = array['bytes','downloadUrl','filename','kind','nextcloudPath','sha256','shareUrl']::text[]
          and pg_catalog.jsonb_typeof(artifact.value -> 'kind') = 'string'
          and artifact.value ->> 'kind' in ('QR','POST','STORY','LED')
          and pg_catalog.jsonb_typeof(artifact.value -> 'filename') = 'string'
          and artifact.value ->> 'filename' ~ '^[A-Za-z0-9._-]+[.]png$'
          and pg_catalog.jsonb_typeof(artifact.value -> 'nextcloudPath') = 'string'
          and artifact.value ->> 'nextcloudPath' like '/Fanbus/%'
          and pg_catalog.strpos(artifact.value ->> 'nextcloudPath','..') = 0
          and pg_catalog.strpos(artifact.value ->> 'nextcloudPath',E'\\') = 0
          and pg_catalog.strpos(artifact.value ->> 'nextcloudPath','?') = 0
          and pg_catalog.strpos(artifact.value ->> 'nextcloudPath','#') = 0
          and pg_catalog.jsonb_typeof(artifact.value -> 'sha256') = 'string'
          and artifact.value ->> 'sha256' ~ '^[0-9a-f]{64}$'
          and pg_catalog.jsonb_typeof(artifact.value -> 'bytes') = 'number'
          and artifact.value ->> 'bytes' ~ '^[0-9]+$'
          and (artifact.value ->> 'bytes')::numeric between 1 and 104857600
          and pg_catalog.jsonb_typeof(artifact.value -> 'shareUrl') = 'string'
          and artifact.value ->> 'shareUrl' ~ '^https://cloud[.]plaerrdeifl[.]de/s/[A-Za-z0-9]{8,128}$'
          and pg_catalog.jsonb_typeof(artifact.value -> 'downloadUrl') = 'string'
          and artifact.value ->> 'downloadUrl' = (artifact.value ->> 'shareUrl') || '/download'
        )
        and pg_catalog.count(*) filter (where artifact.value ->> 'kind'='QR') = 1
        and pg_catalog.count(*) filter (where artifact.value ->> 'kind'='POST') = 1
        and pg_catalog.count(*) filter (where artifact.value ->> 'kind'='STORY') = 1
        and pg_catalog.count(*) filter (where artifact.value ->> 'kind'='LED') = 1
      from pg_catalog.jsonb_array_elements(p_manifest -> 'artifacts') artifact(value)
    );
$function$;
