import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const container = String(
  process.env.M210_SUPABASE_DB_CONTAINER || "supabase_db_portal-v4-dev"
).trim();

if (!/^supabase_db_[a-z0-9_.-]+$/i.test(container)) {
  throw new Error("M210_SUPABASE_DB_CONTAINER ist ungültig.");
}

const actorId = "00000000-0000-4210-8000-00000000f201";
const externalUid = "m210-f2-concurrent@example.invalid";
const sourceKey = "ERV_BAYERNLIGA_2026_27";
const filenames = ["m210-f2-concurrent-a.ics", "m210-f2-concurrent-b.ics"];
const records = JSON.stringify([{
  uid: externalUid,
  eventDate: "2026-10-11",
  eventTime: "18:00:00",
  endDate: "2026-10-11",
  endTime: "20:30:00",
  venue: "F2 Concurrency Arena",
  homeAway: "HOME",
  opponentName: "F2 Parallelgegner"
}]);
const expectedState = JSON.stringify([{
  uid: externalUid,
  status: "NEW",
  eventId: null,
  revision: null
}]);

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function spawnPsql(sql) {
  const child = spawn("docker", [
    "exec", "-i", container,
    "psql", "-X", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", "postgres", "-qAt"
  ], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  const listeners = new Set();

  const notify = () => {
    for (const listener of listeners) listener(`${stdout}\n${stderr}`);
  };
  child.stdout.on("data", chunk => {
    stdout += chunk.toString("utf8");
    notify();
  });
  child.stderr.on("data", chunk => {
    stderr += chunk.toString("utf8");
    notify();
  });
  child.stdin.end(sql);

  const done = new Promise(resolve => {
    child.on("error", error => resolve({ code: -1, stdout, stderr: `${stderr}\n${error.message}` }));
    child.on("close", code => resolve({ code: code ?? -1, stdout, stderr }));
  });

  return {
    done,
    waitFor(marker, timeoutMs = 10_000) {
      return new Promise((resolve, reject) => {
        const inspect = output => {
          if (!output.includes(marker)) return;
          clearTimeout(timeout);
          listeners.delete(inspect);
          resolve();
        };
        const timeout = setTimeout(() => {
          listeners.delete(inspect);
          reject(new Error(`Marker nicht erreicht: ${marker}\n${stdout}\n${stderr}`));
        }, timeoutMs);
        listeners.add(inspect);
        inspect(`${stdout}\n${stderr}`);
      });
    }
  };
}

async function runPsql(sql) {
  const result = await spawnPsql(sql).done;
  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
  return `${result.stdout}\n${result.stderr}`;
}

const cleanupSql = `
begin;
delete from app_portal.audit_events where actor_user_id = ${sqlLiteral(actorId)}::uuid;
delete from app_modules.event_import_runs
where actor = ${sqlLiteral(actorId)}::uuid
   or original_filename in (${filenames.map(sqlLiteral).join(",")});
delete from app_modules.events
where id in (
  select event_id from app_modules.event_external_refs
  where source_type = 'ICS'
    and source_key = ${sqlLiteral(sourceKey)}
    and external_uid = ${sqlLiteral(externalUid)}
);
delete from app_portal.users where id = ${sqlLiteral(actorId)}::uuid;
delete from auth.users where id = ${sqlLiteral(actorId)}::uuid;
commit;
`;

const setupSql = `
${cleanupSql}
insert into auth.users(id, email)
values (${sqlLiteral(actorId)}::uuid, 'm210-f2-concurrency@example.invalid');
insert into app_portal.users(
  id, user_code, email, first_name, last_name, status, role_id
) values (
  ${sqlLiteral(actorId)}::uuid,
  'U-M210-F2-CONCURRENCY',
  'm210-f2-concurrency@example.invalid',
  'M210', 'F2Concurrency', 'ACTIVE',
  '00000000-0000-4000-8000-000000000001'::uuid
);
do $setup$
declare
  v_preview_a jsonb;
  v_preview_b jsonb;
begin
  v_preview_a := public.m210_ics_import_preview(
    ${sqlLiteral(actorId)}::uuid, 'ICS', ${sqlLiteral(sourceKey)}, ${sqlLiteral(records)}::jsonb
  );
  v_preview_b := public.m210_ics_import_preview(
    ${sqlLiteral(actorId)}::uuid, 'ICS', ${sqlLiteral(sourceKey)}, ${sqlLiteral(records)}::jsonb
  );
  if v_preview_a #>> '{items,0,status}' <> 'NEW'
     or v_preview_b #>> '{items,0,status}' <> 'NEW'
     or v_preview_a -> 'state' is distinct from ${sqlLiteral(expectedState)}::jsonb
     or v_preview_b -> 'state' is distinct from ${sqlLiteral(expectedState)}::jsonb then
    raise exception 'Beide Ausgangspreviews müssen NEW und identisch sein.';
  end if;
end
$setup$;
`;

const confirmArgs = filename => `
  ${sqlLiteral(actorId)}::uuid,
  'ICS',
  ${sqlLiteral(sourceKey)},
  ${sqlLiteral(filename)},
  repeat('c', 64),
  900,
  ${sqlLiteral(records)}::jsonb,
  ${sqlLiteral(expectedState)}::jsonb,
  repeat('d', 64)
`;

const sessionASql = `
begin;
do $session_a$
begin
  perform public.m210_ics_import_confirm(${confirmArgs(filenames[0])});
end
$session_a$;
\\echo M210_SESSION_A_CONFIRM_WRITTEN
select pg_sleep(3);
commit;
`;

const sessionBSql = `
do $session_b$
begin
  begin
    perform public.m210_ics_import_confirm(${confirmArgs(filenames[1])});
    raise exception 'Konkurrierender Confirm wurde unerwartet geschrieben.';
  exception when sqlstate 'P2101' then
    raise notice 'M210_SESSION_B_PREVIEW_STALE';
  end;
end
$session_b$;
`;

const verifySql = `
do $verify$
declare
  v_ref_count integer;
  v_event_count integer;
  v_run_count integer;
begin
  select count(*), count(event.id)
    into v_ref_count, v_event_count
  from app_modules.event_external_refs as ref
  join app_modules.events as event on event.id = ref.event_id
  where ref.source_type = 'ICS'
    and ref.source_key = ${sqlLiteral(sourceKey)}
    and ref.external_uid = ${sqlLiteral(externalUid)};

  select count(*) into v_run_count
  from app_modules.event_import_runs
  where actor = ${sqlLiteral(actorId)}::uuid
    and original_filename in (${filenames.map(sqlLiteral).join(",")});

  if v_ref_count <> 1 or v_event_count <> 1 or v_run_count <> 1 then
    raise exception 'Concurrency-Ergebnis ungültig: refs %, events %, runs %',
      v_ref_count, v_event_count, v_run_count;
  end if;
end
$verify$;
\\echo M210_CONCURRENCY_RUNTIME_OK
`;

let sessionA;
try {
  await runPsql(setupSql);
  sessionA = spawnPsql(sessionASql);
  await sessionA.waitFor("M210_SESSION_A_CONFIRM_WRITTEN");

  const competingStartedAt = performance.now();
  const sessionB = spawnPsql(sessionBSql);
  const [resultA, resultB] = await Promise.all([sessionA.done, sessionB.done]);
  const competingDurationMs = performance.now() - competingStartedAt;

  assert.equal(resultA.code, 0, `${resultA.stdout}\n${resultA.stderr}`);
  assert.equal(resultB.code, 0, `${resultB.stdout}\n${resultB.stderr}`);
  assert.match(`${resultB.stdout}\n${resultB.stderr}`, /M210_SESSION_B_PREVIEW_STALE/);
  assert.ok(
    competingDurationMs >= 1_500,
    `Session B wurde nicht erkennbar serialisiert (${competingDurationMs.toFixed(0)} ms).`
  );

  const verification = await runPsql(verifySql);
  assert.match(verification, /M210_CONCURRENCY_RUNTIME_OK/);
  console.log(`M210_CONCURRENCY_RUNTIME_OK · competing session ${competingDurationMs.toFixed(0)} ms`);
} finally {
  if (sessionA) await sessionA.done;
  await runPsql(cleanupSql);
}
