import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const migrationDirectory = path.join(root, "supabase", "migrations");
const migrationName = fs.readdirSync(migrationDirectory).find(name =>
  /^\d{14}_add_fanbus_publishing_queue_m340[.]sql$/.test(name)
);

assert.ok(migrationName, "M340 Slice-3-Migration fehlt");

const migration = fs.readFileSync(
  path.join(migrationDirectory, migrationName),
  "utf8"
);
const edge = fs.readFileSync(
  path.join(root, "supabase", "functions", "m340-publishing-worker", "index.ts"),
  "utf8"
);
const config = fs.readFileSync(path.join(root, "supabase", "config.toml"), "utf8");
const sqlTest = fs.readFileSync(
  path.join(root, "supabase", "tests", "m340_f4_slice3.sql"),
  "utf8"
);

function block(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} fehlt`);
  const end = endMarker ? source.indexOf(endMarker, start + startMarker.length) : -1;
  return source.slice(start, end === -1 ? source.length : end);
}

test("queue schema fixes states, attempts, job type, and claim invariants", () => {
  const table = block(
    migration,
    "create table app_modules.fanbus_publishing_jobs (",
    "create unique index fanbus_publishing_jobs_one_processing_environment_uidx"
  );

  assert.match(table, /job_type text not null default 'ASSET_BUNDLE'/);
  assert.match(table, /check \(job_type = 'ASSET_BUNDLE'\)/);
  assert.match(
    table,
    /check \(status in \('QUEUED', 'PROCESSING', 'SUCCESS', 'FAILED'\)\)/
  );
  assert.match(table, /check \(attempt_count between 0 and 5\)/);
  assert.match(table, /status = 'PROCESSING'[\s\S]*claim_token is not null/);
  assert.match(table, /claimed_at is not null[\s\S]*claim_expires_at is not null/);
  assert.match(table, /status <> 'PROCESSING'[\s\S]*claim_token is null/);
  assert.match(table, /status = 'SUCCESS'[\s\S]*result_manifest is not null/);
  assert.match(table, /status = 'FAILED'[\s\S]*last_error_code is not null/);
});

test("queue uniqueness and claim serialization are database-enforced", () => {
  assert.match(
    migration,
    /create unique index fanbus_publishing_jobs_one_processing_environment_uidx[\s\S]*on app_modules\.fanbus_publishing_jobs\(environment\)[\s\S]*where status = 'PROCESSING'/
  );
  assert.match(
    migration,
    /create unique index fanbus_publishing_jobs_active_trip_uidx[\s\S]*\(environment, trip_id\)[\s\S]*where status in \('QUEUED', 'PROCESSING'\)/
  );
  const claim = block(
    migration,
    "create function app_private.m340_fanbus_publishing_job_claim()",
    "create function public.pd_m340_fanbus_publishing_job_claim()"
  );
  assert.match(claim, /pg_advisory_xact_lock/);
  assert.match(claim, /hashtextextended\('m340-publishing:' \|\| v_environment, 0\)/);
  assert.match(claim, /for update skip locked/);
  assert.match(claim, /if exists \([\s\S]*status = 'PROCESSING'[\s\S]*'claimed', false/);
});

test("environment and enqueue are server-owned and use the existing projections", () => {
  const enqueue = block(
    migration,
    "create function app_private.api_fanbus_publishing_job_enqueue",
    "create function app_private.m340_fanbus_publishing_job_claim()"
  );

  assert.match(enqueue, /require_capability\('fanbus\.publishing\.manage'\)/);
  assert.doesNotMatch(enqueue, /require_capability\('fanbus\.manage'\)/);
  assert.match(enqueue, /platform_release_environment\(\)/);
  assert.match(enqueue, /p_payload - array\['tripId'\]::text\[\]/);
  assert.match(enqueue, /public\.pd_public_fanbus_trips\(\)/);
  assert.match(enqueue, /public\.pd_public_fanbus_trip_boarding_stops\(v_trip_id\)/);
  assert.match(enqueue, /fanbus_publishing_event_places/);
  assert.match(enqueue, /place\.is_active/);
  assert.match(enqueue, /trip\.status = 'PUBLISHED'/);
  assert.match(enqueue, /item\.value ->> 'tripStatus' = 'PUBLISHED'/);
  assert.match(enqueue, /on conflict \(environment, trip_id\)[\s\S]*do nothing/);
  assert.match(enqueue, /'FANBUS_PUBLISHING_JOB_ENQUEUED'/);
  assert.match(enqueue, /'fanbus_publishing_job'/);
  assert.doesNotMatch(enqueue, /p_payload\s*->>\s*'environment'/);
});

test("snapshot is immutable, path-only, and has the frozen top-level contract", () => {
  const enqueue = block(
    migration,
    "create function app_private.api_fanbus_publishing_job_enqueue",
    "create function app_private.m340_fanbus_publishing_job_claim()"
  );
  assert.match(
    enqueue,
    /jsonb_build_object\(\s*'schemaVersion', 1,\s*'shortlinkPath', '\/ontour\/' \|\| v_place_slug,\s*'place'/
  );
  assert.match(enqueue, /'trip', v_trip_projection/);
  assert.match(enqueue, /'boardingStops', v_boarding_stops/);
  assert.doesNotMatch(enqueue, /https?:\/\//i);
  assert.match(migration, /M340_PUBLISHING_REQUEST_SNAPSHOT_IMMUTABLE/);

  for (const forbidden of [
    "fanbus_registrations",
    "registration_names",
    "participantEmail",
    "participantPhone",
    "portalUserId",
    "userAgent",
    "deviceId",
    "fingerprint",
    "cookie"
  ]) {
    assert.doesNotMatch(enqueue, new RegExp(forbidden, "i"));
  }
});

test("pd_api routes enqueue through the USER_MUTATION gate", () => {
  assert.match(
    migration,
    /v_action = 'fanbus_publishing_job_enqueue'[\s\S]*api_fanbus_publishing_job_enqueue/
  );
  assert.match(
    migration,
    /when 'fanbus_publishing_job_enqueue' then 'USER_MUTATION'/
  );
});

test("claim lease and retry schedule are exact", () => {
  const retry = block(
    migration,
    "create function app_private.m340_fanbus_publishing_retry_delay",
    "create function app_private.m340_fanbus_publishing_manifest_is_valid"
  );
  for (const [attempt, minutes] of [[1, 1], [2, 5], [3, 15], [4, 60]]) {
    assert.match(retry, new RegExp(`when ${attempt} then interval '${minutes} minute`));
  }
  assert.match(retry, /else null/);

  const claim = block(
    migration,
    "create function app_private.m340_fanbus_publishing_job_claim()",
    "create function public.pd_m340_fanbus_publishing_job_claim()"
  );
  assert.match(claim, /attempt_count = job\.attempt_count \+ 1/);
  assert.match(claim, /claim_token = extensions\.gen_random_uuid\(\)/);
  assert.match(claim, /claim_expires_at = v_now \+ interval '15 minutes'/);
  assert.match(claim, /attempt_count >= 5 then 'FAILED'/);
  assert.match(claim, /last_error_code = 'CLAIM_EXPIRED'/);
});

