# Operator framework contracts v1

The Plaerrdeifl Portal Operator framework version is `1.0.0`. Manifest schema 1 and result schema 1 are closed contracts; unknown properties are rejected.

## Stages, status, and exit codes

Local stages are `SelfTest`, `Preflight`, `LocalVerify`, and `LocalFreeze`. Package C accepts a valid manifest for these stages but returns `blocked`/`20`, because complete check orchestration arrives in package D. `DevDeploy`, `DevVerify`, `ProdPreflight`, `ProdDeploy`, and `ProdVerify` are actively blocked with `blocked`/`20`.

The status/exit-code pairs are: `passed`/`0`, `failed`/`10`, `blocked`/`20`, and `error`/`30` (invocation or manifest) or `error`/`40` (internal operator failure). M000-R1-C never produces a passed overall operator run.

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

## Process target contract

The immutable package-C process registry contains exactly `npm.test`, `npm.check-frontend`, `npm.check-static`, `npm.build`, and the nine public `fixture.*` targets. Validation compares every field, ordered non-empty array, health definition and implementation mapping against the complete approved matrix without type coercion. NPM targets allow `LocalVerify`/`LocalFreeze`; fixture targets allow `SelfTest`; none allows `Preflight`. Manifests can select only an ID and allowed timeout profile and can never supply launch data.

Target syntax and ordinal registry lookup precede every side effect. Invalid and unknown IDs return a closed `process-rejection` object with `<redacted>`, null sequence, no PID, and skipped zero-count cleanup. They never create `processes`, logs, or `process.json`. Only registered targets enter regular process-attempt reporting.

NPM launch resolution accepts only an Application result for `node.exe`, rejects network/device/reparse paths, derives `node_modules/npm/bin/npm-cli.js` from that installation, and reads `package.json` through a strict UTF-8 stream limited to 1,048,576 bytes plus one detection byte. The fixed script property must exist as a real non-empty string. Fixture resolution accepts only the current Windows PowerShell 5.1 `powershell.exe`, the repository-owned fixture, and `-File`; no shell command or execution-policy override exists.

## Worker, Job Object, timeout, and health contracts

The manager starts a fixed worker behind a unique local named-event gate. It creates and configures a Windows Job Object with kill-on-close, assigns the worker, and only then signals the gate. The worker resolves the registry target again, starts it, and atomically writes the closed start control record. After target and stream completion it atomically writes a closed transient completion record; only that validated record supplies the target exit code, while the worker code remains an internal protocol signal. All descendants inherit job membership. Job cleanup, handle disposal, gate disposal, transient-record removal and stream completion are attempted independently in `finally`; only PIDs queried from the unique job are counted or terminated.

The fixed named mutex `Local\Plaerrdeifl-M000-RunLock-<RunId>` serializes all attempts, initialization and completion within one run, with a maximum wait of 330 seconds. It is acquired before sequence allocation and retained until reports are durable. An abandoned mutex requires a complete integrity audit before work continues. Every existing attempt sequence must be unique and gapless from 0001, use a registered target, contain exactly the three durable artifacts, have passed zero-remaining cleanup, and contain no transient or foreign entry.

Start timeout is registry-owned and runtime timeout is selected only from `short` = 15, `standard` = 60, or `long` = 300 seconds. Package C supports only the fixed `stdout-token` health check. A health token counts only while the target is still active in the job. A no-health target may finish before the manager's first membership query once its valid start record exists. Health failure and runtime timeout produce failed process attempts and immediate owned-job cleanup.

## Process log, redaction, and report contracts

stdout and stderr are drained concurrently into independent 5,242,880-character bounded buffers. Excess data is consumed without storage. After protection and normalization, the final text is bounded again so the complete fixed truncation marker remains inside the same character limit, and the effective truncation state is recorded. One protection pass removes ANSI and forbidden controls before redaction, then repeats the sensitive-value and reserved-marker scan after line bounding; control-split values cannot reappear. Run aggregation uses equally bounded `StringBuilder` buffers, counts headers and one complete marker, and still bounded-reads and validates every later log after storage is full. Invalid late data publishes no replacement run report.

Durable process artifacts are confined to the canonical, local and reparse-free `%LOCALAPPDATA%\Plaerrdeifl\PortalOperator\runs\<RunId>` tree. Process artifacts may exist only in exact `processes\<four-digit-sequence>-<registered-target>` children. Every existing path segment is inspected; UNC, device, network, junction, symlink and look-alike paths are rejected by both manager-side writers and the worker before launch.

`process.json` is closed and records sequence, registered target, status, nullable exit/PIDs, canonical timestamps, duration, timeout and health state, truncation flags, and nested cleanup counters. Passed and failed started targets require distinct PIDs, at least two observed owned processes, passed zero-remaining cleanup, and a real success or failure cause. Null-PID prestart results require all counters to be zero. Failed cleanup requires a positive remaining count and forces `blocked`; all counter sums are bounded by owned count in both process and run cleanup reports.

## Foreign-process protection and package C/D separation

Cleanup never uses a process-name search, WMI/CIM tree search, `taskkill`, or broad termination. Pre-existing PowerShell, Node, and NPM processes are never assigned to the unique job, included in its counters, or terminated. If job assignment fails after worker creation, only the known process handle is used for two bounded termination/verification attempts; a surviving worker is reported as remaining and blocks the attempt. Closing the job handle is the final kill-on-close safeguard for only its owned tree.

Package C supplies process mechanics and safe fixtures but does not invoke a process through `portal-operator.ps1`. That entry point initializes empty run logs and skipped cleanup, then retains blocked/error package behavior. Check orchestration, productive M000 checks, Pester acceptance, a successful SelfTest, LocalVerify, LocalFreeze, and freeze/deployment behavior belong to package D or later.

## Package boundaries

Package A provides entry, manifest/result contracts, strict schema validation, run identity/directory, registry foundation, and basic reporting. Package B adds trusted Git/environment/security data contracts and validated snapshot writers. Package C adds the general local process manager, safe fixtures, bounded logging, redaction, and owned-tree cleanup without adding check orchestration. Complete checks and successful operator stages follow only in package D. M000-R1 is not complete after package C.
