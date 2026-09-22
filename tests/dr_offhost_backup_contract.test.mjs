import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const backupDir = path.join(root, 'scripts', 'dr-backup');

const read = (name) => fs.readFileSync(path.join(backupDir, name), 'utf8');

const script = read('plaerrdeifl-dr-backup');
const service = read('plaerrdeifl-dr-backup.service');
const timer = read('plaerrdeifl-dr-backup.timer');
const envExample = read('env.example');
const recovery = fs.readFileSync(path.join(root, 'docs', 'DR_RECOVERY.md'), 'utf8');

test('DR backup never auto-initializes an unknown restic target', () => {
  assert.match(script, /restic snapshots --json/);
  assert.doesNotMatch(script, /restic init/);
});

test('DR backup contains Supabase DB, Storage, local snapshot and runtime sources', () => {
  assert.match(script, /supabase db dump/);
  assert.match(script, /--role-only/);
  assert.match(script, /--data-only/);
  assert.match(script, /storage cp/);
  assert.match(script, /local_snapshot/);
  assert.match(script, /\/srv\/docker\/liveticker\/prod\/secrets/);
  assert.match(script, /\/srv\/docker\/m340-prod\/secrets/);
  assert.match(script, /\/srv\/docker\/nextcloud\/\.env/);
});

test('DR backup uses locking, integrity checks and multiple retention generations', () => {
  assert.match(script, /flock -n/);
  assert.match(script, /sha256sum -c/);
  assert.match(script, /restic check/);
  assert.match(script, /--keep-daily/);
  assert.match(script, /--keep-weekly/);
  assert.match(script, /--keep-monthly/);
});

test('systemd timer is daily and service has a hard timeout', () => {
  assert.match(timer, /OnCalendar=\*-\*-\* 05:45:00/);
  assert.match(timer, /Persistent=true/);
  assert.match(service, /TimeoutStartSec=6h/);
  assert.match(service, /EnvironmentFile=\/etc\/plaerrdeifl-dr-backup\/env/);
});

test('examples and documentation contain no real restic credential', () => {
  assert.match(envExample, /example\.invalid/);
  assert.match(recovery, /Credential-Escrow/);
  assert.doesNotMatch(envExample, /sbp_[A-Za-z0-9]/);
  assert.doesNotMatch(recovery, /sbp_[A-Za-z0-9]/);
});
