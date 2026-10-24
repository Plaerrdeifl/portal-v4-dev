import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const identifier = '(?:"(?:[^"]|"")*"|[a-z_][a-z0-9_$]*)';
const createTable = new RegExp('\\bcreate\\s+(?:(?:unlogged|temporary|temp)\\s+)?table\\s+(?:if\\s+not\\s+exists\\s+)?(' + identifier + ')(?:\\s*\\.\\s*(' + identifier + '))?', 'gi');

function normalizeIdentifier(raw) {
  return raw.startsWith('"') ? raw.slice(1, -1).replaceAll('""', '"') : raw.toLowerCase();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
}

function tableRef(name) {
  const component = name === name.toLowerCase()
    ? '(?:' + escapeRegex(name) + '|"' + escapeRegex(name) + '")'
    : '"' + escapeRegex(name.replaceAll('"', '""')) + '"';
  return '(?:public|"public")\\s*\\.\\s*' + component;
}

// Mask comments and literal/function bodies so DDL examples do not trigger checks.
export function maskNonSql(source) {
  let output = '';
  let i = 0;
  const hide = s => s.replace(/[^\n]/g, ' ');
  while (i < source.length) {
    if (source.startsWith('--', i)) {
      const end = source.indexOf('\n', i);
      const stop = end < 0 ? source.length : end;
      output += hide(source.slice(i, stop));
      i = stop;
    } else if (source.startsWith('/*', i)) {
      const start = i;
      i += 2;
      let depth = 1;
      while (i < source.length && depth) {
        if (source.startsWith('/*', i)) { depth++; i += 2; }
        else if (source.startsWith('*/', i)) { depth--; i += 2; }
        else i++;
      }
      output += hide(source.slice(start, i));
    } else if (source[i] === "'") {
      const start = i++;
      const escaped = start > 0 && /[eE]/.test(source[start - 1]) && (start === 1 || !/\w/.test(source[start - 2]));
      while (i < source.length) {
        if (escaped && source[i] === '\\') { i += 2; continue; }
        if (source[i] === "'") {
          if (source[i + 1] === "'") { i += 2; continue; }
          i++;
          break;
        }
        i++;
      }
      output += hide(source.slice(start, i));
    } else if (source[i] === '$') {
      const tag = /^\$(?:[a-z_][a-z0-9_]*)?\$/i.exec(source.slice(i));
      if (tag) {
        const start = i;
        const end = source.indexOf(tag[0], i + tag[0].length);
        i = end < 0 ? source.length : end + tag[0].length;
        output += hide(source.slice(start, i));
      } else output += source[i++];
    } else output += source[i++];
  }
  return output;
}

export function inspectMigration(source, filename = 'migration.sql') {
  const sql = maskNonSql(source);
  const statements = sql.split(';').map(value => value.trim()).filter(Boolean);
  const issues = [];
  for (const statement of statements) {
    if (/\balter\s+default\s+privileges\b/i.test(statement) &&
        /\bgrant\b[\s\S]*\bon\s+tables\b[\s\S]*\bto\b/i.test(statement) &&
        /\b(?:anon|authenticated|service_role)\b/i.test(statement)) {
      issues.push(filename + ': no automatic GRANT via ALTER DEFAULT PRIVILEGES');
    }
    if (/\bgrant\b[\s\S]*\bon\s+all\s+tables\s+in\s+schema\s+(?:public|"public")\b/i.test(statement)) {
      issues.push(filename + ': blanket GRANT ON ALL TABLES IN public is forbidden');
    }
  }
  createTable.lastIndex = 0;
  for (const match of sql.matchAll(createTable)) {
    if (!match[2]) {
      issues.push(filename + ': unqualified CREATE TABLE ' + match[1] + '; use an explicit schema');
      continue;
    }
    if (normalizeIdentifier(match[1]) !== 'public') continue;
    const tableName = normalizeIdentifier(match[2]);
    const reference = tableRef(tableName);
    const rls = new RegExp('\\balter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?' + reference + '\\s+enable\\s+row\\s+level\\s+security\\b', 'i');
    if (!rls.test(sql)) issues.push(filename + ': public.' + tableName + ' needs ENABLE ROW LEVEL SECURITY');

    const grant = new RegExp('\\bgrant\\s+([\\s\\S]*?)\\s+on\\s+(?:table\\s+)?' + reference + '\\s+to\\s+([^;]+)', 'i');
    const revoke = new RegExp('\\brevoke\\s+all\\s+(?:privileges\\s+)?on\\s+(?:table\\s+)?' + reference + '\\s+from\\s+([^;]+)', 'i');
    const granted = statements.map(statement => statement.match(grant)).find(Boolean);
    const revoked = statements.map(statement => statement.match(revoke)).find(Boolean);
    if (granted && /\ball\b/i.test(granted[1])) issues.push(filename + ': public.' + tableName + ' uses GRANT ALL; use minimal privileges');
    if (granted && /\bpublic\b/i.test(granted[2])) issues.push(filename + ': public.' + tableName + ' must not GRANT to the PUBLIC role');
    const privateAccess = revoked && ['anon', 'authenticated', 'service_role'].every(role => new RegExp('\\b' + role + '\\b', 'i').test(revoked[1]));
    const apiAccess = granted && ['anon', 'authenticated', 'service_role'].some(role => new RegExp('\\b' + role + '\\b', 'i').test(granted[2]));
    if (!privateAccess && !apiAccess) {
      issues.push(filename + ': public.' + tableName + ' needs explicit access decision: minimal GRANT for intended API access, or REVOKE ALL FROM anon, authenticated, service_role');
    }
  }
  return issues;
}

function changedMigrations(base) {
  if (!/^[a-f\d]{40}$/i.test(base)) throw new Error('--base requires a 40-character commit SHA');
  const diff = execFileSync('git', ['diff', '--diff-filter=ACMR', '--name-only', base, 'HEAD', '--', 'supabase/migrations'], { cwd: root, encoding: 'utf8' });
  return diff.split('\n').filter(name => /^supabase\/migrations\/[a-z\d_.-]+\.sql$/i.test(name));
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--base') {
    console.error('Usage: node scripts/check-public-table-access.mjs --base <commit-sha>');
    process.exitCode = 2;
    return;
  }
  const files = changedMigrations(args[1]);
  const issues = files.flatMap(file => inspectMigration(readFileSync(join(root, file), 'utf8'), file));
  for (const issue of issues) console.error('ERROR: ' + issue);
  if (issues.length) process.exitCode = 1;
  else console.log('Public-table check passed (' + files.length + ' changed migration(s)).');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