test("complete is current-claim-bound and replay-safe", () => {
  const complete = block(
    migration,
    "create function app_private.m340_fanbus_publishing_job_complete(",
    "create function public.pd_m340_fanbus_publishing_job_complete("
  );
  assert.match(complete, /status <> 'PROCESSING'/);
  assert.match(complete, /claim_token is distinct from p_claim_token/);
  assert.match(complete, /claim_expires_at <= v_now/);
  assert.match(complete, /last_completed_claim_token is not distinct from p_claim_token/);
  assert.match(complete, /'idempotent', true/);
  assert.match(complete, /M340_PUBLISHING_COMPLETE_REPLAY_CONFLICT/);
  assert.match(complete, /M340_PUBLISHING_CLAIM_INVALID/);
  assert.match(complete, /attempt_count >= 5 then 'FAILED'/);
});

test("result manifest requires exactly the four fixed PNG artifacts", () => {
  const validator = block(
    migration,
    "create function app_private.m340_fanbus_publishing_manifest_is_valid",
    "create function app_private.api_fanbus_publishing_job_enqueue"
  );
  assert.match(validator, /jsonb_array_length\(p_manifest -> 'artifacts'\) = 4/);
  for (const kind of ["QR", "POST", "STORY", "LED"]) {
    assert.match(validator, new RegExp(`'kind' = '${kind}'`));
  }
  assert.match(validator, /array\[\s*'bytes', 'filename', 'kind', 'nextcloudPath', 'sha256'/);
  assert.match(validator, /char_length\(artifact\.value ->> 'filename'\) between 1 and 160/);
  assert.match(validator, /'\^\[A-Za-z0-9\._-\]\+\[\.\]png\$'/);
  assert.match(validator, /like '\/Fanbus\/%'/);
  assert.match(validator, /strpos\(artifact\.value ->> 'nextcloudPath', '\.\.'/);
  assert.match(validator, /not like 'http:\/\/%'/);
  assert.match(validator, /not like 'https:\/\/%'/);
  assert.match(validator, /'\^\[0-9a-f\]\{64\}\$'/);
  assert.match(validator, /between 1 and 104857600/);
});

test("worker RPCs are service-role-only and the queue is default-deny", () => {
  assert.match(migration, /alter table app_modules\.fanbus_publishing_jobs enable row level security/);
  assert.match(
    migration,
    /revoke all on table app_modules\.fanbus_publishing_jobs\s+from public, anon, authenticated, service_role/
  );
  for (const signature of [
    "public.pd_m340_fanbus_publishing_job_claim()",
    "public.pd_m340_fanbus_publishing_job_complete("
  ]) {
    assert.match(migration, new RegExp(`grant execute on function ${signature.replace(/[.()]/g, "\\$&")}[\\s\\S]*to service_role`));
  }
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.pd_m340_fanbus_publishing_job_(?:claim|complete)[\s\S]*to (?:anon|authenticated|public)/
  );
});

test("Edge gateway uses the exact custom token with constant-time comparison", () => {
  assert.match(edge, /X-M340-Worker-Token/);
  assert.match(edge, /Deno\.env\.get\("M340_WORKER_TOKEN"\)/);
  assert.match(edge, /MIN_WORKER_TOKEN_BYTES = 32/);
  assert.match(edge, /MAX_SECRET_LENGTH = 2_048/);
  assert.match(edge, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(edge, /difference \|= expectedBytes\[index\] \^ suppliedBytes\[index\]/);
  assert.doesNotMatch(edge, /suppliedWorkerToken\s*===\s*configuredWorkerToken/);
  assert.doesNotMatch(edge, /console\.(?:log|debug|info|warn|error)/);
});

test("Edge gateway is POST-only, bounded, strict, and leaks no internal errors", () => {
  assert.match(edge, /if \(request\.method !== "POST"\) return errorResponse\(405\)/);
  assert.match(edge, /MAX_BODY_BYTES = 65_536/);
  assert.match(edge, /totalBytes > MAX_BODY_BYTES/);
  assert.match(edge, /hasExactKeys\(value, \["action"\]\)/);
  assert.match(edge, /value\.action !== "complete"/);
  for (const key of ["jobId", "claimToken", "success", "errorCode", "result"]) {
    assert.match(edge, new RegExp(`"${key}"`));
  }
  assert.match(edge, /return errorResponse\(400\)/);
  assert.match(edge, /return errorResponse\(401\)/);
  assert.match(edge, /return errorResponse\(500\)/);
  assert.match(edge, /"Invalid request"/);
  assert.match(edge, /"Internal error"/);
  assert.doesNotMatch(edge, /error\.stack|error\.message|JSON\.stringify\(error\)/);
});

test("Edge gateway uses fixed RPCs and runtime-only Supabase secrets", () => {
  assert.match(edge, /SUPABASE_SECRET_KEYS/);
  assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edge, /CLAIM_RPC = "pd_m340_fanbus_publishing_job_claim"/);
  assert.match(edge, /COMPLETE_RPC = "pd_m340_fanbus_publishing_job_complete"/);
  assert.match(edge, /\/rest\/v1\/rpc\/\$\{rpcName\}/);
  assert.match(edge, /rpcName: typeof CLAIM_RPC \| typeof COMPLETE_RPC/);
  assert.doesNotMatch(edge, /payload\.(?:rpc|rpcName|supabaseUrl|url)/);
  assert.doesNotMatch(edge, /jsonResponse\([^)]*supabaseSecretKey/);
});

test("Edge function config disables JWT only for the custom-auth gateway", () => {
  assert.match(
    config,
    /\[functions\.m340-publishing-worker\]\s+verify_jwt = false/
  );
});

test("Slice 3 does not implement delivery, rendering, WordPress, or WebDAV", () => {
  const implementation = `${migration}\n${edge}`;
  for (const forbidden of [
    "wordpress/",
    "wp-content",
    "inkscape",
    "KOMIKAX",
    "QRCode",
    "qr-code",
    "WebDAV",
    "PROPFIND"
  ]) {
    assert.doesNotMatch(implementation, new RegExp(forbidden, "i"));
  }
  assert.doesNotMatch(
    migration,
    /alter table app_modules\.(?:fanbus_trips|fanbus_registrations|fanbus_buses|events)\b/i
  );
});

test("SQL contract covers security, retries, idempotency, manifest, and compatibility", () => {
  for (const marker of [
    "M340_SLICE3_SCHEMA_OK",
    "M340_SLICE3_ENVIRONMENT_OK",
    "M340_SLICE3_AUTH_ENQUEUE_OK",
    "M340_SLICE3_CLAIM_SUCCESS_OK",
    "M340_SLICE3_MANIFEST_OK",
    "M340_SLICE3_RETRY_OK",
    "M340_SLICE3_EXPIRY_OK",
    "M340_SLICE3_CONSTRAINTS_OK",
    "M340_SLICE3_SECURITY_COMPATIBILITY_OK"
  ]) {
    assert.match(sqlTest, new RegExp(marker));
  }
  assert.match(sqlTest, /begin;/);
  assert.match(sqlTest, /rollback;/);
  assert.match(sqlTest, /BUS_PUBLISHING/);
  assert.match(sqlTest, /fanbus\.publishing\.manage/);
  assert.match(sqlTest, /public\.pd_api\(/);
  assert.match(sqlTest, /M340_PUBLISHING_COMPLETE_REPLAY_CONFLICT/);
  assert.match(sqlTest, /M340_PUBLISHING_CLAIM_INVALID/);
});
