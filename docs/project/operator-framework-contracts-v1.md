# Operator framework contracts v1

The Plaerrdeifl Portal Operator framework version is `1.0.0`. Manifest schema 1 and result schema 1 are closed contracts; unknown properties are rejected.

## Stages, status, and exit codes

Local stages are `SelfTest`, `Preflight`, `LocalVerify`, and `LocalFreeze`. Package A accepts a valid manifest for these stages but returns `blocked`/`20`, because execution and checks arrive in later M000 packages. `DevDeploy`, `DevVerify`, `ProdPreflight`, `ProdDeploy`, and `ProdVerify` are actively blocked with `blocked`/`20`.

The status/exit-code pairs are: `passed`/`0`, `failed`/`10`, `blocked`/`20`, and `error`/`30` (invocation or manifest) or `error`/`40` (internal operator failure). M000-R1-A never produces a passed run.

## Manifest contract

The manifest identifies schema versions, operator version, module, revision, name, and one to four local stage definitions. Each stage contains one or more unique checks with only `checkId`, `targetId`, `timeoutProfile`, and `required`. Objects are closed. Executable content, commands, arbitrary arguments, URLs, SQL, credentials, secrets, custom timeouts, and success markers are not permitted. Input is strictly decoded as UTF-8, duplicate object properties and non-strict JSON are rejected, and the original bytes are SHA-256 hashed before parsing.

## Result contract and reporting

Result schema 1 records run identity, stage, status, exit code, UTC timestamps, duration, run directory, checks, messages, and cleanup; module, revision, and manifest hash are optional except for passed results. Schema validation is followed by semantic validation of status/exit-code pairing, timestamps, duration, passed-check states, and cleanup. Reports are UTF-8 without BOM and are replaced atomically from a temporary file in the same directory.

Success markers are centrally owned by reporting: `V4_M000_R1_SELFTEST_OK`, `V4_M000_R1_PREFLIGHT_OK`, `V4_M000_R1_LOCAL_OK`, and `V4_M000_R1_LOCAL_FROZEN`. A marker can appear only after schema and semantic validation and an atomic `result.json` write for `passed`/`0`; neither manifests nor checks can supply one.

## Timeouts and registry

The immutable timeout profiles are `short` = 15 seconds, `standard` = 60 seconds, and `long` = 300 seconds. The code-owned registry maps a unique `CheckId` + `TargetId` to non-empty local `AllowedStages` and a trusted-code `Handler`. Manifests cannot register or execute handlers. Registry reads return copies.

## Package-A boundary

Package A provides entry, contracts, strict schema validation, run identity/directory, registry foundation, and basic reporting. It contains no Git, path-policy, environment, tool, secret, process, health, deployment, SelfTest, LocalVerify, or LocalFreeze implementation and registers no checks. Contract evolution and later capabilities may be added only through approved M000 fix or follow-up packages.
