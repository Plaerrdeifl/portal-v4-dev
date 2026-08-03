# Operator framework contracts v1

The Plaerrdeifl Portal Operator framework version is `1.0.0`. Manifest schema 1 and result schema 1 are closed contracts; unknown properties are rejected.

## Stages, status, and exit codes

Local stages are `SelfTest`, `Preflight`, `LocalVerify`, and `LocalFreeze`. Package B accepts a valid manifest for these stages but returns `blocked`/`20`, because process management and complete check execution arrive in packages C/D. `DevDeploy`, `DevVerify`, `ProdPreflight`, `ProdDeploy`, and `ProdVerify` are actively blocked with `blocked`/`20`.

The status/exit-code pairs are: `passed`/`0`, `failed`/`10`, `blocked`/`20`, and `error`/`30` (invocation or manifest) or `error`/`40` (internal operator failure). M000-R1-B never produces a passed run.

## Manifest contract

The manifest identifies schema versions, operator version, module, revision, name, and one to four local stage definitions. Each stage contains one or more unique checks with only `checkId`, `targetId`, `timeoutProfile`, and `required`. Objects are closed. Executable content, commands, arbitrary arguments, URLs, SQL, credentials, secrets, custom timeouts, and success markers are not permitted. Input is strictly decoded as UTF-8, duplicate object properties and non-strict JSON are rejected, and the original bytes are SHA-256 hashed before parsing.

## Result contract and reporting

Result schema 1 records run identity, stage, status, exit code, UTC timestamps, duration, run directory, checks, messages, and cleanup; module, revision, and manifest hash are optional except for passed results. Schema validation is followed by semantic validation of status/exit-code pairing, timestamps, duration, passed-check states, and cleanup. Reports are UTF-8 without BOM and are replaced atomically from a temporary file in the same directory. Snapshot writers accept only fully typed closed objects, reject CR/LF/null in reported strings, and complete validation before creating or replacing a report. No type coercion can make invalid external data reportable. `invocation.json` contains only an exact registered stage or `INVALID`, always redacts `manifestPath` to `<redacted>`, and retains only its canonical UTC invocation time.

Success markers are centrally owned by reporting: `V4_M000_R1_SELFTEST_OK`, `V4_M000_R1_PREFLIGHT_OK`, `V4_M000_R1_LOCAL_OK`, and `V4_M000_R1_LOCAL_FROZEN`. A marker can appear only after schema and semantic validation and an atomic `result.json` write for `passed`/`0`; neither manifests nor checks can supply one.

## Timeouts and registry

The immutable timeout profiles are `short` = 15 seconds, `standard` = 60 seconds, and `long` = 300 seconds. The code-owned registry maps a unique `CheckId` + `TargetId` to non-empty local `AllowedStages` and a trusted-code `Handler`. Manifests cannot register or execute handlers. Registry reads return copies.

## Repository snapshot and Git inspection

Repository snapshot schema 1 is closed and records repository root, full lowercase HEAD SHA, case-sensitive branch, nullable upstream, exact ordinal remote name/URL mappings, working-tree state, and canonical UTC capture time. Malformed snapshot data produces a structured invalid result with fixed violations; only a malformed trusted policy is an internal error. The trusted policy owns expected root, branch, upstream, exact remotes, and optional HEAD binding. The M000 working policy and report writer require `infra/m000-r1`, no upstream, `origin` = `https://github.com/Plaerrdeifl/portal.git`, and `v4dev` = `https://github.com/Plaerrdeifl/portal-v4-dev.git`. Query, fragment, credentials, alternative schemes, relative forms, and URL normalization are forbidden.

The package-B Git inspection plan is immutable and read-only. It covers root, HEAD, branch, upstream, remote URLs, and porcelain status. It is data for the later process manager, not an execution wrapper; package B never starts Git. Only exact registered target-and-argument pairs pass the security contract. No network or write operation is registered.

## Working-tree fingerprint

Working-tree fingerprint schema 1 reports algorithm `SHA256`, lowercase fingerprint, HEAD, entry count, and UTC creation time. The hash is computed from canonical UTF-8-without-BOM data containing HEAD, branch, upstream, ordinally sorted remote mappings, and ordinally sorted repository-relative status entries. Every dynamic field is encoded by UTF-8 byte length and Base64 rather than raw delimiters. Each entry includes its status and a distinct file/hash, missing/deleted, directory, or final-reparse-point representation. A final reparse point is not followed or hashed; any parent reparse point blocks the fingerprint. Absolute repository paths, timestamps, source content, and diffs are excluded. Comparison first validates both operands as closed PSCustomObjects with integer schema 1, exact `SHA256`, lowercase 64-character fingerprint, lowercase 40-character HEAD, non-negative integer entry count, and exact canonical UTC timestamp. Invalid operands return a fixed non-match without exposing values; equally invalid operands never match.

## Path and secret policy

The deny-by-default change policy allows only `scripts/operator/**`, `docs/project/**`, and `docs/modules/M000/R1/**`. `.gitignore` and every unlisted path are blocked. The repository root must be an existing non-reparse directory reached without an absolute parent junction or symlink. Canonical Windows resolution rejects absolute, UNC, device, drive, ADS, control characters, traversal, `.git`, root-escaping, and reparse-point routes. Segments with trailing spaces or dots, reserved device names including extension forms, 8.3 short names, case variants that resolve to a differently spelled existing entry, and other normalization aliases are forbidden. The canonical target is derived segment by segment after `GetFullPath`; its slash-normalized relative path must equal the checked input ordinally, without relying on a prefix-only containment decision.

Secret scanning is a blocking hint mechanism for regular text files within the repository up to 1,048,576 bytes. A bounded stream reads at most one additional byte to detect oversize files. Findings are closed metadata containing only rule ID, relative path, safe line number, severity, and fixed description. Matches, full lines, credentials, connection strings, and exception text are never reported. Placeholders and explicit example/dummy forms are excluded.

## Environment and local-mode protection

Environment snapshot schema 1 is closed and contains a canonical UTC capture time plus exactly one deterministic record for every trusted tool ID: scalar ID, Boolean required/available flags, nullable control-character-free resolved path, nullable detected version, trusted nullable version requirement, allowed scalar version status, and non-empty control-character-free detection source. Schema version must be an actual integer equal to 1 before any numeric conversion. Semantic validation rejects strings, nulls, Booleans, objects, arrays, missing, duplicate, unknown, extended, nested, or script-valued records and inconsistent availability or version states before reporting. Malformed external structures return fixed violations without exposing unchecked names or values; only malformed trusted tool requirements are internal errors. Unavailable tools have neither path nor detected version. Detection is read-only and never runs a tool. Windows PowerShell requires 5.1; Node requires `>=24.18.0 <25`; unavailable execution-derived versions remain unknown. Project-local Supabase candidates and package metadata require a fully normalized path with no reparse point in any existing segment; a global CLI is ignored. Pester is enumerated without import or installation.

Local mode blocks DEV ref `tpieykhhawszlzsoflnl`, PROD ref `wplescvhlgctynkfwvrj`, matching Supabase/database hosts, remote database URLs, classical key-value connection strings with non-local `Host`, `Server`, `Data Source`, `Address`, `Addr`, or `Network Address`, forbidden project arguments, environment values, and known Supabase link files. Connection-metadata source IDs are case-sensitive, limited to `^[a-z0-9][a-z0-9._-]{0,63}$`, and never coerced or echoed when malformed. Reports identify only validated non-sensitive sources such as the environment-variable name. Missing link files and `localhost`, `127.0.0.1`, `::1`, or `[::1]` targets are accepted.

## Package boundaries

Package A provides entry, manifest/result contracts, strict schema validation, run identity/directory, registry foundation, and basic reporting. Package B adds only trusted Git/environment/security data contracts and validated snapshot writers. It does not execute native programs, emit synthetic repository snapshots, register complete checks, or implement processes, health, deployment, SelfTest, LocalVerify, or LocalFreeze. The general process manager belongs exclusively to package C, with complete check execution following in C/D. M000-R1 is not complete after package B.
